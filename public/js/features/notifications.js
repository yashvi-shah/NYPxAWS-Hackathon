/* ==========================================================================
   notifications.js — Deadline countdown alerts in a topbar dropdown.
   ========================================================================== */

import { html, raw, render } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { myWorkspace } from '../services/store.js';
import { daysUntil, moduleCode } from '../lib/format.js';
import { deadlineTone } from '../core/priority.js';
import { openAssignmentDetail } from './assignmentDetail.js';

let isOpen = false;

export function initNotifications() {
  const btn = document.getElementById('notif-btn');
  if (!btn) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown();
  });
  document.addEventListener('click', (e) => {
    if (isOpen && !e.target.closest('.notif-wrap')) closeDropdown();
  });
}

async function toggleDropdown() {
  if (isOpen) { closeDropdown(); return; }
  isOpen = true;
  const dropdown = document.getElementById('notif-dropdown');
  if (!dropdown) return;

  let assignments = [];
  try {
    ({ assignments } = await myWorkspace());
  } catch { /* show empty */ }

  const open = assignments
    .filter((a) => a.status !== 'completed' && a.deadline)
    .sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)));

  const alerts = open.slice(0, 6).map((a) => {
    const d = daysUntil(a.deadline);
    const tone = deadlineTone(a);
    let message = '';
    if (d < 0) message = `${Math.abs(d)} day${Math.abs(d) !== 1 ? 's' : ''} overdue`;
    else if (d === 0) message = 'Due today';
    else if (d === 1) message = 'Due tomorrow';
    else message = `Due in ${d} days`;
    return { assignment: a, message, tone, days: d };
  });

  const recentDone = assignments
    .filter((a) => a.status === 'completed')
    .slice(-2)
    .reverse();

  dropdown.classList.add('is-open');
  render(dropdown, html`
    <div class="notif-header">
      <span class="notif-title">Notifications</span>
      <button class="icon-btn notif-close-btn" aria-label="Close">
        ${icon('close', { size: 14 })}
      </button>
    </div>
    <div class="notif-list">
      ${alerts.length ? alerts.map((alert) => html`
        <button class="notif-item" data-id="${alert.assignment.id}">
          <span class="notif-icon t-${alert.tone}">${icon(alert.days <= 1 ? 'alert' : 'clock', { size: 14 })}</span>
          <div class="notif-info">
            <span class="notif-item-title truncate">${alert.assignment.title}</span>
            <span class="notif-item-meta">${moduleCode(alert.assignment.module)} &middot; ${alert.assignment.weightage ?? 0}% of grade</span>
          </div>
          <span class="notif-countdown ${alert.tone === 'risk' ? 't-risk' : alert.tone === 'warn' ? 't-warn' : ''}">${alert.message}</span>
        </button>
      `) : html`<p class="notif-empty">No upcoming deadlines</p>`}
      ${recentDone.length ? html`
        <div class="notif-section-label">Completed</div>
        ${recentDone.map((a) => html`
          <div class="notif-item notif-item-done">
            <span class="notif-icon t-ok">${icon('checkCircle', { size: 14 })}</span>
            <div class="notif-info">
              <span class="notif-item-title truncate">${a.title}</span>
              <span class="notif-item-meta">${moduleCode(a.module)}</span>
            </div>
            <span class="notif-countdown" style="color:var(--ok)">Done</span>
          </div>
        `)}
      ` : raw('')}
    </div>
  `);

  // Wire up click handlers
  dropdown.querySelectorAll('.notif-item[data-id]').forEach((el) => {
    el.addEventListener('click', () => {
      closeDropdown();
      openAssignmentDetail(el.dataset.id);
    });
  });

  // Close button
  const closeBtn = dropdown.querySelector('.notif-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeDropdown(); });
}

function closeDropdown() {
  isOpen = false;
  const dropdown = document.getElementById('notif-dropdown');
  if (dropdown) dropdown.classList.remove('is-open');
}
