/* ==========================================================================
   assignmentForm.js — add / edit an academic commitment.

   CRITICAL: This uses a div NOT a form to prevent any native browser
   form submission. The ONLY way to create/save a commitment is by clicking
   the explicit "Add commitment" / "Save changes" button.
   ========================================================================== */

import { html, raw } from '../lib/dom.js';
import { api } from '../services/api.js';
import { session } from '../services/store.js';
import { dayKey, addDays } from '../lib/format.js';
import { openModal, closeOverlay } from '../ui/overlay.js';
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
      <div id="assignment-form" class="col gap-4">
        <div class="field">
          <label for="af-title">Title</label>
          <input class="input" id="af-title" maxlength="120"
                 placeholder="e.g. Machine Learning Classification Model" value="${a.title || ''}">
        </div>

        <div class="field">
          <label for="af-module">Module</label>
          <input class="input" id="af-module" maxlength="80"
                 placeholder="e.g. IT3402 - AI &amp; ML" value="${a.module || ''}">
        </div>

        <div class="field-row">
          <div class="field">
            <label for="af-type">Type of work</label>
            <select class="select" id="af-type" data-input="previewEffort">
              ${TYPES.map((t) => html`<option value="${t}" ${a.type === t ? raw('selected') : raw('')}>${t}</option>`)}
            </select>
          </div>
          <div class="field">
            <label for="af-deadline">Deadline</label>
            <input class="input" type="date" id="af-deadline" value="${defaultDeadline}">
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label for="af-weightage">Weightage
              <span class="field-hint">share of the module grade</span>
            </label>
            <div class="row gap-3">
              <input class="range grow" type="range" id="af-weightage" min="1" max="100" step="1"
                     value="${a.weightage ?? 10}" data-input="previewEffort" aria-describedby="af-weightage-out">
              <output class="mono" id="af-weightage-out" style="min-width:38px;text-align:right">${a.weightage ?? 10}%</output>
            </div>
          </div>
          <div class="field">
            <label for="af-confidence">Confidence
              <span class="field-hint">how ready do you feel?</span>
            </label>
            <div class="row gap-3">
              <input class="range grow" type="range" id="af-confidence" min="0" max="100" step="5"
                     value="${a.confidence ?? 50}" data-input="previewEffort" aria-describedby="af-confidence-out">
              <output class="mono" id="af-confidence-out" style="min-width:38px;text-align:right">${a.confidence ?? 50}%</output>
            </div>
          </div>
        </div>

        ${editing ? html`
          <div class="field">
            <label for="af-progress">Progress</label>
            <div class="row gap-3">
              <input class="range grow" type="range" id="af-progress" min="0" max="100" step="5"
                     value="${a.progress ?? 0}" data-input="previewEffort" aria-describedby="af-progress-out">
              <output class="mono" id="af-progress-out" style="min-width:38px;text-align:right">${a.progress ?? 0}%</output>
            </div>
          </div>
        ` : raw('')}

        <div class="field">
          <label for="af-description">Details <span class="field-hint">optional</span></label>
          <textarea class="textarea" id="af-description"
                    placeholder="Requirements, deliverables, anything you'll forget by next week…">${a.description || ''}</textarea>
        </div>

        <p class="well caption" id="af-estimate" aria-live="polite"></p>
      </div>
    `,
    foot: html`
      <button class="btn" data-act="closeOverlay" type="button">Cancel</button>
      <button class="btn btn-primary" data-act="submitAssignmentButton" type="button">
        ${editing ? 'Save changes' : 'Add commitment'}
      </button>
    `,
    initialFocus: '#af-title',
    actions: {
      previewEffort: () => syncPreview(),
      submitAssignmentButton: () => submitFromButton(editing ? a.id : null),
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

/**
 * Called ONLY when the user explicitly clicks "Add commitment" / "Save changes".
 * Reads all field values directly from the DOM (no native form submission involved).
 */
async function submitFromButton(editingId) {
  const val = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };

  const title = val('af-title');
  const module = val('af-module');
  const deadline = val('af-deadline');

  // Validate required fields
  if (!title) { document.getElementById('af-title')?.focus(); return; }
  if (!module) { document.getElementById('af-module')?.focus(); return; }
  if (!deadline) { document.getElementById('af-deadline')?.focus(); return; }

  const payload = {
    title,
    module,
    type: val('af-type') || 'Essay',
    deadline,
    weightage: Number(val('af-weightage')) || 10,
    confidence: Number(val('af-confidence')) || 0,
    description: val('af-description') || '',
    userId: session.id,
  };
  if (editingId) payload.progress = Number(val('af-progress')) || 0;

  // Close modal FIRST then fire the API call
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
