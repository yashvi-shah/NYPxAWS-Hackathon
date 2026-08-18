/* ==========================================================================
   availability.js — how many hours a student actually has, per weekday.

   This is the other half of the workload equation. The backend stores no
   availability, so it is kept on the device.

   FRONTEND REQUIREMENT: a per-user availability field (e.g. capacity hours by
   weekday on the user record) would let this follow the student between
   devices and let the server reason about realistic scheduling.
   ========================================================================== */

import { html, raw } from '../lib/dom.js';
import { preferences, DEFAULT_CAPACITY } from '../services/store.js';
import { openModal, closeOverlay } from '../ui/overlay.js';
import { refresh } from '../core/router.js';
import { toastOk } from '../ui/toast.js';
import { hours as fmtHours } from '../lib/format.js';

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday-first display, Sun..Sat storage
const NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function openAvailability() {
  const capacity = preferences.get('capacity').slice();
  const startHour = Number(preferences.get('dayStartHour')) || 19;

  openModal({
    title: 'Your available study time',
    description: 'Everything Gravity says about pressure is measured against these hours. Be honest rather than optimistic.',
    body: html`
      <div class="col gap-3" id="availability-rows">
        ${ORDER.map((day) => html`
          <div class="row-between">
            <label class="meta" for="cap-${day}" style="min-width:92px">${NAMES[day]}</label>
            <div class="row gap-3 grow" style="max-width:280px">
              <input class="range grow" type="range" id="cap-${day}" data-day="${day}" data-input="capacityChanged"
                     min="0" max="10" step="0.5" value="${capacity[day]}"
                     aria-label="Hours available on ${NAMES[day]}">
              <output class="mono" data-out="${day}" style="min-width:52px;text-align:right">${fmtHours(capacity[day])}</output>
            </div>
          </div>
        `)}
      </div>

      <div class="divider"></div>

      <div class="row-between">
        <div>
          <label class="label" for="cap-start">Study usually starts at</label>
          <p class="caption">Used to lay tonight's plan out on a clock.</p>
        </div>
        <input class="input" type="time" id="cap-start" step="900" value="${String(startHour).padStart(2, '0')}:00"
               style="width:130px">
      </div>

      <p class="well caption" id="cap-total" aria-live="polite"></p>
    `,
    foot: html`
      <button class="btn btn-quiet" data-act="resetAvailability">Reset to default</button>
      <div class="grow"></div>
      <button class="btn" data-act="closeOverlay">Cancel</button>
      <button class="btn btn-primary" data-act="saveAvailability">Save</button>
    `,
    initialFocus: '#cap-1',
    actions: {
      capacityChanged: (ds, el) => {
        const out = document.querySelector(`output[data-out="${el.dataset.day}"]`);
        if (out) out.textContent = fmtHours(Number(el.value));
        syncTotal();
      },
      resetAvailability: () => {
        DEFAULT_CAPACITY.forEach((value, day) => {
          const input = document.getElementById(`cap-${day}`);
          const out = document.querySelector(`output[data-out="${day}"]`);
          if (input) input.value = value;
          if (out) out.textContent = fmtHours(value);
        });
        syncTotal();
      },
      saveAvailability: () => {
        const next = preferences.get('capacity').slice();
        ORDER.forEach((day) => {
          const input = document.getElementById(`cap-${day}`);
          if (input) next[day] = Math.max(0, Number(input.value) || 0);
        });
        const time = document.getElementById('cap-start');
        const hour = time && time.value ? Number(time.value.split(':')[0]) : startHour;
        preferences.set({ capacity: next, dayStartHour: hour });
        closeOverlay({ silent: true });
        toastOk('Availability saved', { message: `${fmtHours(next.reduce((s, h) => s + h, 0))} of study time a week.` });
        refresh();
      },
    },
    onMount: () => syncTotal(),
  });
}

function syncTotal() {
  const target = document.getElementById('cap-total');
  if (!target) return;
  let total = 0;
  ORDER.forEach((day) => {
    const input = document.getElementById(`cap-${day}`);
    if (input) total += Number(input.value) || 0;
  });
  target.textContent = total > 0
    ? `That is ${fmtHours(total)} of study time a week to spread your work across.`
    : 'With no hours available, Gravity can only show deadlines — not whether you can meet them.';
}

/** Small inline control used on the dashboard and workload pages. */
export function availabilityButton(label = 'Adjust availability') {
  return html`
    <button class="btn btn-sm btn-quiet" data-act="openAvailability">
      ${raw('')}${label}
    </button>
  `;
}
