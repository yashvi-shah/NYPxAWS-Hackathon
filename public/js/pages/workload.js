/* ==========================================================================
   workload.js — Track your productivity and study habits.
   A dashboard-style view: stat cards, weekly workload chart, module breakdown,
   and recent XP activity.
   ========================================================================== */

import { html, raw, render, pct } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { myWorkspace, analyticsFor, session } from '../services/store.js';
import { setLayer } from '../core/actions.js';
import { navigate } from '../core/router.js';
import { pageLoading, emptyState, errorState } from '../ui/states.js';
import { openAssignmentDetail } from '../features/assignmentDetail.js';
import { openAssignmentForm } from '../features/assignmentForm.js';
import { formatDate } from '../lib/format.js';

export async function render_(view, ctx) {
  render(view, pageLoading({ title: 'Workload', note: 'Measuring your work against your time...', kind: 'grid' }));

  let assignments = [];
  let plans = [];
  let analytics = null;

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
    analytics = null;
  }

  if (!ctx.isCurrent()) return;
  registerActions({ assignments, plans });

  const completionRate = analytics?.completionRate || 0;
  const totalAssignments = analytics?.totalAssignments || assignments.length;
  const streak = analytics?.streak || session.user?.streak || 0;
  const avgProgress = analytics?.averageProgress || 0;
  const weeklyLoad = analytics?.weeklyLoad || [];
  const moduleBreakdown = analytics?.moduleBreakdown || [];
  const xpHistory = (analytics?.xpHistory || []).slice().reverse();

  render(view, html`
    ${header()}

    <div class="wl-stats-row">
      ${statCard('Completion Rate', `${completionRate}%`)}
      ${statCard('Total Assignments', `${totalAssignments}`)}
      ${statCard('Study Streak', `${streak}`, icon('flame', { size: 18 }))}
      ${statCard('Avg Progress', `${avgProgress}%`)}
    </div>

    <div class="wl-grid-halves">
      ${weeklyPanel(weeklyLoad)}
      ${modulePanel(moduleBreakdown)}
    </div>

    ${xpPanel(xpHistory)}
  `);
}

function header() {
  return html`
    <div class="page-head">
      <div>
        <h1>Workload</h1>
        <p class="page-sub">Track your productivity and study habits</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" data-act="addFromWorkload">${icon('plus', { size: 15 })}Add commitment</button>
      </div>
    </div>
  `;
}

/* --------------------------------------------------------------------------
   Stat cards row
   -------------------------------------------------------------------------- */

function statCard(label, value, iconEl) {
  return html`
    <div class="wl-stat-card card">
      <span class="wl-stat-label">${label}</span>
      <span class="wl-stat-value">
        ${iconEl ? html`<span class="wl-stat-icon">${iconEl}</span>` : raw('')}${value}
      </span>
    </div>
  `;
}

/* --------------------------------------------------------------------------
   Weekly Workload (Next 8 Weeks)
   -------------------------------------------------------------------------- */

function weeklyPanel(weeklyLoad) {
  const maxCount = Math.max(...weeklyLoad.map((w) => w.count), 1);

  return html`
    <section class="card wl-panel">
      <header class="card-head">
        <h3>${icon('workload', { size: 16 })} Weekly Workload (Next 8 Weeks)</h3>
      </header>
      <div class="wl-chart-area">
        <div class="wl-chart">
          ${weeklyLoad.map((week) => {
            const height = week.count > 0 ? Math.max(pct(week.count, maxCount), 8) : 0;
            return html`
              <div class="wl-bar-col">
                <span class="wl-bar-count">${week.count > 0 ? week.count : ''}</span>
                <div class="wl-bar-track">
                  <div class="wl-bar-fill wl-bar-${week.intensity}" style="height:${height}%"></div>
                </div>
                <span class="wl-bar-label">W${week.week.replace('Week ', '')}</span>
              </div>
            `;
          })}
        </div>
      </div>
    </section>
  `;
}

/* --------------------------------------------------------------------------
   Module Breakdown
   -------------------------------------------------------------------------- */

function modulePanel(moduleBreakdown) {
  return html`
    <section class="card wl-panel">
      <header class="card-head">
        <h3>${icon('layers', { size: 16 })} Module Breakdown</h3>
      </header>
      <div class="wl-module-list">
        ${moduleBreakdown.length ? moduleBreakdown.map((m) => html`
          <div class="wl-module-row">
            <span class="wl-module-name truncate">${m.name}</span>
            <span class="wl-module-count">${m.completed}/${m.total}</span>
          </div>
        `) : html`
          <div class="wl-module-row">
            <span class="wl-module-name" style="color:var(--ink-3)">No modules yet</span>
          </div>
        `}
      </div>
    </section>
  `;
}

/* --------------------------------------------------------------------------
   Recent XP Activity
   -------------------------------------------------------------------------- */

function xpPanel(xpHistory) {
  return html`
    <section class="card wl-panel">
      <header class="card-head">
        <h3>${icon('trendUp', { size: 16 })} Recent XP Activity</h3>
      </header>
      ${xpHistory.length ? html`
        <div class="wl-xp-list">
          ${xpHistory.map((entry) => html`
            <div class="wl-xp-row">
              <div class="wl-xp-info">
                <span class="wl-xp-reason">${entry.reason}</span>
                <span class="wl-xp-date">${formatDate(entry.date)}</span>
              </div>
              <span class="wl-xp-amount ${Number(entry.amount) >= 0 ? 'is-positive' : 'is-negative'}">
                ${Number(entry.amount) > 0 ? '+' : ''}${entry.amount} XP
              </span>
            </div>
          `)}
        </div>
      ` : html`
        <div style="padding:var(--sp-5)">
          ${emptyState({
            mark: 'trendUp',
            title: 'Nothing logged yet.',
            message: 'Finishing work and helping peers shows up here as it happens.',
            inline: true,
          })}
        </div>
      `}
    </section>
  `;
}

/* --------------------------------------------------------------------------
   Actions
   -------------------------------------------------------------------------- */

function registerActions({ assignments, plans }) {
  setLayer('page', {
    retryWorkload: reload,
    openAssignment: (ds) => openAssignmentDetail(ds.id),
    gotoPlans: () => navigate('study-plans'),
    gotoAssignments: () => navigate('commitments'),
    addFromWorkload: () => openAssignmentForm(),
  });
}

async function reload() {
  const { invalidate } = await import('../services/store.js');
  invalidate();
  const { refresh } = await import('../core/router.js');
  refresh();
}

export default { render: render_ };
