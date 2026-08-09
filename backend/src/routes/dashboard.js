import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, isAdmin } from '../middleware.js';
import { dateRangeFromKey, today, dateDaysAgo } from '../utils.js';
import { getSettings } from '../config.js';
import { computeUserKpi } from './kpi.js';

const router = Router();
router.use(requireAuth);

function series(days, key = 'day') {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push({
      day: key === 'month' ? d.toLocaleString('en', { month: 'short' }) : d.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      date: d.toISOString().slice(0, 10),
    });
  }
  return out;
}

function statusDist(scope) {
  const cfg = getSettings();
  const rows = db.prepare(`
    SELECT status, COUNT(*) c FROM tasks t WHERE ${scope} GROUP BY status
  `).all();
  const counts = {};
  for (const r of rows) counts[r.status] = r.c;
  return cfg.taskStatuses.map((s) => ({ status: s.id, name: s.name, color: s.color, count: counts[s.id] || 0 }));
}

function prioDist(scope) {
  const cfg = getSettings();
  const rows = db.prepare(`SELECT priority, COUNT(*) c FROM tasks t WHERE ${scope} GROUP BY priority`).all();
  const counts = {};
  for (const r of rows) counts[r.priority] = r.c;
  return cfg.priorities.map((p) => ({ priority: p.id, name: p.name, color: p.color, count: counts[p.id] || 0 }));
}

router.get('/', (req, res) => {
  const admin = isAdmin(req.user);
  const uid = req.user.id;
  const scope = admin ? '1=1' : `(t.created_by = ${uid} OR t.id IN (SELECT task_id FROM task_assignees WHERE user_id = ${uid}))`;
  const cfg = getSettings();
  const r = dateRangeFromKey(req.query.dateKey || '30d', req.query.dateKey === 'custom' ? { from: req.query.from, to: req.query.to } : null);

  const num = (sql) => db.prepare(`SELECT COUNT(*) c FROM tasks t WHERE ${scope} AND ${sql}`).get().c;

  const daily = series(14).map((d) => {
    const added = db.prepare(`SELECT COUNT(*) c FROM tasks t WHERE ${scope} AND date(t.created_at) = ?`).get(d.date).c;
    const done = db.prepare(`SELECT COUNT(*) c FROM tasks t WHERE ${scope} AND date(t.completed_at) = ?`).get(d.date).c;
    return { ...d, added, done };
  });

  const monthly = series(12, 'month').map((m) => {
    const added = db.prepare(`SELECT COUNT(*) c FROM tasks t WHERE ${scope} AND strftime('%Y-%m', t.created_at) = ?`).get(m.date.slice(0, 7)).c;
    const done = db.prepare(`SELECT COUNT(*) c FROM tasks t WHERE ${scope} AND strftime('%Y-%m', t.completed_at) = ?`).get(m.date.slice(0, 7)).c;
    return { ...m, added, done };
  });

  const completionTrend = series(14).map((d) => {
    const c = db.prepare(`SELECT COUNT(*) c FROM tasks t WHERE ${scope} AND date(t.completed_at) = ?`).get(d.date).c;
    return { ...d, completed: c };
  });

  const overdueTrend = series(14).map((d) => {
    const c = db.prepare(`
      SELECT COUNT(*) c FROM tasks t WHERE ${scope}
      AND t.due_date IS NOT NULL AND t.due_date <= ? AND t.due_date >= ?
      AND t.status NOT IN ('done','cancelled')`).get(d.date, dateDaysAgo(13)).c;
    return { ...d, overdue: c };
  });

  const teamPerf = db.prepare(`
    SELECT te.name AS name, te.id, COUNT(t.id) AS total,
      SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END) AS done
    FROM teams te LEFT JOIN tasks t ON t.team_id = te.id AND ${scope}
    GROUP BY te.id ORDER BY done DESC
  `).all();

  const deptPerf = db.prepare(`
    SELECT d.name AS name, d.id, COUNT(t.id) AS total,
      SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END) AS done
    FROM departments d LEFT JOIN tasks t ON t.department_id = d.id AND ${scope}
    GROUP BY d.id ORDER BY done DESC
  `).all();

  const userPerf = db.prepare(`
    SELECT u.id, u.name, u.avatar, COUNT(ta.task_id) AS assigned,
      SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END) AS done
    FROM task_assignees ta
    JOIN users u ON u.id = ta.user_id
    JOIN tasks t ON t.id = ta.task_id
    WHERE ${scope}
    GROUP BY u.id ORDER BY done DESC LIMIT 12
  `).all();

  const recentTasks = db.prepare(`
    SELECT t.*, u.name AS creator_name FROM tasks t
    LEFT JOIN users u ON u.id = t.created_by
    WHERE ${scope} ORDER BY t.updated_at DESC LIMIT 8
  `).all();

  const activities = db.prepare(`
    SELECT th.*, u.name AS user_name FROM task_history th
    JOIN tasks t ON t.id = th.task_id
    LEFT JOIN users u ON u.id = th.user_id
    WHERE ${scope} ORDER BY th.created_at DESC LIMIT 10
  `).all();

  const myNotifications = db.prepare(`
    SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 6
  `).all(uid);

  const summary = {
    total: num('1=1'),
    open: num(`status NOT IN ('done','cancelled')`),
    done: num(`status = 'done'`),
    cancelled: num(`status = 'cancelled'`),
    overdue: num(`due_date IS NOT NULL AND due_date < '${today()}' AND status NOT IN ('done','cancelled')`),
    pending: num(`status IN ('todo','discussion')`),
    inProgress: num(`status = 'in_progress'`),
    inReview: num(`status = 'in_review'`),
    dueToday: num(`due_date = '${today()}' AND status NOT IN ('done','cancelled')`),
    dueWeek: num(`due_date >= '${today()}' AND due_date <= date('${today()}', '+7 day') AND status NOT IN ('done','cancelled')`),
    blocked: num(`is_blocked = 1`),
    critical: num(`priority = 'critical' AND status NOT IN ('done','cancelled')`),
    doneToday: num(`status='done' AND date(completed_at) = '${today()}'`),
    activeUsers: admin ? db.prepare(`SELECT COUNT(*) c FROM users WHERE is_active=1`).get().c
      : db.prepare(`SELECT COUNT(DISTINCT user_id) c FROM task_assignees ta JOIN tasks t ON t.id=ta.task_id WHERE t.status NOT IN ('done','cancelled')`).get().c,
  };
  summary.completionRate = summary.total ? Math.round((summary.done / summary.total) * 100) : 0;
  const avgH = db.prepare(`
    SELECT ROUND(AVG((julianday(completed_at) - julianday(created_at)) * 24),1) v
    FROM tasks t WHERE status='done' AND completed_at IS NOT NULL AND ${scope}`).get().v;
  summary.avgCompletionHours = avgH || 0;
  const budget = db.prepare(`SELECT COALESCE(SUM(t.budget),0) total, COALESCE(SUM(t.estimated_hours),0) hours FROM tasks t WHERE ${scope}`).get();
  summary.budgetUtil = { budget: budget.total, hours: budget.hours };

  let kpi = null;
  if (admin) {
    const list = db.prepare(`
      SELECT u.id, u.name, u.avatar FROM users u WHERE u.is_active=1 ORDER BY u.name`).all()
      .map((u) => ({ ...computeUserKpi(u.id, r.start, r.end, cfg), ...u }))
      .sort((a, b) => b.score - a.score);
    kpi = list;
  } else {
    kpi = [computeUserKpi(uid, r.start, r.end, cfg)];
  }

  const calendar = db.prepare(`
    SELECT t.id, t.title, t.due_date, t.status, t.priority FROM tasks t
    WHERE ${scope} AND t.due_date IS NOT NULL AND t.status NOT IN ('done','cancelled')
    ORDER BY t.due_date LIMIT 200
  `).all();

  res.json({
    summary,
    daily,
    monthly,
    completionTrend,
    overdueTrend,
    teamPerf,
    deptPerf,
    userPerf,
    statusDist: statusDist(scope),
    prioDist: prioDist(scope),
    recentTasks,
    activities,
    notifications: myNotifications,
    kpi,
    calendar,
  });
});

export default router;
