import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { db, UPLOAD_DIR } from '../db.js';
import { requireAuth, audit } from '../middleware.js';

const router = Router();
router.use(requireAuth);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

router.post('/task/:taskId', upload.array('files', 10), (req, res) => {
  const taskId = Number(req.params.taskId);
  const files = req.files || [];
  const saved = [];
  const stmt = db.prepare(`
    INSERT INTO task_attachments (task_id, user_id, filename, stored_name, size, mime)
    VALUES (?, ?, ?, ?, ?, ?)`);
  for (const f of files) {
    const r = stmt.run(taskId, req.user.id, f.originalname, f.filename, f.size, f.mimetype || '');
    saved.push(db.prepare('SELECT * FROM task_attachments WHERE id = ?').get(Number(r.lastInsertRowid)));
  }
  audit(req, 'task.upload', 'task', taskId, `Uploaded ${files.length} attachment(s)`);
  res.json(saved);
});

router.post('/avatar', upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = `/api/uploads/avatar/${req.file.filename}`;
  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(url, req.user.id);
  audit(req, 'user.avatar', 'user', req.user.id, 'Updated profile picture');
  res.json({ url });
});

router.get('/file/:storedName', (req, res) => {
  const name = req.params.storedName;
  if (name.includes('..') || name.includes('/') || name.includes('\\')) return res.status(400).json({ error: 'Invalid name' });
  const filePath = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  const row = db.prepare('SELECT * FROM task_attachments WHERE stored_name = ?').get(name);
  res.setHeader('Content-Type', row?.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(row?.filename || name)}"`);
  fs.createReadStream(filePath).pipe(res);
});

router.get('/avatar/:name', (req, res) => {
  const name = req.params.name;
  if (name.includes('..') || name.includes('/') || name.includes('\\')) return res.status(400).json({ error: 'Invalid name' });
  const filePath = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.setHeader('Content-Type', 'image/*');
  fs.createReadStream(filePath).pipe(res);
});

router.delete('/:attachmentId', (req, res) => {
  const a = db.prepare('SELECT * FROM task_attachments WHERE id = ?').get(req.params.attachmentId);
  if (!a) return res.status(404).json({ error: 'Attachment not found' });
  try { fs.unlinkSync(path.join(UPLOAD_DIR, a.stored_name)); } catch { /* noop */ }
  db.prepare('DELETE FROM task_attachments WHERE id = ?').run(a.id);
  audit(req, 'task.attachment_delete', 'task', a.task_id, `Deleted attachment ${a.filename}`);
  res.json({ ok: true });
});

export default router;
