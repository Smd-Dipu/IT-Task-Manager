import type { Settings, StatusMeta, PriorityMeta, DifficultyMeta } from './types';

export function cx(...args: (string | false | null | undefined)[]) {
  return args.filter(Boolean).join(' ');
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function initials(name?: string): string {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

export const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308',
  '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#a855f7', '#f59e0b',
];

export function avatarColor(name?: string): string {
  let h = 0;
  const s = name || '?';
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function isOverdue(task: { due_date?: string | null; status?: string }): boolean {
  if (!task.due_date || !task.status) return false;
  if (task.status === 'done' || task.status === 'cancelled') return false;
  return task.due_date < new Date().toISOString().slice(0, 10);
}

export function isDueSoon(task: { due_date?: string | null; status?: string }, days = 1): boolean {
  if (!task.due_date || !task.status) return false;
  if (task.status === 'done' || task.status === 'cancelled') return false;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return task.due_date <= d.toISOString().slice(0, 10) && task.due_date >= new Date().toISOString().slice(0, 10);
}

export function statusById(settings: Settings | null, id?: string): StatusMeta {
  return settings?.taskStatuses.find((s) => s.id === id) || { id: id || 'todo', name: id || 'To Do', color: '#94a3b8' };
}

export function priorityById(settings: Settings | null, id?: string): PriorityMeta {
  return settings?.priorities.find((p) => p.id === id) || { id: id || 'medium', name: id || 'Medium', color: '#94a3b8', weight: 2 };
}

export function difficultyById(settings: Settings | null, id?: string): DifficultyMeta {
  return settings?.difficulties.find((d) => d.id === id) || { id: id || 'medium', name: id || 'Medium', points: 2 };
}

export const DATE_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: '90d', label: 'Last 90 Days' },
  { key: '180d', label: 'Last 180 Days' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
  { key: 'custom', label: 'Custom Range' },
];

export const TASK_TYPES = ['task', 'bug', 'feature', 'research', 'design', 'infra'];

export const FLAGS = [
  'Urgent', 'Client', 'Internal', 'Finance', 'Development', 'Infrastructure',
  'Security', 'Bug', 'Enhancement', 'Testing', 'Software', 'Network',
];

export function buildQuery(params: Record<string, string | string[] | number | boolean | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length) v.forEach((x) => x !== undefined && qs.append(k, String(x)));
    } else qs.append(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
