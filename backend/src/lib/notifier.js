import { db } from '../db.js';

const clients = new Map();

export function subscribe(userId, res) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  const set = clients.get(userId);
  set.add(res);
  return () => {
    set.delete(res);
    if (set.size === 0) clients.delete(userId);
  };
}

export function broadcast(userId, event, data) {
  const set = clients.get(userId);
  if (!set || set.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try { res.write(payload); } catch { /* noop */ }
  }
}

export function unreadCount(userId) {
  try {
    return db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND read = 0').get(userId).c;
  } catch {
    return 0;
  }
}

export function notify(userId, type, title, message, link = '') {
  try {
    const r = db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)
    `).run(userId, type, title, message, link);
    const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(Number(r.lastInsertRowid));
    broadcast(userId, 'notification', { notification: row, unread: unreadCount(userId) });
  } catch { /* notify must never break a request */ }
}
