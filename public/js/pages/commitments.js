/* ==========================================================================
   commitments.js — every commitment, built for scanning.
   One row tells you what it is, when it lands, what it's worth, how far along
   it is and how much work is left, without opening anything.
   ========================================================================== */

import { html, raw, render, $ } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { myWorkspace } from '../services/store.js';
import { setLayer, debounce } from '../core/actions.js';
import { pageLoading, emptyState, errorState } from '../ui/states.js';
import { panel, dueBadge, priorityBadge, progressCell, railClass, moduleLine } from '../ui/bits.js';
import { setNavFlag } from '../ui/shell.js';
import { openAssignmentDetail } from '../features/assignmentDetail.js';
import { openAssignmentForm } from '../features/assignmentForm.js';
import { completeAssignment, reopenAssignment, deleteAssignment } from '../features/assignmentActions.js';
import { generatePlan } from '../features/planActions.js';
import { deadlineTone, priorityTone } from '../core/priority.js';
import { buildSchedule, planForAssignment, remainingHours } from '../core/workload.js';
import { daysUntil, hours as fmtHours, plural, formatDayDate } from '../lib/format.js';

const SORTS = [
  { id: 'priority', label: 'Priority' },
  { id: 'deadline', label: 'Deadline' },
  { id: 'effort', label: 'Work left' },
  { id: 'progress', label: 'Least progress' },
  { id: 'weightage', label: 'Weightage' },
];

/** Filter state survives navigation inside a session — it is a view preference. */
const state = { query: '', filter: 'open', sort: 'priority', openMenu: null };

let data = { assignments: [], plans: [], schedule: null };

export async function render_(view, ctx) {
  render(view, pageLoading({ title: 'Commitments', note: 'Loading your commitments…', kind: 'list' }));

  try {
    const workspace = await myWorkspace();
    data.assignments = workspace.assignments;
    data.plans = workspace.plans;
    data.schedule = buildSchedule({ assignments: data.assignments, plans: data.plans });
  } catch (err) {
    if (!ctx.isCurrent()) return;
    render(view, html`
      ${head(0, 0)}
      ${errorState({
        title: 'Your commitments didn\'t load',
        message: 'Nothing has been changed. Check your connection and try again.',
        retry: 'retryList',
      })}
    `);
    setLayer('page', { retryList: reload });
    return;
  }

  if (!ctx.isCurrent()) return;

  const open = data.assignments.filter((a) => a.status !== 'completed');
  const completed = data.assignments.filter((a) => a.status === 'completed');
  setNavFlag('assignments', open.filter((a) => daysUntil(a.deadline) <= 1).length);
  registerActions();

  if (!data.assignments.length) {
    render(view, html`
      ${head(0, 0)}
      ${panel({
        body: emptyState({
          mark: 'inbox',
          title: 'Nothing here yet.',
          message: 'Add your first commitment — title, module, deadline and how much it counts for. Gravity handles the ordering and the timing.',
          action: { label: 'Add a commitment', act: 'addAssignment', icon: 'plus' },
        }),
      })}
    `);
    return;
  }

  render(view, html`
    ${head(open.length, completed.length)}
    ${toolbar()}
    <section class="card" id="asgn-card">
      <div class="list-head">
        <span>Commitment</span>
        <span>Deadline</span>
        <span>Work left</span>
        <span>Progress</span>
        <span></span>
      </div>
      <div id="asgn-list"></div>
    </section>
  `);

  renderList();
}

function head(openCount, completedCount) {
  return html`
    <div class="page-head">
      <div>
        <h1>Commitments</h1>
        <p class="page-sub">
          ${openCount ? html`${plural(openCount, 'open item')} · ${completedCount} completed` : 'Everything you have agreed to do, in the order that matters.'}
        </p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" data-act="addAssignment">${icon('plus', { size: 15 })}Add commitment</button>
      </div>
    </div>
  `;
}

function toolbar() {
  const buckets = counts();
  const chip = (id, label) => html`
    <button class="chip" data-act="setFilter" data-filter="${id}" aria-pressed="${state.filter === id ? 'true' : 'false'}">
      ${label}<span class="count">${buckets[id]}</span>
    </button>
  `;

  return html`
    <div class="toolbar">
      <div class="search">
        ${icon('search', { size: 15 })}
        <input class="input" type="search" id="asgn-search" placeholder="Search title or module"
               aria-label="Search commitments" value="${state.query}" data-input="searchList">
        <kbd>/</kbd>
      </div>
      <div class="toolbar-group" role="group" aria-label="Filter commitments">
        ${chip('open', 'Open')}
        ${chip('attention', 'Needs attention')}
        ${chip('week', 'This week')}
        ${chip('unstarted', 'Not started')}
        ${chip('completed', 'Completed')}
        ${chip('all', 'All')}
      </div>
      <div class="grow"></div>
      <div class="toolbar-sort">
        <label class="label" for="asgn-sort">Sort</label>
        <select class="select" id="asgn-sort" data-change="setSort">
          ${SORTS.map((s) => html`<option value="${s.id}" ${state.sort === s.id ? raw('selected') : raw('')}>${s.label}</option>`)}
        </select>
      </div>
    </div>
  `;
}

function counts() {
  const all = data.assignments;
  const open = all.filter((a) => a.status !== 'completed');
  return {
    all: all.length,
    open: open.length,
    attention: open.filter(isAttention).length,
    week: open.filter((a) => daysUntil(a.deadline) !== null && daysUntil(a.deadline) <= 7).length,
    unstarted: open.filter((a) => (Number(a.progress) || 0) === 0).length,
    completed: all.filter((a) => a.status === 'completed').length,
  };
}

function isAttention(a) {
  const d = daysUntil(a.deadline);
  const atRisk = data.schedule ? data.schedule.atRisk.some((r) => r.id === a.id) : false;
  return (d !== null && d <= 2) || atRisk || priorityTone(a) === 'risk';
}

/* --------------------------------------------------------------------------
   List
   -------------------------------------------------------------------------- */

function visible() {
  const q = state.query.trim().toLowerCase();
  let items = data.assignments.filter((a) => {
    if (!q) return true;
    return `${a.title} ${a.module} ${a.type}`.toLowerCase().includes(q);
  });

  switch (state.filter) {
    case 'open': items = items.filter((a) => a.status !== 'completed'); break;
    case 'attention': items = items.filter((a) => a.status !== 'completed' && isAttention(a)); break;
    case 'week': items = items.filter((a) => a.status !== 'completed' && daysUntil(a.deadline) <= 7); break;
    case 'unstarted': items = items.filter((a) => a.status !== 'completed' && (Number(a.progress) || 0) === 0); break;
    case 'completed': items = items.filter((a) => a.status === 'completed'); break;
    default: break;
  }

  const effort = (a) => remainingHours(a, planForAssignment(a.id, data.plans));
  const byDeadline = (a, b) => String(a.deadline || '').localeCompare(String(b.deadline || ''));

  switch (state.sort) {
    case 'deadline': items = items.slice().sort(byDeadline); break;
    case 'effort': items = items.slice().sort((a, b) => effort(b) - effort(a)); break;
    case 'progress': items = items.slice().sort((a, b) => (Number(a.progress) || 0) - (Number(b.progress) || 0)); break;
    case 'weightage': items = items.slice().sort((a, b) => (Number(b.weightage) || 0) - (Number(a.weightage) || 0)); break;
    default:
      // Priority: the backend already returns assignments in score order.
      items = items.slice().sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
      break;
  }

  // Completed work always sinks to the bottom of a mixed list.
  return items.sort((a, b) => Number(a.status === 'completed') - Number(b.status === 'completed'));
}

function renderList() {
  const host = document.getElementById('asgn-list');
  if (!host) return;

  const items = visible();
  if (!items.length) {
    render(host, emptyState({
      mark: state.query ? 'search' : 'checkCircle',
      title: state.query ? 'Nothing matches that.' : emptyTitle(),
      message: state.query
        ? `No commitment mentions “${state.query}”. Try a module code, or clear the search.`
        : emptyMessage(),
      action: state.query ? { label: 'Clear search', act: 'clearSearch' } : null,
      inline: true,
    }));
    return;
  }

  let lastGroup = null;
  render(host, html`
    <div class="rows">
      ${items.map((a) => {
        const group = groupFor(a);
        const showGroup = state.filter === 'all' && group !== lastGroup;
        lastGroup = group;
        return html`
          ${showGroup ? html`<div class="group-label">${group}</div>` : raw('')}
          ${row(a)}
        `;
      })}
    </div>
  `);

  syncChips();
}

function groupFor(a) {
  return a.status === 'completed' ? 'Completed' : 'Open';
}

function emptyTitle() {
  if (state.filter === 'attention') return 'Nothing needs chasing.';
  if (state.filter === 'completed') return 'Nothing finished yet.';
  if (state.filter === 'week') return 'Nothing due this week.';
  if (state.filter === 'unstarted') return 'Everything has been started.';
  return 'You\'re all clear.';
}

function emptyMessage() {
  if (state.filter === 'attention') return 'No overdue work, nothing inside two days, and everything still fits in the time you have.';
  if (state.filter === 'completed') return 'Completed work shows up here with the deadline it beat.';
  if (state.filter === 'week') return 'Your next deadline is further out — a good week to get ahead.';
  if (state.filter === 'unstarted') return 'Every open commitment has some progress logged against it.';
  return 'Add your next academic commitment to start planning around it.';
}

function row(a) {
  const done = a.status === 'completed';
  const hoursLeft = remainingHours(a, planForAssignment(a.id, data.plans));
  const risk = data.schedule?.atRisk.find((r) => r.id === a.id);
  const tone = done ? 'ok' : deadlineTone(a) !== 'none' ? deadlineTone(a) : priorityTone(a);

  return html`
    <div class="row-item asgn-row ${railClass(tone)} ${done ? 'is-done' : ''}" data-id="${a.id}">
      <button class="asgn-main" data-act="openAssignment" data-id="${a.id}"
              style="background:none;text-align:left" aria-label="Open ${a.title}">
        <span class="row gap-2" style="min-width:0">
          <span class="asgn-title truncate">${a.title}</span>
          ${!done && priorityTone(a) !== 'none' && priorityTone(a) !== 'ok' ? priorityBadge(a) : raw('')}
        </span>
        ${moduleLine(a, [
          `${a.weightage ?? 0}% of grade`,
          risk && !risk.overdue ? `${fmtHours(risk.shortfall)} short of fitting` : null,
        ].filter(Boolean))}
      </button>

      <span class="asgn-due">
        ${done ? html`<span class="badge badge-ok">${icon('check', { size: 12 })}Done</span>` : dueBadge(a)}
        <span class="d2">${formatDayDate(a.deadline)}</span>
      </span>

      <span class="asgn-effort num">${done ? '—' : `${fmtHours(hoursLeft)}`}</span>

      ${progressCell(a.progress, { tone: done ? 'ok' : '' })}

      <span class="asgn-menu menu-wrap">
        <button class="icon-btn" data-act="toggleRowMenu" data-id="${a.id}" aria-label="More actions for ${a.title}"
                aria-haspopup="true" aria-expanded="${state.openMenu === a.id ? 'true' : 'false'}">
          ${icon('more', { size: 16 })}
        </button>
        ${state.openMenu === a.id ? rowMenu(a, done) : raw('')}
      </span>
    </div>
  `;
}

function rowMenu(a, done) {
  const plan = planForAssignment(a.id, data.plans);
  return html`
    <div class="menu" role="menu">
      <button class="menu-item" role="menuitem" data-act="openAssignment" data-id="${a.id}">
        ${icon('arrowUpRight', { size: 15 })}Open details
      </button>
      ${done ? html`
        <button class="menu-item" role="menuitem" data-act="reopenRow" data-id="${a.id}">
          ${icon('refresh', { size: 15 })}Reopen
        </button>
      ` : html`
        <button class="menu-item" role="menuitem" data-act="completeRow" data-id="${a.id}">
          ${icon('check', { size: 15 })}Mark complete
        </button>
        <button class="menu-item" role="menuitem" data-act="planRow" data-id="${a.id}">
          ${icon('plans', { size: 15 })}${plan ? 'Rebuild study plan' : 'Build study plan'}
        </button>
      `}
      <button class="menu-item" role="menuitem" data-act="editRow" data-id="${a.id}">
        ${icon('edit', { size: 15 })}Edit
      </button>
      <div class="menu-sep"></div>
      <button class="menu-item is-danger" role="menuitem" data-act="deleteRow" data-id="${a.id}">
        ${icon('trash', { size: 15 })}Delete
      </button>
    </div>
  `;
}

function syncChips() {
  const buckets = counts();
  document.querySelectorAll('[data-filter]').forEach((chip) => {
    const id = chip.dataset.filter;
    chip.setAttribute('aria-pressed', state.filter === id ? 'true' : 'false');
    const count = chip.querySelector('.count');
    if (count) count.textContent = String(buckets[id]);
  });
}

/* --------------------------------------------------------------------------
   Actions
   -------------------------------------------------------------------------- */

function find(id) { return data.assignments.find((a) => a.id === id); }

function closeMenus() {
  if (!state.openMenu) return;
  state.openMenu = null;
  renderList();
}

document.addEventListener('click', (event) => {
  if (!state.openMenu) return;
  if (event.target.closest('.menu-wrap')) return;
  closeMenus();
});

function registerActions() {
  const onSearch = debounce(() => {
    const input = $('#asgn-search');
    state.query = input ? input.value : '';
    renderList();
  }, 140);

  setLayer('page', {
    retryList: reload,
    addAssignment: () => openAssignmentForm(),
    openAssignment: (ds) => { state.openMenu = null; openAssignmentDetail(ds.id); },
    searchList: onSearch,
    clearSearch: () => {
      state.query = '';
      const input = $('#asgn-search');
      if (input) input.value = '';
      renderList();
    },
    setFilter: (ds) => {
      state.filter = ds.filter;
      state.openMenu = null;
      renderList();
    },
    setSort: (ds, el) => {
      state.sort = el.value;
      renderList();
    },
    toggleRowMenu: (ds) => {
      state.openMenu = state.openMenu === ds.id ? null : ds.id;
      renderList();
    },
    completeRow: (ds) => {
      const a = find(ds.id);
      state.openMenu = null;
      return a ? completeAssignment(a) : null;
    },
    reopenRow: (ds) => {
      const a = find(ds.id);
      state.openMenu = null;
      return a ? reopenAssignment(a) : null;
    },
    planRow: (ds) => {
      const a = find(ds.id);
      state.openMenu = null;
      return generatePlan(ds.id, { title: a?.title });
    },
    editRow: (ds) => {
      const a = find(ds.id);
      state.openMenu = null;
      if (a) openAssignmentForm(a);
    },
    deleteRow: (ds) => {
      const a = find(ds.id);
      state.openMenu = null;
      renderList();
      return a ? deleteAssignment(a) : null;
    },
  });
}

async function reload() {
  const { invalidate } = await import('../services/store.js');
  invalidate();
  const { refresh } = await import('../core/router.js');
  refresh();
}

export default { render: render_ };
