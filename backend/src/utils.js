export const BD_OFFSET_MS = 6 * 60 * 60 * 1000;

function bdVirtual(ms = Date.now()) {
  return new Date(ms + BD_OFFSET_MS);
}

export function bdNow() { return bdVirtual(); }

export function today() { return bdNow().toISOString().slice(0, 10); }

export function now() { return bdNow().toISOString().replace('T', ' ').slice(0, 19); }

export function isoNow() { return bdNow().toISOString(); }

export function daysAgoISO(n) {
  const d = bdNow();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

export function dateDaysAgo(n) {
  const d = bdNow();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export function addDays(dateStr, n) {
  const y = Number(dateStr.slice(0, 4));
  const mo = Number(dateStr.slice(5, 7));
  const d = Number(dateStr.slice(8, 10));
  return new Date(Date.UTC(y, mo - 1, d + n)).toISOString().slice(0, 10);
}

export function startOfMonth() {
  const b = bdNow();
  return new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), 1));
}

export function startOfYear() {
  const b = bdNow();
  return new Date(Date.UTC(b.getUTCFullYear(), 0, 1));
}

function fmtDT(d) { return d.toISOString().replace('T', ' ').slice(0, 19); }

export function dateRangeFromKey(key, custom = null) {
  const now = bdNow();
  let end = new Date(now);
  let start;
  switch (key) {
    case 'today': start = new Date(now); break;
    case 'yesterday': start = new Date(now); start.setUTCDate(start.getUTCDate() - 1); end.setUTCDate(end.getUTCDate() - 1); break;
    case '7d': start = new Date(now); start.setUTCDate(start.getUTCDate() - 7); break;
    case '30d': start = new Date(now); start.setUTCDate(start.getUTCDate() - 30); break;
    case '90d': start = new Date(now); start.setUTCDate(start.getUTCDate() - 90); break;
    case '180d': start = new Date(now); start.setUTCDate(start.getUTCDate() - 180); break;
    case 'month': start = new Date(now); start.setUTCDate(1); break;
    case 'year': start = new Date(now); start.setUTCMonth(0, 1); break;
    case 'custom':
      {
        const from = new Date(custom?.from);
        const to = custom?.to ? new Date(custom.to) : null;
        if (isNaN(from.getTime()) || (to && isNaN(to.getTime()))) {
          start = new Date(now); start.setUTCDate(start.getUTCDate() - 30);
        } else {
          start = from;
          if (to) end = new Date(to);
        }
        break;
      }
    default: start = new Date(now); start.setUTCDate(start.getUTCDate() - 30); break;
  }
  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(23, 59, 59, 999);
  return { start: fmtDT(start), end: fmtDT(end) };
}

export function prettyDate(iso) {
  if (!iso) return '—';
  const s = String(iso);
  if (s.length <= 10) {
    const d = new Date(s.length === 10 ? s + 'T00:00:00+06:00' : s);
    if (isNaN(d.getTime())) return s;
    return new Date(d.getTime()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function timeAgo(iso) {
  if (!iso) return '';
  const s = String(iso);
  const t = s.length <= 10 ? s + 'T00:00:00+06:00' : (s.includes('T') ? s : s.replace(' ', 'T'));
  const d = new Date(t);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (isNaN(diff)) return '';
  if (diff < 60) return 'just now';
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dd = Math.floor(h / 24);
  if (dd < 30) return `${dd}d ago`;
  return prettyDate(iso);
}

export function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

export function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}
