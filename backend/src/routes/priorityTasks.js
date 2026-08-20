import { Router } from 'express';
import { Readable } from 'node:stream';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { db } from '../db.js';
import { requireAuth, requireAdmin, audit } from '../middleware.js';
import { getSetting } from '../config.js';

const router = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /\.(xlsx|csv)$/i.test(file.originalname || '')),
});

const pad = (n) => String(n).padStart(2, '0');

function matchUser(name) {
  const n = String(name || '').trim();
  if (!n) return null;
  return db.prepare(`
    SELECT id, name, avatar FROM users
    WHERE LOWER(name) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1
  `).get(n, n) || null;
}

function matchPriority(p) {
  const cfg = getSetting('priorities');
  const v = String(p || '').trim().toLowerCase();
  const hit = cfg.find((x) => x.id.toLowerCase() === v || x.name.toLowerCase() === v);
  return hit ? hit.id : null;
}

function matchStatus(s) {
  const cfg = getSetting('taskStatuses');
  const v = String(s || '').trim().toLowerCase();
  const hit = cfg.find((x) => x.id.toLowerCase() === v || x.name.toLowerCase() === v);
  return hit ? hit.id : null;
}

function parseDueDate(v) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) {
    return isNaN(v.getTime()) ? '' : `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }
  if (typeof v === 'number') {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${pad(m[1])}-${pad(m[2])}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function cellText(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object' && v.text !== undefined) return String(v.text);
  return String(v).trim();
}

const HEADER_MAP = {
  'work title': 'work_title',
  'title': 'work_title',
  'description': 'description',
  'priority': 'priority',
  'assignee': 'assignee',
  'status': 'status',
  'due date': 'due_date',
  'due_date': 'due_date',
  'deadline': 'due_date',
  'remarks': 'remarks',
  'remark': 'remarks',
  'notes': 'remarks',
  'note': 'remarks',
};

function itemJson(t) {
  const assignee = t.assignee_user_id
    ? db.prepare('SELECT id, name, avatar FROM users WHERE id = ?').get(t.assignee_user_id)
    : null;
  return {
    ...t,
    assignee_avatar: assignee?.avatar || '',
    priority_meta: getSetting('priorities').find((p) => p.id === t.priority) || null,
    status_meta: getSetting('taskStatuses').find((s) => s.id === t.status) || null,
  };
}

router.get('/', (req, res) => {
  const { priority, status, search } = req.query;
  const where = [];
  const params = [];
  if (priority) { where.push('pt.priority = ?'); params.push(priority); }
  if (status) { where.push('pt.status = ?'); params.push(status); }
  if (search) {
    where.push('(pt.work_title LIKE ? OR pt.description LIKE ? OR pt.assignee_name LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  const sql = `
    SELECT pt.*, u.name AS assignee_user_name, u.avatar AS assignee_avatar
    FROM priority_tasks pt
    LEFT JOIN users u ON u.id = pt.assignee_user_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY
      CASE pt.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      (pt.due_date IS NULL OR pt.due_date = ''), pt.due_date, pt.id DESC
  `;
  const rows = db.prepare(sql).all(...params);
  const cfg = getSetting('priorities');
  const statuses = getSetting('taskStatuses');
  res.json(rows.map((r) => ({
    ...r,
    priority_meta: cfg.find((p) => p.id === r.priority) || null,
    status_meta: statuses.find((s) => s.id === r.status) || null,
  })));
});

router.get('/template', requireAdmin, async (req, res) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Priority Tasks');
  const headers = ['Work Title', 'Description', 'Priority', 'Assignee', 'Status', 'Due Date', 'Remarks'];
  ws.addRow(headers);
  ws.getRow(1).font = { bold: true };
  ws.addRow(['Example: release checklist', 'Ship v1.2 release notes and changelog', 'High', 'Sarah Chen', 'In Progress', '2026-09-01', 'Needs review before launch']);
  ws.columns = headers.map((h) => ({ width: Math.max(18, h.length + 8) }));
  ws.getRow(1).eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } }; });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="priority-task-template.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});

router.post('/upload', requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Please upload an .xlsx or .csv file' });
  const mode = String(req.body.mode || 'append') === 'replace' ? 'replace' : 'append';
  const filename = req.file.originalname || '';
  let wb;
  try {
    wb = new ExcelJS.Workbook();
    if (/\.csv$/i.test(filename)) {
      await wb.csv.read(Readable.from([req.file.buffer]));
    } else {
      await wb.xlsx.load(req.file.buffer);
    }
  } catch (e) {
    return res.status(400).json({ error: 'Could not parse the file: ' + (e.message || e) });
  }
  const ws = wb.worksheets[0];
  if (!ws) return res.status(400).json({ error: 'The file does not contain any worksheet' });

  const rows = [];
  ws.eachRow({ includeEmpty: false }, (r, n) => { rows.push({ n, values: r.values }); });
  if (rows.length < 2) return res.status(400).json({ error: 'The file must contain a header row and at least one data row' });

  const header = rows[0].values;
  const cols = {};
  header.forEach((v, i) => {
    if (i === 0) return;
    const key = HEADER_MAP[String(v ?? '').trim().toLowerCase()];
    if (key) cols[key] = i;
  });
  if (!cols.work_title) return res.status(400).json({ error: 'The file must contain a "Work Title" column' });

  const priorities = getSetting('priorities');
  const statuses = getSetting('taskStatuses');
  const errors = [];
  const toInsert = [];
  const existing = new Set(
    mode === 'append'
      ? db.prepare('SELECT work_title FROM priority_tasks').all().map((r) => String(r.work_title).trim().toLowerCase())
      : [],
  );

  for (const row of rows.slice(1)) {
    const vals = row.values;
    const get = (key) => {
      const i = cols[key];
      return i === undefined ? '' : cellText(vals[i]);
    };
    const workTitle = get('work_title');
    if (!workTitle) { errors.push({ row: row.n, message: 'Missing Work Title' }); continue; }
    if (mode === 'append' && existing.has(String(workTitle).trim().toLowerCase())) {
      errors.push({ row: row.n, message: `Duplicate work title: ${workTitle}` }); continue;
    }
    const priority = matchPriority(get('priority'));
    if (!priority) { errors.push({ row: row.n, message: `Invalid priority: ${get('priority') || '(empty)'}` }); continue; }
    const assigneeName = String(get('assignee')).trim();
    const user = matchUser(assigneeName);
    const statusRaw = get('status');
    const status = matchStatus(statusRaw) || 'todo';
    const dueDate = parseDueDate(vals[cols.due_date]);
    const description = get('description');
    const remarks = get('remarks');
    toInsert.push({
      work_title: workTitle, description, priority,
      assignee_name: user?.name || assigneeName,
      assignee_user_id: user?.id || null,
      status, due_date: dueDate, remarks,
      created_by: req.user.id, updated_by: req.user.id,
    });
    if (mode === 'append') existing.add(String(workTitle).trim().toLowerCase());
  }

  const insert = db.prepare(`
    INSERT INTO priority_tasks
      (work_title, description, priority, assignee_name, assignee_user_id, status, due_date, remarks, created_by, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const run = () => {
    for (const t of toInsert) {
      insert.run(t.work_title, t.description, t.priority, t.assignee_name, t.assignee_user_id, t.status, t.due_date, t.remarks, t.created_by, t.updated_by);
    }
  };
  try {
    if (mode === 'replace') {
      db.exec('BEGIN');
      db.prepare('DELETE FROM priority_tasks').run();
      run();
      db.exec('COMMIT');
    } else {
      run();
    }
  } catch (e) {
    if (mode === 'replace') { try { db.exec('ROLLBACK'); } catch { /* noop */ } }
    return res.status(400).json({ error: 'Failed to save the import: ' + (e.message || e) });
  }

  audit(req, 'priority_task.upload', 'priority_task', null,
    `Uploaded ${toInsert.length} priority task(s) (mode: ${mode}, ${errors.length} skipped)`);
  res.json({
    imported: toInsert.length,
    skipped: errors.length,
    errors: errors.slice(0, 50),
    mode,
  });
});

router.post('/', requireAdmin, (req, res) => {
  const b = req.body || {};
  const workTitle = String(b.work_title || '').trim();
  if (!workTitle) return res.status(400).json({ error: 'Work Title is required' });
  const priority = matchPriority(b.priority) || 'medium';
  const assigneeName = String(b.assignee_name || '').trim();
  const user = matchUser(assigneeName);
  const r = db.prepare(`
    INSERT INTO priority_tasks
      (work_title, description, priority, assignee_name, assignee_user_id, status, due_date, remarks, created_by, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    workTitle, String(b.description || '').trim(), priority,
    user?.name || assigneeName, user?.id || null,
    matchStatus(b.status) || 'todo', parseDueDate(b.due_date), String(b.remarks || '').trim(),
    req.user.id, req.user.id,
  );
  const row = db.prepare('SELECT * FROM priority_tasks WHERE id = ?').get(Number(r.lastInsertRowid));
  audit(req, 'priority_task.create', 'priority_task', row.id, `Created priority task: ${workTitle}`);
  res.json(itemJson(row));
});

router.put('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM priority_tasks WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Priority task not found' });
  const b = req.body || {};
  const allowed = Object.keys(b).filter((k) => !['id', 'created_at', 'created_by'].includes(k));
  const isAdminUser = ['admin', 'super_admin'].includes(req.user.role);
  if (!isAdminUser && allowed.some((k) => k !== 'status')) {
    return res.status(403).json({ error: 'You may only update the status of a priority task' });
  }

  const workTitle = isAdminUser ? String(b.work_title ?? row.work_title).trim() : row.work_title;
  if (!workTitle) return res.status(400).json({ error: 'Work Title is required' });
  const priority = isAdminUser ? (matchPriority(b.priority) || row.priority) : row.priority;
  const status = matchStatus(b.status) || row.status;
  const assigneeName = isAdminUser ? String(b.assignee_name ?? row.assignee_name).trim() : row.assignee_name;
  const user = isAdminUser ? (matchUser(assigneeName) || null) : null;
  const dueDate = isAdminUser ? parseDueDate(b.due_date !== undefined ? b.due_date : row.due_date) : row.due_date;

  db.prepare(`
    UPDATE priority_tasks SET
      work_title = ?, description = ?, priority = ?, assignee_name = ?, assignee_user_id = ?,
      status = ?, due_date = ?, remarks = ?, updated_by = ?, updated_at = datetime('now','+6 hours')
    WHERE id = ?
  `).run(
    workTitle,
    isAdminUser ? String(b.description ?? row.description).trim() : row.description,
    priority,
    user?.name || assigneeName,
    user?.id || (isAdminUser ? null : row.assignee_user_id),
    status,
    dueDate,
    isAdminUser ? String(b.remarks ?? row.remarks).trim() : row.remarks,
    req.user.id,
    row.id,
  );
  const updated = db.prepare('SELECT * FROM priority_tasks WHERE id = ?').get(row.id);
  audit(req, 'priority_task.update', 'priority_task', updated.id, `Updated priority task: ${updated.work_title}`);
  res.json(itemJson(updated));
});

router.delete('/:id', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM priority_tasks WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Priority task not found' });
  db.prepare('DELETE FROM priority_tasks WHERE id = ?').run(row.id);
  audit(req, 'priority_task.delete', 'priority_task', row.id, `Deleted priority task: ${row.work_title}`);
  res.json({ ok: true });
});

export default router;
