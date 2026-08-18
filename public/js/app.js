/* ==========================================================================
   app.js — entry point.
   Layers: pages → features → ui → core → services → existing backend.
   ========================================================================== */

import { initDelegation } from './core/actions.js';
import { registerRoutes, startRouter } from './core/router.js';
import { session, refreshUser } from './services/store.js';
import { initTheme, renderShell, renderAuthScreen, initShortcuts, syncUser } from './ui/shell.js';

import dashboard from './pages/dashboard.js';
import assignments from './pages/assignments.js';
import workload from './pages/workload.js';
import plans from './pages/plans.js';
import calendar from './pages/calendar.js';
import community from './pages/community.js';
import leaderboard from './pages/leaderboard.js';

const ROUTES = [
  { id: 'dashboard',   title: 'Today',       render: dashboard.render },
  { id: 'assignments', title: 'Commitments', render: assignments.render },
  { id: 'workload',    title: 'Workload',    render: workload.render },
  { id: 'study-plans', title: 'Study plans', render: plans.render },
  { id: 'calendar',    title: 'Calendar',    render: calendar.render },
  { id: 'community',   title: 'Community',   render: community.render },
  { id: 'leaderboard', title: 'Progress',    render: leaderboard.render },
];

/** Links kept working after the analytics page became the workload page. */
const ALIASES = { analytics: 'workload' };

function normaliseHash() {
  const current = window.location.hash.replace(/^#\/?/, '').split(/[?/]/)[0];
  if (ALIASES[current]) window.location.replace(`#/${ALIASES[current]}`);
}

function startApp(root) {
  renderShell(root);
  initShortcuts();
  normaliseHash();
  startRouter('dashboard');

  // Keep the streak and XP chip honest without disturbing the page.
  window.setInterval(() => {
    if (!session.isSignedIn() || document.hidden) return;
    refreshUser().then(syncUser);
  }, 60000);
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
