/* ==========================================================================
   plans.js — study plans as a schedule, not a chat transcript.

   Tonight first, on a clock, with the steps you can actually start. Then the
   days ahead, then every plan in full.
   ========================================================================== */

import { html, raw, render } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { myWorkspace, preferences } from '../services/store.js';
import { setLayer } from '../core/actions.js';
import { navigate } from '../core/router.js';
import { pageLoading, emptyState, errorState } from '../ui/states.js';
import { panel, railClass } from '../ui/bits.js';
import { openModal, closeOverlay } from '../ui/overlay.js';
import { openAssignmentDetail } from '../features/assignmentDetail.js';
import { generatePlan, setTaskDone, snoozeTask } from '../features/planActions.js';
import { planProgress, timeBlocks, buildSchedule, planForAssignment } from '../core/workload.js';
import {
  dayKey, formatDayDate, clock, minutes as fmtMinutes, hours as fmtHours,
  daysUntil, weekdayLong, plural, moduleCode, dueShort,
} from '../lib/format.js';

export async function render_(view, ctx) {
  render(view, pageLoading({ title: 'Study plans', note: 'Laying out your steps…', kind: 'list' }));

  let assignments = [];
  let plans = [];
  try {
    ({ assignments, plans } = await myWorkspace());
  } catch (err) {
    if (!ctx.isCurrent()) return;
    render(view, html`
      ${header(0)}
      ${errorState({
        title: 'Your plans didn\'t load',
        message: 'Nothing has been changed. Try again in a moment.',
        retry: 'retryPlans',
      })}
    `);
    setLayer('page', { retryPlans: reload });
    return;
  }

  if (!ctx.isCurrent()) return;

  const open = assignments.filter((a) => a.status !== 'completed');
  registerActions({ assignments, plans });

  if (!plans.length) {
    render(view, html`
      ${header(0)}
      ${panel({
        body: emptyState({
          mark: 'plans',
          title: 'Nothing planned yet.',
          message: open.length
            ? 'Pick a commitment and Gravity will break it into timed steps spread across the days you have left — so starting doesn\'t need a decision.'
            : 'Add a commitment first, then build a plan around the time you have.',
          action: open.length
            ? { label: 'Build a plan', act: 'openPlanPicker', icon: 'plans' }
            : { label: 'Add a commitment', act: 'addFromPlans', icon: 'plus' },
        }),
      })}
    `);
    return;
  }

  const entries = allEntries(plans, assignments);
  const todayK = dayKey(new Date());
  const todayEntries = entries
    .filter((e) => (e.scheduledDate <= todayK && !e.completed) || (e.scheduledDate === todayK))
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.carried !== b.carried) return a.carried ? -1 : 1;
      return a.order - b.order;
    });

  const laterEntries = entries.filter((e) => e.scheduledDate > todayK && !e.completed);
  const schedule = buildSchedule({ assignments, plans });

  render(view, html`
    ${header(plans.length)}
    ${tonightPanel(todayEntries, schedule)}
    ${laterEntries.length ? aheadPanel(laterEntries) : raw('')}
    <div class="section-head" style="margin-top:var(--sp-3)">
      <h2>Every plan</h2>
      <span class="section-note">${plural(plans.length, 'plan')} across ${plural(new Set(plans.map((p) => p.module)).size, 'module')}</span>
    </div>
    <div class="stack">
      ${plans
        .slice()
        .sort((a, b) => planSortKey(a, assignments) - planSortKey(b, assignments))
        .map((plan) => planCard(plan, assignments))}
    </div>
  `);
}

function header(planCount) {
  return html`
    <div class="page-head">
      <div>
        <h1>Study plans</h1>
        <p class="page-sub">
          ${planCount
            ? 'Your work broken into blocks, laid out against the hours you actually have.'
            : 'Turn a commitment into timed steps you can start without thinking.'}
        </p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" data-act="openPlanPicker">${icon('plans', { size: 15 })}Build a plan</button>
      </div>
    </div>
  `;
}

/* --------------------------------------------------------------------------
   Data shaping
   -------------------------------------------------------------------------- */

function allEntries(plans, assignments) {
  const todayK = dayKey(new Date());
  const entries = [];
  plans.forEach((plan) => {
    const assignment = assignments.find((a) => a.id === plan.assignmentId);
    (plan.tasks || []).forEach((task) => {
      entries.push({
        planId: plan.id,
        taskId: task.id,
        title: task.title,
        order: Number(task.order) || 0,
        minutes: Number(task.duration) || 0,
        completed: Boolean(task.completed),
        scheduledDate: String(task.scheduledDate || ''),
        carried: String(task.scheduledDate || '') < todayK && !task.completed,
        snoozed: preferences.isSnoozed(plan.id, task.id),
        assignmentId: plan.assignmentId,
        assignmentTitle: plan.assignmentTitle,
        module: plan.module,
        deadline: assignment?.deadline,
      });
    });
  });
  return entries;
}

function planSortKey(plan, assignments) {
  const a = assignments.find((x) => x.id === plan.assignmentId);
  const done = planProgress(plan).percent === 100;
  const days = a ? (daysUntil(a.deadline) ?? 999) : 999;
  return (done ? 1000 : 0) + days;
}

/* --------------------------------------------------------------------------
   Tonight
   -------------------------------------------------------------------------- */

function tonightPanel(entries, schedule) {
  const active = entries.filter((e) => !e.completed && !e.snoozed);
  const laid = timeBlocks(active);
  const snoozed = entries.filter((e) => e.snoozed && !e.completed);
  const done = entries.filter((e) => e.completed);
  const plannedMinutes = active.reduce((s, e) => s + e.minutes, 0);
  const capacity = schedule.today.capacity;
  const startHour = Number(preferences.get('dayStartHour')) || 19;
  const overCapacity = plannedMinutes / 60 > capacity + 0.01;

  return panel({
    title: `Today · ${weekdayLong(new Date())}`,
    note: active.length ? `${fmtMinutes(plannedMinutes)} of steps` : 'nothing scheduled',
    actions: html`
      <span class="badge ${overCapacity ? 'badge-warn' : ''}" data-tip="Your available hours today">
        ${icon('clock', { size: 12 })}${fmtHours(capacity)} free
      </span>
      <button class="btn btn-sm btn-quiet" data-act="openAvailabilityFromPlans">
        ${icon('sliders', { size: 14 })}From ${clock(startHour * 60)}
      </button>
    `,
    body: active.length || done.length || snoozed.length
      ? html`
        <div class="timeline">
          ${laid.map((e) => timelineRow(e, { time: `${clock(e.from)}–${clock(e.to)}` }))}
          ${snoozed.map((e) => timelineRow(e, { time: 'Pushed', snoozed: true }))}
          ${done.map((e) => timelineRow(e, { time: 'Done' }))}
        </div>
      `
      : emptyState({
        mark: 'clock',
        title: 'Nothing scheduled for today.',
        message: 'Your plans put their next steps on other days. Look at the days ahead below, or build a plan for something new.',
        inline: true,
      }),
    foot: overCapacity
      ? html`
        <div class="row-between wrap gap-3">
          <span class="caption t-warn">
            ${icon('alert', { size: 12 })} Tonight's steps come to ${fmtMinutes(plannedMinutes)}, more than the ${fmtHours(capacity)} you said you have.
          </span>
          <button class="btn btn-sm btn-quiet" data-act="openAvailabilityFromPlans">Adjust availability</button>
        </div>
      `
      : active.length
        ? html`<span class="caption">Times are laid out from ${clock(startHour * 60)} with short breaks between steps.</span>`
        : null,
  });
}

function timelineRow(entry, { time, snoozed = false }) {
  return html`
    <div class="tl-row ${entry.completed ? 'is-done' : ''} ${snoozed ? 'is-snoozed' : ''}">
      <span class="tl-time">
        ${time}
        <span class="dur">${entry.minutes}m</span>
      </span>
      <div class="tl-body">
        <button class="check" role="checkbox" aria-checked="${entry.completed ? 'true' : 'false'}"
                aria-label="${entry.completed ? 'Reopen' : 'Complete'} ${entry.title}"
                data-act="toggleTask" data-plan="${entry.planId}" data-task="${entry.taskId}"
                data-done="${entry.completed ? 'true' : 'false'}">
          ${icon('check', { size: 12 })}
        </button>
        <span class="tl-text">
          <span class="tl-title">${entry.title}</span>
          <span class="tl-sub">
            ${moduleCode(entry.module)} · ${entry.assignmentTitle}
            ${entry.carried ? html` · <span class="t-warn">carried over from ${formatDayDate(entry.scheduledDate)}</span>` : raw('')}
            ${entry.deadline ? html` · due ${dueShort(entry.deadline)}` : raw('')}
          </span>
        </span>
        <span class="tl-actions">
          <button class="icon-btn" data-act="snoozeTask" data-plan="${entry.planId}" data-task="${entry.taskId}"
                  data-title="${entry.title}" aria-label="${snoozed ? 'Bring back into today' : 'Push out of today'}"
                  data-tip="${snoozed ? 'Bring back' : 'Not today'}">
            ${icon('snooze', { size: 15 })}
          </button>
          <button class="icon-btn" data-act="openAssignment" data-id="${entry.assignmentId}"
                  aria-label="Open ${entry.assignmentTitle}" data-tip="Open commitment">
            ${icon('arrowUpRight', { size: 15 })}
          </button>
        </span>
      </div>
    </div>
  `;
}

/* --------------------------------------------------------------------------
   Days ahead
   -------------------------------------------------------------------------- */

function aheadPanel(entries) {
  const byDate = new Map();
  entries.forEach((e) => {
    if (!byDate.has(e.scheduledDate)) byDate.set(e.scheduledDate, []);
    byDate.get(e.scheduledDate).push(e);
  });
  const dates = Array.from(byDate.keys()).sort().slice(0, 4);

  return panel({
    title: 'Days ahead',
    note: `${plural(entries.length, 'step')} scheduled`,
    body: html`
      <div>
        ${dates.map((date) => {
          const items = byDate.get(date).sort((a, b) => a.order - b.order);
          const total = items.reduce((s, e) => s + e.minutes, 0);
          return html`
            <div class="agenda-day">
              <div class="agenda-date">
                <span class="d">${daysUntil(date) === 1 ? 'Tomorrow' : formatDayDate(date)}</span>
                <span class="h">${fmtMinutes(total)}</span>
              </div>
              <div class="stack-sm">
                ${items.map((e) => html`
                  <div class="plan-task-row">
                    <span class="plan-task-title grow truncate">${e.title}</span>
                    <span class="plan-task-dur">${e.minutes}m</span>
                    <button class="check" role="checkbox" aria-checked="false"
                            aria-label="Complete ${e.title}" data-act="toggleTask"
                            data-plan="${e.planId}" data-task="${e.taskId}" data-done="false">
                      ${icon('check', { size: 12 })}
                    </button>
                  </div>
                `)}
              </div>
            </div>
          `;
        })}
      </div>
    `,
  });
}

/* --------------------------------------------------------------------------
   Full plans
   -------------------------------------------------------------------------- */

function planCard(plan, assignments) {
  const p = planProgress(plan);
  const assignment = assignments.find((a) => a.id === plan.assignmentId);
  const complete = p.percent === 100;
  const tone = complete ? 'ok' : assignment && daysUntil(assignment.deadline) <= 2 ? 'risk' : 'accent';

  const byDate = new Map();
  (plan.tasks || []).forEach((task) => {
    const key = String(task.scheduledDate || '');
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(task);
  });

  return html`
    <section class="card ${railClass(tone)}">
      <header class="card-head">
        <div class="grow" style="min-width:0">
          <h3 class="truncate">${plan.assignmentTitle}</h3>
          <div class="plan-head-meta">
            <span class="caption">${moduleCode(plan.module)}</span>
            <span class="caption">·</span>
            <span class="caption num">${fmtMinutes(p.totalMinutes)} of work over ${plural(plan.totalDays || 1, 'day')}</span>
            ${assignment ? html`<span class="caption">·</span><span class="caption">due ${dueShort(assignment.deadline)}</span>` : raw('')}
          </div>
        </div>
        <div class="plan-progress">
          <div class="bar ${complete ? 'bar-ok' : ''}"><i style="width:${p.percent}%"></i></div>
          <span class="caption num">${p.done}/${p.total}</span>
        </div>
      </header>

      <div>
        ${Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, tasks]) => html`
          <div class="agenda-day">
            <div class="agenda-date">
              <span class="d">${date === dayKey(new Date()) ? 'Today' : formatDayDate(date)}</span>
              <span class="h">${fmtMinutes(tasks.reduce((s, t) => s + (Number(t.duration) || 0), 0))}</span>
            </div>
            <div class="stack-sm">
              ${tasks.map((task) => html`
                <div class="plan-task-row ${task.completed ? 'is-done' : ''}">
                  <span class="plan-task-title grow truncate">${task.title}</span>
                  <span class="plan-task-dur">${task.duration}m</span>
                  <button class="check" role="checkbox" aria-checked="${task.completed ? 'true' : 'false'}"
                          aria-label="${task.completed ? 'Reopen' : 'Complete'} ${task.title}"
                          data-act="toggleTask" data-plan="${plan.id}" data-task="${task.id}"
                          data-done="${task.completed ? 'true' : 'false'}">
                    ${icon('check', { size: 12 })}
                  </button>
                </div>
              `)}
            </div>
          </div>
        `)}
      </div>

      <footer class="card-foot">
        <div class="row-between wrap gap-3">
          <span class="caption">
            ${complete
              ? 'Every step is done — all that is left is submitting.'
              : `${fmtMinutes(p.remainingMinutes)} of steps still to do.`}
          </span>
          <div class="row gap-2">
            ${assignment ? html`
              <button class="btn btn-sm btn-quiet" data-act="openAssignment" data-id="${assignment.id}">Open commitment</button>
            ` : raw('')}
            <button class="btn btn-sm" data-act="regeneratePlan" data-id="${plan.assignmentId}" data-title="${plan.assignmentTitle}">
              ${icon('refresh', { size: 14 })}Rebuild
            </button>
          </div>
        </div>
      </footer>
    </section>
  `;
}

/* --------------------------------------------------------------------------
   Plan picker
   -------------------------------------------------------------------------- */

function openPlanPicker(assignments, plans) {
  const open = assignments
    .filter((a) => a.status !== 'completed')
    .sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)));

  if (!open.length) {
    openModal({
      title: 'Nothing to plan yet',
      body: html`<p class="meta">Add a commitment first — a plan is built from its type, weightage and how long you have.</p>`,
      foot: html`<button class="btn btn-primary" data-act="addFromPicker">Add a commitment</button>`,
      actions: {
        addFromPicker: async () => {
          closeOverlay({ silent: true });
          const { openAssignmentForm } = await import('../features/assignmentForm.js');
          openAssignmentForm();
        },
      },
    });
    return;
  }

  openModal({
    title: 'Build a study plan',
    description: 'Gravity splits the work into steps and spreads them across the days you have left.',
    wide: true,
    body: html`
      <div class="rows" style="border:1px solid var(--line);border-radius:var(--r-md);overflow:hidden">
        ${open.map((a) => {
          const existing = planForAssignment(a.id, plans);
          return html`
            <button class="row-item" data-act="pickPlan" data-id="${a.id}" data-title="${a.title}"
                    style="grid-template-columns:minmax(0,1fr) auto auto">
              <span class="asgn-main">
                <span class="row-title truncate">${a.title}</span>
                <span class="asgn-sub">
                  <span>${moduleCode(a.module)}</span><span class="sep">·</span><span>${a.type}</span>
                  <span class="sep">·</span><span>due ${dueShort(a.deadline)}</span>
                </span>
              </span>
              ${existing ? html`<span class="badge">has a plan</span>` : raw('')}
              ${icon('arrowRight', { size: 15 })}
            </button>
          `;
        })}
      </div>
      <p class="caption">Rebuilding a plan leaves the old one in your history — the newest plan is the one Gravity uses for timing.</p>
    `,
    actions: {
      pickPlan: (ds) => {
        closeOverlay({ silent: true });
        return generatePlan(ds.id, { goToPlans: false, title: ds.title });
      },
    },
  });
}

/* -------------------------------------------------------------------------- */

function registerActions({ assignments, plans }) {
  setLayer('page', {
    retryPlans: reload,
    openPlanPicker: () => openPlanPicker(assignments, plans),
    addFromPlans: async () => {
      const { openAssignmentForm } = await import('../features/assignmentForm.js');
      openAssignmentForm();
    },
    toggleTask: (ds) => setTaskDone(ds.plan, ds.task, ds.done !== 'true'),
    snoozeTask: async (ds) => {
      snoozeTask(ds.plan, ds.task, ds.title);
      const { refresh } = await import('../core/router.js');
      refresh();
    },
    regeneratePlan: (ds) => generatePlan(ds.id, { goToPlans: false, title: ds.title }),
    openAssignment: (ds) => openAssignmentDetail(ds.id),
    openAvailabilityFromPlans: async () => {
      const { openAvailability } = await import('../features/availability.js');
      openAvailability();
    },
    gotoAssignments: () => navigate('assignments'),
  });
}

async function reload() {
  const { invalidate } = await import('../services/store.js');
  invalidate();
  const { refresh } = await import('../core/router.js');
  refresh();
}

export default { render: render_ };
