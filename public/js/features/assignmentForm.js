/* ==========================================================================
   assignmentForm.js — add / edit an academic commitment.
   Field names and types match the assignments contract exactly.
   ========================================================================== */

import { html, raw } from '../lib/dom.js';
import { api } from '../services/api.js';
import { session } from '../services/store.js';
import { dayKey, addDays } from '../lib/format.js';
import { openModal, closeOverlay } from '../ui/overlay.js';
import { formValues } from '../core/actions.js';
import { mutate } from './mutate.js';
import { estimateTotalHours } from '../core/workload.js';
import { hours as fmtHours } from '../lib/format.js';

const TYPES = ['Essay', 'Programming', 'Report', 'Presentation', 'Lab Report', 'Project'];

export function openAssignmentForm(assignment = null) {
  const editing = Boolean(assignment && assignment.id);
  const a = assignment || {};
  const defaultDeadline = a.deadline ? String(a.deadline).slice(0, 10) : dayKey(addDays(new Date(), 7));

  openModal({
    title: editing ? 'Edit commitment' : 'Add a commitment',
    description: editing
      ? 'Changes feed straight back into your priority order and workload.'
      : 'Weightage and how confident you feel are what let Gravity time this properly.',
    wide: true,
    body: html`
      <form id="assignment-form" data-act="submitAssignment" class="col gap-4" novalidate>
        <div class="field">
          <label for="af-title">Title</label>
          <input class="input" id="af-title" name="title" required maxlength="120"
                 placeholder="e.g. Machine Learning Classification Model" value="${a.title || ''}">
        </div>

        <div class="field">
          <label for="af-module">Module</label>
          <input class="input" id="af-module" name="module" required maxlength="80"
                 placeholder="e.g. IT3402 - AI &amp; ML" value="${a.module || ''}">
        </div>

        <div class="field-row">
          <div class="field">
            <label for="af-type">Type of work</label>
            <select class="select" id="af-type" name="type" data-input="previewEffort">
              ${TYPES.map((t) => html`<option value="${t}" ${a.type === t ? raw('selected') : raw('')}>${t}</option>`)}
            </select>
          </div>
          <div class="field">
            <label for="af-deadline">Deadline</label>
            <input class="input" type="date" id="af-deadline" name="deadline" required value="${defaultDeadline}">
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label for="af-weightage">Weightage
              <span class="field-hint">share of the module grade</span>
            </label>
            <div class="row gap-3">
              <input class="range grow" type="range" id="af-weightage" name="weightage" min="1" max="100" step="1"
                     value="${a.weightage ?? 10}" data-input="previewEffort" aria-describedby="af-weightage-out">
              <output class="mono" id="af-weightage-out" style="min-width:38px;text-align:right">${a.weightage ?? 10}%</output>
            </div>
          </div>
          <div class="field">
            <label for="af-confidence">Confidence
              <span class="field-hint">how ready do you feel?</span>
            </label>
            <div class="row gap-3">
              <input class="range grow" type="range" id="af-confidence" name="confidence" min="0" max="100" step="5"
                     value="${a.confidence ?? 50}" data-input="previewEffort" aria-describedby="af-confidence-out">
              <output class="mono" id="af-confidence-out" style="min-width:38px;text-align:right">${a.confidence ?? 50}%</output>
            </div>
          </div>
        </div>

        ${editing ? html`
          <div class="field">
            <label for="af-progress">Progress</label>
            <div class="row gap-3">
              <input class="range grow" type="range" id="af-progress" name="progress" min="0" max="100" step="5"
                     value="${a.progress ?? 0}" data-input="previewEffort" aria-describedby="af-progress-out">
              <output class="mono" id="af-progress-out" style="min-width:38px;text-align:right">${a.progress ?? 0}%</output>
            </div>
          </div>
        ` : raw('')}

        <div class="field">
          <label for="af-description">Details <span class="field-hint">optional</span></label>
          <textarea class="textarea" id="af-description" name="description"
                    placeholder="Requirements, deliverables, anything you'll forget by next week…">${a.description || ''}</textarea>
        </div>

        <p class="well caption" id="af-estimate" aria-live="polite"></p>
      </form>
    `,
    foot: html`
      <button class="btn" data-act="closeOverlay">Cancel</button>
      <button class="btn btn-primary" data-act="submitAssignmentButton">
        ${editing ? 'Save changes' : 'Add commitment'}
      </button>
    `,
    initialFocus: '#af-title',
    actions: {
      previewEffort: () => syncPreview(),
      submitAssignmentButton: () => {
        const form = document.getElementById('assignment-form');
        if (form) form.requestSubmit();
      },
      submitAssignment: (ds, form) => submit(form, editing ? a.id : null),
    },
    onMount: () => syncPreview(),
  });
}

function readDraft() {
  const value = (id, fallback) => {
    const el = document.getElementById(id);
    return el ? el.value : fallback;
  };
  return {
    type: value('af-type', 'Report'),
    weightage: Number(value('af-weightage', 10)),
    confidence: Number(value('af-confidence', 50)),
    progress: Number(value('af-progress', 0)),
  };
}

/** Live feedback: show the student what this commitment will cost them in hours. */
function syncPreview() {
  const draft = readDraft();
  const out = {
    weightage: document.getElementById('af-weightage-out'),
    confidence: document.getElementById('af-confidence-out'),
    progress: document.getElementById('af-progress-out'),
  };
  if (out.weightage) out.weightage.textContent = `${draft.weightage}%`;
  if (out.confidence) out.confidence.textContent = `${draft.confidence}%`;
  if (out.progress) out.progress.textContent = `${draft.progress}%`;

  const target = document.getElementById('af-estimate');
  if (!target) return;
  const total = estimateTotalHours(draft);
  const left = total * (1 - (draft.progress || 0) / 100);
  target.textContent = `Gravity will budget about ${fmtHours(left)} of work for this`
    + `${draft.progress ? ` (${fmtHours(total)} in total)` : ''}`
    + `, based on the type, weightage and your confidence. Generating a study plan replaces the estimate with real task times.`;
}

async function submit(form, editingId) {
  const values = formValues(form);
  if (!values.title || !values.module || !values.deadline) {
    form.querySelector(':invalid, .input:placeholder-shown')?.focus();
    return;
  }

  const payload = {
    title: values.title,
    module: values.module,
    type: values.type,
    deadline: values.deadline,
    weightage: Number(values.weightage) || 10,
    confidence: Number(values.confidence) || 0,
    description: values.description || '',
    userId: session.id,
  };
  if (editingId) payload.progress = Number(values.progress) || 0;

  closeOverlay({ silent: true });

  await mutate({
    run: () => (editingId ? api.updateAssignment(editingId, payload) : api.createAssignment(payload)),
    success: editingId ? 'Commitment updated' : 'Commitment added',
    detail: editingId
      ? 'Your priorities and workload have been recalculated.'
      : `${payload.title} is now part of your workload.`,
    failure: editingId ? 'We couldn\'t save those changes' : 'We couldn\'t add that commitment',
  });
}
