/* ==========================================================================
   assignmentDetail.js — the assignment drawer.
   Everything that matters is visible at once: what it is, when it is due,
   what it is worth, how far along it is, how much work is left, why it ranks
   where it does — then the actions.
   ========================================================================== */

import { html, raw } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { myWorkspace } from '../services/store.js';
import { openDrawer, closeOverlay } from '../ui/overlay.js';
import { toastError } from '../ui/toast.js';
import { navigate, refresh } from '../core/router.js';
import {
  completeAssignment, reopenAssignment, setAssignmentProgress, deleteAssignment,
} from './assignmentActions.js';
import { openAssignmentForm } from './assignmentForm.js';
import { generatePlan } from './planActions.js';
import { explain, priorityText, priorityTone } from '../core/priority.js';
import { buildSchedule, planForAssignment, planProgress, effortSource } from '../core/workload.js';
import { formatDayDate, dueLabel, hours as fmtHours, moduleParts, minutes as fmtMinutes } from '../lib/format.js';

const STEPS = [0, 25, 50, 75, 100];
const TONE_BADGE = { risk: 'badge-risk', warn: 'badge-warn', ok: 'badge-ok', none: '' };

export async function openAssignmentDetail(assignmentId) {
  let assignments = [];
  let plans = [];
  try {
    ({ assignments, plans } = await myWorkspace());
  } catch (err) {
    toastError('We couldn\'t open that assignment', err);
    return;
  }

  const assignment = assignments.find((a) => a.id === assignmentId);
  if (!assignment) {
    toastError('That assignment is no longer available', null, {
      message: 'It may have been deleted. Your list has been refreshed.',
    });
    refresh();
    return;
  }

  const plan = planForAssignment(assignment.id, plans);
  const schedule = buildSchedule({ assignments, plans });
  const { bullets, hoursLeft } = explain(assignment, { plans, assignments, schedule });
  const { code, name } = moduleParts(assignment.module);
  const done = assignment.status === 'completed';
  const tone = priorityTone(assignment);
  const source = effortSource(assignment, plan);

  openDrawer({
    eyebrow: `${code}${name ? ` · ${name}` : ''}`,
    title: assignment.title,
    body: html`
      <div class="row gap-2 wrap">
        ${done
          ? html`<span class="badge badge-ok">${icon('check', { size: 12 })}Completed</span>`
          : html`<span class="badge badge-strong ${TONE_BADGE[tone] || ''}">${priorityText(assignment)} priority</span>`}
        <span class="badge">${assignment.type || 'Coursework'}</span>
        ${assignment.priorityScore !== undefined
          ? html`<span class="badge" data-tip="StudySphere's ranking score, from deadline, weightage, confidence and progress">Score ${assignment.priorityScore}/100</span>`
          : raw('')}
      </div>

      <div class="detail-facts">
        <div class="detail-fact">
          <div class="k">Deadline</div>
          <div class="v">${formatDayDate(assignment.deadline)}</div>
          <div class="caption ${tone === 'risk' ? 't-risk' : ''}">${dueLabel(assignment.deadline)}</div>
        </div>
        <div class="detail-fact">
          <div class="k">Weightage</div>
          <div class="v">${assignment.weightage ?? '—'}%</div>
          <div class="caption">of the module grade</div>
        </div>
        <div class="detail-fact">
          <div class="k">Progress</div>
          <div class="v">${assignment.progress ?? 0}%</div>
          <div class="bar" style="margin-top:6px"><i style="width:${assignment.progress ?? 0}%"></i></div>
        </div>
        <div class="detail-fact">
          <div class="k">Work left</div>
          <div class="v">${done ? '—' : fmtHours(hoursLeft)}</div>
          <div class="caption">${done ? 'nothing outstanding'
            : source === 'plan' ? 'from your study plan' : 'estimated from type and weightage'}</div>
        </div>
      </div>

      ${!done && bullets.length ? html`
        <section class="why" style="border-top:none;padding-top:0">
          <div class="why-title">Why it sits where it does</div>
          <ul class="why-list">
            ${bullets.map((b) => html`
              <li class="${b.tone !== 'none' ? `is-${b.tone}` : ''}">${icon(b.icon, { size: 14 })}<span>${b.text}</span></li>
            `)}
          </ul>
        </section>
      ` : raw('')}

      ${!done ? html`
        <section class="col gap-2">
          <div class="row-between">
            <span class="label">Update progress</span>
            <span class="caption">currently ${assignment.progress ?? 0}%</span>
          </div>
          <div class="progress-steps" role="group" aria-label="Set progress">
            ${STEPS.map((step) => html`
              <button type="button" data-act="setProgress" data-id="${assignment.id}" data-value="${step}"
                      aria-pressed="${(assignment.progress ?? 0) === step ? 'true' : 'false'}">${step}%</button>
            `)}
          </div>
        </section>
      ` : raw('')}

      <section class="col gap-2">
        <span class="label">Details</span>
        <p class="detail-desc">${assignment.description || 'No details were added for this one.'}</p>
      </section>

      <section class="col gap-3">
        <div class="row-between">
          <span class="label">Study plan</span>
          ${plan ? html`<button class="btn btn-sm btn-quiet" data-act="openPlans">Open plan</button>` : raw('')}
        </div>
        ${plan ? planSummary(plan) : html`
          <div class="well col gap-3">
            <p class="caption">No plan yet. StudySphere can break this into timed steps across the days you have left.</p>
            <button class="btn btn-sm" data-act="generatePlan" data-id="${assignment.id}">
              ${icon('plans', { size: 15 })}Build a study plan
            </button>
          </div>
        `}
      </section>

      <section class="col gap-2">
        <span class="label">Confidence</span>
        <div class="row gap-3">
          <div class="bar grow ${Number(assignment.confidence) < 40 ? 'bar-risk' : Number(assignment.confidence) < 70 ? 'bar-warn' : 'bar-ok'}">
            <i style="width:${Math.max(0, Math.min(100, Number(assignment.confidence) || 0))}%"></i>
          </div>
          <span class="meta num">${assignment.confidence ?? 0}%</span>
        </div>
        <p class="caption">Your own rating. Lower confidence pushes this earlier and buys it more time.</p>
      </section>
    `,
    foot: html`
      ${done ? html`
        <button class="btn" data-act="reopenAssignment" data-id="${assignment.id}">${icon('refresh', { size: 15 })}Reopen</button>
      ` : html`
        <button class="btn btn-primary" data-act="completeAssignment" data-id="${assignment.id}">
          ${icon('check', { size: 15 })}Mark complete
        </button>
      `}
      <button class="btn" data-act="editAssignment" data-id="${assignment.id}">${icon('edit', { size: 15 })}Edit</button>
      <div class="grow"></div>
      <button class="btn btn-danger btn-icon" data-act="deleteAssignment" data-id="${assignment.id}"
              aria-label="Delete assignment" data-tip="Delete">${icon('trash', { size: 15 })}</button>
    `,
    actions: {
      openPlans: () => { closeOverlay({ silent: true }); navigate('study-plans'); },
      generatePlan: (ds) => { closeOverlay({ silent: true }); return generatePlan(ds.id, { title: assignment.title }); },
      editAssignment: () => { closeOverlay({ silent: true }); openAssignmentForm(assignment); },
      setProgress: (ds) => updateProgress(assignment, Number(ds.value)),
      completeAssignment: () => complete(assignment),
      reopenAssignment: () => reopen(assignment),
      deleteAssignment: () => remove(assignment),
    },
  });
}

function planSummary(plan) {
  const p = planProgress(plan);
  const next = (plan.tasks || []).filter((t) => !t.completed).slice(0, 3);
  return html`
    <div class="well col gap-3">
      <div class="row-between">
        <span class="meta"><b>${p.done}/${p.total}</b> steps done</span>
        <span class="caption num">${fmtMinutes(p.remainingMinutes)} of steps left</span>
      </div>
      <div class="bar ${p.percent === 100 ? 'bar-ok' : ''}"><i style="width:${p.percent}%"></i></div>
      ${next.length ? html`
        <ul class="col gap-2">
          ${next.map((task) => html`
            <li class="row gap-2 meta">
              ${icon('arrowRight', { size: 13 })}
              <span class="grow truncate">${task.title}</span>
              <span class="caption num">${task.duration}m</span>
            </li>
          `)}
        </ul>
      ` : html`<p class="caption">Every step is ticked off — all that is left is submitting.</p>`}
    </div>
  `;
}

/* ---- writes ------------------------------------------------------------- */

/** Progress keeps the drawer open: the student is still reading the detail. */
async function updateProgress(assignment, progress) {
  if (progress === 100) return complete(assignment);
  await setAssignmentProgress(assignment, progress, { rerender: false });
  await refresh();
  openAssignmentDetail(assignment.id);
}

function complete(assignment) {
  closeOverlay({ silent: true });
  return completeAssignment(assignment);
}

function reopen(assignment) {
  closeOverlay({ silent: true });
  return reopenAssignment(assignment);
}

function remove(assignment) {
  // Cancelling brings the student straight back to where they were.
  return deleteAssignment(assignment, { onCancel: () => openAssignmentDetail(assignment.id) });
}
