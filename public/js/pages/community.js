/* ==========================================================================
   community.js — Get help, share knowledge, and collaborate.
   Tabs for Help Requests and Discussions, card-based posts with urgency
   badges, respond buttons, and inline replies.
   ========================================================================== */

import { html, raw, render } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../services/api.js';
import { session } from '../services/store.js';
import { setLayer, formValues } from '../core/actions.js';
import { pageLoading, emptyState, errorState } from '../ui/states.js';
import { avatar } from '../ui/bits.js';
import { openModal, closeOverlay } from '../ui/overlay.js';
import { mutate } from '../features/mutate.js';
import { timeAgo, moduleCode, plural } from '../lib/format.js';

const CATEGORIES = ['Academic', 'Practical', 'Project', 'Career'];

const state = { tab: 'help' };

let data = { help: [], discussions: [] };

export async function render_(view, ctx) {
  render(view, pageLoading({ title: 'Community', note: 'Loading what your peers are asking...', kind: 'list' }));

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
    ${tabs()}
    <div id="community-body"></div>
  `);

  renderBody();
}

function header() {
  return html`
    <div class="page-head">
      <div>
        <h1>Community</h1>
        <p class="page-sub">Get help, share knowledge, and collaborate</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" data-act="newHelp">${icon('helpCircle', { size: 15 })}Ask for Help</button>
        <button class="btn" data-act="newDiscussion">${icon('message', { size: 15 })}New Discussion</button>
      </div>
    </div>
  `;
}

function tabs() {
  return html`
    <div class="cm-tabs" role="tablist">
      <button class="cm-tab ${state.tab === 'help' ? 'is-active' : ''}" role="tab"
              data-act="setTab" data-tab="help" aria-selected="${state.tab === 'help' ? 'true' : 'false'}">
        ${icon('helpCircle', { size: 14 })}
        Help Requests (${data.help.length})
      </button>
      <button class="cm-tab ${state.tab === 'discussions' ? 'is-active' : ''}" role="tab"
              data-act="setTab" data-tab="discussions" aria-selected="${state.tab === 'discussions' ? 'true' : 'false'}">
        ${icon('message', { size: 14 })}
        Discussions (${data.discussions.length})
      </button>
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
  if (!data.help.length) {
    return html`
      <section class="card" style="padding:var(--sp-5)">
        ${emptyState({
          mark: 'helpCircle',
          title: 'No one has asked for help yet.',
          message: 'If you are stuck on something specific, asking here is faster than working around it.',
          action: { label: 'Ask for help', act: 'newHelp', icon: 'helpCircle' },
          inline: true,
        })}
      </section>
    `;
  }

  return html`
    <div class="cm-posts">
      ${data.help.map(helpCard)}
    </div>
  `;
}

function helpCard(request) {
  const responses = request.responses || [];
  const mine = request.userId === session.id;

  return html`
    <article class="cm-post card">
      <div class="cm-post-header">
        <div class="cm-post-header-left">
          <h4 class="cm-post-title">${request.title}</h4>
          <div class="cm-post-byline">
            by ${mine ? 'You' : request.userName}
            ${request.module ? html` &middot; ${moduleCode(request.module)}` : raw('')}
            &middot; ${request.category}
          </div>
        </div>
        <span class="cm-urgency cm-urgency-${request.urgency || 'low'}">${(request.urgency || 'low').toUpperCase()}</span>
      </div>

      <p class="cm-post-body">${request.description}</p>

      ${responses.length ? html`
        <div class="cm-responses-count">${responses.length} response${responses.length !== 1 ? 's' : ''}:</div>
        <div class="cm-replies">
          ${responses.map((r) => html`
            <div class="cm-reply">
              <div class="cm-reply-meta">${r.userId === session.id ? 'You' : r.userName} &middot; ${timeAgo(r.date)}</div>
              <p class="cm-reply-text">${r.message}</p>
            </div>
          `)}
        </div>
      ` : raw('')}

      <div class="cm-post-footer">
        <button class="btn btn-sm" data-act="respondTo" data-id="${request.id}" data-title="${request.title}">
          ${icon('message', { size: 14 })}Respond
        </button>
      </div>
    </article>
  `;
}

/* --------------------------------------------------------------------------
   Discussions
   -------------------------------------------------------------------------- */

function discussionSection() {
  if (!data.discussions.length) {
    return html`
      <section class="card" style="padding:var(--sp-5)">
        ${emptyState({
          mark: 'message',
          title: 'No discussions yet.',
          message: 'Start one with something you wish you had known two weeks ago.',
          action: { label: 'Start a discussion', act: 'newDiscussion', icon: 'message' },
          inline: true,
        })}
      </section>
    `;
  }

  return html`
    <div class="cm-posts">
      ${data.discussions.map(discussionCard)}
    </div>
  `;
}

function discussionCard(discussion) {
  const replies = discussion.replies || [];
  const shown = replies.slice(0, 2);
  const mine = discussion.userId === session.id;

  return html`
    <article class="cm-post card">
      <div class="cm-post-header">
        <div class="cm-post-header-left">
          <h4 class="cm-post-title">${discussion.title}</h4>
          <div class="cm-post-byline">
            by ${mine ? 'You' : discussion.userName}
            ${discussion.module ? html` &middot; ${moduleCode(discussion.module)}` : raw('')}
            ${discussion.createdAt ? html` &middot; ${timeAgo(discussion.createdAt)}` : raw('')}
          </div>
        </div>
        ${replies.length ? html`
          <span class="cm-reply-count">${plural(replies.length, 'reply', 'ies')}</span>
        ` : raw('')}
      </div>

      <p class="cm-post-body">${discussion.content}</p>

      ${(discussion.tags || []).length ? html`
        <div class="cm-tags">
          ${(discussion.tags || []).map((t) => html`<span class="cm-tag">#${t}</span>`)}
        </div>
      ` : raw('')}

      ${shown.length ? html`
        <div class="cm-replies">
          ${shown.map((r) => html`
            <div class="cm-reply">
              <div class="cm-reply-meta">${r.userId === session.id ? 'You' : r.userName} &middot; ${timeAgo(r.date)}</div>
              <p class="cm-reply-text">${r.content}</p>
            </div>
          `)}
          ${replies.length > shown.length
            ? html`<span class="cm-more-replies">${replies.length - shown.length} more ${replies.length - shown.length === 1 ? 'reply' : 'replies'}</span>`
            : raw('')}
        </div>
      ` : raw('')}

      <div class="cm-post-footer">
        <button class="btn btn-sm" data-act="replyTo" data-id="${discussion.id}" data-title="${discussion.title}">
          ${icon('message', { size: 14 })}Respond
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
              <option value="Academic">Academic</option>
              <option value="Practical">Practical</option>
              <option value="Project">Group project</option>
              <option value="Career">Career and internships</option>
            </select>
          </div>
          <div class="field">
            <label for="hf-urgency">How urgent?</label>
            <select class="select" id="hf-urgency" name="urgency">
              <option value="low">Low</option>
              <option value="medium" selected>Medium</option>
              <option value="high">High</option>
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
                    placeholder="${isHelp ? 'What worked for you, step by step.' : 'Add to the thread...'}"></textarea>
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
      const view = document.getElementById('view');
      if (view) {
        const tabsEl = view.querySelector('.cm-tabs');
        if (tabsEl) {
          tabsEl.querySelectorAll('.cm-tab').forEach((t) => {
            const isActive = t.dataset.tab === state.tab;
            t.classList.toggle('is-active', isActive);
            t.setAttribute('aria-selected', isActive ? 'true' : 'false');
          });
        }
      }
      renderBody();
    },
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
