import { Router } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { db } from '../db.js';
import { requireAuth, requireAdmin, isAdmin } from '../middleware.js';
import { dateRangeFromKey } from '../utils.js';
import { getSettings } from '../config.js';
import { computeUserKpi } from './kpi.js';

const router = Router();
router.use(requireAuth);

function taskRowsForReport(user, q) {
  const admin = isAdmin(user);
  const where = [];
  const params = [];
  if (!admin) where.push('(t.created_by = ? OR t.id IN (SELECT task_id FROM task_assignees WHERE user_id = ?))'), params.push(user.id, user.id);
  if (q.status) { const l = Array.isArray(q.status) ? q.status : [q.status]; if (l.length && !l.includes('all')) where.push(`t.status IN (${l.map(() => '?').join(',')})`), params.push(...l); }
  if (q.priority) { const l = Array.isArray(q.priority) ? q.priority : [q.priority]; if (l.length && !l.includes('all')) where.push(`t.priority IN (${l.map(() => '?').join(',')})`), params.push(...l); }
  if (q.team_id) { const l = Array.isArray(q.team_id) ? q.team_id : [q.team_id]; if (l.length && !l.includes('all')) where.push(`t.team_id IN (${l.map(() => '?').join(',')})`), params.push(...l); }
  if (q.department_id) { const l = Array.isArray(q.department_id) ? q.department_id : [q.department_id]; if (l.length && !l.includes('all')) where.push(`t.department_id IN (${l.map(() => '?').join(',')})`), params.push(...l); }
  if (q.dateKey) { const r = dateRangeFromKey(q.dateKey); where.push('t.created_at >= ? AND t.created_at <= ?'); params.push(r.start, r.end); }
  const rows = db.prepare(`
    SELECT t.id, t.title, t.status, t.priority, t.difficulty, t.task_type, t.budget, t.estimated_hours,
      t.due_date, t.progress, t.created_at, t.updated_at, t.completed_at,
      c.name AS created_by_name, r.name AS reviewer_name, te.name AS team_name, d.name AS department_name
    FROM tasks t
    LEFT JOIN users c ON c.id = t.created_by
    LEFT JOIN users r ON r.id = t.reviewer_id
    LEFT JOIN teams te ON te.id = t.team_id
    LEFT JOIN departments d ON d.id = t.department_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY t.created_at DESC
  `).all(...params);
  return rows;
}

router.get('/tasks', (req, res) => {
  res.json(taskRowsForReport(req.user, req.query));
});

router.get('/analytics', (req, res) => {
  const cfg = getSettings();
  const admin = isAdmin(req.user);
  const uid = req.user.id;
  const scope = admin ? '1=1' : `(created_by = ${uid} OR id IN (SELECT task_id FROM task_assignees WHERE user_id = ${uid}))`;
  const r = dateRangeFromKey(req.query.dateKey || '30d');

  const rows = db.prepare(`
    SELECT status, COUNT(*) c, AVG(progress) avg_progress FROM tasks WHERE ${scope}
    GROUP BY status`).all();
  const byPrio = db.prepare(`SELECT priority, COUNT(*) c FROM tasks WHERE ${scope} GROUP BY priority`).all();
  const byType = db.prepare(`SELECT task_type, COUNT(*) c FROM tasks WHERE ${scope} GROUP BY task_type`).all();

  const monthly = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const m = d.toISOString().slice(0, 7);
    monthly.push({
      month: d.toLocaleString('en', { month: 'short' }),
      added: db.prepare(`SELECT COUNT(*) c FROM tasks WHERE ${scope} AND strftime('%Y-%m', created_at) = ?`).get(m).c,
      done: db.prepare(`SELECT COUNT(*) c FROM tasks WHERE ${scope} AND strftime('%Y-%m', completed_at) = ?`).get(m).c,
    });
  }

  const workload = db.prepare(`
    SELECT u.id, u.name, COUNT(ta.task_id) AS open_count
    FROM users u LEFT JOIN task_assignees ta ON ta.user_id = u.id
    LEFT JOIN tasks t ON t.id = ta.task_id AND t.status NOT IN ('done','cancelled')
    GROUP BY u.id ORDER BY open_count DESC LIMIT 15
  `).all();

  res.json({ status: rows, priority: byPrio, type: byType, monthly, workload });
});

router.get('/activity', (req, res) => {
  const admin = isAdmin(req.user);
  const r = dateRangeFromKey(req.query.dateKey || '30d');
  let sql = `
    SELECT a.*, u.name AS user_name FROM audit_logs a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE a.created_at >= ? AND a.created_at <= ?
  `;
  const params = [r.start, r.end];
  if (!admin) {
    sql += ' AND a.user_id = ?';
    params.push(req.user.id);
  }
  sql += ' ORDER BY a.created_at DESC LIMIT 1000';
  res.json(db.prepare(sql).all(...params));
});

router.get('/kpi', (req, res) => {
  const admin = isAdmin(req.user);
  const cfg = getSettings();
  const r = dateRangeFromKey(req.query.dateKey || 'month');
  const where = admin ? '1=1' : 'u.id = ?';
  const params = admin ? [] : [req.user.id];
  const list = db.prepare(`
    SELECT u.id, u.name, u.role, u.avatar, t.name AS team_name, d.name AS department_name
    FROM users u LEFT JOIN teams t ON t.id = u.team_id LEFT JOIN departments d ON d.id = u.department_id
    WHERE ${where} AND u.is_active=1 ORDER BY u.name`).all(...params)
    .map((u) => ({ ...computeUserKpi(u.id, r.start, r.end, cfg), ...u }));
  res.json(list);
});

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

router.get('/export', (req, res) => {
  const { type = 'tasks', format = 'csv' } = req.query;
  let base = [];
  if (type === 'tasks') {
    base = taskRowsForReport(req.user, req.query).map((t) => ({
      ID: t.id, Title: t.title, Status: t.status, Priority: t.priority, Difficulty: t.difficulty,
      Type: t.task_type, Budget: t.budget, 'Est. Hours': t.estimated_hours, 'Due Date': t.due_date || '',
      Progress: `${t.progress}%`, 'Created By': t.created_by_name, Reviewer: t.reviewer_name,
      Team: t.team_name, Department: t.department_name, Created: t.created_at, Completed: t.completed_at || '',
    }));
  } else if (type === 'kpi') {
    const cfg = getSettings();
    const r = dateRangeFromKey(req.query.dateKey || 'month');
    const isAdminUser = isAdmin(req.user);
    const where = isAdminUser ? '1=1' : 'u.id = ?';
    const params = isAdminUser ? [] : [req.user.id];
    base = db.prepare(`
      SELECT u.id, u.name, u.role, t.name AS team_name, d.name AS department_name
      FROM users u LEFT JOIN teams t ON t.id = u.team_id LEFT JOIN departments d ON d.id = u.department_id
      WHERE ${where} AND u.is_active=1 ORDER BY u.name`).all(...params)
      .map((u) => ({ ...computeUserKpi(u.id, r.start, r.end, cfg), ...u }))
      .map((k) => ({
        User: k.name, Role: k.role, Team: k.team_name || '', Department: k.department_name || '',
        Completed: k.completed, 'On-Time': k.onTime, Late: k.late, Overdue: k.overdueCount,
        'Completion Rate': `${k.completionRate}%`, 'Avg Hours': k.avgCompletionHours,
        Points: k.points, Bonus: k.bonus, Penalty: k.penalty, Rating: k.rating, 'Final Score': k.score,
      }));
  } else if (type === 'activity') {
    const r = dateRangeFromKey(req.query.dateKey || '30d');
    const isAdminUser = isAdmin(req.user);
    let sql = `SELECT a.*, u.name AS user_name FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
      WHERE a.created_at >= ? AND a.created_at <= ?`;
    const params = [r.start, r.end];
    if (!isAdminUser) { sql += ' AND a.user_id = ?'; params.push(req.user.id); }
    sql += ' ORDER BY a.created_at DESC LIMIT 2000';
    base = db.prepare(sql).all(...params).map((a) => ({
      Timestamp: a.created_at, User: a.user_name || 'System', Action: a.action,
      Entity: a.entity_type, 'Entity ID': a.entity_id ?? '', Details: a.details || '', IP: a.ip || '',
    }));
  }
  const filename = `${type}-${Date.now()}.${format}`;

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const headers = Object.keys(base[0] || {});
    res.write('\uFEFF' + headers.join(',') + '\n');
    for (const row of base) {
      res.write(headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',') + '\n');
    }
    return res.end();
  }

  if (format === 'xlsx') {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(type);
    const headers = Object.keys(base[0] || {});
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true };
    for (const row of base) ws.addRow(headers.map((h) => row[h] ?? ''));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return wb.xlsx.write(res).then(() => res.end());
  }

  if (format === 'pdf') {
    const doc = new PDFDocument({ margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);
    doc.fontSize(18).text('TaskFlow Export', { align: 'center' });
    doc.moveDown();
    doc.fontSize(11).text(`Report: ${type} | Generated: ${new Date().toLocaleString()}`);
    doc.moveDown();
    const headers = Object.keys(base[0] || {});
    const colW = (doc.page.width - 80) / Math.max(headers.length, 1);
    const drawRow = (values, header) => {
      const y = doc.y;
      let maxH = 0;
      values.forEach((v, i) => {
        doc.font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(7);
        const text = String(v ?? '').slice(0, 60);
        doc.text(text, 40 + i * colW, y, { width: colW - 6 });
        maxH = Math.max(maxH, doc.heightOfString(text, { width: colW - 6 }));
      });
      doc.moveDown();
      if (doc.y > doc.page.height - 80) doc.addPage();
      return maxH;
    };
    drawRow(headers, true);
    doc.moveDown(-0.4);
    for (const row of base.slice(0, 400)) {
      drawRow(headers.map((h) => row[h]), false);
    }
    doc.end();
    return;
  }
  res.status(400).json({ error: 'Unsupported format' });
});

export default router;
