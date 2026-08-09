export function today() { return new Date().toISOString().slice(0, 10); }

export function now() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }

export function isoNow() { return new Date().toISOString(); }

export function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export function dateDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfYear() {
  const d = new Date();
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function dateRangeFromKey(key, custom = null) {
  const now = new Date();
  const end = new Date(now);
  let start;
  switch (key) {
    case 'today': start = new Date(now); break;
    case 'yesterday': start = new Date(now); start.setDate(start.getDate() - 1); end.setDate(end.getDate() - 1); break;
    case '7d': start = new Date(now); start.setDate(start.getDate() - 7); break;
    case '30d': start = new Date(now); start.setDate(start.getDate() - 30); break;
    case '90d': start = new Date(now); start.setDate(start.getDate() - 90); break;
    case '180d': start = new Date(now); start.setDate(start.getDate() - 180); break;
    case 'month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'year': start = new Date(now.getFullYear(), 0, 1); break;
    case 'custom':
      {
        const from = new Date(custom?.from);
        const to = custom?.to ? new Date(custom.to) : null;
        if (isNaN(from.getTime()) || (to && isNaN(to.getTime()))) {
          start = new Date(now); start.setDate(start.getDate() - 30);
        } else {
          start = from;
          if (to) end = new Date(to);
        }
        break;
      }
    default: start = new Date(now); start.setDate(start.getDate() - 30); break;
  }
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function prettyDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function timeAgo(iso) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return prettyDate(iso);
}

export function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

export function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}
