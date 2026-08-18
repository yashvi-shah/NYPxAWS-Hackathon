/* ==========================================================================
   store.js — session, local preferences and a short-lived request cache.
   Preferences (study availability, theme, snoozed tasks) are frontend-only
   state: the backend has no endpoint for them, so they live in localStorage.
   ========================================================================== */

import { api } from './api.js';
import { dayKey } from '../lib/format.js';

const SESSION_KEY = 'studysphere.session.v1';
const LEGACY_SESSION_KEY = 'studysphere_user';
const PREFS_KEY = 'studysphere.prefs.v1';

/* --------------------------------------------------------------------------
   Preferences
   -------------------------------------------------------------------------- */

/** Study hours a student expects to have free, per weekday (Sun..Sat). */
export const DEFAULT_CAPACITY = [2, 2.5, 2.5, 2.5, 2.5, 2, 4];

const DEFAULT_PREFS = {
  theme: null,           // null = follow the OS
  capacity: DEFAULT_CAPACITY.slice(),
  dayStartHour: 19,      // when the evening study block begins
  snoozed: {},           // "planId:taskId" -> dayKey it was pushed off
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

let prefs = { ...DEFAULT_PREFS, ...readJSON(PREFS_KEY, {}) };
if (!Array.isArray(prefs.capacity) || prefs.capacity.length !== 7) {
  prefs.capacity = DEFAULT_CAPACITY.slice();
}
if (!prefs.snoozed || typeof prefs.snoozed !== 'object') prefs.snoozed = {};

const listeners = new Set();

function emit() { listeners.forEach((fn) => fn(prefs)); }

export const preferences = {
  all: () => prefs,
  get: (key) => prefs[key],
  set(patch) {
    prefs = { ...prefs, ...patch };
    writeJSON(PREFS_KEY, prefs);
    emit();
  },
  /** Hours available on a given date (weekday-based). */
  capacityFor(date) {
    const day = new Date(date).getDay();
    const value = Number(prefs.capacity[day]);
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  },
  resetCapacity() { this.set({ capacity: DEFAULT_CAPACITY.slice() }); },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  /* Snoozing a plan task is a local-only nudge: the backend stores no
     scheduled-date change, so we remember it here and label it in the UI. */
  isSnoozed(planId, taskId) {
    const stamp = prefs.snoozed[`${planId}:${taskId}`];
    return Boolean(stamp) && stamp === dayKey(new Date());
  },
  snooze(planId, taskId) {
    preferences.set({ snoozed: { ...prefs.snoozed, [`${planId}:${taskId}`]: dayKey(new Date()) } });
  },
  unsnooze(planId, taskId) {
    const next = { ...prefs.snoozed };
    delete next[`${planId}:${taskId}`];
    preferences.set({ snoozed: next });
  },
};

/* --------------------------------------------------------------------------
   Session
   -------------------------------------------------------------------------- */

let user = readJSON(SESSION_KEY, null) || readJSON(LEGACY_SESSION_KEY, null);

const userListeners = new Set();

/** The shell listens here so XP, level and streak stay current after a write. */
export function onUserChange(fn) {
  userListeners.add(fn);
  return () => userListeners.delete(fn);
}

function emitUser() { userListeners.forEach((fn) => fn(user)); }

export const session = {
  get user() { return user; },
  get id() { return user ? user.id : null; },
  isSignedIn: () => Boolean(user && user.id),
  set(next) {
    user = next;
    writeJSON(SESSION_KEY, next);
    try { localStorage.removeItem(LEGACY_SESSION_KEY); } catch { /* ignore */ }
    emitUser();
  },
  /** Merge fresh server fields (xp, streak, badges, levelInfo) into the session. */
  merge(patch) {
    if (!patch) return user;
    user = { ...user, ...patch };
    writeJSON(SESSION_KEY, user);
    emitUser();
    return user;
  },
  clear() {
    user = null;
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(LEGACY_SESSION_KEY);
    } catch { /* ignore */ }
    emitUser();
  },
};

/** Mirror of the backend's level curve, used only for display. */
export function levelFromXp(xp = 0) {
  let level = 1;
  let xpNeeded = 100;
  let banked = 0;
  while (banked + xpNeeded <= xp) {
    banked += xpNeeded;
    level += 1;
    xpNeeded = Math.floor(100 * Math.pow(1.5, level - 1));
  }
  return { level, currentXp: xp - banked, xpForNextLevel: xpNeeded, totalXp: xp };
}

export function levelInfo() {
  if (user && user.levelInfo && typeof user.levelInfo.level === 'number') return user.levelInfo;
  return levelFromXp((user && user.xp) || 0);
}

/* --------------------------------------------------------------------------
   Short-lived cache — keeps navigation instant without going stale.
   Any mutation calls invalidate(), so writes are always followed by fresh reads.
   -------------------------------------------------------------------------- */

const TTL_MS = 12000;
const cache = new Map();

export function cached(key, loader, { ttl = TTL_MS, force = false } = {}) {
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < ttl) return hit.value;
  const value = Promise.resolve().then(loader);
  cache.set(key, { at: Date.now(), value });
  // A failed request must not be remembered.
  value.catch(() => { if (cache.get(key)?.value === value) cache.delete(key); });
  return value;
}

export function invalidate(prefix) {
  if (!prefix) { cache.clear(); return; }
  Array.from(cache.keys()).forEach((k) => { if (k.startsWith(prefix)) cache.delete(k); });
}

/* --------------------------------------------------------------------------
   Data helpers used by pages (all built on the api service)
   -------------------------------------------------------------------------- */

/**
 * Assignments and plans together — the pair almost every screen needs.
 * Both requests go out at once; ownership filtering happens after.
 *
 * /api/assignments returns every student's work and /api/study-plans carries no
 * userId, so the frontend filters: assignments by userId, plans by whether their
 * assignmentId belongs to this student.
 */
export async function myWorkspace({ force = false } = {}) {
  const [all, plans] = await Promise.all([
    cached('assignments', () => api.assignments(), { force }),
    cached('plans', () => api.studyPlans(), { force }),
  ]);
  const id = session.id;
  const assignments = (all || []).filter((a) => a && a.userId === id);
  const mine = new Set(assignments.map((a) => a.id));
  return { assignments, plans: (plans || []).filter((p) => p && mine.has(p.assignmentId)) };
}

export function analyticsFor({ force = false } = {}) {
  return cached('analytics', () => api.analytics(session.id), { force });
}

export function recommendationsFor({ force = false } = {}) {
  return cached('recs', () => api.recommendations(session.id), { force });
}

/** Refresh xp/streak/badges after an action that awards XP. */
export async function refreshUser() {
  if (!session.id) return null;
  try {
    const fresh = await api.user(session.id);
    if (fresh && fresh.id) session.merge(fresh);
    return session.user;
  } catch {
    return session.user; // never block the UI on a background refresh
  }
}
