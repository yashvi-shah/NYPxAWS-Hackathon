/* ==========================================================================
   leaderboard.js — progress and recognition, kept deliberately quiet.
   Motivation sits behind the work, never in front of it: no giant counters,
   no arcade styling, just where you are and what is left to earn.
   ========================================================================== */

import { html, raw, render, pct } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../services/api.js';
import { session, levelInfo } from '../services/store.js';
import { setLayer } from '../core/actions.js';
import { pageLoading, emptyState, errorState } from '../ui/states.js';
import { panel, avatar, statBlock } from '../ui/bits.js';
import { plural } from '../lib/format.js';

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
  render(view, pageLoading({ title: 'Progress', note: 'Loading your standing…', kind: 'grid' }));

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
  const me = students.find((s) => s.id === session.id);
  const myRank = me ? students.indexOf(me) + 1 : null;
  const earned = new Set(session.user?.badges || []);

  render(view, html`
    ${header()}
    ${levelStrip({ myRank, total: students.length, earned: earned.size, badgeCount: allBadges.length })}

    <div class="grid-halves">
      ${panel({
        title: 'Students by XP',
        note: students.length ? plural(students.length, 'student') : '',
        body: students.length
          ? html`
            <div>
              ${students.map((student, index) => row(student, index))}
            </div>
          `
          : emptyState({ mark: 'users', title: 'No one on the board yet.', message: 'XP is earned by finishing work and helping peers.', inline: true }),
        foot: myRank ? html`
          <span class="caption">You are ${myRank === 1 ? 'top of the board' : `${myRank} of ${students.length}`}. XP comes from finishing work, keeping a streak and answering other students.</span>
        ` : null,
      })}

      ${panel({
        title: 'Badges',
        note: `${earned.size} of ${allBadges.length} earned`,
        body: allBadges.length
          ? html`
            <div class="badge-grid">
              ${allBadges.map((badge) => badgeTile(badge, earned.has(badge.id)))}
            </div>
          `
          : emptyState({ mark: 'award', title: 'No badges available.', message: 'Nothing to show here yet.', inline: true }),
      })}
    </div>
  `);
}

function header() {
  return html`
    <div class="page-head">
      <div>
        <h1>Progress</h1>
        <p class="page-sub">A quiet record of what you have kept on top of — and how your cohort is doing.</p>
      </div>
    </div>
  `;
}

function levelStrip({ myRank, total, earned, badgeCount }) {
  const info = levelInfo();
  const user = session.user || {};
  const toNext = Math.max(0, (info.xpForNextLevel || 0) - (info.currentXp || 0));

  return panel({
    body: html`
      <div class="level-strip">
        ${avatar(user, { large: true })}
        <div>
          <div class="row-baseline gap-2">
            <span class="stat-value" style="font-size:var(--fs-title)">Level ${info.level}</span>
            <span class="meta num">${(user.xp || 0).toLocaleString()} XP</span>
          </div>
          <span class="caption">${toNext} XP to level ${info.level + 1}</span>
        </div>

        <div class="grow">
          <div class="bar bar-lg" role="progressbar" aria-valuenow="${info.currentXp}" aria-valuemin="0"
               aria-valuemax="${info.xpForNextLevel}" aria-label="Progress to next level">
            <i style="width:${pct(info.currentXp, info.xpForNextLevel)}%"></i>
          </div>
        </div>

        <div class="stat-grid" style="border-left:1px solid var(--line);min-width:290px">
          ${statBlock({ label: 'Streak', value: user.streak || 0, unit: 'days' })}
          ${statBlock({ label: 'Badges', value: `${earned}/${badgeCount}` })}
          ${statBlock({ label: 'Rank', value: myRank ? `${myRank}` : '—', sub: total ? `of ${total}` : '' })}
        </div>
      </div>
    `,
  });
}

function row(student, index) {
  const isMe = student.id === session.id;
  const level = student.levelInfo?.level ?? 1;
  return html`
    <div class="lb-row ${isMe ? 'is-me' : ''} ${index < 3 ? 'is-top' : ''}">
      <span class="lb-rank">${index + 1}</span>
      ${avatar(student)}
      <div style="min-width:0">
        <div class="lb-name truncate">${student.name}${isMe ? html` <span class="caption">· you</span>` : raw('')}</div>
        <div class="lb-sub truncate">
          ${student.course || 'Student'} · Level ${level}${Number(student.streak) > 0 ? ` · ${student.streak} day streak` : ''}
        </div>
      </div>
      <div class="lb-xp num">
        ${(student.xp || 0).toLocaleString()}
        <small>XP</small>
      </div>
    </div>
  `;
}

function badgeTile(badge, isEarned) {
  return html`
    <div class="badge-tile ${isEarned ? 'is-earned' : 'is-locked'}">
      <div class="bt-top">
        <span class="bt-mark">${icon(isEarned ? (BADGE_ICONS[badge.id] || 'award') : 'lock', { size: 12 })}</span>
        <span class="bt-name">${badge.name}</span>
      </div>
      <span class="bt-desc">${badge.description}</span>
      <span class="caption ${isEarned ? 't-ok' : ''}">${isEarned ? 'Earned' : `+${badge.xpReward} XP`}</span>
    </div>
  `;
}

async function reload() {
  const { refresh } = await import('../core/router.js');
  refresh();
}

export default { render: render_ };
