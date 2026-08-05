import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const { unreadOnly } = req.query;
  let sql = `SELECT n.*, u.name AS user_name FROM notifications n LEFT JOIN users u ON u.id = n.user_id
    WHERE n.user_id = ?`;
  if (unreadOnly === 'true') sql += ' AND n.read = 0';
  sql += ' ORDER BY n.created_at DESC LIMIT 100';
  res.json(db.prepare(sql).all(req.user.id));
});

router.get('/unread-count', (req, res) => {
  res.json({ count: db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND read = 0').get(req.user.id).c });
});

router.put('/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

router.put('/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

export default router;
