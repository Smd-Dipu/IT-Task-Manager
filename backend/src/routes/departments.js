import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireAdmin, audit } from '../middleware.js';

const router = Router();
router.use(requireAuth);

function deptRows() {
  return db.prepare(`
    SELECT d.*, u.name AS head_name,
      (SELECT COUNT(*) FROM users x WHERE x.department_id = d.id) AS member_count,
      (SELECT COUNT(*) FROM tasks x WHERE x.department_id = d.id) AS task_count,
      (SELECT COUNT(*) FROM tasks x WHERE x.department_id = d.id AND x.status = 'done') AS done_count
    FROM departments d LEFT JOIN users u ON u.id = d.head_id
    ORDER BY d.name
  `).all();
}

router.get('/', (req, res) => res.json(deptRows()));

router.post('/', requireAdmin, (req, res) => {
  const { name, description, head_id } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Department name is required' });
  const exists = db.prepare('SELECT id FROM departments WHERE lower(name) = lower(?)').get(name);
  if (exists) return res.status(400).json({ error: 'Department already exists' });
  const r = db.prepare('INSERT INTO departments (name, description, head_id) VALUES (?, ?, ?)')
    .run(name, description || '', head_id || null);
  audit(req, 'department.create', 'department', Number(r.lastInsertRowid), `Created department ${name}`);
  res.json({ ok: true, id: Number(r.lastInsertRowid) });
});

router.put('/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const d = db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
  if (!d) return res.status(404).json({ error: 'Department not found' });
  const { name, description, head_id } = req.body || {};
  db.prepare('UPDATE departments SET name = COALESCE(?, name), description = COALESCE(?, description), head_id = ? WHERE id = ?')
    .run(name ?? null, description ?? null, head_id || null, id);
  audit(req, 'department.update', 'department', id, `Updated department ${name || d.name}`);
  res.json({ ok: true });
});

router.delete('/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const d = db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
  if (!d) return res.status(404).json({ error: 'Department not found' });
  db.prepare('DELETE FROM departments WHERE id = ?').run(id);
  audit(req, 'department.delete', 'department', id, `Deleted department ${d.name}`);
  res.json({ ok: true });
});

export default router;
