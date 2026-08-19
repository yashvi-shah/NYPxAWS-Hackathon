/* ==========================================================================
   overlay.js — modals, the detail drawer and confirmations.
   One overlay at a time, focus returned to wherever it came from, Escape and
   scrim both close, Tab stays inside.
   ========================================================================== */

import { html, raw, render } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { setLayer, clearLayer } from '../core/actions.js';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let root = null;
let lastFocused = null;
let onCloseHook = null;

function host() {
  if (!root) root = document.getElementById('overlay-root');
  return root;
}

export function isOpen() {
  const el = host();
  return Boolean(el && el.childElementCount);
}

export function closeOverlay({ silent = false } = {}) {
  const el = host();
  if (!el || !el.childElementCount) return;
  render(el, raw(''));
  clearLayer('overlay');
  document.body.style.removeProperty('overflow');
  const hook = onCloseHook;
  onCloseHook = null;
  if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
  lastFocused = null;
  if (hook && !silent) hook();
}

function mount(markup, { actions, onMount, onClose, initialFocus } = {}) {
  const el = host();
  if (!el) return;
  lastFocused = document.activeElement;
  onCloseHook = onClose || null;
  setLayer('overlay', { closeOverlay: () => closeOverlay(), ...(actions || {}) });
  render(el, markup);
  document.body.style.overflow = 'hidden';

  // Track where mousedown originated to prevent scrim-close when interacting
  // with native controls (select dropdowns, date pickers) that render outside the modal.
  const overlay = el.querySelector('.overlay');
  if (overlay) {
    let mouseDownTarget = null;
    overlay.addEventListener('mousedown', (e) => { mouseDownTarget = e.target; });
    overlay.addEventListener('click', (e) => {
      // Only close if BOTH mousedown AND click landed on the scrim itself
      if (e.target === overlay && mouseDownTarget === overlay) {
        closeOverlay();
      }
      mouseDownTarget = null;
    });
  }

  const panel = el.querySelector('.modal, .drawer');
  if (panel) {
    const target = (initialFocus && panel.querySelector(initialFocus))
      || panel.querySelector('input:not([type="hidden"]), textarea, select')
      || panel.querySelector('[data-autofocus]')
      || panel.querySelector(FOCUSABLE);
    if (target) target.focus({ preventScroll: true });
  }
  if (onMount) onMount(el);
}

/** Escape + focus trap for whichever overlay is open. */
document.addEventListener('keydown', (event) => {
  if (!isOpen()) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeOverlay();
    return;
  }
  if (event.key !== 'Tab') return;
  const panel = host().querySelector('.modal, .drawer');
  if (!panel) return;
  const items = Array.from(panel.querySelectorAll(FOCUSABLE)).filter((n) => n.offsetParent !== null);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

const closeButton = html`
  <button class="icon-btn" data-act="closeOverlay" aria-label="Close">${icon('close', { size: 16 })}</button>
`;

/**
 * Modal dialog. `body` and `foot` take html`` fragments.
 */
export function openModal({ title, description, body, foot, wide = false, actions, onMount, onClose, initialFocus }) {
  mount(html`
    <div class="overlay" role="presentation">
      <div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-label="${title}">
        <div class="modal-head">
          <div>
            <h2>${title}</h2>
            ${description ? html`<p class="meta" style="margin-top:4px">${description}</p>` : raw('')}
          </div>
          ${closeButton}
        </div>
        <div class="modal-body">${body}</div>
        ${foot ? html`<div class="modal-foot">${foot}</div>` : raw('')}
      </div>
    </div>
  `, {
    actions: {
      ...(actions || {}),
    },
    onMount,
    onClose,
    initialFocus,
  });
}

/**
 * Right-hand detail drawer — used for assignment detail so the list context
 * behind it is never lost.
 */
export function openDrawer({ title, eyebrow, body, foot, actions, onMount, onClose }) {
  mount(html`
    <div class="drawer-scrim" role="presentation"></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-label="${title}">
      <header class="drawer-head">
        <div class="grow">
          ${eyebrow ? html`<div class="eyebrow" style="margin-bottom:6px">${eyebrow}</div>` : raw('')}
          <h2 class="detail-title">${title}</h2>
        </div>
        ${closeButton}
      </header>
      <div class="drawer-body">${body}</div>
      ${foot ? html`<footer class="drawer-foot">${foot}</footer>` : raw('')}
    </aside>
  `, {
    actions: { ...(actions || {}) },
    onMount: (el) => {
      // Drawer scrim click-to-close
      const scrim = el.querySelector('.drawer-scrim');
      if (scrim) scrim.addEventListener('click', () => closeOverlay());
      if (onMount) onMount(el);
    },
    onClose,
  });
}

/** Replace the body of the open drawer without losing scroll or focus context. */
export function updateOverlayBody(markup) {
  const el = host();
  const body = el && el.querySelector('.drawer-body, .modal-body');
  if (body) render(body, markup);
}

/** Promise-based confirmation. Resolves false on cancel, Escape or scrim. */
export function confirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    openModal({
      title,
      body: html`<p class="meta">${message}</p>`,
      foot: html`
        <button class="btn" data-act="cancelConfirm">${cancelLabel}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="acceptConfirm" data-autofocus>
          ${confirmLabel}
        </button>
      `,
      actions: {
        acceptConfirm: () => { finish(true); closeOverlay({ silent: true }); },
        cancelConfirm: () => { finish(false); closeOverlay({ silent: true }); },
      },
      onClose: () => finish(false),
      initialFocus: '[data-autofocus]',
    });
  });
}

/** Put a button into a pending state while an async action runs. */
export async function withBusy(element, label, work) {
  if (!element) return work();
  const original = element.innerHTML;
  element.setAttribute('aria-disabled', 'true');
  element.classList.add('is-busy');
  element.innerHTML = String(html`<span class="spinner"></span>${label || 'Working'}`);
  try {
    return await work();
  } finally {
    element.classList.remove('is-busy');
    element.removeAttribute('aria-disabled');
    element.innerHTML = original;
  }
}
