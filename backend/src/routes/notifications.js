import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, authUserFromToken } from '../middleware.js';
import { subscribe, broadcast, unreadCount } from '../lib/notifier.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const { unreadOnly } = req.query;
  let sql = `SELECT n.*, u.name AS user_name FROM notifications n LEFT JOIN users u ON u.id = n.user_id
    WHERE n.user_id = ?`;
  if (unreadOnly === 'true') sql += ' AND n.read = 0';
  sql += ' ORDER BY n.created_at DESC LIMIT 100';
  res.json(db.prepare(sql).all(req.user.id));
});

router.get('/unread-count', requireAuth, (req, res) => {
  res.json({ count: unreadCount(req.user.id) });
});

router.get('/stream', (req, res) => {
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = authUserFromToken(req.query.token || bearer);
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');
  res.write(`event: connected\ndata: {"unread": ${unreadCount(user.id)}}\n\n`);

  const unsubscribe = subscribe(user.id, res);
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { /* noop */ }
  }, 25000);

  const cleanup = () => {
    clearInterval(heartbeat);
    unsubscribe();
  };
  req.on('close', cleanup);
  res.on('close', cleanup);
});

router.put('/:id/read', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  broadcast(req.user.id, 'sync', { unread: unreadCount(req.user.id) });
  res.json({ ok: true });
});

router.put('/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id);
  broadcast(req.user.id, 'sync', { unread: 0 });
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  broadcast(req.user.id, 'sync', { unread: unreadCount(req.user.id) });
  res.json({ ok: true });
});

export default router;
