/* ==========================================================================
   states.js — loading, empty and error presentation.
   No blank screens while data loads, no "No data found", no raw exceptions.
   ========================================================================== */

import { html, raw } from '../lib/dom.js';
import { icon } from '../lib/icons.js';

/* --------------------------------------------------------------------------
   Loading
   -------------------------------------------------------------------------- */

export function skeletonLine(width = '100%', height = 11) {
  return html`<div class="sk sk-line" style="width:${width};height:${height}px"></div>`;
}

export function skeletonRows(count = 5) {
  return html`
    <div class="rows">
      ${Array.from({ length: count }, () => html`
        <div style="padding:14px 16px;display:grid;grid-template-columns:minmax(0,2.5fr) 116px 128px;gap:16px;align-items:center">
          <div class="col gap-2">
            ${skeletonLine('58%', 13)}
            ${skeletonLine('34%', 10)}
          </div>
          ${skeletonLine('80%', 11)}
          ${skeletonLine('100%', 6)}
        </div>
      `)}
    </div>
  `;
}

export function skeletonCard({ height = 160, lines = 3 } = {}) {
  return html`
    <div class="card card-pad col gap-3" style="min-height:${height}px">
      ${skeletonLine('30%', 10)}
      ${skeletonLine('62%', 20)}
      ${Array.from({ length: lines }, (_, i) => skeletonLine(`${92 - i * 14}%`, 11))}
    </div>
  `;
}

/** A page-level loading frame that mirrors the layout it is standing in for. */
export function pageLoading({ title, note = 'Loading your workload…', kind = 'split' }) {
  const shapes = kind === 'list'
    ? html`<div class="card">${skeletonRows(6)}</div>`
    : kind === 'grid'
      ? html`<div class="grid-halves">${skeletonCard({ height: 200 })}${skeletonCard({ height: 200 })}</div>`
      : html`
        <div class="grid-main">
          ${skeletonCard({ height: 320, lines: 5 })}
          <div class="stack">${skeletonCard({ height: 140, lines: 2 })}${skeletonCard({ height: 140, lines: 2 })}</div>
        </div>
      `;

  return html`
    <div class="page-head">
      <div>
        <h1>${title}</h1>
        <p class="page-sub"><span class="loading-note"><span class="spinner"></span>${note}</span></p>
      </div>
    </div>
    ${shapes}
  `;
}

/* --------------------------------------------------------------------------
   Empty
   -------------------------------------------------------------------------- */

/**
 * @param {{ mark?: string, title: string, message: string, action?: {label: string, act: string, data?: object}, inline?: boolean }} opts
 */
export function emptyState({ mark = 'inbox', title, message, action, inline = false }) {
  return html`
    <div class="state ${inline ? 'state-inline' : ''}">
      <div class="state-mark">${icon(mark, { size: 19 })}</div>
      <h3>${title}</h3>
      <p>${message}</p>
      ${action ? html`
        <button class="btn btn-primary" data-act="${action.act}" ${dataAttrs(action.data)}>
          ${action.icon ? icon(action.icon, { size: 15 }) : raw('')}${action.label}
        </button>
      ` : raw('')}
    </div>
  `;
}

/* --------------------------------------------------------------------------
   Error
   -------------------------------------------------------------------------- */

/**
 * Student-facing failure. `retry` is an action name registered by the page.
 */
export function errorState({
  title = 'We couldn\'t load this',
  message = 'The request didn\'t come back. Nothing has been changed.',
  retry = null,
  retryLabel = 'Try again',
  inline = false,
}) {
  return html`
    <div class="state state-error ${inline ? 'state-inline' : ''}" role="alert">
      <div class="state-mark">${icon('alertCircle', { size: 19 })}</div>
      <h3>${title}</h3>
      <p>${message}</p>
      ${retry ? html`
        <button class="btn" data-act="${retry}">${icon('refresh', { size: 15 })}${retryLabel}</button>
      ` : raw('')}
    </div>
  `;
}

/** A quiet strip for partial failures, so one dead panel doesn't blank a page. */
export function partialError({ label, retry }) {
  return html`
    <div class="well row-between" role="alert" style="border-left:2px solid var(--risk)">
      <span class="meta">${label}</span>
      ${retry ? html`<button class="btn btn-sm" data-act="${retry}">Retry</button>` : raw('')}
    </div>
  `;
}

function dataAttrs(data) {
  if (!data) return raw('');
  return raw(Object.entries(data)
    .map(([k, v]) => `data-${k}="${String(v).replace(/"/g, '&quot;')}"`)
    .join(' '));
}

export { dataAttrs };
