/* ==========================================================================
   today.js — Focus mode: "What should I work on?"
   Shows top priorities with urgency colors, stats, upcoming list, mini-week.
   ========================================================================== */

import { html, raw, render, pct } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { session, myWorkspace, recommendationsFor } from '../services/store.js';
import { setLayer } from '../core/actions.js';
import { navigate } from '../core/router.js';
import { pageLoading, emptyState, errorState } from '../ui/states.js';
import { panel } from '../ui/bits.js';
import { setNavFlag } from '../ui/shell.js';
import { openAssignmentDetail } from '../features/assignmentDetail.js';
import { openAssignmentForm } from '../features/assignmentForm.js';
import { generatePlan } from '../features/planActions.js';
import { completeAssignment } from '../features/assignmentActions.js';
import { actionLabel, deadlineTone } from '../core/priority.js';
import { buildSchedule, planForAssignment, remainingHours } from '../core/workload.js';
import {
  greeting, firstName, daysUntil, hours as fmtHours,
  moduleParts, plural, moduleCode, weekdayShort, dayKey,
} from '../lib/format.js';

export async function render_(view, ctx) {
  render(view, pageLoading({
    title: `${greeting()}, ${firstName(session.user?.name)}.`,
    note: 'Working out what needs your attention...',
    kind: 'split',
  }));

  let assignments = [];
  let plans = [];
  let recommendations = null;

  try {
    ({ assignments, plans } = await myWorkspace());
  } catch (err) {
    if (!ctx.isCurrent()) return;
    render(view, html`
      ${header(html`We couldn't reach your workload just now.`)}
      ${errorState({ title: 'Your workload didn\'t load', message: 'Try again in a moment.', retry: 'retryDashboard' })}
    `);
    setLayer('page', { retryDashboard: () => reload() });
    return;
  }

  try { recommendations = await recommendationsFor(); } catch {}
  if (!ctx.isCurrent()) return;

  const open = assignments.filter((a) => a.status !== 'completed');
  const schedule = buildSchedule({ assignments, plans });
  const urgent = open.filter((a) => daysUntil(a.deadline) <= 1).length;
  setNavFlag('commitments', urgent);
  registerActions({ assignments, plans });

  if (!open.length) {
    render(view, html`
      ${header(assignments.length
        ? html`Everything is done. <strong>Nothing competing for your time.</strong>`
        : html`Nothing on your list yet.`)}
      ${panel({
        body: emptyState({
          mark: assignments.length ? 'checkCircle' : 'inbox',
          title: assignments.length ? 'You\'re all clear.' : 'Start with what\'s due.',
          message: assignments.length
            ? 'No open commitments. Add the next one whenever it lands.'
            : 'Add an assignment with its deadline and weighting to get started.',
          action: { label: 'Add a commitment', act: 'addAssignment', icon: 'plus' },
        }),
      })}
    `);
    return;
  }

  const ordered = orderedFocus(recommendations, open);
  const dueThisWeek = open.filter((a) => daysUntil(a.deadline) <= 7).length;
  const topPriorities = getTopPriorities(ordered);
  const avgProgress = open.length ? Math.round(open.reduce((s, a) => s + (a.progress || 0), 0) / open.length) : 0;

  render(view, html`
    ${header(situationLine({ open, urgent, dueThisWeek }))}
    ${statsStrip({ open: open.length, dueThisWeek, avgProgress, streak: session.user?.streak || 0 })}
    ${priorityCards(topPriorities, { assignments, plans, schedule })}

    <div class="today-bottom-grid">
      ${upcomingList(ordered.slice(topPriorities.length), plans)}
      ${miniWeekCalendar(assignments)}
    </div>
  `);
}

function header(subline) {
  return html`
    <div class="page-head greeting">
      <div>
        <h1>${greeting()}, ${firstName(session.user?.name)}.</h1>
        <p class="page-sub">${subline}</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" data-act="addAssignment">${icon('plus', { size: 15 })}Add</button>
      </div>
    </div>
  `;
}

function situationLine({ open, urgent, dueThisWeek }) {
  if (urgent > 1) return html`<strong>${plural(urgent, 'thing')} due within 24 hours.</strong> Here are your top priorities.`;
  if (urgent === 1) return html`<strong>1 thing due within 24 hours.</strong> Focus on it first.`;
  if (dueThisWeek) return html`You have <strong>${plural(dueThisWeek, 'deadline')} this week.</strong> Here's what to prioritise.`;
  return html`No deadlines this week. A good time to get ahead.`;
}

/* --------------------------------------------------------------------------
   Stats strip — colored by urgency
   -------------------------------------------------------------------------- */

function statsStrip({ open, dueThisWeek, avgProgress, streak }) {
  const dueTone = dueThisWeek >= 3 ? 't-risk' : dueThisWeek >= 1 ? 't-warn' : '';
  const progTone = avgProgress < 30 ? 't-warn' : avgProgress >= 70 ? 't-ok' : '';
  const streakTone = streak >= 5 ? 't-ok' : streak >= 2 ? '' : 't-warn';

  return html`
    <div class="today-stats">
      <div class="today-stat">
        <span class="today-stat-value">${open}</span>
        <span class="today-stat-label">Open tasks</span>
      </div>
      <div class="today-stat ${dueThisWeek >= 3 ? 'today-stat-alert' : ''}">
        <span class="today-stat-value ${dueTone}">${dueThisWeek}</span>
        <span class="today-stat-label">Due this week</span>
      </div>
      <div class="today-stat">
        <span class="today-stat-value ${progTone}">${avgProgress}%</span>
        <span class="today-stat-label">Avg progress</span>
      </div>
      <div class="today-stat">
        <span class="today-stat-value ${streakTone}">${streak}</span>
        <span class="today-stat-label">Day streak</span>
      </div>
    </div>
  `;
}

/* --------------------------------------------------------------------------
   Priority cards — shows 1-3 top items, colored by urgency
   -------------------------------------------------------------------------- */

function orderedFocus(recommendations, open) {
  if (Array.isArray(recommendations) && recommendations.length) {
    return recommendations
      .filter((r) => r && r.assignment && open.some((a) => a.id === r.assignment.id))
      .map((r) => ({
        assignment: open.find((a) => a.id === r.assignment.id) || r.assignment,
        rank: r.rank,
        suggestedAction: r.suggestedAction,
      }));
  }
  return open.slice(0, 6).map((assignment, i) => ({ assignment, rank: i + 1, suggestedAction: null }));
}

function getTopPriorities(ordered) {
  if (ordered.length <= 1) return ordered.slice(0, 1);
  const top = [];
  for (const item of ordered.slice(0, 3)) {
    const d = daysUntil(item.assignment.deadline);
    if (top.length === 0 || (d !== null && d <= 3)) {
      top.push(item);
    } else break;
  }
  return top;
}

function priorityCards(items, { assignments, plans, schedule }) {
  if (items.length === 1) {
    return focusCard(items[0], { assignments, plans, schedule });
  }
  return html`
    <div class="today-priorities">
      ${items.map((item) => focusCard(item, { assignments, plans, schedule }))}
    </div>
  `;
}

function focusCard(focus, { assignments, plans, schedule }) {
  const a = focus.assignment;
  const hoursLeft = remainingHours(a, planForAssignment(a.id, plans));
  const tone = deadlineTone(a);
  const { code, name } = moduleParts(a.module);

  return html`
    <section class="card focus-card focus-card-${tone}">
      <h3 class="focus-card-title">${a.title}</h3>
      <div class="focus-card-meta">
        <span>${code}${name ? ` - ${name}` : ''}</span>
        <span>${a.type || 'Coursework'}</span>
        <span>${a.weightage ?? 0}% of grade</span>
      </div>

      <div class="focus-card-stats">
        <div class="focus-card-stat">
          <span class="focus-card-stat-label">Due</span>
          <span class="focus-card-stat-value ${tone === 'risk' ? 't-risk' : tone === 'warn' ? 't-warn' : ''}">${dueWord(a)}</span>
        </div>
        <div class="focus-card-stat">
          <span class="focus-card-stat-label">Progress</span>
          <span class="focus-card-stat-value">${a.progress ?? 0}%</span>
        </div>
        <div class="focus-card-stat">
          <span class="focus-card-stat-label">Work left</span>
          <span class="focus-card-stat-value">${fmtHours(hoursLeft)}</span>
        </div>
      </div>

      <div class="focus-card-progress">
        <div class="bar"><i style="width:${a.progress ?? 0}%"></i></div>
      </div>

      <div class="focus-card-actions">
        <button class="btn btn-primary" data-act="openAssignment" data-id="${a.id}">
          ${icon('play', { size: 15 })}${actionLabel(a, focus.suggestedAction)}
        </button>
        <button class="btn" data-act="planFor" data-id="${a.id}">${icon('plans', { size: 15 })}Plan</button>
        <button class="btn btn-quiet" data-act="completeFocus" data-id="${a.id}">${icon('check', { size: 15 })}Done</button>
      </div>
    </section>
  `;
}

function dueWord(assignment) {
  const d = daysUntil(assignment.deadline);
  if (d === null) return 'No date';
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  return `${d} days`;
}

/* --------------------------------------------------------------------------
   Upcoming list
   -------------------------------------------------------------------------- */

function upcomingList(items, plans) {
  if (!items.length) return raw('');
  return html`
    <section class="card upcoming-panel">
      <header class="card-head">
        <h3>Upcoming</h3>
        <button class="btn btn-sm btn-quiet" data-act="gotoAssignments">View all ${icon('arrowRight', { size: 14 })}</button>
      </header>
      <div class="upcoming-list">
        ${items.slice(0, 5).map((item) => {
          const a = item.assignment;
          const tone = deadlineTone(a);
          return html`
            <button class="upcoming-row" data-act="openAssignment" data-id="${a.id}">
              <div class="upcoming-row-main">
                <span class="upcoming-row-title truncate">${a.title}</span>
                <span class="upcoming-row-meta">${moduleCode(a.module)} &middot; ${a.type || 'Coursework'}</span>
              </div>
              <span class="upcoming-row-due ${tone === 'risk' ? 't-risk' : tone === 'warn' ? 't-warn' : ''}">${dueWord(a)}</span>
              <div class="upcoming-row-progress">
                <div class="bar bar-sm"><i style="width:${a.progress ?? 0}%"></i></div>
                <span class="upcoming-row-pct">${a.progress ?? 0}%</span>
              </div>
            </button>
          `;
        })}
      </div>
    </section>
  `;
}

/* --------------------------------------------------------------------------
   Mini week calendar — days with deadlines get colored backgrounds
   -------------------------------------------------------------------------- */

function miniWeekCalendar(assignments) {
  const today = new Date();
  const todayKey = dayKey(today);
  const dow = (today.getDay() + 6) % 7;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const key = dayKey(date);
    const deadlines = assignments.filter((a) => a.deadline && dayKey(a.deadline) === key && a.status !== 'completed');
    let dayTone = 'none';
    for (const a of deadlines) {
      const t = deadlineTone(a);
      if (t === 'risk') { dayTone = 'risk'; break; }
      if (t === 'warn') dayTone = 'warn';
      else if (dayTone === 'none') dayTone = 'ok';
    }
    days.push({ date, key, isToday: key === todayKey, deadlines, dayTone });
  }

  return html`
    <section class="card today-week-panel">
      <header class="card-head">
        <h3>This week</h3>
        <button class="btn btn-sm btn-quiet" data-act="gotoCalendar">${icon('calendar', { size: 14 })}Full calendar</button>
      </header>
      <div class="today-week">
        ${days.map((day) => html`
          <div class="today-week-day ${day.isToday ? 'is-today' : ''} ${day.deadlines.length ? `has-deadline has-deadline-${day.dayTone}` : ''}">
            <span class="today-week-label">${weekdayShort(day.date)}</span>
            <span class="today-week-num">${day.date.getDate()}</span>
            <div class="today-week-dots">
              ${day.deadlines.slice(0, 3).map((a) => {
                const t = deadlineTone(a);
                return html`<i class="today-week-dot today-week-dot-${t}"></i>`;
              })}
            </div>
          </div>
        `)}
      </div>
    </section>
  `;
}

/* -------------------------------------------------------------------------- */

function registerActions({ assignments, plans }) {
  setLayer('page', {
    retryDashboard: () => reload(),
    gotoWorkload: () => navigate('workload'),
    gotoPlans: () => navigate('study-plans'),
    gotoAssignments: () => navigate('commitments'),
    gotoCalendar: () => navigate('calendar'),
    addAssignment: () => openAssignmentForm(),
    openAssignment: (ds) => openAssignmentDetail(ds.id),
    planFor: (ds) => {
      const a = assignments.find((x) => x.id === ds.id);
      return generatePlan(ds.id, { title: a?.title });
    },
    completeFocus: (ds) => {
      const a = assignments.find((x) => x.id === ds.id);
      return a ? completeAssignment(a) : null;
    },
  });
}

async function reload() {
  const { invalidate } = await import('../services/store.js');
  invalidate();
  const { refresh } = await import('../core/router.js');
  refresh();
}

export default { render: render_ };
