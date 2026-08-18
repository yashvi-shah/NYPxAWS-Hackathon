/* ==========================================================================
   progress.js — Leaderboard & Achievements.
   Compete with peers and earn badges.
   ========================================================================== */

import { html, raw, render } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../services/api.js';
import { session } from '../services/store.js';
import { setLayer } from '../core/actions.js';
import { pageLoading, emptyState, errorState } from '../ui/states.js';
import { avatar } from '../ui/bits.js';

/** Badge ids come from the backend; these are their icons in our own set. */
const BADGE_ICONS = {
  'first-assignment': 'target',
  'streak-3': 'flame',
  'streak-7': 'zap',
  'early-bird': 'clock',
  helper: 'users',
  planner: 'plans',
  'all-clear': 'checkCircle',
  social: 'message',
  'level-5': 'book',
  'level-10': 'award',
};

export async function render_(view, ctx) {
  render(view, pageLoading({ title: 'Leaderboard & Achievements', note: 'Loading your standing...', kind: 'grid' }));

  const [board, badges] = await Promise.allSettled([api.leaderboard(), api.badges()]);
  if (!ctx.isCurrent()) return;

  setLayer('page', { retryProgress: reload });

  if (board.status === 'rejected' && badges.status === 'rejected') {
    render(view, html`
      ${header()}
      ${errorState({
        title: 'Your progress didn\'t load',
        message: 'Nothing has been changed. Try again in a moment.',
        retry: 'retryProgress',
      })}
    `);
    return;
  }

  const students = board.status === 'fulfilled' ? (board.value || []) : [];
  const allBadges = badges.status === 'fulfilled' ? (badges.value || []) : [];
  const earned = new Set(session.user?.badges || []);

  render(view, html`
    ${header()}

    <div class="lb-layout">
      ${topStudentsPanel(students)}
      ${badgesPanel(allBadges, earned)}
    </div>
  `);
}

function header() {
  return html`
    <div class="page-head">
      <div>
        <h1>${icon('award', { size: 22 })} Leaderboard & Achievements</h1>
        <p class="page-sub">Compete with peers and earn badges</p>
      </div>
    </div>
  `;
}

/* --------------------------------------------------------------------------
   Top Students
   -------------------------------------------------------------------------- */

function topStudentsPanel(students) {
  return html`
    <section class="lb-section">
      <h2 class="lb-section-title">${icon('leaderboard', { size: 16 })} Top Students</h2>
      ${students.length ? html`
        <div class="lb-list">
          ${students.map((student, index) => studentRow(student, index))}
        </div>
      ` : html`
        <div class="card" style="padding:var(--sp-5)">
          ${emptyState({ mark: 'users', title: 'No one on the board yet.', message: 'XP is earned by finishing work and helping peers.', inline: true })}
        </div>
      `}
    </section>
  `;
}

function studentRow(student, index) {
  const isMe = student.id === session.id;
  const level = student.levelInfo?.level ?? 1;
  const streak = Number(student.streak) || 0;

  return html`
    <div class="lb-student-row card ${isMe ? 'lb-student-me' : ''}">
      <span class="lb-student-rank">${index + 1}</span>
      ${avatar(student)}
      <div class="lb-student-info">
        <span class="lb-student-name">${student.name}${isMe ? ' (You)' : ''}</span>
        <span class="lb-student-meta">
          ${student.course || 'Student'}
          ${level ? ` \u2022 Level ${level}` : ''}
          ${streak > 0 ? html` \u2022 ${icon('flame', { size: 12 })} ${streak} day streak` : raw('')}
        </span>
      </div>
      <span class="lb-student-xp">${(student.xp || 0).toLocaleString()} XP</span>
    </div>
  `;
}

/* --------------------------------------------------------------------------
   Badges
   -------------------------------------------------------------------------- */

function badgesPanel(allBadges, earned) {
  return html`
    <section class="lb-section">
      <h2 class="lb-section-title">${icon('award', { size: 16 })} Badges</h2>
      ${allBadges.length ? html`
        <div class="lb-badges-grid">
          ${allBadges.map((badge) => badgeTile(badge, earned.has(badge.id)))}
        </div>
      ` : html`
        <div class="card" style="padding:var(--sp-5)">
          ${emptyState({ mark: 'award', title: 'No badges available.', message: 'Nothing to show here yet.', inline: true })}
        </div>
      `}
    </section>
  `;
}

function badgeTile(badge, isEarned) {
  const iconName = BADGE_ICONS[badge.id] || 'award';
  return html`
    <div class="lb-badge-tile card ${isEarned ? 'lb-badge-earned' : 'lb-badge-locked'}">
      <div class="lb-badge-icon">
        ${icon(isEarned ? iconName : 'lock', { size: 20 })}
      </div>
      <span class="lb-badge-name">${badge.name}</span>
      <span class="lb-badge-desc">${badge.description}</span>
      ${isEarned
        ? html`<span class="lb-badge-status lb-badge-status-earned">Earned</span>`
        : html`<span class="lb-badge-status lb-badge-status-locked">+${badge.xpReward} XP</span>`}
    </div>
  `;
}

/* -------------------------------------------------------------------------- */

async function reload() {
  const { refresh } = await import('../core/router.js');
  refresh();
}

export default { render: render_ };
