/* ==========================================================================
   shell.js — sign-in screen, application chrome and global actions.
   ========================================================================== */

import { html, raw, render, $ } from '../lib/dom.js';
import { icon, logoMark } from '../lib/icons.js';
import { session, levelInfo, preferences, invalidate, onUserChange } from '../services/store.js';
import { api } from '../services/api.js';
import { setLayer } from '../core/actions.js';
import { navigate, refresh, onRouteChange, currentRouteId } from '../core/router.js';
import { toast, toastError, toastOk } from './toast.js';
import { openAssignmentForm } from '../features/assignmentForm.js';
import { openAvailability } from '../features/availability.js';
import { openAssignmentDetail } from '../features/assignmentDetail.js';
import { firstName, initials, weekdayLong, monthLong } from '../lib/format.js';

export const NAV = [
  { id: 'today',       label: 'Today',       icon: 'dashboard',   title: 'Today', group: 'primary' },
  { id: 'commitments', label: 'Commitments', icon: 'assignments', title: 'Commitments', group: 'primary' },
  { id: 'workload',    label: 'Workload',    icon: 'workload',    title: 'Workload', group: 'primary' },
  { id: 'study-plans', label: 'Plans',       icon: 'plans',       title: 'Study plans', group: 'primary' },
  { id: 'calendar',    label: 'Calendar',    icon: 'calendar',    title: 'Calendar', group: 'primary' },
  { id: 'chat',        label: 'Chat',        icon: 'chat',        title: 'Chat', group: 'primary' },
  { id: 'my-gravity',  label: 'My Gravity',  icon: 'target',      title: 'My Gravity', group: 'primary' },
  { id: 'rewards',     label: 'Rewards',     icon: 'flame',       title: 'My Rewards', group: 'primary' },
  { id: 'community',   label: 'Community',   icon: 'community',   title: 'Community', group: 'secondary' },
  { id: 'progress',    label: 'Leaderboard', icon: 'leaderboard', title: 'Leaderboard', group: 'secondary' },
];

const navFlags = new Map();

/* --------------------------------------------------------------------------
   Theme
   -------------------------------------------------------------------------- */

export function initTheme() {
  // Check local preference first, then user's server-stored theme, then OS
  const stored = preferences.get('theme');
  const userTheme = session.user?.theme;
  const effective = stored || userTheme || null;

  if (effective && effective !== 'system') {
    applyTheme(effective);
  } else {
    applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const pref = preferences.get('theme') || session.user?.theme;
    if (!pref || pref === 'system') applyTheme(e.matches ? 'dark' : 'light');
  });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    render(btn, icon(theme === 'dark' ? 'sun' : 'moon', { size: 16 }));
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  preferences.set({ theme: next });
  applyTheme(next);
}

/** Restore user settings from server data after login (theme, profile pic). */
export function restoreUserSettings() {
  const user = session.user;
  if (!user) return;

  // Merge any locally saved settings that the server might not have
  try {
    const local = JSON.parse(localStorage.getItem('gravity.userSettings.v1') || '{}');
    if (local && typeof local === 'object') {
      const fields = ['displayName', 'profilePic', 'theme', 'year', 'semester'];
      for (const key of fields) {
        if (local[key] !== undefined && !user[key]) {
          session.merge({ [key]: local[key] });
        }
      }
    }
  } catch { /* ignore */ }

  const resolved = session.user;

  // Restore theme
  if (resolved.theme && resolved.theme !== 'system') {
    preferences.set({ theme: resolved.theme });
    applyTheme(resolved.theme);
  } else if (resolved.theme === 'system') {
    preferences.set({ theme: null });
    applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  // Restore profile pic on user chip
  setTimeout(() => {
    const chip = document.querySelector('.user-chip .avatar');
    if (!chip) return;
    if (resolved.profilePic) {
      chip.style.backgroundImage = `url(${resolved.profilePic})`;
      chip.style.backgroundSize = 'cover';
      chip.style.backgroundPosition = 'center';
      chip.textContent = '';
    }
  }, 50);
}

/* --------------------------------------------------------------------------
   Sign in
   -------------------------------------------------------------------------- */

export function renderAuthScreen(root, { onSignedIn }) {
  render(root, html`
    <div class="auth">
      <section class="auth-pitch">
        <div class="wordmark wordmark-lg">
          <span class="mark">${logoMark()}</span>
          <span class="name">Gravity</span>
        </div>
        <div>
          <h1>Know what to work on, and whether it actually fits.</h1>
          <p class="lede">
            Gravity reads your deadlines, weightings and confidence, then measures them
            against the hours you really have — so a heavy week is something you plan for
            instead of something you discover.
          </p>
        </div>
        <ul class="auth-flow">
          <li><span class="n">1</span><span><b>Capture</b> every assignment, its weight and how ready you feel.</span></li>
          <li><span class="n">2</span><span><b>See the pressure</b> before it arrives — which days are overloaded and by how much.</span></li>
          <li><span class="n">3</span><span><b>Work in order.</b> One clear next action, with the reasoning shown.</span></li>
        </ul>
        <p class="caption">Made for students, by students.</p>
      </section>

      <div class="auth-form-wrap">
        <div class="auth-form" style="text-align:center">
          <div>
            <h2>Welcome back</h2>
            <p class="meta" style="margin-top:4px">Sign in to pick up where your workload left off.</p>
          </div>
          <button class="btn btn-primary btn-lg btn-full" type="button" data-act="signInCognito" id="cognito-btn" style="margin-top:var(--sp-5)">
            Sign in to Gravity
          </button>
          <p class="caption" style="margin-top:var(--sp-4)">
            Use your Gravity account email and password.
          </p>
        </div>
      </div>
    </div>
  `);

  setLayer('global', {
    signInCognito: async () => {
      const btn = document.getElementById('cognito-btn');
      if (btn) { btn.setAttribute('aria-disabled', 'true'); btn.innerHTML = '<span class="spinner"></span> Redirecting...'; }
      const { signInWithCognito } = await import('../services/cognito.js');
      await signInWithCognito();
    },
  });
}

async function signIn(form, onSignedIn) {
  const button = form.querySelector('#signin-submit');
  const email = form.querySelector('[name="email"]').value.trim();
  const password = form.querySelector('[name="password"]').value;
  if (!email || !password) {
    toast('Enter your email and password', { tone: 'warn' });
    return;
  }

  const original = button.textContent;
  button.setAttribute('aria-disabled', 'true');
  button.innerHTML = String(html`<span class="spinner"></span>Signing in`);

  try {
    const result = await api.login(email, password);
    if (result && result.success && result.user) {
      session.set(result.user);
      invalidate();
      onSignedIn();
      toastOk(`Welcome back, ${firstName(result.user.name)}`, { message: 'Here is where your workload stands.' });
      return;
    }
    toast('Those details didn\'t match', {
      tone: 'error',
      message: 'Check the email and password, or use the demo account shown below.',
    });
  } catch (err) {
    toastError('We couldn\'t sign you in', err);
  } finally {
    button.removeAttribute('aria-disabled');
    button.textContent = original;
  }
}

/* --------------------------------------------------------------------------
   Application chrome
   -------------------------------------------------------------------------- */

export function renderShell(root) {
  const now = new Date();
  render(root, html`
    <div class="shell">
      <nav class="sidebar" aria-label="Main">
        <div class="sidebar-head">
          <a class="wordmark" href="#/today" data-act="goto" data-page="today" aria-label="Gravity home">
            <span class="mark">${logoMark()}</span>
            <span class="name">Gravity</span>
          </a>
        </div>

        <div class="nav-group" role="list">
          ${NAV.filter((n) => n.group === 'primary').map(navItem)}
        </div>
        <div class="nav-group nav-group-secondary" role="list">
          <span class="nav-group-label">Peers</span>
          ${NAV.filter((n) => n.group === 'secondary').map(navItem)}
        </div>

        <div class="sidebar-foot">
          <div class="user-chip" id="user-chip"></div>
        </div>
      </nav>

      <div class="main">
        <header class="topbar">
          <a class="wordmark topbar-brand" href="#/today" data-act="goto" data-page="today" style="display:none">
            <span class="mark">${logoMark()}</span>
          </a>
          <span class="topbar-date" id="topbar-clock">${weekdayLong(now)}, ${now.getDate()} ${monthLong(now.getMonth())} &middot; ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}</span>
          <div class="topbar-tools">
            <span class="streak-chip hide-narrow" id="streak-chip" data-tip="Days in a row you have kept moving"></span>
            ${NAV.filter((n) => n.group === 'secondary').map((n) => html`
              <a class="icon-btn only-narrow" href="#/${n.id}" data-act="goto" data-page="${n.id}"
                 data-nav="${n.id}" aria-label="${n.title}">${icon(n.icon, { size: 16 })}</a>
            `)}
            <a class="icon-btn" href="#/settings" data-act="goto" data-page="settings" aria-label="Settings"
                    data-tip="Settings">${icon('gear', { size: 16 })}</a>
            <button class="icon-btn" id="theme-toggle" data-act="toggleTheme" aria-label="Switch theme"></button>
            <div class="notif-wrap">
              <button class="icon-btn" id="notif-btn" aria-label="Notifications" data-tip="Notifications">
                ${icon('alert', { size: 16 })}
              </button>
              <div class="notif-dropdown" id="notif-dropdown"></div>
            </div>
            <button class="icon-btn hide-narrow" data-act="openAvailability" aria-label="Adjust your available study time"
                    data-tip="Available study time">${icon('sliders', { size: 16 })}</button>
            <button class="icon-btn" data-act="signOut" aria-label="Sign out" data-tip="Sign out">
              ${icon('logout', { size: 16 })}
            </button>
          </div>
        </header>

        <main class="view" id="view" tabindex="-1"></main>
      </div>
    </div>
  `);

  // Brand only shows once the sidebar head is out of the picture.
  const brand = root.querySelector('.topbar-brand');
  const applyBrand = () => {
    if (!brand) return;
    brand.style.display = window.matchMedia('(max-width: 780px)').matches ? 'inline-flex' : 'none';
  };
  applyBrand();
  window.addEventListener('resize', applyBrand);

  // Keep the topbar clock ticking.
  const tickClock = () => {
    const el = document.getElementById('topbar-clock');
    if (!el) return;
    const n = new Date();
    el.textContent = `${weekdayLong(n)}, ${n.getDate()} ${monthLong(n.getMonth())} \u00b7 ${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  };
  window.setInterval(tickClock, 30000);

  setLayer('global', {
    goto: (ds) => navigate(ds.page),
    toggleTheme,
    addAssignment: () => openAssignmentForm(),
    openAvailability,
    openAssignment: (ds) => openAssignmentDetail(ds.id),
    openAvailabilityFromPage: openAvailability,
    reloadPage: () => refresh(),
    signOut,
  });

  syncUser();
  onUserChange(syncUser);
  onRouteChange(syncNav);
  syncNav();
  preferences.subscribe(() => syncNav());

  // Ensure theme toggle button gets its icon now that the shell is rendered
  applyTheme(document.documentElement.dataset.theme || 'light');
}

function navItem(item) {
  return html`
    <a class="nav-link" role="listitem" href="#/${item.id}" data-act="goto" data-page="${item.id}"
       data-nav="${item.id}" data-tip="${item.title}">
      ${icon(item.icon, { size: 16 })}<span>${item.label}</span>
    </a>
  `;
}

/** Highlight the active destination and surface any urgent count. */
export function syncNav() {
  const active = currentRouteId();
  document.querySelectorAll('[data-nav]').forEach((link) => {
    const isActive = link.dataset.nav === active;
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');

    const flag = navFlags.get(link.dataset.nav);
    const existing = link.querySelector('.nav-flag');
    if (flag) {
      if (existing) existing.textContent = String(flag);
      else {
        const el = document.createElement('span');
        el.className = 'nav-flag';
        el.textContent = String(flag);
        el.title = 'Needs attention';
        link.appendChild(el);
      }
    } else if (existing) {
      existing.remove();
    }
  });
}

/** Pages call this once they know how many items are urgent. */
export function setNavFlag(id, count) {
  if (count > 0) navFlags.set(id, count);
  else navFlags.delete(id);
  syncNav();
}

export function syncUser() {
  const user = session.user;
  const chip = document.getElementById('user-chip');
  if (chip && user) {
    const info = levelInfo();
    const name = user.displayName || user.name || '';
    render(chip, html`
      <span class="avatar" aria-hidden="true">${initials(name)}</span>
      <span class="user-text grow">
        <span class="user-name truncate">${name}</span>
        <span class="user-sub num">Level ${info.level} · ${(user.xp || 0).toLocaleString()} XP</span>
      </span>
    `);
    chip.setAttribute('title', `${name} — Level ${info.level}`);

    // Apply profile pic to avatar
    const avatar = chip.querySelector('.avatar');
    if (avatar && user.profilePic) {
      avatar.style.backgroundImage = `url(${user.profilePic})`;
      avatar.style.backgroundSize = 'cover';
      avatar.style.backgroundPosition = 'center';
      avatar.textContent = '';
    }
  }

  const streak = document.getElementById('streak-chip');
  if (streak) {
    const days = Number(user?.streak) || 0;
    render(streak, html`${icon('flame', { size: 13 })}<span class="num">${days}</span>`);
    streak.style.display = days > 0 ? 'inline-flex' : 'none';
  }
}

function signOut() {
  const hasCognitoTokens = Boolean(localStorage.getItem('gravity.cognito.tokens'));
  session.clear();
  invalidate();
  window.location.hash = '';
  if (hasCognitoTokens) {
    // Sign out through Cognito to clear their session too
    localStorage.removeItem('gravity.cognito.tokens');
    import('../services/cognito.js').then(m => m.signOutCognito());
  } else {
    window.location.reload();
  }
}

/** Ctrl/Cmd + 1…7 jumps between destinations; kept from the original app. */
export function initShortcuts() {
  document.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) return;
    const index = Number(event.key);
    if (!Number.isInteger(index) || index < 1 || index > NAV.length) return;
    event.preventDefault();
    navigate(NAV[index - 1].id);
  });

  // "/" focuses the list filter when a page offers one.
  document.addEventListener('keydown', (event) => {
    if (event.key !== '/' || event.metaKey || event.ctrlKey) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const search = $('#view input[type="search"]');
    if (search) {
      event.preventDefault();
      search.focus();
      search.select();
    }
  });
}

export { raw as _raw };
