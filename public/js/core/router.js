/* ==========================================================================
   router.js — hash routing for the single-page shell.
   Pages are plain modules with a render(view) function; the router owns
   mounting, teardown of page-scoped actions and post-navigation focus.
   ========================================================================== */

import { clearLayer } from './actions.js';
import { closeOverlay } from '../ui/overlay.js';

const routes = new Map();
const listeners = new Set();
let activeId = null;
let started = false;

export function registerRoutes(list) {
  list.forEach((route) => routes.set(route.id, route));
}

export const allRoutes = () => Array.from(routes.values());
export const currentRouteId = () => activeId;
export const currentRoute = () => routes.get(activeId) || null;

export function onRouteChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '').trim();
  const id = raw.split(/[?/]/)[0];
  return routes.has(id) ? id : null;
}

export function navigate(id, { replace = false } = {}) {
  if (!routes.has(id)) id = 'today';
  const hash = `#/${id}`;
  if (window.location.hash === hash) {
    mount(id);
    return;
  }
  if (replace) window.history.replaceState(null, '', hash);
  else window.location.hash = hash;
  // hashchange handles the mount when the hash actually changed
  if (replace) mount(id);
}

let renderToken = 0;

async function mount(id) {
  const route = routes.get(id);
  if (!route) return;
  const view = document.getElementById('view');
  if (!view) return;

  const token = ++renderToken;
  activeId = id;
  closeOverlay({ silent: true });
  clearLayer('page');
  listeners.forEach((fn) => fn(route));
  document.title = `${route.title} · Gravity`;

  try {
    await route.render(view, { token, isCurrent: () => token === renderToken });
  } catch (err) {
    console.error('[router] page failed', err);
    const { errorState } = await import('../ui/states.js');
    const { render } = await import('../lib/dom.js');
    if (token === renderToken) {
      render(view, errorState({
        title: 'This page didn\'t load',
        message: 'Something went wrong while putting the page together. Reloading usually clears it.',
        retry: 'reloadPage',
      }));
    }
  }

  if (token !== renderToken) return;
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  const heading = view.querySelector('h1');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
}

/** Re-run the current page (used after mutations and by the retry actions). */
export function refresh() {
  return activeId ? mount(activeId) : Promise.resolve();
}

export function startRouter(fallback = 'today') {
  if (!started) {
    started = true;
    window.addEventListener('hashchange', () => {
      const id = parseHash();
      mount(id || fallback);
    });
  }
  const id = parseHash();
  if (!id) navigate(fallback, { replace: true });
  else mount(id);
}
