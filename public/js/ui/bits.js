/* ==========================================================================
   bits.js — shared render fragments.
   Anything that appears on more than one screen lives here so the visual
   language stays identical everywhere.
   ========================================================================== */

import { html, raw, pct, cx } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import {
  dueShort, dueLabel, daysUntil, formatDayDate, hours as fmtHours,
  moduleCode, weekdayShort, initials,
} from '../lib/format.js';
import { deadlineTone, priorityTone, priorityText } from '../core/priority.js';

/* ---- status atoms -------------------------------------------------------- */

const TONE_CLASS = { risk: 'badge-risk', warn: 'badge-warn', ok: 'badge-ok', none: '' };

export function railClass(tone) {
  return tone === 'risk' ? 'rail rail-risk'
    : tone === 'warn' ? 'rail rail-warn'
      : tone === 'ok' ? 'rail rail-ok'
        : 'rail rail-none';
}

/** Deadline chip — the single most-read piece of metadata in the app. */
export function dueBadge(assignment, { long = false } = {}) {
  const tone = deadlineTone(assignment);
  const overdue = daysUntil(assignment.deadline) < 0 && assignment.status !== 'completed';
  return html`
    <span class="badge ${TONE_CLASS[tone] || ''}">
      ${overdue ? icon('alert', { size: 12 }) : raw('')}
      ${long ? dueLabel(assignment.deadline) : dueShort(assignment.deadline)}
    </span>
  `;
}

/** Priority as words, with the score kept as a tooltip rather than a headline. */
export function priorityBadge(assignment) {
  const tone = priorityTone(assignment);
  return html`
    <span class="badge badge-strong ${TONE_CLASS[tone] || ''} ${tone === 'none' ? 'badge-dot' : ''}"
          data-tip="Priority score ${assignment.priorityScore ?? '—'}/100 from Gravity's ranking">
      ${priorityText(assignment)}
    </span>
  `;
}

export function statusBadge(assignment) {
  if (assignment.status === 'completed') {
    return html`<span class="badge badge-ok">${icon('check', { size: 12 })}Done</span>`;
  }
  return dueBadge(assignment);
}

export function progressCell(progress, { tone = '' } = {}) {
  const value = Math.max(0, Math.min(100, Number(progress) || 0));
  return html`
    <div class="asgn-progress">
      <div class="bar ${tone ? `bar-${tone}` : ''}" role="progressbar" aria-valuenow="${value}"
           aria-valuemin="0" aria-valuemax="100" aria-label="Progress">
        <i style="width:${value}%"></i>
      </div>
      <span class="pct">${value}%</span>
    </div>
  `;
}

export function moduleLine(assignment, extra = []) {
  const parts = [moduleCode(assignment.module), assignment.type, ...extra].filter(Boolean);
  return html`
    <div class="asgn-sub">
      ${parts.map((part, i) => html`${i ? html`<span class="sep">·</span>` : raw('')}<span class="truncate">${part}</span>`)}
    </div>
  `;
}

export function avatar(user, { large = false } = {}) {
  return html`<span class="avatar ${large ? 'avatar-lg' : ''}" aria-hidden="true">${initials(user?.name)}</span>`;
}

/* ---- card scaffolding --------------------------------------------------- */

/**
 * Standard panel. `body` is placed raw so callers can choose padding
 * (card-body for prose, rows/daychart for edge-to-edge lists).
 */
export function panel({ title, note, actions, body, foot, id, cls = '' }) {
  return html`
    <section class="card ${cls}" ${id ? raw(`id="${id}"`) : raw('')}>
      ${title ? html`
        <header class="card-head">
          <div class="row gap-2">
            <h3>${title}</h3>
            ${note ? html`<span class="section-note">${note}</span>` : raw('')}
          </div>
          ${actions ? html`<div class="row gap-2">${actions}</div>` : raw('')}
        </header>
      ` : raw('')}
      ${body}
      ${foot ? html`<footer class="card-foot">${foot}</footer>` : raw('')}
    </section>
  `;
}

export function statBlock({ label, value, unit, tone = '', sub }) {
  return html`
    <div class="stat">
      <span class="stat-label">${label}</span>
      <span class="stat-value ${tone ? `t-${tone}` : ''}">${value}${unit ? html`<span class="stat-unit"> ${unit}</span>` : raw('')}</span>
      ${sub ? html`<span class="caption">${sub}</span>` : raw('')}
    </div>
  `;
}

/* ---- workload visuals --------------------------------------------------- */

/**
 * Capacity meter for a single day: planned work, work already done and any
 * overflow beyond the hours available.
 */
export function capacityMeter({ capacity, planned = 0, done = 0, over = 0 }) {
  const total = Math.max(capacity, planned + done + over, 0.01);
  return html`
    <div class="meter" role="img"
         aria-label="${fmtHours(planned + done)} of work against ${fmtHours(capacity)} available">
      ${done > 0 ? html`<span class="seg-done" style="width:${pct(done, total)}%"></span>` : raw('')}
      ${planned > 0 ? html`<span class="seg-planned" style="width:${pct(planned, total)}%"></span>` : raw('')}
      ${over > 0 ? html`<span class="seg-over" style="width:${pct(over, total)}%"></span>` : raw('')}
    </div>
  `;
}

/**
 * Seven-day pressure columns — the app's signature workload picture.
 * Column height is required work relative to the busiest day; the dashed line
 * is that day's available hours, so "above the line" reads as overload.
 */
export function weekColumns(days, { height = 104 } = {}) {
  const peak = Math.max(...days.map((d) => Math.max(d.required, d.capacity)), 1);
  return html`
    <div class="weekbar">
      ${days.map((day) => {
        const fill = Math.min(day.required, day.capacity);
        const over = day.over;
        const capTop = 100 - pct(day.capacity, peak);
        const marks = day.deadlines.slice(0, 4);
        return html`
          <div class="${cx('daycol', day.isOver && 'is-over', day.isToday && 'is-today')}">
            <div class="daycol-marks">
              ${marks.map((d) => html`<i class="${priorityTone(d) === 'risk' ? 'is-risk' : priorityTone(d) === 'warn' ? 'is-warn' : ''}"></i>`)}
            </div>
            <div class="daycol-track" style="height:${height}px"
                 data-tip="${tooltipForDay(day)}" tabindex="0" role="img"
                 aria-label="${ariaForDay(day)}">
              ${day.capacity > 0 ? html`<span class="daycol-cap" style="top:${capTop}%"></span>` : raw('')}
              ${over > 0 ? html`<span class="daycol-over" style="height:${pct(over, peak)}%"></span>` : raw('')}
              ${fill > 0 ? html`<span class="daycol-fill" style="height:${pct(fill, peak)}%"></span>` : raw('')}
            </div>
            <span class="daycol-label">
              ${day.isToday ? 'Today' : weekdayShort(day.date)}
              <b>${day.required > 0 ? fmtHours(day.required) : '—'}</b>
            </span>
          </div>
        `;
      })}
    </div>
  `;
}

function tooltipForDay(day) {
  const lines = [`${formatDayDate(day.date)}`, `${fmtHours(day.required)} of work · ${fmtHours(day.capacity)} free`];
  if (day.isOver) lines.push(`${fmtHours(day.over)} over capacity`);
  day.deadlines.slice(0, 3).forEach((d) => lines.push(`Due: ${d.title}`));
  return lines.join('\n');
}

function ariaForDay(day) {
  return `${formatDayDate(day.date)}: ${fmtHours(day.required)} of work against ${fmtHours(day.capacity)} available`
    + (day.isOver ? `, ${fmtHours(day.over)} over capacity` : '')
    + (day.deadlines.length ? `, ${day.deadlines.length} deadline${day.deadlines.length === 1 ? '' : 's'}` : '');
}

/** Horizontal required-vs-available row, used on the workload page. */
export function dayRow(day, { peak }) {
  const fill = Math.min(day.required, day.capacity);
  return html`
    <div class="${cx('dayrow', day.isToday && 'is-today', day.isOver && 'is-over')}">
      <span class="dayrow-label">
        ${day.isToday ? 'Today' : `${weekdayShort(day.date)} ${day.date.getDate()}`}
      </span>
      <div class="dayrow-track" role="img" aria-label="${ariaForDay(day)}">
        ${fill > 0 ? html`<span class="fill" style="width:${pct(fill, peak)}%"></span>` : raw('')}
        ${day.over > 0 ? html`<span class="over" style="width:${pct(day.over, peak)}%"></span>` : raw('')}
        ${day.capacity > 0 ? html`<span class="capline" style="left:${pct(day.capacity, peak)}%"></span>` : raw('')}
      </div>
      <span class="dayrow-nums">
        <b>${day.required > 0 ? fmtHours(day.required) : '—'}</b> / ${fmtHours(day.capacity)}
      </span>
    </div>
  `;
}

/** Legend explaining the workload visuals once per page. */
export function workloadLegend() {
  return html`
    <div class="meter-legend">
      <span><i style="background:var(--accent)"></i>Work to do</span>
      <span><i style="background:var(--risk)"></i>Beyond your available time</span>
      <span><i style="background:var(--ink-3)"></i>Hours you said you have free</span>
    </div>
  `;
}

/* ---- misc -------------------------------------------------------------- */

export function iconButton({ act, data, label, name, cls = 'icon-btn' }) {
  const attrs = Object.entries(data || {}).map(([k, v]) => `data-${k}="${String(v).replace(/"/g, '&quot;')}"`).join(' ');
  return html`
    <button class="${cls}" data-act="${act}" ${raw(attrs)} aria-label="${label}" data-tip="${label}">
      ${icon(name, { size: 15 })}
    </button>
  `;
}

export function inlineHint(text, iconName = 'info') {
  return html`<span class="caption row gap-1">${icon(iconName, { size: 12 })}${text}</span>`;
}
