import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { signToken, getPublicUser, requireAuth } from '../middleware.js';
import { audit } from '../middleware.js';

const router = Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  const user = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(String(email).trim());
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });
  if (!bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (!user.is_active) return res.status(403).json({ error: 'Your account has been deactivated. Contact an administrator.' });
  db.prepare('UPDATE users SET last_login = datetime(\'now\') WHERE id = ?').run(user.id);
  const token = signToken(user);
  audit(req, 'auth.login', 'user', user.id, 'User signed in');
  res.json({ token, user: getPublicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: getPublicUser(req.user) });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords are required' });
  if (String(newPassword).length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  if (!bcrypt.compareSync(String(currentPassword), req.user.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(bcrypt.hashSync(String(newPassword), 10), req.user.id);
  audit(req, 'auth.change_password', 'user', req.user.id, 'Password changed');
  res.json({ ok: true });
});

export default router;
