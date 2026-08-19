#!/usr/bin/env bash
#
# TaskFlow one-click launcher (Linux / macOS)
#
# Automates the deployment steps documented in DEPLOYMENT.md:
#   1. Verifies Node.js 22.5+ (required for node:sqlite); installs Node 22
#      automatically on Debian/Ubuntu when missing
#   2. Installs backend + frontend dependencies (npm)
#   3. Builds the frontend into frontend/dist
#   4. Creates backend/.env with a persistent JWT_SECRET
#      (generated once, kept stable across restarts)
#   5. Creates the SQLite data directory (DB created on first start)
#   6. Starts the production server on http://localhost:3001
#      (serves the built UI and the /api backend on one port)
#
# Usage:
#   ./start.sh                 use default port 3001
#   ./start.sh 8080            use a custom port
#   ./start.sh --rebuild       force dependency reinstall + frontend rebuild
#   ./start.sh --background    run the server in the background (logs to a file)
#   ./start.sh --systemd       (Linux) also install + enable a systemd service
#
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=3001
FORCE=0
BACKGROUND=0
SYSTEMD=0
STEP=0

for arg in "$@"; do
  case "$arg" in
    --rebuild|--force) FORCE=1 ;;
    --background|-d) BACKGROUND=1 ;;
    --systemd) SYSTEMD=1 ;;
    *)
      if [[ "$arg" =~ ^[0-9]+$ ]]; then PORT="$arg"; fi
      ;;
  esac
done

say()  { printf '\n  [%s] %s\n' "$1" "$2"; }
step() { STEP=$((STEP + 1)); printf '\n  [%d/6] %s\n' "$STEP" "$1"; }
info() { say "i" "$1"; }
ok()   { say "ok" "$1"; }
die()  { printf '\n  [ERROR] %s\n' "$1" >&2; exit 1; }

echo
echo "  ================================================"
echo "    TaskFlow  -  One-Click Setup & Start"
echo "    Port: $PORT"
echo "  ================================================"

# ---- 1. Node.js: detect, report version, install if missing ----
if ! command -v node >/dev/null 2>&1; then
  info "Node.js not found. Installing Node.js 22 LTS..."
  if command -v apt-get >/dev/null 2>&1; then
    if command -v curl >/dev/null 2>&1; then
      curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
      sudo apt-get install -y nodejs
    else
      die "curl is required to install Node.js. Install Node.js 22.5+ manually, then re-run."
    fi
  else
    die "Node.js not found. Install Node.js 22.5+ manually (https://nodejs.org/), then re-run."
  fi
fi

NODE_VERSION="$(node --version)"
if ! node -e "const [m,n]=process.versions.node.split('.').map(Number);process.exit(m<22||(m===22&&n<5)?1:0)"; then
  die "Node.js 22.5 or newer is required. Found $NODE_VERSION. Please upgrade from https://nodejs.org/ (22 LTS)."
fi
step "Node.js OK: $NODE_VERSION"

# ---- 2. Install backend dependencies ----
if [[ -d "$APP_DIR/backend/node_modules" && "$FORCE" != 1 ]]; then
  step "Backend dependencies already installed (skip; pass --rebuild to force)"
else
  step "Installing backend dependencies..."
  (cd "$APP_DIR/backend" && npm install --no-audit --no-fund)
fi

# ---- 3. Install frontend dependencies ----
if [[ -d "$APP_DIR/frontend/node_modules" && "$FORCE" != 1 ]]; then
  step "Frontend dependencies already installed (skip; pass --rebuild to force)"
else
  step "Installing frontend dependencies..."
  (cd "$APP_DIR/frontend" && npm install --no-audit --no-fund)
fi

# ---- 4. Build the frontend ----
if [[ -d "$APP_DIR/frontend/dist" && "$FORCE" != 1 ]]; then
  step "Frontend build already present (skip; pass --rebuild to force)"
else
  step "Building frontend..."
  (cd "$APP_DIR/frontend" && npm run build)
fi

# ---- 5. Ensure config + data directories ----
step "Ensuring configuration and data directories..."
mkdir -p "$APP_DIR/backend/data"

# backend/.env with a persistent JWT_SECRET is created automatically on first
# start by the backend (backend/src/env.js). No manual step needed.
info "Configuration: backend/.env (auto-managed, JWT secret generated once)"
info "Database:      backend/data/taskflow.db (auto-created on first start)"

# ---- Optional: install as a systemd service (Linux) ----
if [[ "$SYSTEMD" == 1 ]]; then
  if ! command -v systemctl >/dev/null 2>&1; then
    die "--systemd requested but systemd is not available on this machine."
  fi
  info "Installing TaskFlow as a systemd service..."
  SUDO=""
  if [[ "$(id -u)" -ne 0 ]]; then SUDO="sudo"; fi

  SECRET="$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")"
  $SUDO mkdir -p /etc/taskflow
  echo "JWT_SECRET=$SECRET" | $SUDO tee /etc/taskflow/taskflow.env >/dev/null
  echo "PORT=127.0.0.1:$PORT" | $SUDO tee -a /etc/taskflow/taskflow.env >/dev/null

  RUN_USER="$(id -un)"
  USER_LINE=""
  if [[ "$RUN_USER" != "root" ]]; then
    USER_LINE="User=$RUN_USER
Group=$RUN_USER"
  fi

  $SUDO tee /etc/systemd/system/taskflow.service >/dev/null <<EOF
[Unit]
Description=TaskFlow task management application
After=network.target

[Service]
Type=simple
$USER_LINE
WorkingDirectory=$APP_DIR
EnvironmentFile=/etc/taskflow/taskflow.env
ExecStart=/usr/bin/env node $APP_DIR/backend/src/index.js
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

  $SUDO systemctl daemon-reload
  $SUDO systemctl enable --now taskflow
  ok "TaskFlow service installed and started (systemctl status taskflow)"
  exit 0
fi

# ---- 6. Start the server ----
# Open the browser automatically (like start.bat) once the server responds.
# xdg-open requires a desktop session; on headless servers this is skipped.
open_browser() {
  local url="http://localhost:$1"
  local opener=""
  if command -v xdg-open >/dev/null 2>&1 && { [[ -n "${DISPLAY:-}" || -n "${WAYLAND_DISPLAY:-}" ]]; }; then
    opener="xdg-open"
  elif command -v open >/dev/null 2>&1; then
    opener="open"
  else
    return 0
  fi
  (
    for _ in $(seq 1 30); do
      if (exec 3<>/dev/tcp/127.0.0.1/"$1") 2>/dev/null; then
        exec 3>&- 3<&-
        "$opener" "$url" >/dev/null 2>&1 &
        break
      fi
      sleep 0.5
    done
  ) &
}

if [[ "$BACKGROUND" == 1 ]]; then
  LOG_DIR="$APP_DIR/backend/data"
  LOG="$LOG_DIR/taskflow.log"
  step "Starting TaskFlow in the background..."
  PORT="$PORT" nohup node "$APP_DIR/backend/src/index.js" >>"$LOG" 2>&1 &
  local_pid=$!
  sleep 1
  if ! kill -0 "$local_pid" 2>/dev/null; then
    die "Server failed to start. See the log: $LOG"
  fi
  echo
  echo "  TaskFlow started in the background (PID $local_pid)"
  echo "  Log: $LOG"
  echo "  URL: http://localhost:$PORT"
  echo "  Stop with: kill $local_pid"
  echo
  exit 0
fi

echo
step "Starting TaskFlow on http://localhost:$PORT"
echo "  Press Ctrl+C to stop the server."
echo
open_browser "$PORT"
cd "$APP_DIR"
PORT="$PORT" node backend/src/index.js
