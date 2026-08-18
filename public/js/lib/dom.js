/* ==========================================================================
   dom.js — escaping template helper + tiny DOM utilities
   All user-supplied strings are escaped by default; only html`` / raw()
   output is trusted. This is the app's only path to innerHTML.
   ========================================================================== */

class Raw {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape a value for safe interpolation into markup. */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** Mark a string as already-safe markup. */
export function raw(value) { return new Raw(value); }

function stringify(value) {
  if (value === null || value === undefined || value === false || value === true) return '';
  if (value instanceof Raw) return value.value;
  if (Array.isArray(value)) return value.map(stringify).join('');
  return esc(value);
}

/**
 * Tagged template that escapes interpolations.
 * Nested html`` results, raw() values and arrays of them pass through.
 */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += stringify(values[i]) + strings[i + 1];
  return new Raw(out);
}

/** Replace the contents of an element with rendered markup. */
export function render(target, node) {
  if (!target) return;
  target.innerHTML = stringify(node);
}

export const $  = (sel, scope = document) => scope.querySelector(sel);
export const $$ = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));

/** Percentage clamped to 0-100, safe for inline width styles. */
export function pct(value, total) {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

/** Build a class attribute value from strings/conditionals. */
export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}
