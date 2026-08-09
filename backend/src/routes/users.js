import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { requireAuth, requireAdmin, requireRole, getPublicUser, audit, notify } from '../middleware.js';
import { initials } from '../utils.js';

const router = Router();
router.use(requireAuth);

function generateTempPassword() {
  return crypto.randomBytes(4).toString('hex') + 'A1!';
}

function userRow(u) {
  return { ...getPublicUser(u), initials: initials(u.name) };
}

function listUsers(req, res) {
  const rows = db.prepare(`
    SELECT u.*, t.name AS team_name, d.name AS department_name,
      (SELECT COUNT(*) FROM tasks t2 WHERE t2.created_by = u.id) AS tasks_created,
      (SELECT COUNT(*) FROM task_assignees ta JOIN tasks tk ON tk.id = ta.task_id
        WHERE ta.user_id = u.id AND tk.status != 'done' AND tk.status != 'cancelled') AS open_tasks,
      (SELECT COUNT(*) FROM task_assignees ta JOIN tasks tk ON tk.id = ta.task_id
        WHERE ta.user_id = u.id AND tk.status = 'done') AS completed_tasks
    FROM users u
    LEFT JOIN teams t ON t.id = u.team_id
    LEFT JOIN departments d ON d.id = u.department_id
    ORDER BY u.created_at DESC
  `).all();
  res.json(rows.map(userRow));
}

router.get('/', (req, res) => {
  const { q } = req.query;
  const role = req.user.role;
  if (role === 'user') {
    const rows = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.avatar, u.title, u.team_id, u.department_id,
        t.name AS team_name, d.name AS department_name
      FROM users u LEFT JOIN teams t ON t.id = u.team_id LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.id != ? AND u.is_active = 1 ORDER BY u.name
    `).all(req.user.id);
    return res.json(rows);
  }
  let sql = `SELECT u.*, t.name AS team_name, d.name AS department_name
    FROM users u LEFT JOIN teams t ON t.id = u.team_id LEFT JOIN departments d ON d.id = u.department_id`;
  const params = [];
  if (q) {
    sql += ` WHERE (u.name LIKE ? OR u.email LIKE ? OR u.role LIKE ?)`;
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  sql += ' ORDER BY u.created_at DESC';
  res.json(db.prepare(sql).all(...params).map(userRow));
});

router.get('/:id', (req, res) => {
  const u = db.prepare(`
    SELECT u.*, t.name AS team_name, d.name AS department_name
    FROM users u LEFT JOIN teams t ON t.id = u.team_id LEFT JOIN departments d ON d.id = u.department_id
    WHERE u.id = ?`).get(req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json(userRow(u));
});

router.post('/', requireAdmin, (req, res) => {
  const { name, email, password, role, title, team_id, department_id, phone } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  const newRole = role || 'user';
  if (!['user', 'admin', 'super_admin'].includes(newRole)) return res.status(400).json({ error: 'Invalid role' });
  if (newRole === 'super_admin' && req.user.role !== 'super_admin') return res.status(403).json({ error: 'Only a super admin can create super admin accounts' });
  const exists = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(email);
  if (exists) return res.status(400).json({ error: 'Email already in use' });
  const r = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, title, phone, team_id, department_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, email.trim(), bcrypt.hashSync(String(password), 10), newRole, title || '', phone || '', team_id || null, department_id || null);
  const id = Number(r.lastInsertRowid);
  audit(req, 'user.create', 'user', id, `Created user ${name} (${newRole})`);
  notify(id, 'system', 'Welcome to TaskFlow', `Your account was created by an administrator.`);
  res.json(userRow(db.prepare('SELECT * FROM users WHERE id = ?').get(id)));
});

router.put('/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  const { name, role, title, team_id, department_id, phone, is_active } = req.body || {};
  if (u.role === 'super_admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only a super admin can modify a super admin account' });
  }
  if (role !== undefined && !['user', 'admin', 'super_admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (role === 'super_admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only a super admin can grant the super admin role' });
  }
  if (id === req.user.id && role !== undefined && role !== u.role && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'You cannot change your own role' });
  }
  db.prepare(`
    UPDATE users SET name = COALESCE(?, name), role = COALESCE(?, role), title = COALESCE(?, title),
      phone = COALESCE(?, phone), team_id = ?, department_id = ?,
      is_active = ?, updated_at = datetime('now') WHERE id = ?
  `).run(name ?? null, role ?? null, title ?? null, phone ?? null, team_id || null, department_id || null, is_active === undefined ? u.is_active : (is_active ? 1 : 0), id);
  audit(req, 'user.update', 'user', id, `Updated user ${name || u.name} (${role || u.role})`);
  if (u.role === 'user' && role && role !== 'user' && is_active === 1) {
    notify(id, 'system', 'Role updated', `Your role was changed to ${role}.`);
  }
  res.json(userRow(db.prepare('SELECT * FROM users WHERE id = ?').get(id)));
});

router.delete('/:id', requireRole('super_admin'), (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' });
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  if (u.role === 'super_admin') {
    const superCount = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'super_admin'").get().c;
    if (superCount <= 1) return res.status(400).json({ error: 'Cannot delete the last super admin' });
  }
  try {
    db.exec('BEGIN');
    db.prepare('UPDATE tasks SET created_by = NULL WHERE created_by = ?').run(id);
    db.prepare('UPDATE tasks SET reviewer_id = NULL WHERE reviewer_id = ?').run(id);
    db.prepare('UPDATE approvals SET approver_id = NULL WHERE approver_id = ?').run(id);
    db.prepare('DELETE FROM approvals WHERE requester_id = ?').run(id);
    db.prepare('DELETE FROM task_comments WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM task_attachments WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM time_entries WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: 'Failed to delete user: ' + (e.message || e) });
  }
  audit(req, 'user.delete', 'user', id, `Deleted user ${u.name}`);
  res.json({ ok: true });
});

router.post('/:id/reset-password', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { newPassword } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  if (newPassword != null && typeof newPassword !== 'string') return res.status(400).json({ error: 'Password must be a string' });
  const pwd = newPassword && newPassword.length >= 6 ? newPassword : generateTempPassword();
  db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(bcrypt.hashSync(String(pwd), 10), id);
  audit(req, 'user.reset_password', 'user', id, `Reset password for ${u.name}`);
  notify(id, 'security', 'Password reset', 'An administrator reset your password.');
  res.json({ ok: true, temporaryPassword: pwd });
});

router.post('/:id/toggle-active', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  if (id === req.user.id) return res.status(400).json({ error: 'You cannot deactivate your own account' });
  const next = u.is_active ? 0 : 1;
  db.prepare('UPDATE users SET is_active = ?, updated_at = datetime(\'now\') WHERE id = ?').run(next, id);
  audit(req, 'user.toggle_active', 'user', id, `${next ? 'Activated' : 'Deactivated'} ${u.name}`);
  if (next) notify(id, 'system', 'Account activated', 'Your account has been activated.');
  res.json({ ok: true, is_active: !!next });
});

router.put('/me/profile', (req, res) => {
  const { name, title, phone, avatar } = req.body || {};
  db.prepare('UPDATE users SET name = COALESCE(?, name), title = COALESCE(?, title), phone = COALESCE(?, phone), avatar = COALESCE(?, avatar), updated_at = datetime(\'now\') WHERE id = ?')
    .run(name ?? null, title ?? null, phone ?? null, avatar ?? null, req.user.id);
  audit(req, 'user.profile_update', 'user', req.user.id, 'Updated own profile');
  res.json(getPublicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)));
});

export default router;
