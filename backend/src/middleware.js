import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { db } from './db.js';
import { notify as notifierNotify } from './lib/notifier.js';

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) {
  console.warn('[security] JWT_SECRET is not set; using an ephemeral random secret. Sessions will be invalidated on restart. Set JWT_SECRET for production.');
}

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

export function getPublicUser(u) {
  return {
    id: u.id, name: u.name, email: u.email, role: u.role, title: u.title,
    phone: u.phone, avatar: u.avatar, team_id: u.team_id, department_id: u.department_id,
    is_active: !!u.is_active, last_login: u.last_login, created_at: u.created_at,
  };
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (!user.is_active) return res.status(403).json({ error: 'Account is deactivated' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function authUserFromToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
    if (!user || !user.is_active) return null;
    return user;
  } catch {
    return null;
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action' });
    }
    next();
  };
}

export const isAdmin = (user) => user.role === 'admin' || user.role === 'super_admin';

export function requireAdmin(req, res, next) {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin access required' });
  next();
}

export function audit(req, action, entityType = '', entityId = null, details = '') {
  try {
    db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user?.id ?? null,
      req.user?.name ?? 'system',
      action, entityType, entityId ?? null,
      typeof details === 'string' ? details.slice(0, 2000) : JSON.stringify(details).slice(0, 2000),
      req.ip || '',
    );
  } catch { /* audit must never break a request */ }
}

export function logHistory(taskId, userId, action, field = '', oldValue = '', newValue = '') {
  try {
    db.prepare(`
      INSERT INTO task_history (task_id, user_id, action, field, old_value, new_value)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(taskId, userId ?? null, action, field,
      typeof oldValue === 'string' ? oldValue.slice(0, 1000) : JSON.stringify(oldValue ?? '').slice(0, 1000),
      typeof newValue === 'string' ? newValue.slice(0, 1000) : JSON.stringify(newValue ?? '').slice(0, 1000));
  } catch { /* noop */ }
}

export function notify(userId, type, title, message, link = '') {
  notifierNotify(userId, type, title, message, link);
}
