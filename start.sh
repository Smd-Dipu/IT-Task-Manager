#!/bin/bash
# Start the full TaskFlow stack (backend + frontend dev servers)

# Start backend server in background
cd /workspace/backend && npm run dev &
BACKEND_PID=$!

# Start frontend server (this is the exposed port)
cd /workspace/frontend && npm run dev

# Cleanup on exit
trap "kill $BACKEND_PID" EXIT
