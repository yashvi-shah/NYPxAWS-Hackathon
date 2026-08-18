/* ==========================================================================
   workload.js — "Can I realistically handle what's coming?"

   Not a statistics page. Required hours against available hours, where the
   pressure sits, what is driving it and the cheapest thing to move.
   ========================================================================== */

import { html, raw, render, pct } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { myWorkspace, analyticsFor } from '../services/store.js';
import { setLayer } from '../core/actions.js';
import { navigate } from '../core/router.js';
import { pageLoading, emptyState, errorState, partialError } from '../ui/states.js';
import { panel, dayRow, workloadLegend, dueBadge, railClass, moduleLine, statBlock } from '../ui/bits.js';
import { openAvailability } from '../features/availability.js';
import { openAssignmentDetail } from '../features/assignmentDetail.js';
import { buildSchedule, weekVerdict, effortByModule, relief } from '../core/workload.js';
import { hours as fmtHours, weekdayLong, plural, moduleCode, formatDate } from '../lib/format.js';

const WINDOWS = [
  { id: 7, label: '7 days' },
  { id: 14, label: '14 days' },
  { id: 21, label: '21 days' },
];
const TONE_ICON = { risk: 'alert', warn: 'alertCircle', ok: 'checkCircle', none: 'info' };

const state = { window: 14 };

export async function render_(view, ctx) {
  render(view, pageLoading({ title: 'Workload', note: 'Measuring your work against your time…', kind: 'grid' }));

  let assignments = [];
  let plans = [];
  let analytics = null;
  let analyticsFailed = false;

  try {
    ({ assignments, plans } = await myWorkspace());
  } catch (err) {
    if (!ctx.isCurrent()) return;
    render(view, html`
      ${header()}
      ${errorState({
        title: 'Your workload didn\'t load',
        message: 'Nothing has been changed. Try again in a moment.',
        retry: 'retryWorkload',
      })}
    `);
    setLayer('page', { retryWorkload: reload });
    return;
  }

  try {
    analytics = await analyticsFor();
  } catch {
    analyticsFailed = true;
  }

  if (!ctx.isCurrent()) return;

  const schedule = buildSchedule({ assignments, plans, horizonDays: 21 });
  const verdict = weekVerdict(schedule);
  const summary = schedule.window(state.window);
  const open = assignments.filter((a) => a.status !== 'completed');
  registerActions({ assignments, plans });

  if (!open.length) {
    render(view, html`
      ${header()}
      ${panel({
        body: emptyState({
          mark: 'checkCircle',
          title: 'Your workload looks manageable.',
          message: 'Nothing is open, so there is no pressure to measure. Add what is coming and this page will tell you straight away whether it fits.',
          action: { label: 'Add a commitment', act: 'addFromWorkload', icon: 'plus' },
        }),
      })}
      ${analytics ? momentumPanel(analytics) : raw('')}
    `);
    return;
  }

  render(view, html`
    ${header()}
    ${analyticsFailed ? partialError({
      label: 'Your completion figures didn\'t load — the workload numbers below are unaffected.',
      retry: 'retryWorkload',
    }) : raw('')}

    ${verdictHero(verdict, summary)}

    ${panel({
      title: 'Day by day',
      note: `next ${state.window} days`,
      actions: html`
        <div class="segmented" role="group" aria-label="Time window">
          ${WINDOWS.map((w) => html`
            <button data-act="setWindow" data-window="${w.id}" aria-pressed="${state.window === w.id ? 'true' : 'false'}">${w.label}</button>
          `)}
        </div>
      `,
      body: html`
        <div class="daychart">
          ${(() => {
            const days = summary.days;
            const peak = Math.max(...days.map((d) => Math.max(d.required, d.capacity)), 1);
            return days.map((d) => dayRow(d, { peak }));
          })()}
        </div>
      `,
      foot: html`
        <div class="row-between wrap gap-3">
          ${workloadLegend()}
          <button class="btn btn-sm btn-quiet" data-act="openAvailabilityFromPage">
            ${icon('sliders', { size: 14 })}Adjust availability
          </button>
        </div>
      `,
    })}

    <div class="grid-halves">
      ${pressurePanel(schedule, summary)}
      ${riskPanel(schedule, assignments)}
    </div>

    <div class="grid-halves">
      ${modulePanel(assignments, plans, summary)}
      ${analytics ? completionPanel(analytics) : raw('')}
    </div>

    ${analytics ? momentumPanel(analytics) : raw('')}

    <p class="caption" style="max-width:76ch">
      Work left is taken from your study plan when one exists, and otherwise estimated from the type of work,
      its weightage and the confidence you recorded. Available time comes from the hours you set per weekday —
      keep those honest and everything above stays honest with you.
    </p>
  `);
}

function header() {
  return html`
    <div class="page-head">
      <div>
        <h1>Workload</h1>
        <p class="page-sub">Whether what's coming actually fits into the time you have.</p>
      </div>
      <div class="page-actions">
        <button class="btn" data-act="openAvailabilityFromPage">${icon('sliders', { size: 15 })}Available time</button>
      </div>
    </div>
  `;
}

/* --------------------------------------------------------------------------
   The verdict
   -------------------------------------------------------------------------- */

/** The hero always talks about the window the student has selected. */
function windowDetail(summary) {
  const span = `next ${state.window} days`;
  const numbers = `${fmtHours(summary.required)} of work against ${fmtHours(summary.capacity)} of study time in the ${span}`;
  if (summary.required <= 0.01) return 'No open work falls inside this window.';
  if (summary.balance < 0) {
    return `${numbers}. Something has to move: start earlier, cut scope, or raise the hours you have set aside.`;
  }
  if (summary.overloaded.length) {
    const names = summary.overloaded.slice(0, 3).map((d) => (d.isToday ? 'today' : `${weekdayLong(d.date)} ${formatDate(d.date)}`));
    return `${numbers}. The total is fine — the problem is where it sits: ${names.join(', ')}.`;
  }
  if (summary.utilisation >= 85) {
    return `${numbers}. That leaves very little room for anything unexpected.`;
  }
  return `${numbers}, so you have ${fmtHours(summary.balance)} of genuine slack.`;
}

function verdictHero(verdict, summary) {
  const short = summary.balance < 0;
  const tone = short ? 'risk' : summary.overloaded.length ? 'warn' : 'ok';
  const headline = short
    ? `You are ${fmtHours(Math.abs(summary.balance))} short over the next ${state.window} days.`
    : summary.overloaded.length
      ? `It fits overall, but ${plural(summary.overloaded.length, 'day')} ${summary.overloaded.length === 1 ? 'is' : 'are'} overloaded.`
      : `Everything fits, with ${fmtHours(summary.balance)} to spare.`;

  return html`
    <section class="card verdict-hero ${railClass(tone)}">
      <div class="verdict-hero-main">
        <div class="row gap-2" style="align-items:flex-start">
          <span class="t-${tone}" style="margin-top:3px">${icon(TONE_ICON[tone], { size: 20 })}</span>
          <h2>${headline}</h2>
        </div>
        <p>${windowDetail(summary)}</p>
        <div class="row gap-2 wrap" style="margin-top:var(--sp-5)">
          <button class="btn btn-sm" data-act="gotoPlans">${icon('plans', { size: 14 })}Work from a plan</button>
          <button class="btn btn-sm" data-act="gotoAssignments">${icon('assignments', { size: 14 })}Review commitments</button>
        </div>
      </div>
      <div class="verdict-hero-side">
        <div>
          <span class="stat-label">Work required</span>
          <span class="stat-value num">${fmtHours(summary.required)}</span>
        </div>
        <div>
          <span class="stat-label">Time available</span>
          <span class="stat-value num">${fmtHours(summary.capacity)}</span>
        </div>
        <div>
          <span class="stat-label">${short ? 'Short by' : 'Room left'}</span>
          <span class="stat-value num t-${short ? 'risk' : summary.balance < 2 ? 'warn' : 'ok'}">
            ${fmtHours(Math.abs(summary.balance))}
          </span>
        </div>
      </div>
    </section>
  `;
}

/* --------------------------------------------------------------------------
   Pressure points
   -------------------------------------------------------------------------- */

function pressurePanel(schedule, summary) {
  const overloaded = summary.overloaded.slice(0, 4);

  return panel({
    title: 'Pressure points',
    note: overloaded.length ? `${overloaded.length} of ${state.window} days` : 'none',
    body: overloaded.length
      ? html`
        <div>
          ${overloaded.map((day) => {
            const fix = relief(day, schedule);
            return html`
              <article class="pressure-item">
                <div class="pressure-head">
                  <h4>${day.isToday ? 'Today' : weekdayLong(day.date)}, ${formatDate(day.date)}</h4>
                  <span class="badge badge-risk">${fmtHours(day.over)} over</span>
                </div>
                <div class="dayrow-track" role="img"
                     aria-label="${fmtHours(day.required)} of work against ${fmtHours(day.capacity)} available">
                  <span class="fill" style="width:${pct(Math.min(day.required, day.capacity), day.required)}%"></span>
                  <span class="over" style="width:${pct(day.over, day.required)}%"></span>
                </div>
                <ul class="pressure-drivers">
                  ${day.items.slice(0, 3).map((item) => html`
                    <li>
                      <span class="truncate">${item.title}</span>
                      <span class="h">${fmtHours(item.hours)}</span>
                    </li>
                  `)}
                  ${day.deadlines.length ? html`
                    <li>
                      <span class="t-risk">${plural(day.deadlines.length, 'deadline')} land${day.deadlines.length === 1 ? 's' : ''} this day</span>
                      <span class="h">${fmtHours(day.capacity)} available</span>
                    </li>
                  ` : raw('')}
                </ul>
                ${fix ? html`<p class="pressure-fix">${fix.text}</p>` : raw('')}
              </article>
            `;
          })}
        </div>
      `
      : emptyState({
        mark: 'checkCircle',
        title: 'No day is overloaded.',
        message: `Across the next ${state.window} days, every day's work fits inside the hours you set aside.`,
        inline: true,
      }),
  });
}

/* --------------------------------------------------------------------------
   What might not land
   -------------------------------------------------------------------------- */

function riskPanel(schedule, assignments) {
  const risks = schedule.atRisk.slice(0, 6);
  return panel({
    title: 'At risk of not fitting',
    note: risks.length ? plural(risks.length, 'commitment') : 'nothing',
    body: risks.length
      ? html`
        <div class="rows">
          ${risks.map((risk) => {
            const a = assignments.find((x) => x.id === risk.id) || risk;
            return html`
              <button class="row-item ${railClass('risk')}" data-act="openAssignment" data-id="${risk.id}"
                      style="grid-template-columns:minmax(0,1fr) auto auto">
                <span class="asgn-main">
                  <span class="row-title truncate">${risk.title}</span>
                  ${moduleLine(a, [risk.overdue
                    ? 'deadline already passed'
                    : `${fmtHours(risk.shortfall)} more than you have free`])}
                </span>
                ${dueBadge(a)}
                <span class="asgn-effort num">${fmtHours(risk.required)}</span>
              </button>
            `;
          })}
        </div>
      `
      : emptyState({
        mark: 'checkCircle',
        title: 'Everything can still be finished on time.',
        message: 'Each open commitment has enough free hours in front of its deadline.',
        inline: true,
      }),
    foot: risks.length ? html`
      <span class="caption">Shortfall is the work that has nowhere to go before the deadline — start earlier, cut scope, or raise your available hours.</span>
    ` : null,
  });
}

/* --------------------------------------------------------------------------
   Where the time goes
   -------------------------------------------------------------------------- */

function modulePanel(assignments, plans, summary) {
  const rows = effortByModule(assignments, plans);
  const peak = Math.max(...rows.map((r) => r.hours), 1);

  return panel({
    title: 'Where your time goes',
    note: 'remaining work by module',
    body: rows.length
      ? html`
        <div>
          ${rows.map((r) => html`
            <div class="modrow">
              <div class="modrow-top">
                <span class="truncate"><b>${moduleCode(r.module)}</b> · ${plural(r.count, 'item')}</span>
                <span class="h">${fmtHours(r.hours)}</span>
              </div>
              <div class="bar bar-lg"><i style="width:${pct(r.hours, peak)}%"></i></div>
            </div>
          `)}
        </div>
      `
      : emptyState({ mark: 'layers', title: 'No open work.', message: 'Nothing left to distribute.', inline: true }),
    foot: rows.length ? html`
      <span class="caption">${fmtHours(rows.reduce((s, r) => s + r.hours, 0))} of work left in total, against ${fmtHours(summary.capacity)} in the next ${state.window} days.</span>
    ` : null,
  });
}

function completionPanel(analytics) {
  const modules = analytics.moduleBreakdown || [];
  return panel({
    title: 'Progress so far',
    note: 'this semester',
    body: html`
      <div class="stat-grid" style="border-bottom:1px solid var(--line)">
        ${statBlock({ label: 'Completed', value: `${analytics.completionRate || 0}%`, tone: 'ok', sub: `${analytics.completedAssignments || 0} of ${analytics.totalAssignments || 0}` })}
        ${statBlock({ label: 'Still open', value: analytics.pendingAssignments || 0, sub: 'commitments' })}
        ${statBlock({ label: 'Average progress', value: `${analytics.averageProgress || 0}%`, sub: 'on open work' })}
      </div>
      ${modules.length ? html`
        <div>
          ${modules.map((m) => html`
            <div class="modrow">
              <div class="modrow-top">
                <span class="truncate">${moduleCode(m.name)}</span>
                <span class="h">${m.completed}/${m.total} done</span>
              </div>
              <div class="bar bar-lg ${m.completed === m.total ? 'bar-ok' : ''}">
                <i style="width:${pct(m.completed, m.total)}%"></i>
              </div>
            </div>
          `)}
        </div>
      ` : raw('')}
    `,
  });
}

function momentumPanel(analytics) {
  const history = (analytics.xpHistory || []).slice().reverse();
  return panel({
    title: 'Momentum',
    note: 'recent activity',
    actions: html`<span class="badge">${icon('flame', { size: 12 })}${analytics.streak || 0} day streak</span>`,
    body: history.length
      ? html`
        <div class="ledger">
          ${history.map((entry) => html`
            <div class="ledger-row">
              <span class="grow truncate">${entry.reason}</span>
              <span class="caption num">${formatDate(entry.date)}</span>
              <span class="amt ${Number(entry.amount) < 0 ? 'is-neg' : ''}">${Number(entry.amount) > 0 ? '+' : ''}${entry.amount}</span>
            </div>
          `)}
        </div>
      `
      : emptyState({
        mark: 'trendUp',
        title: 'Nothing logged yet.',
        message: 'Finishing work and helping peers shows up here as it happens.',
        inline: true,
      }),
  });
}

/* -------------------------------------------------------------------------- */

function registerActions() {
  setLayer('page', {
    retryWorkload: reload,
    setWindow: (ds) => {
      state.window = Number(ds.window) || 14;
      reloadView();
    },
    openAvailabilityFromPage: () => openAvailability(),
    openAssignment: (ds) => openAssignmentDetail(ds.id),
    gotoPlans: () => navigate('study-plans'),
    gotoAssignments: () => navigate('assignments'),
    addFromWorkload: async () => {
      const { openAssignmentForm } = await import('../features/assignmentForm.js');
      openAssignmentForm();
    },
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
