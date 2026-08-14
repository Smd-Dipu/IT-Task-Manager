import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, '..', 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const DB_PATH = path.join(DATA_DIR, 'taskflow.db');
mkdirSync(UPLOAD_DIR, { recursive: true });

export let db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function openDatabase(filePath = DB_PATH) {
  const handle = new DatabaseSync(filePath);
  handle.exec('PRAGMA journal_mode = WAL;');
  handle.exec('PRAGMA foreign_keys = ON;');
  ensureSchema(handle);
  migrate(handle);
  return handle;
}

export function ensureSchema(handle = db) {
  const taskCols = handle.prepare('PRAGMA table_info(tasks)').all().map((c) => c.name);
  if (!taskCols.includes('is_self_task')) {
    handle.exec("ALTER TABLE tasks ADD COLUMN is_self_task INTEGER NOT NULL DEFAULT 0");
  }
}

const SCHEMA_VERSION = 1;

function recreateTableDhaka(handle, name) {
  const def = handle.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(name).sql;
  if (!def.includes("datetime('now')") && !def.includes("date('now')")) return;
  const newDef = def.replace(/datetime\('now'\)/g, "datetime('now','+6 hours')").replace(/date\('now'\)/g, "date('now','+6 hours')");
  const tmp = 'zz__' + name;
  handle.exec(newDef.replace(/^CREATE TABLE\s+[^\s(]+/, `CREATE TABLE ${tmp}`));
  handle.exec(`INSERT INTO ${tmp} SELECT * FROM ${name}`);
  handle.exec(`DROP TABLE ${name}`);
  handle.exec(`ALTER TABLE ${tmp} RENAME TO ${name}`);
}

export function migrate(handle = db) {
  const v = Number(handle.prepare('PRAGMA user_version').get().user_version) || 0;
  if (v >= SCHEMA_VERSION) return;
  handle.exec('PRAGMA foreign_keys = OFF;');
  handle.exec('BEGIN;');
  try {
    for (const t of ['users', 'teams', 'departments', 'tasks', 'task_assignees', 'task_comments', 'task_checklist', 'task_attachments', 'time_entries', 'approvals', 'notifications', 'audit_logs', 'settings', 'saved_filters', 'task_history']) {
      recreateTableDhaka(handle, t);
    }
    handle.exec(`
UPDATE users SET created_at = datetime(created_at, '+6 hours') WHERE created_at IS NOT NULL AND created_at != '';
UPDATE users SET updated_at = datetime(updated_at, '+6 hours') WHERE updated_at IS NOT NULL AND updated_at != '';
UPDATE users SET last_login = datetime(last_login, '+6 hours') WHERE last_login IS NOT NULL AND last_login != '';
UPDATE teams SET created_at = datetime(created_at, '+6 hours') WHERE created_at IS NOT NULL AND created_at != '';
UPDATE departments SET created_at = datetime(created_at, '+6 hours') WHERE created_at IS NOT NULL AND created_at != '';
UPDATE tasks SET created_at = datetime(created_at, '+6 hours') WHERE created_at IS NOT NULL AND created_at != '';
UPDATE tasks SET updated_at = datetime(updated_at, '+6 hours') WHERE updated_at IS NOT NULL AND updated_at != '';
UPDATE tasks SET completed_at = datetime(completed_at, '+6 hours') WHERE completed_at IS NOT NULL AND completed_at != '';
UPDATE task_assignees SET assigned_at = datetime(assigned_at, '+6 hours') WHERE assigned_at IS NOT NULL AND assigned_at != '';
UPDATE task_assignees SET completed_at = datetime(completed_at, '+6 hours') WHERE completed_at IS NOT NULL AND completed_at != '';
UPDATE task_comments SET created_at = datetime(created_at, '+6 hours') WHERE created_at IS NOT NULL AND created_at != '';
UPDATE task_checklist SET created_at = datetime(created_at, '+6 hours') WHERE created_at IS NOT NULL AND created_at != '';
UPDATE task_attachments SET uploaded_at = datetime(uploaded_at, '+6 hours') WHERE uploaded_at IS NOT NULL AND uploaded_at != '';
UPDATE time_entries SET created_at = datetime(created_at, '+6 hours') WHERE created_at IS NOT NULL AND created_at != '';
UPDATE time_entries SET date = date(date, '+6 hours') WHERE date IS NOT NULL AND date != '';
UPDATE approvals SET created_at = datetime(created_at, '+6 hours') WHERE created_at IS NOT NULL AND created_at != '';
UPDATE approvals SET updated_at = datetime(updated_at, '+6 hours') WHERE updated_at IS NOT NULL AND updated_at != '';
UPDATE notifications SET created_at = datetime(created_at, '+6 hours') WHERE created_at IS NOT NULL AND created_at != '';
UPDATE audit_logs SET created_at = datetime(created_at, '+6 hours') WHERE created_at IS NOT NULL AND created_at != '';
UPDATE settings SET updated_at = datetime(updated_at, '+6 hours') WHERE updated_at IS NOT NULL AND updated_at != '';
UPDATE saved_filters SET created_at = datetime(created_at, '+6 hours') WHERE created_at IS NOT NULL AND created_at != '';
UPDATE task_history SET created_at = datetime(created_at, '+6 hours') WHERE created_at IS NOT NULL AND created_at != '';
`);
    handle.exec('COMMIT;');
  } catch (e) {
    handle.exec('ROLLBACK;');
    handle.exec('PRAGMA foreign_keys = ON;');
    throw e;
  }
  handle.exec('PRAGMA foreign_keys = ON;');
  handle.exec(`PRAGMA user_version = ${SCHEMA_VERSION};`);
}

export function closeDatabase() {
  try { db.close(); } catch { /* already closed */ }
}

export function replaceDatabase(buffer) {
  closeDatabase();
  for (const suffix of ['-wal', '-shm']) {
    try { rmSync(DB_PATH + suffix, { force: true }); } catch { /* noop */ }
  }
  writeFileSync(DB_PATH, buffer);
  db = openDatabase(DB_PATH);
}

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  title TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','+6 hours')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','+6 hours'))
);

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  lead_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','+6 hours'))
);

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  head_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','+6 hours'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  difficulty TEXT NOT NULL DEFAULT 'medium',
  task_type TEXT DEFAULT 'task',
  flags TEXT DEFAULT '[]',
  tags TEXT DEFAULT '[]',
  budget REAL DEFAULT 0,
  estimated_hours REAL DEFAULT 0,
  due_date TEXT,
  start_date TEXT,
  created_by INTEGER REFERENCES users(id),
  reviewer_id INTEGER REFERENCES users(id),
  team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  parent_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  approval_status TEXT DEFAULT 'none',
  is_blocked INTEGER NOT NULL DEFAULT 0,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurring_rule TEXT DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0,
  is_self_task INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','+6 hours')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','+6 hours')),
  completed_at TEXT
);
`);
ensureSchema();
db.exec(`
CREATE TABLE IF NOT EXISTS task_assignees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'todo',
  assigned_at TEXT NOT NULL DEFAULT (datetime('now','+6 hours')),
  completed_at TEXT,
  UNIQUE(task_id, user_id)
);

CREATE TABLE IF NOT EXISTS task_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  mentions TEXT DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now','+6 hours'))
);

CREATE TABLE IF NOT EXISTS task_checklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now','+6 hours'))
);

CREATE TABLE IF NOT EXISTS task_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  filename TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  mime TEXT DEFAULT '',
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now','+6 hours'))
);

CREATE TABLE IF NOT EXISTS task_dependencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  UNIQUE(task_id, depends_on)
);

CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  hours REAL NOT NULL DEFAULT 0,
  note TEXT DEFAULT '',
  date TEXT NOT NULL DEFAULT (date('now','+6 hours')),
  created_at TEXT NOT NULL DEFAULT (datetime('now','+6 hours'))
);

CREATE TABLE IF NOT EXISTS approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  requester_id INTEGER NOT NULL REFERENCES users(id),
  approver_id INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  comment TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','+6 hours')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','+6 hours'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT DEFAULT '',
  link TEXT DEFAULT '',
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','+6 hours'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT DEFAULT '',
  action TEXT NOT NULL,
  entity_type TEXT DEFAULT '',
  entity_id INTEGER,
  details TEXT DEFAULT '',
  ip TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','+6 hours'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now','+6 hours'))
);

CREATE TABLE IF NOT EXISTS holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  UNIQUE(date)
);

CREATE TABLE IF NOT EXISTS saved_filters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now','+6 hours'))
);

CREATE TABLE IF NOT EXISTS task_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  field TEXT DEFAULT '',
  old_value TEXT DEFAULT '',
  new_value TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','+6 hours'))
);
`);
migrate();
