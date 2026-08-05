import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireAdmin, audit } from '../middleware.js';
import { getSettings, setSetting, resetSettingsCache } from '../config.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  res.json(getSettings());
});

router.get('/holidays', (req, res) => {
  res.json(db.prepare('SELECT * FROM holidays ORDER BY date').all());
});

router.post('/holidays', requireAdmin, (req, res) => {
  const { date, name } = req.body || {};
  if (!date) return res.status(400).json({ error: 'date required' });
  db.prepare('INSERT OR IGNORE INTO holidays (date, name) VALUES (?, ?)').run(date, name || '');
  audit(req, 'settings.holiday_add', 'settings', null, `Added holiday ${date}`);
  res.json({ ok: true });
});

router.delete('/holidays/:date', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM holidays WHERE date = ?').run(req.params.date);
  audit(req, 'settings.holiday_remove', 'settings', null, `Removed holiday ${req.params.date}`);
  res.json({ ok: true });
});

router.post('/saved-filters', (req, res) => {
  const { name, payload } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const r = db.prepare('INSERT INTO saved_filters (user_id, name, payload) VALUES (?, ?, ?)')
    .run(req.user.id, name, JSON.stringify(payload || {}));
  res.json({ ok: true, id: Number(r.lastInsertRowid) });
});

router.get('/saved-filters', (req, res) => {
  const rows = db.prepare('SELECT * FROM saved_filters WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(rows.map((r) => ({ ...r, payload: JSON.parse(r.payload || '{}') })));
});

router.delete('/saved-filters/:id', (req, res) => {
  db.prepare('DELETE FROM saved_filters WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

router.put('/', requireAdmin, (req, res) => {
  const allowed = ['taskStatuses', 'priorities', 'difficulties', 'kpi', 'workingDays', 'businessHours', 'notificationRules', 'security', 'dashboard'];
  const keys = Object.keys(req.body || {});
  for (const k of keys) {
    if (allowed.includes(k)) setSetting(k, req.body[k]);
  }
  audit(req, 'settings.update', 'settings', null, `Updated settings: ${keys.join(', ')}`);
  resetSettingsCache();
  res.json(getSettings());
});

export default router;
