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
  const stored = preferences.get('theme');
  applyTheme(stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!preferences.get('theme')) applyTheme(e.matches ? 'dark' : 'light');
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
        <form class="auth-form" data-act="signIn" novalidate>
          <div>
            <h2>Sign in</h2>
            <p class="meta" style="margin-top:4px">Pick up where your workload left off.</p>
          </div>
          <div class="field">
            <label for="signin-email">Email</label>
            <input class="input" id="signin-email" name="email" type="email" autocomplete="username"
                   required value="alex@studysphere.com">
          </div>
          <div class="field">
            <label for="signin-password">Password</label>
            <input class="input" id="signin-password" name="password" type="password"
                   autocomplete="current-password" required value="demo123">
          </div>
          <button class="btn btn-primary btn-lg btn-full" type="submit" id="signin-submit">Sign in</button>
          <p class="auth-demo">
            Demo account — <code>alex@studysphere.com</code> / <code>demo123</code>.
            Other students: sarah, marcus, priya, jake (same password).
          </p>
        </form>
      </div>
    </div>
  `);

  setLayer('global', {
    signIn: (ds, form) => signIn(form, onSignedIn),
  });

  const email = document.getElementById('signin-email');
  if (email) email.focus({ preventScroll: true });
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
          <span class="topbar-date">${weekdayLong(now)}, ${now.getDate()} ${monthLong(now.getMonth())}</span>
          <div class="topbar-tools">
            <span class="streak-chip hide-narrow" id="streak-chip" data-tip="Days in a row you have kept moving"></span>
            ${NAV.filter((n) => n.group === 'secondary').map((n) => html`
              <a class="icon-btn only-narrow" href="#/${n.id}" data-act="goto" data-page="${n.id}"
                 data-nav="${n.id}" aria-label="${n.title}">${icon(n.icon, { size: 16 })}</a>
            `)}
            <a class="icon-btn" href="#/settings" data-act="goto" data-page="settings" aria-label="Settings"
                    data-tip="Settings">${icon('gear', { size: 16 })}</a>
            <button class="icon-btn" id="theme-toggle" data-act="toggleTheme" aria-label="Switch theme"></button>
            <button class="icon-btn hide-narrow" data-act="openAvailability" aria-label="Adjust your available study time"
                    data-tip="Available study time">${icon('sliders', { size: 16 })}</button>
            <button class="btn btn-primary btn-sm" data-act="addAssignment" aria-label="Add a commitment">
              ${icon('plus', { size: 15 })}<span class="add-label">Add</span>
            </button>
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
    render(chip, html`
      <span class="avatar" aria-hidden="true">${initials(user.name)}</span>
      <span class="user-text grow">
        <span class="user-name truncate">${user.name}</span>
        <span class="user-sub num">Level ${info.level} · ${(user.xp || 0).toLocaleString()} XP</span>
      </span>
    `);
    chip.setAttribute('title', `${user.name} — Level ${info.level}`);
  }

  const streak = document.getElementById('streak-chip');
  if (streak) {
    const days = Number(user?.streak) || 0;
    render(streak, html`${icon('flame', { size: 13 })}<span class="num">${days}</span>`);
    streak.style.display = days > 0 ? 'inline-flex' : 'none';
  }
}

function signOut() {
  session.clear();
  invalidate();
  window.location.hash = '';
  window.location.reload();
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
