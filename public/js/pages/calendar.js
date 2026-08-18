/* ==========================================================================
   calendar.js — a clean academic calendar with monthly events beside it.
   Two-column on desktop: calendar grid + events for the displayed month.
   ========================================================================== */

import { html, raw, render, pct, cx } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { myWorkspace } from '../services/store.js';
import { setLayer } from '../core/actions.js';
import { pageLoading, emptyState, errorState } from '../ui/states.js';
import { dueBadge, railClass } from '../ui/bits.js';
import { openAssignmentDetail } from '../features/assignmentDetail.js';
import { openAssignmentForm } from '../features/assignmentForm.js';
import { priorityTone } from '../core/priority.js';
import { buildSchedule } from '../core/workload.js';
import {
  dayKey, startOfDay, monthLong, weekdayShort, formatDayDate, daysUntil,
  hours as fmtHours, plural, moduleCode, dueShort,
} from '../lib/format.js';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const state = { monthOffset: 0, selected: null };

export async function render_(view, ctx) {
  render(view, pageLoading({ title: 'Calendar', note: 'Placing your deadlines...', kind: 'grid' }));

  let assignments = [];
  let plans = [];
  try {
    ({ assignments, plans } = await myWorkspace());
  } catch (err) {
    if (!ctx.isCurrent()) return;
    render(view, html`
      ${header(new Date())}
      ${errorState({
        title: 'The calendar didn\'t load',
        message: 'Nothing has been changed. Try again in a moment.',
        retry: 'retryCalendar',
      })}
    `);
    setLayer('page', { retryCalendar: reload });
    return;
  }

  if (!ctx.isCurrent()) return;

  const schedule = buildSchedule({ assignments, plans, horizonDays: 21 });
  registerActions({ assignments, plans, schedule });

  const today = startOfDay(new Date());
  const cursor = new Date(today.getFullYear(), today.getMonth() + state.monthOffset, 1);
  const cells = buildMonth(cursor, { assignments, schedule });

  // Events for this month
  const monthEvents = assignments
    .filter((a) => {
      if (!a.deadline) return false;
      const d = startOfDay(a.deadline);
      return d.getMonth() === cursor.getMonth() && d.getFullYear() === cursor.getFullYear();
    })
    .sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)));

  render(view, html`
    ${header(cursor)}

    <div class="cal-two-col">
      <section class="card cal-card">
        <div class="cal">
          ${DOW.map((d) => html`<div class="cal-dow">${d}</div>`)}
          ${cells.map((cell) => monthCell(cell))}
        </div>
      </section>

      <section class="card cal-events-panel">
        <header class="cal-events-header">
          <h3>${monthLong(cursor.getMonth())} ${cursor.getFullYear()}</h3>
          <span class="caption">${plural(monthEvents.length, 'event')}</span>
        </header>
        ${monthEvents.length ? eventsListByDate(monthEvents) : html`
          <div style="padding:var(--sp-5)">
            ${emptyState({
              mark: 'calendar',
              title: 'No deadlines this month.',
              message: 'A clear month ahead.',
              inline: true,
            })}
          </div>
        `}
      </section>
    </div>
  `);
}

function header(cursor) {
  return html`
    <div class="page-head">
      <div>
        <h1>Calendar</h1>
        <p class="page-sub">Where your deadlines land</p>
      </div>
      <div class="page-actions">
        <div class="btn-group">
          <button class="btn btn-icon" data-act="prevMonth" aria-label="Previous month">${icon('chevronLeft', { size: 15 })}</button>
          <button class="btn" data-act="thisMonth" style="min-width:132px">
            ${monthLong(cursor.getMonth())} ${cursor.getFullYear()}
          </button>
          <button class="btn btn-icon" data-act="nextMonth" aria-label="Next month">${icon('chevronRight', { size: 15 })}</button>
        </div>
      </div>
    </div>
  `;
}

/* --------------------------------------------------------------------------
   Month grid
   -------------------------------------------------------------------------- */

function buildMonth(cursor, { assignments, schedule }) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - lead);

  const byDeadline = new Map();
  assignments.forEach((a) => {
    if (!a.deadline) return;
    const key = dayKey(a.deadline);
    if (!byDeadline.has(key)) byDeadline.set(key, []);
    byDeadline.get(key).push(a);
  });

  const cells = [];
  const todayKey = dayKey(new Date());
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = dayKey(date);
    const day = schedule.byKey.get(key) || null;
    cells.push({
      date,
      key,
      inMonth: date.getMonth() === month,
      isToday: key === todayKey,
      isSelected: key === state.selected,
      deadlines: (byDeadline.get(key) || []).sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0)),
      load: day,
    });
  }
  const lastWeek = cells.slice(35);
  return lastWeek.every((c) => !c.inMonth) ? cells.slice(0, 35) : cells;
}

function monthCell(cell) {
  const load = cell.load;
  const over = load ? load.over : 0;
  const peak = load ? Math.max(load.capacity, load.required, 0.01) : 1;
  const deadlineCount = cell.deadlines.length;

  return html`
    <button class="${cx('cal-cell', !cell.inMonth && 'is-outside', cell.isToday && 'is-today',
      cell.isSelected && 'is-selected', load && load.isOver && 'is-over')}"
            data-act="selectDay" data-key="${cell.key}"
            aria-label="${formatDayDate(cell.date)}${deadlineCount ? `, ${plural(deadlineCount, 'deadline')}` : ''}"
            aria-pressed="${cell.isSelected ? 'true' : 'false'}">
      <span class="cal-date">
        <span class="n">${cell.date.getDate()}</span>
      </span>

      ${deadlineCount > 0 ? html`
        <span class="cal-dots">
          ${cell.deadlines.slice(0, 3).map((a) => html`
            <i class="cal-dot-${chipTone(a)}"></i>
          `)}
          ${deadlineCount > 3 ? html`<span class="cal-dot-more">+${deadlineCount - 3}</span>` : raw('')}
        </span>
      ` : raw('')}

      ${load && load.required > 0 ? html`
        <span class="cal-loadbar">
          <i style="width:${pct(Math.min(load.required, load.capacity), peak)}%"></i>
          ${over > 0 ? html`<i class="over" style="width:${pct(over, peak)}%"></i>` : raw('')}
        </span>
      ` : raw('')}
    </button>
  `;
}

function chipTone(a) {
  if (a.status === 'completed') return 'ok';
  const d = daysUntil(a.deadline);
  if (d !== null && d <= 1) return 'risk';
  const tone = priorityTone(a);
  return tone === 'risk' ? 'risk' : tone === 'warn' ? 'warn' : 'ok';
}

/* --------------------------------------------------------------------------
   Monthly events panel
   -------------------------------------------------------------------------- */

function eventsListByDate(events) {
  const byDate = new Map();
  events.forEach((a) => {
    const key = dayKey(a.deadline);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(a);
  });

  return html`
    <div class="cal-events-list">
      ${Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([dateKey, items]) => html`
        <div class="cal-event-group">
          <div class="cal-event-date">${formatDayDate(dateKey)}</div>
          ${items.map((a) => html`
            <button class="cal-event-item" data-act="openAssignment" data-id="${a.id}">
              <div class="cal-event-info">
                <span class="cal-event-title">${a.title}</span>
                <span class="cal-event-meta">${moduleCode(a.module)}${a.type ? ` \u00b7 ${a.type}` : ''}</span>
              </div>
              ${dueBadge(a)}
            </button>
          `)}
        </div>
      `)}
    </div>
  `;
}

/* -------------------------------------------------------------------------- */

function registerActions() {
  setLayer('page', {
    retryCalendar: reload,
    prevMonth: () => { state.monthOffset -= 1; reloadView(); },
    nextMonth: () => { state.monthOffset += 1; reloadView(); },
    thisMonth: () => { state.monthOffset = 0; state.selected = null; reloadView(); },
    selectDay: (ds) => { state.selected = ds.key; reloadView(); },
    openAssignment: (ds) => openAssignmentDetail(ds.id),
    addOnDay: (ds) => openAssignmentForm({ deadline: ds.key }),
  });
}

async function reloadView() {
  const { refresh } = await import('../core/router.js');
  refresh();
}

async function reload() {
  const { invalidate } = await import('../services/store.js');
  invalidate();
  reloadView();
}

export default { render: render_ };
