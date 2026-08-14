import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { signToken, getPublicUser, requireAuth, audit } from '../middleware.js';

const router = Router();

const MAX_PASSWORD_LEN = 128;
const loginAttempts = new Map();
function checkRateLimit(key) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const max = 10;
  const rec = loginAttempts.get(key);
  if (!rec || now - rec.resetAt > windowMs) {
    loginAttempts.set(key, { count: 1, resetAt: now });
    return true;
  }
  rec.count += 1;
  if (rec.count > max) return false;
  return true;
}
setInterval(() => {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [k, v] of loginAttempts) if (v.resetAt < cutoff) loginAttempts.delete(k);
}, 5 * 60 * 1000).unref();

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (String(password).length > MAX_PASSWORD_LEN) {
    return res.status(400).json({ error: 'Password is too long' });
  }
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(`${ip}:${String(email).trim().toLowerCase()}`)) {
    return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(String(email).trim());
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });
  if (!bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (!user.is_active) return res.status(403).json({ error: 'Your account has been deactivated. Contact an administrator.' });
  db.prepare('UPDATE users SET last_login = datetime(\'now\',\'+6 hours\') WHERE id = ?').run(user.id);
  const token = signToken(user);
  req.user = user;
  audit(req, 'auth.login', 'user', user.id, 'User signed in');
  res.json({ token, user: getPublicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: getPublicUser(req.user) });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords are required' });
  if (typeof newPassword !== 'string' || String(newPassword).length > MAX_PASSWORD_LEN) {
    return res.status(400).json({ error: 'New password is too long' });
  }
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
