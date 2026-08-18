/* ==========================================================================
   toast.js — brief, non-blocking confirmations.
   XP is shown as quiet metadata, never as the headline.
   ========================================================================== */

import { html, raw } from '../lib/dom.js';
import { icon } from '../lib/icons.js';

const ICONS = { ok: 'checkCircle', error: 'alertCircle', warn: 'alert', info: 'info' };
const LIFETIME = 4200;

function container() {
  let el = document.getElementById('toasts');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toasts';
    el.className = 'toasts';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  return el;
}

/**
 * @param {string} title short outcome, e.g. "Progress saved"
 * @param {{ message?: string, tone?: 'ok'|'error'|'warn'|'info', xp?: number, timeout?: number }} [opts]
 */
export function toast(title, opts = {}) {
  const tone = opts.tone || 'info';
  const el = document.createElement('div');
  el.className = `toast toast-${tone}`;
  el.innerHTML = String(html`
    ${icon(ICONS[tone] || 'info', { size: 16 })}
    <div class="grow">
      <div class="toast-title">${title}</div>
      ${opts.message ? html`<div class="toast-msg">${opts.message}</div>` : raw('')}
    </div>
    ${Number.isFinite(opts.xp) && opts.xp !== 0
      ? html`<span class="toast-xp">${opts.xp > 0 ? '+' : ''}${opts.xp} XP</span>`
      : raw('')}
  `);

  const host = container();
  host.appendChild(el);

  const remove = () => {
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 220);
  };
  const timer = setTimeout(remove, opts.timeout || LIFETIME);
  el.addEventListener('click', () => { clearTimeout(timer); remove(); });
  return remove;
}

export const toastOk = (title, opts = {}) => toast(title, { ...opts, tone: 'ok' });
export const toastWarn = (title, opts = {}) => toast(title, { ...opts, tone: 'warn' });

/**
 * Friendly failure messaging. Raw technical errors never reach the student;
 * they go to the console for whoever is debugging.
 */
export function toastError(title, error, opts = {}) {
  if (error) console.error('[StudySphere]', error);
  const offline = error && error.isOffline;
  return toast(title, {
    ...opts,
    tone: 'error',
    message: opts.message || (offline
      ? 'StudySphere could not be reached. Check your connection and try again.'
      : 'Nothing was changed. Please try again.'),
  });
}
