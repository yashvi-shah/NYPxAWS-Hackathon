/* ==========================================================================
   community.js — peers, kept useful and quiet.
   Two things students actually need from each other: a hand with something
   specific, and a place to compare notes on a module.
   ========================================================================== */

import { html, raw, render } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../services/api.js';
import { session } from '../services/store.js';
import { setLayer, formValues } from '../core/actions.js';
import { pageLoading, emptyState, errorState } from '../ui/states.js';
import { panel, avatar, railClass } from '../ui/bits.js';
import { openModal, closeOverlay } from '../ui/overlay.js';
import { mutate } from '../features/mutate.js';
import { timeAgo, moduleCode, plural } from '../lib/format.js';

const CATEGORIES = ['Academic', 'Practical', 'Project', 'Career'];
const URGENCY_TONE = { high: 'badge-risk', medium: 'badge-warn', low: '' };

const state = { tab: 'help', category: 'all' };

let data = { help: [], discussions: [] };

export async function render_(view, ctx) {
  render(view, pageLoading({ title: 'Community', note: 'Loading what your peers are asking…', kind: 'list' }));

  const [help, discussions] = await Promise.allSettled([api.helpRequests(), api.discussions()]);
  if (!ctx.isCurrent()) return;

  if (help.status === 'rejected' && discussions.status === 'rejected') {
    render(view, html`
      ${header()}
      ${errorState({
        title: 'The community didn\'t load',
        message: 'Nothing has been changed. Try again in a moment.',
        retry: 'retryCommunity',
      })}
    `);
    setLayer('page', { retryCommunity: reload });
    return;
  }

  data.help = help.status === 'fulfilled' ? (help.value || []) : [];
  data.discussions = discussions.status === 'fulfilled' ? (discussions.value || []) : [];
  registerActions();

  render(view, html`
    ${header()}
    <div class="tabs" role="tablist">
      <button class="tab" role="tab" data-act="setTab" data-tab="help" aria-selected="${state.tab === 'help' ? 'true' : 'false'}">
        Help requests<span class="count">${data.help.length}</span>
      </button>
      <button class="tab" role="tab" data-act="setTab" data-tab="discussions" aria-selected="${state.tab === 'discussions' ? 'true' : 'false'}">
        Discussions<span class="count">${data.discussions.length}</span>
      </button>
    </div>
    <div id="community-body"></div>
  `);

  renderBody();
}

function header() {
  return html`
    <div class="page-head">
      <div>
        <h1>Community</h1>
        <p class="page-sub">Ask for something specific, or share what you worked out the hard way.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" data-act="newHelp">${icon('helpCircle', { size: 15 })}Ask for help</button>
        <button class="btn" data-act="newDiscussion">${icon('message', { size: 15 })}Start a discussion</button>
      </div>
    </div>
  `;
}

function renderBody() {
  const host = document.getElementById('community-body');
  if (!host) return;
  render(host, state.tab === 'help' ? helpSection() : discussionSection());
}

/* --------------------------------------------------------------------------
   Help requests
   -------------------------------------------------------------------------- */

function helpSection() {
  const items = state.category === 'all'
    ? data.help
    : data.help.filter((r) => r.category === state.category);

  return html`
    <div class="stack">
      <div class="toolbar">
        <div class="toolbar-group" role="group" aria-label="Filter by category">
          <button class="chip" data-act="setCategory" data-category="all" aria-pressed="${state.category === 'all' ? 'true' : 'false'}">
            All<span class="count">${data.help.length}</span>
          </button>
          ${CATEGORIES.map((c) => html`
            <button class="chip" data-act="setCategory" data-category="${c}" aria-pressed="${state.category === c ? 'true' : 'false'}">
              ${c}<span class="count">${data.help.filter((r) => r.category === c).length}</span>
            </button>
          `)}
        </div>
      </div>

      ${panel({
        body: items.length
          ? html`<div>${items.map(helpCard)}</div>`
          : emptyState({
            mark: 'helpCircle',
            title: state.category === 'all' ? 'No one has asked for help yet.' : `Nothing under ${state.category}.`,
            message: 'If you are stuck on something specific — a lab technique, a toolchain, a concept — asking here is faster than working around it.',
            action: { label: 'Ask for help', act: 'newHelp', icon: 'helpCircle' },
            inline: true,
          }),
      })}
    </div>
  `;
}

function helpCard(request) {
  const responses = request.responses || [];
  const answered = responses.length > 0;
  const mine = request.userId === session.id;

  return html`
    <article class="post ${railClass(answered ? 'ok' : request.urgency === 'high' ? 'risk' : 'none')}"
             style="padding-left:calc(var(--sp-4) + 3px)">
      <div class="post-head">
        <div style="min-width:0">
          <h4 class="post-title">${request.title}</h4>
          <div class="post-byline">
            ${avatar({ name: request.userName })}
            <span>${mine ? 'You' : request.userName}</span>
            ${request.module ? html`<span>·</span><span>${moduleCode(request.module)}</span>` : raw('')}
            <span>·</span><span>${request.category}</span>
            ${request.createdAt ? html`<span>·</span><span>${timeAgo(request.createdAt)}</span>` : raw('')}
          </div>
        </div>
        <div class="row gap-2">
          ${answered
            ? html`<span class="badge badge-ok">${icon('check', { size: 12 })}${plural(responses.length, 'reply', 'ies')}</span>`
            : html`<span class="badge ${URGENCY_TONE[request.urgency] || ''}">${request.urgency} urgency</span>`}
        </div>
      </div>

      <p class="post-body">${request.description}</p>

      ${responses.length ? html`
        <div class="replies">
          ${responses.map((r) => html`
            <div class="reply">
              <div class="reply-meta">${r.userId === session.id ? 'You' : r.userName} · ${timeAgo(r.date)}</div>
              <p>${r.message}</p>
            </div>
          `)}
        </div>
      ` : raw('')}

      <div class="post-foot">
        <button class="btn btn-sm" data-act="respondTo" data-id="${request.id}" data-title="${request.title}">
          ${icon('reply', { size: 14 })}${answered ? 'Add an answer' : 'Help out'}
        </button>
        ${!answered && !mine ? html`<span class="caption">No one has answered yet.</span>` : raw('')}
      </div>
    </article>
  `;
}

/* --------------------------------------------------------------------------
   Discussions
   -------------------------------------------------------------------------- */

function discussionSection() {
  return panel({
    body: data.discussions.length
      ? html`<div>${data.discussions.map(discussionCard)}</div>`
      : emptyState({
        mark: 'message',
        title: 'No discussions yet.',
        message: 'Start one with something you wish you had known two weeks ago — a shortcut, a resource, a warning about an assignment.',
        action: { label: 'Start a discussion', act: 'newDiscussion', icon: 'message' },
        inline: true,
      }),
  });
}

function discussionCard(discussion) {
  const replies = discussion.replies || [];
  const shown = replies.slice(0, 2);
  const mine = discussion.userId === session.id;

  return html`
    <article class="post">
      <div class="post-head">
        <div style="min-width:0">
          <h4 class="post-title">${discussion.title}</h4>
          <div class="post-byline">
            ${avatar({ name: discussion.userName })}
            <span>${mine ? 'You' : discussion.userName}</span>
            ${discussion.module ? html`<span>·</span><span>${moduleCode(discussion.module)}</span>` : raw('')}
            ${discussion.createdAt ? html`<span>·</span><span>${timeAgo(discussion.createdAt)}</span>` : raw('')}
          </div>
        </div>
        <div class="row gap-2">
          ${Number(discussion.upvotes) > 0 ? html`<span class="badge">${icon('trendUp', { size: 12 })}${discussion.upvotes}</span>` : raw('')}
          <span class="badge">${plural(replies.length, 'reply', 'ies')}</span>
        </div>
      </div>

      <p class="post-body clamp-2">${discussion.content}</p>

      ${(discussion.tags || []).length ? html`
        <div class="row gap-2 wrap">
          ${(discussion.tags || []).map((t) => html`<span class="tag">#${t}</span>`)}
        </div>
      ` : raw('')}

      ${shown.length ? html`
        <div class="replies">
          ${shown.map((r) => html`
            <div class="reply">
              <div class="reply-meta">${r.userId === session.id ? 'You' : r.userName} · ${timeAgo(r.date)}</div>
              <p>${r.content}</p>
            </div>
          `)}
          ${replies.length > shown.length
            ? html`<span class="caption">${replies.length - shown.length} more ${replies.length - shown.length === 1 ? 'reply' : 'replies'}</span>`
            : raw('')}
        </div>
      ` : raw('')}

      <div class="post-foot">
        <button class="btn btn-sm" data-act="replyTo" data-id="${discussion.id}" data-title="${discussion.title}">
          ${icon('reply', { size: 14 })}Reply
        </button>
      </div>
    </article>
  `;
}

/* --------------------------------------------------------------------------
   Composers
   -------------------------------------------------------------------------- */

function openHelpForm() {
  openModal({
    title: 'Ask for help',
    description: 'The more specific the ask, the faster someone can answer it.',
    wide: true,
    body: html`
      <form id="help-form" data-act="submitHelp" class="col gap-4" novalidate>
        <div class="field">
          <label for="hf-title">What do you need?</label>
          <input class="input" id="hf-title" name="title" required maxlength="120"
                 placeholder="e.g. Calibrating the DHT22 sensor on an ESP32">
        </div>
        <div class="field-row">
          <div class="field">
            <label for="hf-category">Category</label>
            <select class="select" id="hf-category" name="category">
              <option value="Academic">Academic — concepts, marking, theory</option>
              <option value="Practical">Practical — soldering, CAD, 3D printing, lab kit</option>
              <option value="Project">Group project</option>
              <option value="Career">Career and internships</option>
            </select>
          </div>
          <div class="field">
            <label for="hf-urgency">How urgent?</label>
            <select class="select" id="hf-urgency" name="urgency">
              <option value="low">Low — whenever</option>
              <option value="medium" selected>Medium — this week</option>
              <option value="high">High — blocking me now</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label for="hf-module">Module <span class="field-hint">optional</span></label>
          <input class="input" id="hf-module" name="module" maxlength="80" placeholder="e.g. EE4301 - IoT Systems">
        </div>
        <div class="field">
          <label for="hf-description">Details</label>
          <textarea class="textarea" id="hf-description" name="description" required
                    placeholder="What have you tried, and where does it break down?"></textarea>
        </div>
      </form>
    `,
    foot: html`
      <button class="btn" data-act="closeOverlay">Cancel</button>
      <button class="btn btn-primary" data-act="submitHelpButton">Post request</button>
    `,
    initialFocus: '#hf-title',
    actions: {
      submitHelpButton: () => document.getElementById('help-form')?.requestSubmit(),
      submitHelp: (ds, form) => {
        const v = formValues(form);
        if (!v.title || !v.description) return;
        closeOverlay({ silent: true });
        return mutate({
          run: () => api.createHelpRequest({
            title: v.title,
            description: v.description,
            category: v.category,
            module: v.module,
            urgency: v.urgency,
            userId: session.id,
            userName: session.user?.name,
          }),
          success: 'Request posted',
          detail: 'Your peers will see it at the top of the list.',
          failure: 'We couldn\'t post that request',
        });
      },
    },
  });
}

function openDiscussionForm() {
  openModal({
    title: 'Start a discussion',
    description: 'Notes, resources, warnings about an assignment — anything a classmate would want to know.',
    wide: true,
    body: html`
      <form id="disc-form" data-act="submitDiscussion" class="col gap-4" novalidate>
        <div class="field">
          <label for="df-title">Title</label>
          <input class="input" id="df-title" name="title" required maxlength="120"
                 placeholder="e.g. What the DSP lab report actually wants">
        </div>
        <div class="field">
          <label for="df-module">Module <span class="field-hint">optional</span></label>
          <input class="input" id="df-module" name="module" maxlength="80" placeholder="e.g. EE3205 - DSP">
        </div>
        <div class="field">
          <label for="df-content">Post</label>
          <textarea class="textarea" id="df-content" name="content" required style="min-height:130px"
                    placeholder="Share the detail — what worked, what to avoid, what took the longest."></textarea>
        </div>
        <div class="field">
          <label for="df-tags">Tags <span class="field-hint">comma separated</span></label>
          <input class="input" id="df-tags" name="tags" placeholder="e.g. lab-report, matlab, exam-prep">
        </div>
      </form>
    `,
    foot: html`
      <button class="btn" data-act="closeOverlay">Cancel</button>
      <button class="btn btn-primary" data-act="submitDiscussionButton">Post</button>
    `,
    initialFocus: '#df-title',
    actions: {
      submitDiscussionButton: () => document.getElementById('disc-form')?.requestSubmit(),
      submitDiscussion: (ds, form) => {
        const v = formValues(form);
        if (!v.title || !v.content) return;
        closeOverlay({ silent: true });
        return mutate({
          run: () => api.createDiscussion({
            title: v.title,
            content: v.content,
            module: v.module,
            tags: String(v.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
            userId: session.id,
            userName: session.user?.name,
          }),
          success: 'Discussion posted',
          failure: 'We couldn\'t post that',
        });
      },
    },
  });
}

function openResponder({ id, title, kind }) {
  const isHelp = kind === 'help';
  openModal({
    title: isHelp ? 'Answer this request' : 'Reply',
    description: title,
    body: html`
      <form id="resp-form" data-act="submitResponse" class="col gap-3" novalidate>
        <div class="field">
          <label for="rf-body">${isHelp ? 'Your answer' : 'Your reply'}</label>
          <textarea class="textarea" id="rf-body" name="body" required style="min-height:120px"
                    placeholder="${isHelp ? 'What worked for you, step by step.' : 'Add to the thread…'}"></textarea>
        </div>
      </form>
    `,
    foot: html`
      <button class="btn" data-act="closeOverlay">Cancel</button>
      <button class="btn btn-primary" data-act="submitResponseButton">${isHelp ? 'Send answer' : 'Post reply'}</button>
    `,
    initialFocus: '#rf-body',
    actions: {
      submitResponseButton: () => document.getElementById('resp-form')?.requestSubmit(),
      submitResponse: (ds, form) => {
        const v = formValues(form);
        if (!v.body) return;
        closeOverlay({ silent: true });
        return mutate({
          run: () => (isHelp
            ? api.respondToHelpRequest(id, { message: v.body, userId: session.id, userName: session.user?.name })
            : api.replyToDiscussion(id, { content: v.body, userId: session.id, userName: session.user?.name })),
          success: isHelp ? 'Answer sent' : 'Reply posted',
          detail: isHelp ? 'Thanks — that is one less person stuck.' : undefined,
          failure: 'We couldn\'t post that',
        });
      },
    },
  });
}

/* -------------------------------------------------------------------------- */

function registerActions() {
  setLayer('page', {
    retryCommunity: reload,
    setTab: (ds) => {
      state.tab = ds.tab;
      document.querySelectorAll('[data-tab]').forEach((t) => {
        t.setAttribute('aria-selected', t.dataset.tab === state.tab ? 'true' : 'false');
      });
      renderBody();
    },
    setCategory: (ds) => { state.category = ds.category; renderBody(); },
    newHelp: openHelpForm,
    newDiscussion: openDiscussionForm,
    respondTo: (ds) => openResponder({ id: ds.id, title: ds.title, kind: 'help' }),
    replyTo: (ds) => openResponder({ id: ds.id, title: ds.title, kind: 'discussion' }),
  });
}

async function reload() {
  const { invalidate } = await import('../services/store.js');
  invalidate();
  const { refresh } = await import('../core/router.js');
  refresh();
}

export default { render: render_ };
