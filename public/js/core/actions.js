/* ==========================================================================
   actions.js — one delegated event listener for the whole app.

   Markup declares intent (data-act="completeAssignment" data-id="…") and each
   page registers handlers when it mounts. Nothing needs inline onclick, so
   rendered content stays free of executable strings.
   ========================================================================== */

const layers = { overlay: {}, page: {}, global: {} };
const ORDER = ['overlay', 'page', 'global'];

export function setLayer(name, map) { layers[name] = map || {}; }
export function clearLayer(name) { layers[name] = {}; }

function resolve(name) {
  for (const layer of ORDER) {
    const fn = layers[layer][name];
    if (fn) return fn;
  }
  return null;
}

/** Read a form into a plain object, trimming strings. */
export function formValues(form) {
  const values = {};
  new FormData(form).forEach((value, key) => {
    values[key] = typeof value === 'string' ? value.trim() : value;
  });
  return values;
}

function run(name, element, event) {
  const fn = resolve(name);
  if (!fn) return false;
  const result = fn({ ...element.dataset }, element, event);
  if (result && typeof result.catch === 'function') {
    result.catch((err) => console.error(`[action:${name}]`, err));
  }
  return true;
}

export function initDelegation(root = document.body) {
  root.addEventListener('click', (event) => {
    const el = event.target.closest('[data-act]');
    if (!el || !root.contains(el)) return;
    // Let real links and native submits behave natively unless told otherwise.
    if (el.tagName === 'A' && el.getAttribute('href') && el.dataset.actKeepDefault === 'true') return;
    event.preventDefault();
    run(el.dataset.act, el, event);
  });

  root.addEventListener('submit', (event) => {
    const form = event.target.closest('form[data-act]');
    if (!form || !root.contains(form)) return;
    event.preventDefault();
    run(form.dataset.act, form, event);
  });

  root.addEventListener('change', (event) => {
    const el = event.target.closest('[data-change]');
    if (!el || !root.contains(el)) return;
    run(el.dataset.change, el, event);
  });

  root.addEventListener('input', (event) => {
    const el = event.target.closest('[data-input]');
    if (!el || !root.contains(el)) return;
    run(el.dataset.input, el, event);
  });

  // Space/Enter on elements that behave like buttons but are not <button>.
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const el = event.target.closest('[data-act][role="button"], [data-act][role="checkbox"]');
    if (!el || el.tagName === 'BUTTON' || el.tagName === 'A') return;
    event.preventDefault();
    run(el.dataset.act, el, event);
  });
}

/** Debounce helper for search-as-you-type handlers. */
export function debounce(fn, wait = 180) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
