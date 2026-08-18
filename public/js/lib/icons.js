/* ==========================================================================
   icons.js — one icon family for the whole app
   24x24 grid, 1.75 stroke, round caps, currentColor. No emoji in the UI.
   ========================================================================== */

import { raw } from './dom.js';

const PATHS = {
  /* --- navigation --- */
  dashboard:  '<path d="M4 13h6v7H4zM4 4h6v5H4zM14 4h6v11h-6zM14 19h6"/>',
  assignments:'<path d="M8 4h9a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7"/><path d="M5 7h3V4"/><path d="M9 12h7M9 16h5"/>',
  workload:   '<path d="M4 20V10M9.5 20V4M15 20v-7M20.5 20V8"/>',
  plans:      '<path d="M5 6h14M5 12h14M5 18h9"/><circle cx="19" cy="18" r="2.4"/>',
  calendar:   '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3.5V6M16 3.5V6"/>',
  community:  '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M16 6.2a3 3 0 0 1 0 5.6M17.5 19.5c0-2-.6-3.5-1.6-4.6"/>',
  leaderboard:'<path d="M9 20V9h6v11M4 20v-6h5M15 20h5v-9"/><path d="M3 20h18"/>',
  chat:       '<path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-5.2-1.6L3 21l1.6-3.8A9 9 0 0 1 3 12a9 9 0 0 1 9-9 9 9 0 0 1 9 9z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>',

  /* --- actions --- */
  plus:       '<path d="M12 5v14M5 12h14"/>',
  search:     '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l4.5 4.5"/>',
  close:      '<path d="M6 6l12 12M18 6L6 18"/>',
  check:      '<path d="M5 12.5l4.5 4.5L19 7"/>',
  chevronDown:'<path d="M6 9l6 6 6-6"/>',
  chevronUp:  '<path d="M6 15l6-6 6 6"/>',
  chevronLeft:'<path d="M14.5 5l-7 7 7 7"/>',
  chevronRight:'<path d="M9.5 5l7 7-7 7"/>',
  arrowRight: '<path d="M4.5 12h14M13 6.5l5.5 5.5L13 17.5"/>',
  arrowUpRight:'<path d="M7 17L17 7M9 7h8v8"/>',
  more:       '<circle cx="12" cy="5.5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="18.5" r="1.4"/>',
  trash:      '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9L17.5 7M10.5 11v5M13.5 11v5"/>',
  refresh:    '<path d="M19.5 12a7.5 7.5 0 1 1-2.6-5.7"/><path d="M19.5 4.5V7h-2.5"/>',
  play:       '<path d="M8 5.5l10 6.5-10 6.5z"/>',
  sliders:    '<path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2"/><circle cx="9" cy="16" r="2"/>',
  snooze:     '<circle cx="12" cy="12.5" r="7.5"/><path d="M12 8.5v4.5l3 2"/><path d="M4 4l3-1.5"/>',
  edit:       '<path d="M5 19h3l9.5-9.5a2 2 0 0 0-2.8-2.8L5 16.2z"/><path d="M14.5 7.5l2.8 2.8"/>',
  logout:     '<path d="M10 5H6a1.5 1.5 0 0 0-1.5 1.5v11A1.5 1.5 0 0 0 6 19h4"/><path d="M14.5 8.5L18 12l-3.5 3.5M9 12h9"/>',
  reply:      '<path d="M5 7v4a3 3 0 0 0 3 3h10"/><path d="M14.5 10.5L18 14l-3.5 3.5"/>',
  print:      '<path d="M7 9V4.5h10V9M7 17H5.5A1.5 1.5 0 0 1 4 15.5v-5A1.5 1.5 0 0 1 5.5 9h13A1.5 1.5 0 0 1 20 10.5v5A1.5 1.5 0 0 1 18.5 17H17"/><rect x="7" y="14" width="10" height="6"/>',

  /* --- status & meaning --- */
  alert:      '<path d="M12 4.5l8.5 15h-17z"/><path d="M12 10v4M12 17.2v.1"/>',
  alertCircle:'<circle cx="12" cy="12" r="8"/><path d="M12 8v4.5M12 15.6v.1"/>',
  info:       '<circle cx="12" cy="12" r="8"/><path d="M12 11v5M12 8.2v.1"/>',
  checkCircle:'<circle cx="12" cy="12" r="8"/><path d="M8.5 12.3l2.4 2.4 4.6-5"/>',
  clock:      '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3.2 2"/>',
  target:     '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.4"/>',
  flame:      '<path d="M12 3.5s4.8 3.4 4.8 8.2A4.8 4.8 0 0 1 12 20.5a4.8 4.8 0 0 1-4.8-4.8c0-2 1-3.4 1-3.4s.4 1.3 1.6 1.7c-.4-4 3.2-5.4 3.2-10.5z"/>',
  gauge:      '<path d="M4.5 17a8 8 0 1 1 15 0"/><path d="M12 13.5l3.5-3.2"/><circle cx="12" cy="14.5" r="1.3"/>',
  scale:      '<path d="M12 4.5v15M7 19.5h10M6 8h12l-2.5 5h-7z"/><path d="M9 8l3-3.5L15 8"/>',
  book:       '<path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H18v16H6.5A1.5 1.5 0 0 1 5 18.5z"/><path d="M8 4v16"/>',
  layers:     '<path d="M12 4l8 4-8 4-8-4z"/><path d="M4 13l8 4 8-4"/>',
  trendUp:    '<path d="M4 17l5.5-5.5 3.5 3.5L20 8"/><path d="M15 8h5v5"/>',
  hourglass:  '<path d="M8 4h8M8 20h8"/><path d="M8 4c0 4 4 5.2 4 8s-4 4-4 8M16 4c0 4-4 5.2-4 8s4 4 4 8"/>',
  inbox:      '<path d="M4 12.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5.5"/><path d="M4 12.5L6.5 5h11L20 12.5h-4.5a3.5 3.5 0 0 1-7 0z"/>',
  lock:       '<rect x="5.5" y="10.5" width="13" height="9" rx="1.6"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  award:      '<circle cx="12" cy="10" r="5"/><path d="M9 14.5L8 21l4-2 4 2-1-6.5"/>',
  users:      '<circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/>',
  message:    '<path d="M4.5 6.5A1.5 1.5 0 0 1 6 5h12a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 18 16H9l-4.5 3.5z"/>',
  helpCircle: '<circle cx="12" cy="12" r="8"/><path d="M9.8 9.6a2.3 2.3 0 1 1 3.4 2.1c-.8.5-1.2 1-1.2 1.8"/><path d="M12 16.4v.1"/>',
  sun:        '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>',
  moon:       '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
  flag:       '<path d="M6 20V4.5h9l-1.2 3.5H19l-1.5 4.5H6"/>',
  zap:        '<path d="M13.5 3.5L6 13.5h4.5L9.5 20.5 17.5 10H13z"/>',
  send:       '<path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4z"/>',
  attach:     '<path d="M14.5 3.5a4.5 4.5 0 0 1 0 6.36L8.15 16.2a3 3 0 0 1-4.24-4.24l6.36-6.36a1.5 1.5 0 0 1 2.12 2.12L6.03 14.09"/>',
  image:      '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><circle cx="9" cy="9.5" r="1.5"/><path d="M20.5 14.5L16 10l-8.5 10.5"/>',
  file:       '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M10 13h4M10 17h4M10 9h1"/>',
  sparkle:    '<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>',
  gear:       '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
};

/**
 * Render an icon.
 * @param {string} name key from PATHS
 * @param {{size?: number, cls?: string, strokeWidth?: number}} [opts]
 */
export function icon(name, opts = {}) {
  const body = PATHS[name];
  if (!body) return raw('');
  const size = opts.size || 24;
  const cls = opts.cls ? ` class="${opts.cls}"` : '';
  const sw = opts.strokeWidth || 1.75;
  return raw(
    `<svg${cls} viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" ` +
    `stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" ` +
    `stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`
  );
}

/** The Gravity mark: purple planet logo. */
export function logoMark() {
  return raw(
    '<img src="/logo.svg" width="24" height="24" alt="" aria-hidden="true" style="border-radius:4px">'
  );
}

export const hasIcon = (name) => Boolean(PATHS[name]);
