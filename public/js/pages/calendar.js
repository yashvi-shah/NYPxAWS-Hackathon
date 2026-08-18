/* ==========================================================================
   calendar.js — an academic calendar, not an events grid.

   Every cell carries two things: what is due, and how much work that day is
   carrying. Days that cannot take what they are being asked to do stand out.
   ========================================================================== */

import { html, raw, render, pct, cx } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { myWorkspace } from '../services/store.js';
import { setLayer } from '../core/actions.js';
import { navigate } from '../core/router.js';
import { pageLoading, emptyState, errorState } from '../ui/states.js';
import { panel, dueBadge, railClass, moduleLine } from '../ui/bits.js';
import { openAssignmentDetail } from '../features/assignmentDetail.js';
import { openAssignmentForm } from '../features/assignmentForm.js';
import { priorityTone } from '../core/priority.js';
import { buildSchedule, planForAssignment, remainingHours } from '../core/workload.js';
import {
  dayKey, startOfDay, monthLong, weekdayShort, formatDayDate, daysUntil,
  hours as fmtHours, plural, dueShort,
} from '../lib/format.js';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const state = { monthOffset: 0, selected: dayKey(new Date()) };

export async function render_(view, ctx) {
  render(view, pageLoading({ title: 'Calendar', note: 'Placing your deadlines…', kind: 'grid' }));

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
  const monthItems = assignments.filter((a) => {
    const d = a.deadline ? startOfDay(a.deadline) : null;
    return d && d.getMonth() === cursor.getMonth() && d.getFullYear() === cursor.getFullYear();
  });

  render(view, html`
    ${header(cursor)}

    <div class="cal-wrap">
      <div class="stack">
        ${panel({
          cls: 'cal-card',
          body: html`
            <div class="cal">
              ${DOW.map((d) => html`<div class="cal-dow">${d}</div>`)}
              ${cells.map((cell) => monthCell(cell))}
            </div>
          `,
          foot: html`
            <div class="row-between wrap gap-3">
              <div class="cal-legend">
                <span><i style="background:var(--risk)"></i>Due now or overdue</span>
                <span><i style="background:var(--warn)"></i>High priority</span>
                <span><i style="background:var(--ok)"></i>Lower priority</span>
                <span><i style="background:var(--accent)"></i>Planned work</span>
                <span><i style="background:var(--risk)"></i>Over your available hours</span>
              </div>
              <span class="caption">Bars show that day's workload against the time you have.</span>
            </div>
          `,
        })}
        ${monthOverview(monthItems, cursor)}
      </div>

      <div class="stack">
        ${dayPanel(state.selected, { assignments, plans, schedule })}
        ${nextUpPanel(assignments, plans)}
      </div>
    </div>
  `);
}

function header(cursor) {
  return html`
    <div class="page-head">
      <div>
        <h1>Calendar</h1>
        <p class="page-sub">Where your deadlines land, and what each day is carrying.</p>
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
  // Monday-first offset
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
  // Trim a trailing all-outside week.
  const lastWeek = cells.slice(35);
  return lastWeek.every((c) => !c.inMonth) ? cells.slice(0, 35) : cells;
}

function monthCell(cell) {
  const load = cell.load;
  const over = load ? load.over : 0;
  const peak = load ? Math.max(load.capacity, load.required, 0.01) : 1;
  const chips = cell.deadlines.slice(0, 2);
  const more = cell.deadlines.length - chips.length;

  return html`
    <button class="${cx('cal-cell', !cell.inMonth && 'is-outside', cell.isToday && 'is-today',
      cell.isSelected && 'is-selected', load && load.isOver && 'is-over')}"
            data-act="selectDay" data-key="${cell.key}"
            aria-label="${formatDayDate(cell.date)}${cell.deadlines.length ? `, ${plural(cell.deadlines.length, 'deadline')}` : ''}${load ? `, ${fmtHours(load.required)} of work` : ''}"
            aria-pressed="${cell.isSelected ? 'true' : 'false'}">
      <span class="cal-date">
        <span class="n">${cell.date.getDate()}</span>
        ${load && load.required > 0 ? html`<span class="cal-load">${fmtHours(load.required)}</span>` : raw('')}
      </span>

      <span class="cal-chips">
        ${chips.map((a) => html`
          <span class="${cx('cal-chip', `p-${chipTone(a)}`, a.status === 'completed' && 'is-done')}">${a.title}</span>
        `)}
        ${more > 0 ? html`<span class="cal-more">+${more} more</span>` : raw('')}
      </span>

      <span class="cal-dots">
        ${cell.deadlines.slice(0, 4).map((a) => html`
          <i style="width:5px;height:5px;border-radius:50%;background:var(--${chipTone(a) === 'risk' ? 'risk' : chipTone(a) === 'warn' ? 'warn' : 'ok'})"></i>
        `)}
      </span>

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
   Selected day
   -------------------------------------------------------------------------- */

function dayPanel(key, { assignments, plans, schedule }) {
  const date = startOfDay(key);
  const day = schedule.byKey.get(key) || null;
  const due = assignments.filter((a) => a.deadline && dayKey(a.deadline) === key);
  const planned = day ? day.items.slice(0, 4) : [];

  return panel({
    title: daysUntil(date) === 0 ? 'Today' : formatDayDate(date),
    note: weekdayShort(date),
    actions: html`
      <button class="icon-btn" data-act="addOnDay" data-key="${key}" aria-label="Add a commitment due this day"
              data-tip="Add a commitment due here">${icon('plus', { size: 15 })}</button>
    `,
    body: html`
      <div class="card-body col gap-4">
        ${day ? html`
          <div>
            <div class="row-between" style="margin-bottom:var(--sp-2)">
              <span class="eyebrow">Workload</span>
              <span class="caption num ${day.isOver ? 't-risk' : ''}">
                ${fmtHours(day.required)} of ${fmtHours(day.capacity)}
              </span>
            </div>
            <div class="meter">
              <span class="seg-planned" style="width:${pct(Math.min(day.required, day.capacity), Math.max(day.capacity, day.required, 0.01))}%"></span>
              ${day.over > 0 ? html`<span class="seg-over" style="width:${pct(day.over, Math.max(day.capacity, day.required, 0.01))}%"></span>` : raw('')}
            </div>
            <p class="caption" style="margin-top:var(--sp-2)">
              ${day.isOver
                ? `${fmtHours(day.over)} more than this day can take.`
                : day.required > 0
                  ? `${fmtHours(day.freeHours)} still free.`
                  : 'Nothing needs doing on this day.'}
            </p>
          </div>
        ` : html`
          <p class="caption">This day is beyond the three weeks StudySphere schedules in detail. Deadlines still show below.</p>
        `}

        ${due.length ? html`
          <div>
            <span class="eyebrow">Due this day</span>
            <div class="stack-sm" style="margin-top:var(--sp-2)">
              ${due.map((a) => html`
                <button class="well row-between ${railClass(chipTone(a) === 'ok' ? 'ok' : chipTone(a))}"
                        data-act="openAssignment" data-id="${a.id}" style="text-align:left;padding-left:var(--sp-4)">
                  <span class="grow" style="min-width:0">
                    <span class="row-title truncate">${a.title}</span>
                    ${moduleLine(a, [`${a.weightage ?? 0}%`])}
                  </span>
                  ${a.status === 'completed'
                    ? html`<span class="badge badge-ok">${icon('check', { size: 12 })}Done</span>`
                    : dueBadge(a)}
                </button>
              `)}
            </div>
          </div>
        ` : raw('')}

        ${planned.length ? html`
          <div>
            <span class="eyebrow">Work to do this day</span>
            <div class="stack-sm" style="margin-top:var(--sp-2)">
              ${planned.map((item) => html`
                <div class="row-between meta">
                  <span class="truncate">${item.title}</span>
                  <span class="caption num">${fmtHours(item.hours)}</span>
                </div>
              `)}
            </div>
          </div>
        ` : raw('')}

        ${!due.length && !planned.length ? emptyState({
          mark: 'checkCircle',
          title: 'Clear day.',
          message: 'Nothing due and nothing scheduled — a good day to pull work forward from a heavier one.',
          inline: true,
        }) : raw('')}
      </div>
    `,
  });
}

/* --------------------------------------------------------------------------
   Supporting lists
   -------------------------------------------------------------------------- */

function monthOverview(items, cursor) {
  const open = items.filter((a) => a.status !== 'completed');
  const totalWeight = open.reduce((s, a) => s + (Number(a.weightage) || 0), 0);

  return panel({
    title: `${monthLong(cursor.getMonth())} at a glance`,
    note: `${plural(items.length, 'deadline')}`,
    body: items.length
      ? html`
        <div class="stat-grid" style="border-bottom:1px solid var(--line)">
          <div class="stat">
            <span class="stat-label">Deadlines</span>
            <span class="stat-value num">${items.length}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Still open</span>
            <span class="stat-value num ${open.length ? '' : 't-ok'}">${open.length}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Grade at stake</span>
            <span class="stat-value num">${totalWeight}%</span>
          </div>
          <div class="stat">
            <span class="stat-label">Modules</span>
            <span class="stat-value num">${new Set(items.map((a) => a.module)).size}</span>
          </div>
        </div>
      `
      : emptyState({
        mark: 'calendar',
        title: 'No deadlines this month.',
        message: 'A clear month — a good window to get ahead on whatever lands next.',
        inline: true,
      }),
  });
}

function nextUpPanel(assignments, plans) {
  const soon = assignments
    .filter((a) => a.status !== 'completed' && a.deadline)
    .sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)))
    .slice(0, 5);

  return panel({
    title: 'Next deadlines',
    note: 'across all months',
    body: soon.length
      ? html`
        <div class="rows">
          ${soon.map((a) => html`
            <button class="row-item ${railClass(chipTone(a))}" data-act="openAssignment" data-id="${a.id}"
                    style="grid-template-columns:minmax(0,1fr) auto">
              <span class="asgn-main">
                <span class="row-title truncate">${a.title}</span>
                ${moduleLine(a, [`${fmtHours(remainingHours(a, planForAssignment(a.id, plans)))} left`])}
              </span>
              <span class="asgn-due" style="text-align:right">
                <span class="d1">${dueShort(a.deadline)}</span>
                <span class="d2">${formatDayDate(a.deadline)}</span>
              </span>
            </button>
          `)}
        </div>
      `
      : emptyState({ mark: 'checkCircle', title: 'Nothing outstanding.', message: 'No open deadlines at all.', inline: true }),
  });
}

/* -------------------------------------------------------------------------- */

function registerActions() {
  setLayer('page', {
    retryCalendar: reload,
    prevMonth: () => { state.monthOffset -= 1; reloadView(); },
    nextMonth: () => { state.monthOffset += 1; reloadView(); },
    thisMonth: () => { state.monthOffset = 0; state.selected = dayKey(new Date()); reloadView(); },
    selectDay: (ds) => { state.selected = ds.key; reloadView(); },
    openAssignment: (ds) => openAssignmentDetail(ds.id),
    addOnDay: (ds) => openAssignmentForm({ deadline: ds.key }),
    gotoWorkload: () => navigate('workload'),
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
