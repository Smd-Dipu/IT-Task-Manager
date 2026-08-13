import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { db, DATA_DIR, UPLOAD_DIR, replaceDatabase } from '../db.js';
import { requireAuth, requireAdmin, audit } from '../middleware.js';
import { resetSettingsCache } from '../config.js';

const router = Router();
router.use(requireAuth, requireAdmin);

export const BACKUP_FORMAT = 'taskflow-backup';
export const BACKUP_VERSION = 1;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 256 * 1024 * 1024 },
});

function snapshotDb() {
  const tmp = path.join(DATA_DIR, `snapshot-${Date.now()}-${Math.round(Math.random() * 1e9)}.db`);
  try {
    db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
  } catch {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    fs.copyFileSync(path.join(DATA_DIR, 'taskflow.db'), tmp);
  }
  const buf = fs.readFileSync(tmp);
  try { fs.rmSync(tmp, { force: true }); } catch { /* noop */ }
  return buf;
}

function safeName(name) {
  return typeof name === 'string' && name && !name.includes('..') && !name.includes('/') && !name.includes('\\') && !name.includes('\0');
}

export function buildBackupManifest() {
  const dbBuf = snapshotDb();
  const attachments = db.prepare('SELECT stored_name, filename, mime, size FROM task_attachments').all()
    .filter((a) => safeName(a.stored_name))
    .map((a) => {
      const p = path.join(UPLOAD_DIR, a.stored_name);
      let data = '';
      try { data = fs.readFileSync(p).toString('base64'); } catch { data = ''; }
      return { stored_name: a.stored_name, filename: a.filename, mime: a.mime, size: a.size, data };
    })
    .filter((a) => a.data);

  const counts = {};
  for (const t of ['users', 'teams', 'departments', 'tasks', 'time_entries', 'task_assignees', 'task_comments', 'task_checklist', 'task_attachments', 'task_dependencies', 'approvals', 'notifications', 'audit_logs', 'holidays', 'saved_filters', 'task_history', 'settings']) {
    try { counts[t] = Number(db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c); } catch { counts[t] = 0; }
  }

  const content = { db: dbBuf.toString('base64'), attachments };
  const checksum = crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: 'taskflow',
    createdAt: new Date().toISOString(),
    counts,
    content,
    checksum,
  };
}

export function validateBackup(parsed) {
  const errors = [];
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return ['File is not a valid backup (not an object)'];
  if (parsed.format !== BACKUP_FORMAT) errors.push('Unrecognized backup file format');
  if (parsed.version !== BACKUP_VERSION) errors.push(`Unsupported backup version (${parsed.version}); expected ${BACKUP_VERSION}`);
  const content = parsed.content;
  if (!content || typeof content !== 'object' || typeof content.db !== 'string' || !content.db) errors.push('Backup is missing the database payload');
  if (!content || !content.attachments || !Array.isArray(content.attachments)) errors.push('Backup is missing the attachments payload');
  if (typeof parsed.checksum !== 'string') errors.push('Backup is missing an integrity checksum');
  return errors;
}

function validateDbSnapshot(buf) {
  const tmp = path.join(DATA_DIR, `validate-${Date.now()}-${Math.round(Math.random() * 1e9)}.db`);
  let handle;
  try {
    fs.writeFileSync(tmp, buf);
    handle = new DatabaseSync(tmp);
    handle.exec('PRAGMA foreign_keys = ON;');
    const tables = handle.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
    const required = ['users', 'tasks', 'settings', 'holidays', 'task_assignees'];
    const missing = required.filter((t) => !tables.includes(t));
    if (missing.length) return { ok: false, error: `Backup database is missing required tables: ${missing.join(', ')}` };
    const userCols = handle.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
    if (!userCols.includes('password_hash')) return { ok: false, error: 'Backup database has an incompatible users table' };
    return { ok: true, tables: tables.length, users: Number(handle.prepare('SELECT COUNT(*) AS c FROM users').get().c) };
  } catch (e) {
    return { ok: false, error: 'Backup database could not be read: ' + (e.message || e) };
  } finally {
    try { handle?.close(); } catch { /* noop */ }
    try { fs.rmSync(tmp, { force: true }); } catch { /* noop */ }
  }
}

function writeAttachments(attachments) {
  let restored = 0;
  for (const a of attachments || []) {
    if (!safeName(a.stored_name) || typeof a.data !== 'string' || !a.data) continue;
    const buf = Buffer.from(a.data, 'base64');
    if (!buf.length) continue;
    fs.writeFileSync(path.join(UPLOAD_DIR, a.stored_name), buf);
    restored++;
  }
  return restored;
}

router.get('/backup', (req, res) => {
  try {
    const manifest = buildBackupManifest();
    audit(req, 'backup.create', 'backup', null, `Generated full system backup (${(Buffer.byteLength(JSON.stringify(manifest)) / 1024).toFixed(0)} KB)`);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="taskflow-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.taskflow"`);
    res.send(JSON.stringify(manifest));
  } catch (e) {
    res.status(500).json({ error: 'Failed to generate backup: ' + (e.message || e) });
  }
});

router.post('/backup/restore', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No backup file uploaded' });
    if (req.body.confirm !== 'true' && req.body.confirm !== true) {
      return res.status(400).json({ error: 'Restore requires explicit confirmation. Please confirm before restoring.' });
    }

    let parsed;
    try {
      parsed = JSON.parse(req.file.buffer.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Backup file is not valid JSON' });
    }

    const errors = validateBackup(parsed);
    if (errors.length) return res.status(400).json({ error: `Invalid backup file: ${errors[0]}` });

    const expected = crypto.createHash('sha256').update(JSON.stringify(parsed.content)).digest('hex');
    if (expected !== parsed.checksum) {
      return res.status(400).json({ error: 'Backup integrity check failed. The file may be corrupted or tampered with.' });
    }

    const dbBuf = Buffer.from(parsed.content.db, 'base64');
    if (!dbBuf.length) return res.status(400).json({ error: 'Backup database payload is empty' });
    const check = validateDbSnapshot(dbBuf);
    if (!check.ok) return res.status(400).json({ error: 'Incompatible backup: ' + check.error });

    const preRestore = buildBackupManifest();
    const safetyName = `pre-restore-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.taskflow`;
    try { fs.writeFileSync(path.join(DATA_DIR, safetyName), JSON.stringify(preRestore)); } catch { /* noop */ }

    replaceDatabase(dbBuf);
    resetSettingsCache();
    const attachmentsRestored = writeAttachments(parsed.content.attachments);

    audit(req, 'backup.restore', 'backup', null,
      `Restored backup from ${parsed.createdAt || 'unknown'} (${check.users} users, ${check.tables} tables, ${attachmentsRestored} attachments)`);

    res.json({
      ok: true,
      message: `Backup restored successfully. ${check.users} users and ${check.tables} tables were restored.`,
      counts: parsed.counts,
      attachmentsRestored,
      safetyBackup: safetyName,
    });
  } catch (e) {
    res.status(500).json({ error: 'Restore failed: ' + (e.message || e) });
  }
});

export default router;
