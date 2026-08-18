/* ==========================================================================
   app.js — entry point.
   Layers: pages → features → ui → core → services → existing backend.
   ========================================================================== */

import { initDelegation } from './core/actions.js';
import { registerRoutes, startRouter } from './core/router.js';
import { session, refreshUser } from './services/store.js';
import { initTheme, renderShell, renderAuthScreen, initShortcuts, syncUser } from './ui/shell.js';

import today from './pages/today.js';
import commitments from './pages/commitments.js';
import workload from './pages/workload.js';
import plans from './pages/plans.js';
import calendar from './pages/calendar.js';
import community from './pages/community.js';
import progress from './pages/progress.js';
import chat from './pages/chat.js';
import settings from './pages/settings.js';
import universe from './pages/universe.js';
import rewards from './pages/rewards.js';

const ROUTES = [
  { id: 'today',       title: 'Today',       render: today.render },
  { id: 'commitments', title: 'Commitments', render: commitments.render },
  { id: 'workload',    title: 'Workload',    render: workload.render },
  { id: 'study-plans', title: 'Study plans', render: plans.render },
  { id: 'calendar',    title: 'Calendar',    render: calendar.render },
  { id: 'community',   title: 'Community',   render: community.render },
  { id: 'progress',    title: 'Leaderboard', render: progress.render },
  { id: 'chat',        title: 'Chat',        render: chat.render },
  { id: 'my-gravity',  title: 'My Gravity',  render: universe.render },
  { id: 'rewards',     title: 'My Rewards',  render: rewards.render },
  { id: 'settings',    title: 'Settings',    render: settings.render },
];

/** Links kept working after old route IDs were renamed. */
const ALIASES = { analytics: 'workload', dashboard: 'today', assignments: 'commitments', leaderboard: 'progress' };

function normaliseHash() {
  const current = window.location.hash.replace(/^#\/?/, '').split(/[?/]/)[0];
  if (ALIASES[current]) window.location.replace(`#/${ALIASES[current]}`);
}

function startApp(root) {
  // Apply any locally tracked XP deductions from rewards
  applyRewardDeductions();

  renderShell(root);
  initShortcuts();
  normaliseHash();
  startRouter('today');

  // Init notifications bell
  import('./features/notifications.js').then((m) => m.initNotifications());

  // Keep the streak and XP chip honest without disturbing the page.
  window.setInterval(() => {
    if (!session.isSignedIn() || document.hidden) return;
    refreshUser().then(() => { applyRewardDeductions(); syncUser(); });
  }, 60000);
}

/** Deduct locally-tracked reward spending from session XP */
function applyRewardDeductions() {
  const spent = Number(localStorage.getItem('gravity.xpSpent.v1')) || 0;
  if (spent > 0 && session.user) {
    const serverXp = session.user.xp || 0;
    const adjusted = Math.max(0, serverXp - spent);
    if (session.user.xp !== adjusted) {
      session.merge({ xp: adjusted });
    }
  }
}

function boot() {
  const root = document.getElementById('app');
  if (!root) return;

  initTheme();
  initDelegation(document.body);
  registerRoutes(ROUTES);

  if (session.isSignedIn()) startApp(root);
  else renderAuthScreen(root, { onSignedIn: () => startApp(root) });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
