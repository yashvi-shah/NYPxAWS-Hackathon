/* ==========================================================================
   calendar.js — Interactive academic calendar with month/week/day views.
   Connects to /api/calendar/events for persistence.
   ========================================================================== */

import { html, raw, render, cx } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../services/api.js';
import { session } from '../services/store.js';
import { setLayer } from '../core/actions.js';
import { openModal, closeOverlay } from '../ui/overlay.js';
import { toast, toastOk, toastError } from '../ui/toast.js';
import { pageLoading, emptyState } from '../ui/states.js';
import {
  dayKey, monthLong, weekdayShort, weekdayLong, formatDayDate, plural,
} from '../lib/format.js';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CATEGORIES = [
  { id: 'study', label: 'Study', color: 'var(--accent)' },
  { id: 'assignment', label: 'Assignment', color: 'var(--warn)' },
  { id: 'exam', label: 'Exam', color: 'var(--risk)' },
  { id: 'personal', label: 'Personal', color: 'var(--ok)' },
  { id: 'ai-generated', label: 'AI Study Session', color: 'var(--info)' },
  { id: 'event', label: 'Other', color: 'var(--ink-3)' },
];

const state = {
  view: 'month', // month, week, day
  offset: 0,
  events: [],
  loading: true,
};

/* --------------------------------------------------------------------------
   Main render
   -------------------------------------------------------------------------- */

export async function render_(view, ctx) {
  render(view, pageLoading({ title: 'Calendar', note: 'Loading your schedule...', kind: 'grid' }));

  try {
    const userId = session.id;
    const events = await api.calendarEvents(userId, '');
    state.events = events || [];
    state.loading = false;
  } catch (err) {
    state.events = [];
    state.loading = false;
  }

  if (!ctx.isCurrent()) return;
  registerActions(view);
  renderCalendar(view);
}

function renderCalendar(view) {
  const today = new Date();
  const cursor = getCursor(today);

  render(view, html`
    <div class="cal-page">
      ${calHeader(cursor)}
      ${state.view === 'month' ? monthView(cursor) : ''}
      ${state.view === 'week' ? weekView(cursor) : ''}
      ${state.view === 'day' ? dayView(cursor) : ''}
    </div>
  `);
}

function getCursor(today) {
  if (state.view === 'month') {
    return new Date(today.getFullYear(), today.getMonth() + state.offset, 1);
  } else if (state.view === 'week') {
    const d = new Date(today);
    d.setDate(d.getDate() + state.offset * 7);
    return d;
  } else {
    const d = new Date(today);
    d.setDate(d.getDate() + state.offset);
    return d;
  }
}

/* --------------------------------------------------------------------------
   Header
   -------------------------------------------------------------------------- */

function calHeader(cursor) {
  let title = '';
  if (state.view === 'month') title = `${monthLong(cursor.getMonth())} ${cursor.getFullYear()}`;
  else if (state.view === 'week') title = `Week of ${formatDayDate(getWeekStart(cursor))}`;
  else title = `${weekdayLong(cursor)}, ${formatDayDate(cursor)}`;

  return html`
    <div class="cal-header">
      <div class="cal-header-left">
        <h1>Calendar</h1>
        <div class="cal-nav">
          <button class="btn btn-icon" data-act="calPrev" aria-label="Previous">${icon('chevronLeft', { size: 16 })}</button>
          <button class="btn cal-today-btn" data-act="calToday">Today</button>
          <button class="btn btn-icon" data-act="calNext" aria-label="Next">${icon('chevronRight', { size: 16 })}</button>
          <span class="cal-title">${title}</span>
        </div>
      </div>
      <div class="cal-header-right">
        <div class="cal-view-switcher">
          <button class="btn btn-sm ${state.view === 'month' ? 'btn-primary' : ''}" data-act="calViewMonth">Month</button>
          <button class="btn btn-sm ${state.view === 'week' ? 'btn-primary' : ''}" data-act="calViewWeek">Week</button>
          <button class="btn btn-sm ${state.view === 'day' ? 'btn-primary' : ''}" data-act="calViewDay">Day</button>
        </div>
        <button class="btn btn-primary btn-sm" data-act="calCreateEvent">
          ${icon('plus', { size: 14 })}Event
        </button>
      </div>
    </div>
  `;
}

/* --------------------------------------------------------------------------
   Month View
   -------------------------------------------------------------------------- */

function monthView(cursor) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - lead);
  const todayKey = dayKey(new Date());

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = dayKey(date);
    const dayEvents = state.events.filter(e => e.date === key);
    cells.push({ date, key, inMonth: date.getMonth() === month, isToday: key === todayKey, events: dayEvents });
  }
  // Trim trailing all-outside week
  const lastWeek = cells.slice(35);
  const finalCells = lastWeek.every(c => !c.inMonth) ? cells.slice(0, 35) : cells;

  return html`
    <div class="cal-month">
      <div class="cal-month-grid">
        ${DOW.map(d => html`<div class="cal-dow-header">${d}</div>`)}
        ${finalCells.map(cell => html`
          <div class="${cx('cal-month-cell', !cell.inMonth && 'is-outside', cell.isToday && 'is-today')}"
               data-act="calClickDay" data-key="${cell.key}">
            <span class="cal-month-date">${cell.date.getDate()}</span>
            <div class="cal-month-events">
              ${cell.events.slice(0, 3).map(evt => html`
                <button class="cal-evt-chip cal-evt-${evt.category || 'event'}" data-act="calClickEvent" data-id="${evt.id}">
                  ${evt.startTime ? html`<span class="cal-evt-time">${evt.startTime}</span>` : raw('')}
                  <span class="cal-evt-label">${evt.title}</span>
                </button>
              `)}
              ${cell.events.length > 3 ? html`<span class="cal-evt-more">+${cell.events.length - 3} more</span>` : raw('')}
            </div>
          </div>
        `)}
      </div>
    </div>
  `;
}

/* --------------------------------------------------------------------------
   Week View
   -------------------------------------------------------------------------- */

function getWeekStart(d) {
  const date = new Date(d);
  const dow = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - dow);
  return date;
}

function weekView(cursor) {
  const weekStart = getWeekStart(cursor);
  const todayKey = dayKey(new Date());
  const hours = [];
  for (let h = 7; h <= 22; h++) hours.push(h);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
    const key = dayKey(date);
    const dayEvents = state.events.filter(e => e.date === key);
    days.push({ date, key, isToday: key === todayKey, events: dayEvents });
  }

  return html`
    <div class="cal-week">
      <div class="cal-week-header">
        <div class="cal-week-gutter"></div>
        ${days.map(day => html`
          <div class="cal-week-day-header ${day.isToday ? 'is-today' : ''}">
            <span class="cal-week-dow">${weekdayShort(day.date)}</span>
            <span class="cal-week-date-num">${day.date.getDate()}</span>
          </div>
        `)}
      </div>
      <div class="cal-week-body">
        <div class="cal-week-gutter">
          ${hours.map(h => html`<div class="cal-week-hour-label">${String(h).padStart(2, '0')}:00</div>`)}
        </div>
        ${days.map(day => html`
          <div class="cal-week-col ${day.isToday ? 'is-today' : ''}" data-act="calClickDay" data-key="${day.key}">
            ${hours.map(h => html`<div class="cal-week-slot" data-act="calClickSlot" data-key="${day.key}" data-hour="${h}"></div>`)}
            ${day.events.map(evt => weekEventBlock(evt, hours))}
          </div>
        `)}
      </div>
    </div>
  `;
}

function weekEventBlock(evt, hours) {
  const startHour = evt.startTime ? parseInt(evt.startTime.split(':')[0]) : 9;
  const startMin = evt.startTime ? parseInt(evt.startTime.split(':')[1] || '0') : 0;
  const duration = evt.duration || 60;
  const top = ((startHour - 7) * 60 + startMin) / (16 * 60) * 100;
  const height = Math.max(duration / (16 * 60) * 100, 3);

  return html`
    <button class="cal-week-event cal-evt-${evt.category || 'event'}" data-act="calClickEvent" data-id="${evt.id}"
            style="top:${top}%;height:${height}%">
      <span class="cal-week-event-title">${evt.title}</span>
      <span class="cal-week-event-time">${evt.startTime || ''}${evt.endTime ? ' - ' + evt.endTime : ''}</span>
    </button>
  `;
}

/* --------------------------------------------------------------------------
   Day View
   -------------------------------------------------------------------------- */

function dayView(cursor) {
  const key = dayKey(cursor);
  const dayEvents = state.events.filter(e => e.date === key);
  const hours = [];
  for (let h = 7; h <= 22; h++) hours.push(h);

  return html`
    <div class="cal-day">
      <div class="cal-day-timeline">
        ${hours.map(h => html`
          <div class="cal-day-hour" data-act="calClickSlot" data-key="${key}" data-hour="${h}">
            <span class="cal-day-hour-label">${String(h).padStart(2, '0')}:00</span>
            <div class="cal-day-hour-content">
              ${dayEvents.filter(e => {
                const eHour = e.startTime ? parseInt(e.startTime.split(':')[0]) : 9;
                return eHour === h;
              }).map(evt => html`
                <button class="cal-day-event cal-evt-${evt.category || 'event'}" data-act="calClickEvent" data-id="${evt.id}">
                  <span class="cal-day-event-title">${evt.title}</span>
                  <span class="cal-day-event-meta">
                    ${evt.startTime || ''}${evt.endTime ? ' - ' + evt.endTime : ''}
                    ${evt.module ? ` · ${evt.module}` : ''}
                  </span>
                </button>
              `)}
            </div>
          </div>
        `)}
      </div>
      ${!dayEvents.length ? html`
        <div style="padding:var(--sp-5);text-align:center">
          ${emptyState({ mark: 'calendar', title: 'Nothing scheduled', message: 'Click a time slot to add an event.', inline: true })}
        </div>
      ` : raw('')}
    </div>
  `;
}

/* --------------------------------------------------------------------------
   Event Modal (Create / Edit)
   -------------------------------------------------------------------------- */

function openEventModal({ date = '', startTime = '', event = null } = {}) {
  const editing = Boolean(event);
  const e = event || {};

  openModal({
    title: editing ? 'Edit Event' : 'New Event',
    wide: true,
    body: html`
      <div id="event-form" class="col gap-4">
        <div class="field">
          <label for="evt-title">Title</label>
          <input class="input" id="evt-title" maxlength="120" placeholder="e.g. ML Study Session" value="${e.title || ''}">
        </div>
        <div class="field-row">
          <div class="field">
            <label for="evt-date">Date</label>
            <input class="input" type="date" id="evt-date" value="${e.date || date || dayKey(new Date())}">
          </div>
          <div class="field">
            <label for="evt-category">Category</label>
            <select class="select" id="evt-category">
              ${CATEGORIES.map(c => html`<option value="${c.id}" ${(e.category || 'study') === c.id ? raw('selected') : raw('')}>${c.label}</option>`)}
            </select>
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="evt-start">Start Time</label>
            <input class="input" type="time" id="evt-start" value="${e.startTime || startTime || '09:00'}">
          </div>
          <div class="field">
            <label for="evt-end">End Time</label>
            <input class="input" type="time" id="evt-end" value="${e.endTime || ''}">
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="evt-duration">Duration (minutes)</label>
            <input class="input" type="number" id="evt-duration" min="15" max="480" step="15" value="${e.duration || 60}">
          </div>
          <div class="field">
            <label for="evt-module">Module <span class="field-hint">optional</span></label>
            <input class="input" id="evt-module" placeholder="e.g. IT3402 - AI & ML" value="${e.module || ''}">
          </div>
        </div>
        <div class="field">
          <label for="evt-desc">Description <span class="field-hint">optional</span></label>
          <textarea class="textarea" id="evt-desc" placeholder="Notes about this event...">${e.description || ''}</textarea>
        </div>
      </div>
    `,
    foot: html`
      ${editing ? html`<button class="btn btn-danger" data-act="deleteEvent" type="button">Delete</button>` : raw('')}
      <span style="flex:1"></span>
      <button class="btn" data-act="closeOverlay" type="button">Cancel</button>
      <button class="btn btn-primary" data-act="saveEvent" type="button">${editing ? 'Save' : 'Create'}</button>
    `,
    actions: {
      saveEvent: () => saveEvent(editing ? e.id : null),
      deleteEvent: () => deleteEvent(e.id),
    },
  });
}

async function saveEvent(editingId) {
  const val = (id) => document.getElementById(id)?.value?.trim() || '';

  const title = val('evt-title');
  if (!title) { document.getElementById('evt-title')?.focus(); return; }

  const payload = {
    title,
    date: val('evt-date') || dayKey(new Date()),
    startTime: val('evt-start'),
    endTime: val('evt-end'),
    duration: parseInt(val('evt-duration')) || 60,
    category: val('evt-category') || 'event',
    module: val('evt-module'),
    description: val('evt-desc'),
    userId: session.id,
  };

  closeOverlay({ silent: true });

  try {
    if (editingId) {
      await api.updateCalendarEvent(editingId, payload);
      toastOk('Event updated');
    } else {
      await api.createCalendarEvent(payload);
      toastOk('Event created');
    }
    await refreshEvents();
  } catch (err) {
    toastError('Could not save event', err);
  }
}

async function deleteEvent(eventId) {
  if (!eventId) return;
  closeOverlay({ silent: true });
  try {
    await api.deleteCalendarEvent(eventId);
    toastOk('Event deleted');
    await refreshEvents();
  } catch (err) {
    toastError('Could not delete event', err);
  }
}

async function refreshEvents() {
  try {
    state.events = await api.calendarEvents(session.id, '') || [];
  } catch { state.events = []; }
  const { refresh } = await import('../core/router.js');
  refresh();
}

/* --------------------------------------------------------------------------
   Actions
   -------------------------------------------------------------------------- */

function registerActions(view) {
  setLayer('page', {
    calPrev: () => { state.offset -= 1; renderCalendar(view); },
    calNext: () => { state.offset += 1; renderCalendar(view); },
    calToday: () => { state.offset = 0; renderCalendar(view); },
    calViewMonth: () => { state.view = 'month'; state.offset = 0; renderCalendar(view); },
    calViewWeek: () => { state.view = 'week'; state.offset = 0; renderCalendar(view); },
    calViewDay: () => { state.view = 'day'; state.offset = 0; renderCalendar(view); },
    calCreateEvent: () => openEventModal(),
    calClickDay: (ds) => { state.view = 'day'; state.offset = dateDiffFromToday(ds.key); renderCalendar(view); },
    calClickSlot: (ds) => openEventModal({ date: ds.key, startTime: `${String(ds.hour).padStart(2, '0')}:00` }),
    calClickEvent: (ds) => {
      const evt = state.events.find(e => e.id === ds.id);
      if (evt) openEventModal({ event: evt });
    },
  });
}

function dateDiffFromToday(dateKey) {
  const target = new Date(dateKey);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

export default { render: render_ };
