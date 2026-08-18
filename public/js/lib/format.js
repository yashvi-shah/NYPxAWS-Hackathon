/* ==========================================================================
   format.js — dates, durations and small language helpers
   Deadlines from the API are date-only strings ("2026-08-19"); they are
   parsed as local dates so "days left" never shifts by a timezone.
   ========================================================================== */

const DAY_MS = 86400000;
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

/** Parse an API date value into a local Date at midnight (date-only) or exact time. */
export function toDate(value) {
  if (value instanceof Date) return value;
  if (!value) return null;
  const s = String(value);
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (dateOnly) return new Date(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3]);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Local midnight for a date. */
export function startOfDay(d = new Date()) {
  const x = toDate(d) || new Date();
  return new Date(x.getFullYear(), x.getMonth(), x.getDate());
}

/** "YYYY-MM-DD" in local time — the key used to match API deadlines. */
export function dayKey(d) {
  const x = startOfDay(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

export function addDays(d, n) {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Whole days from today to a date (0 = today, negative = past). */
export function daysUntil(value) {
  const target = toDate(value);
  if (!target) return null;
  return Math.round((startOfDay(target) - startOfDay(new Date())) / DAY_MS);
}

export const weekdayShort = (d) => WEEKDAY[startOfDay(d).getDay()];
export const weekdayLong  = (d) => WEEKDAY_LONG[startOfDay(d).getDay()];
export const monthLong    = (m) => MONTH_LONG[m];

/** "19 Aug" / "19 Aug 2027" when the year differs from now. */
export function formatDate(value, opts = {}) {
  const d = toDate(value);
  if (!d) return '—';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const base = `${d.getDate()} ${MONTH[d.getMonth()]}`;
  return sameYear && !opts.year ? base : `${base} ${d.getFullYear()}`;
}

/** "Wed 19 Aug" */
export function formatDayDate(value) {
  const d = toDate(value);
  if (!d) return '—';
  return `${WEEKDAY[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]}`;
}

/** Plain-language deadline distance. No emoji, no exclamation marks. */
export function dueLabel(value) {
  const n = daysUntil(value);
  if (n === null) return 'No deadline';
  if (n < -1) return `${Math.abs(n)} days overdue`;
  if (n === -1) return 'Overdue by a day';
  if (n === 0) return 'Due today';
  if (n === 1) return 'Due tomorrow';
  if (n <= 6) return `Due in ${n} days`;
  if (n <= 13) return 'Due next week';
  return `Due in ${Math.round(n / 7)} weeks`;
}

/** Short form for dense rows: "2d left", "Today", "3d late". */
export function dueShort(value) {
  const n = daysUntil(value);
  if (n === null) return '—';
  if (n < 0) return `${Math.abs(n)}d late`;
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  return `${n}d left`;
}

/** Hours as "3h 45m" / "45m" / "0h". */
export function hours(value) {
  const total = Math.round((Number(value) || 0) * 60);
  if (total <= 0) return '0h';
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Minutes as "1h 30m". */
export const minutes = (m) => hours((Number(m) || 0) / 60);

/** Clock time from minutes-since-midnight: "19:45". */
export function clock(minutesFromMidnight) {
  const total = Math.max(0, Math.round(minutesFromMidnight)) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function timeAgo(value) {
  const d = toDate(value);
  if (!d) return '';
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 604800) return `${Math.floor(secs / 86400)}d ago`;
  return formatDate(d);
}

export function plural(n, word, suffix = 's') {
  return `${n} ${word}${n === 1 ? '' : suffix}`;
}

/** Module codes arrive as "EE4301 - IoT Systems"; split for tighter display. */
export function moduleParts(module) {
  const s = String(module || '').trim();
  const m = /^([A-Za-z]{2,4}\s?\d{3,4})\s*[-–—:]\s*(.+)$/.exec(s);
  if (m) return { code: m[1].replace(/\s+/g, ''), name: m[2] };
  return { code: s, name: '' };
}

export const moduleCode = (module) => moduleParts(module).code || '—';

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'there';
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Turn a list of strings into "a, b and c". */
export function joinList(items) {
  const list = items.filter(Boolean);
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}
