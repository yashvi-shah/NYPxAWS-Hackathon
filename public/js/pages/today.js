/* ==========================================================================
   today.js — "What should I work on, and can I actually finish it?"

   Order on the page is the order of those questions: one next action with its
   reasoning, then today's capacity, then the week's verdict, then the pressure
   distribution, then what is coming after that.
   ========================================================================== */

import { html, raw, render, pct } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { session, myWorkspace, recommendationsFor, analyticsFor } from '../services/store.js';
import { setLayer } from '../core/actions.js';
import { navigate } from '../core/router.js';
import { pageLoading, emptyState, errorState, partialError } from '../ui/states.js';
import {
  panel, weekColumns, workloadLegend, dueBadge, priorityBadge, progressCell,
  railClass, moduleLine,
} from '../ui/bits.js';
import { setNavFlag } from '../ui/shell.js';
import { openAssignmentDetail } from '../features/assignmentDetail.js';
import { openAssignmentForm } from '../features/assignmentForm.js';
import { openAvailability } from '../features/availability.js';
import { generatePlan, setTaskDone } from '../features/planActions.js';
import { completeAssignment } from '../features/assignmentActions.js';
import { explain, actionLabel, priorityTone, deadlineTone } from '../core/priority.js';
import {
  buildSchedule, weekVerdict, todayPicture, timeBlocks, planForAssignment, remainingHours,
} from '../core/workload.js';
import {
  greeting, firstName, daysUntil, formatDayDate, hours as fmtHours, clock,
  weekdayLong, moduleParts, plural,
} from '../lib/format.js';

const TONE_ICON = { risk: 'alert', warn: 'alertCircle', ok: 'checkCircle', none: 'info' };

export async function render_(view, ctx) {
  render(view, pageLoading({
    title: `${greeting()}, ${firstName(session.user?.name)}.`,
    note: 'Working out where your time is going…',
    kind: 'split',
  }));

  let assignments = [];
  let plans = [];
  let recommendations = null;
  let analytics = null;
  let hardError = null;
  let softErrors = [];

  try {
    ({ assignments, plans } = await myWorkspace());
  } catch (err) {
    hardError = err;
  }

  if (!hardError) {
    const [recs, stats] = await Promise.allSettled([recommendationsFor(), analyticsFor()]);
    if (recs.status === 'fulfilled') recommendations = recs.value; else softErrors.push('priority order');
    if (stats.status === 'fulfilled') analytics = stats.value; else softErrors.push('progress figures');
  }

  if (!ctx.isCurrent()) return;

  if (hardError) {
    render(view, html`
      ${header(html`We couldn't reach your workload just now.`)}
      ${errorState({
        title: 'Your workload didn\'t load',
        message: 'Nothing has been changed. This is usually a dropped connection — try again in a moment.',
        retry: 'retryDashboard',
      })}
    `);
    setLayer('page', { retryDashboard: () => reload() });
    return;
  }

  const open = assignments.filter((a) => a.status !== 'completed');
  const schedule = buildSchedule({ assignments, plans });
  const verdict = weekVerdict(schedule);
  const today = todayPicture(schedule, plans);
  const urgent = open.filter((a) => daysUntil(a.deadline) <= 1).length;
  setNavFlag('commitments', urgent);

  registerActions({ assignments, plans });

  if (!open.length) {
    render(view, html`
      ${header(assignments.length
        ? html`Everything on your list is done. <strong>Nothing is competing for your time.</strong>`
        : html`Nothing is on your list yet.`)}
      ${panel({
        body: emptyState({
          mark: assignments.length ? 'checkCircle' : 'inbox',
          title: assignments.length ? 'You\'re all clear.' : 'Start with what\'s due.',
          message: assignments.length
            ? 'No open commitments. Add the next one whenever it lands, and Gravity will fit it around the time you have.'
            : 'Add an assignment with its deadline and weighting, and you\'ll see straight away whether the week can take it.',
          action: { label: 'Add a commitment', act: 'addAssignment', icon: 'plus' },
        }),
      })}
      ${assignments.length ? recentlyCompleted(assignments) : raw('')}
    `);
    return;
  }

  /* ---- the one thing to do next -------------------------------------- */
  const ordered = orderedFocus(recommendations, open);
  const focus = ordered[0];
  const focusPlan = focus ? planForAssignment(focus.assignment.id, plans) : null;

  render(view, html`
    ${header(situationLine({ open, schedule, verdict, urgent }))}

    ${softErrors.length ? partialError({
      label: `We couldn't load your ${softErrors.join(' and ')} — everything else is up to date.`,
      retry: 'retryDashboard',
    }) : raw('')}

    <div class="grid-main">
      ${focusCard(focus, ordered, { assignments, plans, schedule, plan: focusPlan })}
      <div class="stack">
        ${todayCard(today)}
        ${verdictCard(verdict, schedule)}
      </div>
    </div>

    ${panel({
      title: 'This week\'s pressure',
      note: 'next 7 days',
      actions: html`<button class="btn btn-sm" data-act="gotoWorkload">Full workload${icon('arrowRight', { size: 14 })}</button>`,
      body: html`
        <div class="card-body">
          ${weekColumns(schedule.week.days)}
        </div>
      `,
      foot: html`
        <div class="row-between wrap gap-3">
          ${workloadLegend()}
          <span class="caption">${schedule.week.utilisation}% of this week's study time is already committed</span>
        </div>
      `,
    })}

    ${runwayPanel(open, plans, schedule)}
  `);
}

/* --------------------------------------------------------------------------
   Header
   -------------------------------------------------------------------------- */

function header(subline) {
  return html`
    <div class="page-head greeting">
      <div>
        <h1>${greeting()}, ${firstName(session.user?.name)}.</h1>
        <p class="page-sub">${subline}</p>
      </div>
    </div>
  `;
}

function situationLine({ open, schedule, verdict, urgent }) {
  const overdue = schedule.atRisk.filter((r) => r.overdue).length;
  if (overdue) {
    return html`<strong>${plural(overdue, 'deadline')} already passed</strong> and ${overdue === 1 ? 'is' : 'are'} still open — clear ${overdue === 1 ? 'it' : 'them'} first.`;
  }
  if (urgent) {
    return html`<strong>${plural(urgent, 'thing')} due inside 24 hours.</strong> ${verdict.line}`;
  }
  const dueThisWeek = open.filter((a) => daysUntil(a.deadline) <= 7).length;
  if (dueThisWeek) {
    return html`${plural(dueThisWeek, 'deadline')} this week across ${plural(new Set(open.map((a) => a.module)).size, 'module')}. <strong>${verdict.line}</strong>`;
  }
  return html`Nothing is due in the next seven days. <strong>${verdict.line}</strong>`;
}

/* --------------------------------------------------------------------------
   Next best action
   -------------------------------------------------------------------------- */

/** Keep the backend's ranking; only fall back if that call failed. */
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
  return open.slice(0, 3).map((assignment, i) => ({ assignment, rank: i + 1, suggestedAction: null }));
}

function focusCard(focus, ordered, { assignments, plans, schedule, plan }) {
  if (!focus) {
    return panel({
      title: 'Next best action',
      body: emptyState({
        mark: 'checkCircle',
        title: 'Nothing is waiting on you.',
        message: 'Your open work has no immediate pressure. Add what is coming next and Gravity will slot it in.',
        inline: true,
      }),
    });
  }

  const a = focus.assignment;
  const { bullets, hoursLeft } = explain(a, { plans, assignments, schedule });
  const tone = priorityTone(a);
  const { code, name } = moduleParts(a.module);
  const rest = ordered.slice(1, 3);

  return html`
    <section class="card focus ${railClass(tone === 'none' ? 'accent' : tone)}">
      <div class="focus-eyebrow">
        <span class="eyebrow">Next best action</span>
        <span class="seq">${focus.rank || 1} of ${ordered.length}</span>
        ${priorityBadge(a)}
      </div>

      <h2>${a.title}</h2>
      <div class="focus-module">
        <span>${code}</span>
        ${name ? html`<span class="sep">·</span><span class="truncate">${name}</span>` : raw('')}
        <span class="sep">·</span><span>${a.type || 'Coursework'}</span>
      </div>

      <div class="focus-facts">
        <div class="focus-fact">
          <span class="k">Deadline</span>
          <span class="v ${deadlineTone(a) === 'risk' ? 't-risk' : deadlineTone(a) === 'warn' ? 't-warn' : ''}">
            ${dueWord(a)}
          </span>
          <span class="caption">${formatDayDate(a.deadline)}</span>
        </div>
        <div class="focus-fact">
          <span class="k">Complete</span>
          <span class="v">${a.progress ?? 0}<small>%</small></span>
          <div class="bar" style="margin-top:6px"><i style="width:${a.progress ?? 0}%"></i></div>
        </div>
        <div class="focus-fact">
          <span class="k">Work left</span>
          <span class="v">${fmtHours(hoursLeft)}</span>
          <span class="caption">${plan ? 'from your plan' : 'estimated'}</span>
        </div>
        <div class="focus-fact">
          <span class="k">Weightage</span>
          <span class="v">${a.weightage ?? '—'}<small>%</small></span>
          <span class="caption">of the module grade</span>
        </div>
      </div>

      <div class="why">
        <div class="why-title">Why this first?</div>
        <ul class="why-list">
          ${bullets.map((b) => html`
            <li class="${b.tone !== 'none' ? `is-${b.tone}` : ''}">${icon(b.icon, { size: 14 })}<span>${b.text}</span></li>
          `)}
        </ul>
      </div>

      <div class="focus-actions">
        <button class="btn btn-primary" data-act="openAssignment" data-id="${a.id}">
          ${icon('play', { size: 15 })}${actionLabel(a, focus.suggestedAction)}
        </button>
        ${plan
          ? html`<button class="btn" data-act="gotoPlans">${icon('plans', { size: 15 })}Open plan</button>`
          : html`<button class="btn" data-act="planFor" data-id="${a.id}">${icon('plans', { size: 15 })}Build a plan</button>`}
        <button class="btn btn-quiet" data-act="completeFocus" data-id="${a.id}">Mark complete</button>
      </div>

      ${rest.length ? html`
        <div class="focus-next">
          <div class="row-between wrap gap-3">
            <span class="caption">After that</span>
            <div class="row gap-3 wrap">
              ${rest.map((item) => html`
                <button class="btn btn-sm btn-quiet" data-act="openAssignment" data-id="${item.assignment.id}">
                  <span class="mono caption">${item.rank}</span>
                  <span class="truncate" style="max-width:22ch">${item.assignment.title}</span>
                  ${dueBadge(item.assignment)}
                </button>
              `)}
            </div>
          </div>
        </div>
      ` : raw('')}
    </section>
  `;
}

function dueWord(assignment) {
  const d = daysUntil(assignment.deadline);
  if (d === null) return 'No date';
  if (d < 0) return `${Math.abs(d)}d late`;
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  return `${d} days`;
}

/* --------------------------------------------------------------------------
   Today's capacity
   -------------------------------------------------------------------------- */

function todayCard(today) {
  const blocks = timeBlocks(today.blocks.filter((b) => !b.completed && !b.snoozed)).slice(0, 4);
  const doneCount = today.blocks.filter((b) => b.completed).length;
  const total = Math.max(today.capacity, today.required, 0.01);

  return panel({
    title: 'Today',
    note: weekdayLong(new Date()),
    actions: html`
      <button class="icon-btn" data-act="openAvailabilityFromPage" aria-label="Adjust available study time"
              data-tip="Adjust availability">${icon('sliders', { size: 15 })}</button>
    `,
    body: html`
      <div class="card-body">
        <div class="capacity-figures">
          <span class="stat-value ${today.over > 0 ? 't-risk' : today.free <= 0.25 ? 't-warn' : ''}">
            ${today.over > 0 ? fmtHours(today.over) : fmtHours(today.free)}
          </span>
          <span class="stat-unit">${today.over > 0 ? 'more than you have' : 'still free'}</span>
        </div>

        <div class="meter" style="margin-top:var(--sp-4)" role="img"
             aria-label="${fmtHours(today.required)} of work against ${fmtHours(today.capacity)} available today">
          <span class="seg-planned" style="width:${pct(Math.min(today.required, today.capacity), total)}%"></span>
          ${today.over > 0 ? html`<span class="seg-over" style="width:${pct(today.over, total)}%"></span>` : raw('')}
        </div>

        <div class="capacity-rows">
          <div class="capacity-row"><span class="k"><i style="background:var(--line-strong)"></i>Time available</span><span class="v num">${fmtHours(today.capacity)}</span></div>
          <div class="capacity-row is-planned"><span class="k"><i></i>Work to fit in</span><span class="v num">${fmtHours(today.required)}</span></div>
          ${today.over > 0
            ? html`<div class="capacity-row is-over"><span class="k"><i></i>Beyond capacity</span><span class="v num">${fmtHours(today.over)}</span></div>`
            : html`<div class="capacity-row"><span class="k"><i style="background:var(--ok)"></i>Left over</span><span class="v num">${fmtHours(today.free)}</span></div>`}
        </div>

        ${blocks.length ? html`
          <div class="divider" style="margin:var(--sp-4) 0"></div>
          <div class="row-between" style="margin-bottom:var(--sp-2)">
            <span class="eyebrow">Tonight's steps</span>
            ${doneCount ? html`<span class="caption">${doneCount} already done</span>` : raw('')}
          </div>
          <div class="block-list">
            ${blocks.map((b) => html`
              <div class="block-row">
                <span class="time">${clock(b.from)}–${clock(b.to)}</span>
                <span class="title truncate" title="${b.assignmentTitle}">${b.title}</span>
                <button class="check" role="checkbox" aria-checked="false" aria-label="Mark ${b.title} done"
                        data-act="toggleTask" data-plan="${b.planId}" data-task="${b.taskId}" data-done="false">
                  ${icon('check', { size: 12 })}
                </button>
              </div>
            `)}
          </div>
        ` : html`
          <div class="divider" style="margin:var(--sp-4) 0"></div>
          <p class="caption">No timed steps scheduled for today. A study plan turns an assignment into blocks you can actually sit down and start.</p>
        `}
      </div>
    `,
    foot: blocks.length
      ? html`<button class="btn btn-sm btn-quiet" data-act="gotoPlans">See the full plan${icon('arrowRight', { size: 14 })}</button>`
      : html`<button class="btn btn-sm btn-quiet" data-act="gotoPlans">Go to study plans${icon('arrowRight', { size: 14 })}</button>`,
  });
}

/* --------------------------------------------------------------------------
   Workload status
   -------------------------------------------------------------------------- */

function verdictCard(verdict, schedule) {
  const week = schedule.week;
  const balanceTone = week.balance < 0 ? 'risk' : week.balance < 1 ? 'warn' : 'ok';

  return panel({
    title: 'Workload status',
    note: 'this week',
    body: html`
      <div class="card-body verdict">
        <div class="row gap-2" style="align-items:flex-start">
          <span class="t-${verdict.tone === 'none' ? 'mute' : verdict.tone}" style="margin-top:2px">
            ${icon(TONE_ICON[verdict.tone] || 'info', { size: 17 })}
          </span>
          <span class="verdict-line">${verdict.line}</span>
        </div>
        <p class="meta">${verdict.detail}</p>

        <div class="verdict-nums">
          <div class="stat">
            <span class="stat-label">Work needed</span>
            <span class="stat-value num">${fmtHours(week.required)}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Time you have</span>
            <span class="stat-value num">${fmtHours(week.capacity)}</span>
          </div>
          <div class="stat">
            <span class="stat-label">${week.balance < 0 ? 'Short by' : 'Slack'}</span>
            <span class="stat-value num t-${balanceTone}">${fmtHours(Math.abs(week.balance))}</span>
          </div>
        </div>

        ${schedule.atRisk.length ? html`
          <p class="meta">
            ${plural(schedule.atRisk.length, 'commitment')} ${schedule.atRisk.length === 1 ? 'does' : 'do'} not fit
            in the time before ${schedule.atRisk.length === 1 ? 'its' : 'their'} deadline.
          </p>
        ` : raw('')}
      </div>
    `,
    foot: html`
      <button class="btn btn-sm ${verdict.tone === 'risk' ? 'btn-primary' : ''}" data-act="gotoWorkload">
        ${verdict.tone === 'ok' ? 'Review your workload' : 'See what to move'}${icon('arrowRight', { size: 14 })}
      </button>
    `,
  });
}

/* --------------------------------------------------------------------------
   Deadline runway
   -------------------------------------------------------------------------- */

function runwayPanel(open, plans, schedule) {
  const soon = open
    .slice()
    .sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)))
    .slice(0, 6);

  return panel({
    title: 'What\'s coming',
    note: 'soonest first',
    actions: html`<button class="btn btn-sm" data-act="gotoAssignments">All commitments${icon('arrowRight', { size: 14 })}</button>`,
    body: html`
      <div class="rows">
        ${soon.map((a) => {
          const hoursLeft = remainingHours(a, planForAssignment(a.id, plans));
          const risk = schedule.atRisk.find((r) => r.id === a.id);
          return html`
            <button class="row-item runway-item ${railClass(deadlineTone(a))}" data-act="openAssignment" data-id="${a.id}">
              <span class="asgn-main">
                <span class="row-title truncate">${a.title}</span>
                ${moduleLine(a, risk && !risk.overdue ? [`${fmtHours(risk.shortfall)} short of fitting`] : [])}
              </span>
              ${dueBadge(a, { long: true })}
              <span class="asgn-effort runway-effort num">${fmtHours(hoursLeft)} left</span>
              ${progressCell(a.progress)}
            </button>
          `;
        })}
      </div>
    `,
    foot: open.length > soon.length
      ? html`<span class="caption">${open.length - soon.length} more open ${open.length - soon.length === 1 ? 'commitment' : 'commitments'} further out.</span>`
      : null,
  });
}

function recentlyCompleted(assignments) {
  const done = assignments
    .filter((a) => a.status === 'completed')
    .slice(-4)
    .reverse();
  if (!done.length) return raw('');
  return panel({
    title: 'Recently finished',
    body: html`
      <div class="rows">
        ${done.map((a) => html`
          <button class="row-item ${railClass('ok')}" data-act="openAssignment" data-id="${a.id}"
                  style="grid-template-columns:minmax(0,1fr) auto">
            <span class="asgn-main">
              <span class="row-title truncate">${a.title}</span>
              ${moduleLine(a)}
            </span>
            <span class="badge badge-ok">${icon('check', { size: 12 })}Done</span>
          </button>
        `)}
      </div>
    `,
  });
}

/* --------------------------------------------------------------------------
   Actions
   -------------------------------------------------------------------------- */

function registerActions({ assignments }) {
  setLayer('page', {
    retryDashboard: () => reload(),
    gotoWorkload: () => navigate('workload'),
    gotoPlans: () => navigate('study-plans'),
    gotoAssignments: () => navigate('commitments'),
    addAssignment: () => openAssignmentForm(),
    openAvailabilityFromPage: () => openAvailability(),
    openAssignment: (ds) => openAssignmentDetail(ds.id),
    planFor: (ds) => {
      const a = assignments.find((x) => x.id === ds.id);
      return generatePlan(ds.id, { title: a?.title });
    },
    completeFocus: (ds) => {
      const a = assignments.find((x) => x.id === ds.id);
      return a ? completeAssignment(a) : null;
    },
    toggleTask: (ds) => setTaskDone(ds.plan, ds.task, ds.done !== 'true'),
  });
}

async function reload() {
  const { invalidate } = await import('../services/store.js');
  invalidate();
  const { refresh } = await import('../core/router.js');
  refresh();
}

export default { render: render_ };
