/* ==========================================================================
   chat.js — Gravity AI chat interface.
   A dedicated conversation page with sidebar for history, mock AI responses,
   and a clean input area ready for future integration.
   ========================================================================== */

import { html, raw, render, $ } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { setLayer } from '../core/actions.js';
import { session } from '../services/store.js';
import { firstName, initials } from '../lib/format.js';

/* --------------------------------------------------------------------------
   Mock data
   -------------------------------------------------------------------------- */

const MOCK_CONVERSATIONS = [
  {
    id: 'conv-1',
    title: 'Math revision plan',
    messages: [
      { role: 'user', text: 'Can you help me create a revision plan for my math exam next week?' },
      { role: 'ai', text: 'Of course. Let\u2019s break your math revision into manageable sessions across the week.\n\nHere\u2019s what I\u2019d suggest:\n\n1. **Monday** \u2014 Review core formulas and theorems (2 hrs)\n2. **Tuesday** \u2014 Practice problem sets from chapters 4\u20136 (1.5 hrs)\n3. **Wednesday** \u2014 Work through past exam papers (2 hrs)\n4. **Thursday** \u2014 Focus on weak areas identified from practice (1.5 hrs)\n5. **Friday** \u2014 Light review and rest before the exam\n\nWould you like me to adjust the time blocks based on your availability?' },
    ],
  },
  {
    id: 'conv-2',
    title: 'Database assignment',
    messages: [
      { role: 'user', text: 'I\u2019m stuck on my database normalisation assignment. Where should I start?' },
      { role: 'ai', text: 'Normalisation can feel overwhelming, but it follows a clear sequence.\n\nStart here:\n\n- Identify all **functional dependencies** in your unnormalised table\n- Check for **partial dependencies** to reach 2NF\n- Then look for **transitive dependencies** for 3NF\n\nWould you like me to walk through an example with your specific table structure?' },
    ],
  },
  {
    id: 'conv-3',
    title: 'Prepare for tomorrow\u2019s test',
    messages: [
      { role: 'user', text: 'I have a networking test tomorrow. What should I focus on?' },
      { role: 'ai', text: 'With limited time, focus on the highest-yield topics:\n\n- **OSI model layers** \u2014 know what each layer does and key protocols\n- **TCP vs UDP** \u2014 differences, use cases, handshake process\n- **Subnetting** \u2014 practice calculating subnet masks and host ranges\n- **DNS and DHCP** \u2014 how they work at a high level\n\nI\u2019d spend 60% of your time on subnetting since it\u2019s the most calculation-heavy. Want me to generate some practice questions?' },
    ],
  },
  {
    id: 'conv-4',
    title: 'Flashcards for Python',
    messages: [
      { role: 'user', text: 'Create some flashcards for Python data structures' },
      { role: 'ai', text: 'Here are some key flashcard pairs for Python data structures:\n\n**Q:** What is the time complexity of accessing an element in a list by index?\n**A:** O(1) \u2014 constant time\n\n**Q:** How does a dictionary handle collisions internally?\n**A:** CPython uses open addressing with probing\n\n**Q:** What\u2019s the difference between a tuple and a list?\n**A:** Tuples are immutable and hashable; lists are mutable\n\n**Q:** When would you use a set over a list?\n**A:** When you need fast membership testing (O(1) average) and don\u2019t need ordering\n\nWant me to generate more, or focus on a specific area?' },
    ],
  },
  {
    id: 'conv-5',
    title: 'Weekly study plan',
    messages: [
      { role: 'user', text: 'Help me plan my week' },
      { role: 'ai', text: 'Absolutely. Let\u2019s start by looking at your upcoming deadlines and deciding what needs your attention first.\n\nBased on a typical study week, here\u2019s a balanced approach:\n\n- **High-priority work** early in the week when energy is highest\n- **Steady progress** on ongoing assignments mid-week\n- **Review and light tasks** towards the end\n\nWould you like me to factor in your specific deadlines and available hours?' },
    ],
  },
];

const MOCK_RESPONSES = [
  'Absolutely. Let\u2019s start by looking at your upcoming deadlines and deciding what needs your attention first.',
  'That\u2019s a great question. Based on your current workload, I\u2019d suggest prioritising the assignments closest to their deadline that carry the most weight.',
  'I can help with that. Let me break it down into smaller steps so it feels more manageable.',
  'Here\u2019s what I\u2019d recommend:\n\n1. Start with the most urgent items\n2. Block out focused study time\n3. Take regular breaks to stay sharp\n4. Review what you\u2019ve covered at the end of each session\n\nWant me to go deeper on any of these?',
  'Good thinking. Planning ahead like this is exactly how you stay on top of a heavy semester. Let me put together a structured approach for you.',
  'I\u2019d be happy to help you prepare. The key is to focus on understanding concepts rather than memorising facts \u2014 that way you can handle any question they throw at you.',
];

const SUGGESTED_PROMPTS = [
  { text: 'Help me plan my week', icon: 'calendar' },
  { text: 'What should I study first?', icon: 'target' },
  { text: 'Create flashcards for me', icon: 'layers' },
  { text: 'Help me prepare for my next test', icon: 'book' },
];

/* --------------------------------------------------------------------------
   State
   -------------------------------------------------------------------------- */

let conversations = [...MOCK_CONVERSATIONS];
let activeConvId = null;
let sidebarOpen = true;
let attachMenuOpen = false;

function activeConversation() {
  return conversations.find((c) => c.id === activeConvId) || null;
}

/* --------------------------------------------------------------------------
   Render
   -------------------------------------------------------------------------- */

async function renderChat(view, ctx) {
  render(view, chatPage());
  registerActions(view);
  autoResizeInput(view);
  scrollToBottom();
}

function chatPage() {
  const conv = activeConversation();
  return html`
    <div class="chat-layout ${sidebarOpen ? '' : 'chat-sidebar-closed'}">
      ${chatSidebar()}
      <div class="chat-main">
        ${!sidebarOpen ? html`
          <button class="chat-sidebar-toggle chat-sidebar-open-btn" data-act="toggleChatSidebar" aria-label="Open sidebar">
            ${icon('chevronRight', { size: 16 })}
          </button>
        ` : raw('')}
        ${conv ? conversationView(conv) : landingView()}
        ${chatInput()}
      </div>
    </div>
  `;
}

function chatSidebar() {
  return html`
    <aside class="chat-sidebar ${sidebarOpen ? '' : 'chat-sidebar-hidden'}" aria-label="Chat history">
      <div class="chat-sidebar-head">
        <button class="btn btn-primary btn-sm chat-new-btn" data-act="newChat">
          ${icon('plus', { size: 14 })}<span>New chat</span>
        </button>
        <button class="icon-btn chat-sidebar-toggle" data-act="toggleChatSidebar" aria-label="Close sidebar">
          ${icon('chevronLeft', { size: 16 })}
        </button>
      </div>
      <div class="chat-sidebar-list">
        <span class="chat-sidebar-label">Previous chats</span>
        ${conversations.map((conv) => html`
          <button class="chat-conv-item ${conv.id === activeConvId ? 'is-active' : ''}"
                  data-act="selectConv" data-id="${conv.id}">
            ${icon('message', { size: 14 })}
            <span class="truncate">${conv.title}</span>
          </button>
        `)}
      </div>
    </aside>
  `;
}

function landingView() {
  const user = session.user;
  return html`
    <div class="chat-landing">
      <div class="chat-landing-content">
        <div class="chat-landing-icon">
          ${icon('sparkle', { size: 28 })}
        </div>
        <h1>How can I help you study?</h1>
        <p class="chat-landing-desc">
          Gravity AI can help you organise your workload, plan revision sessions,
          create study materials, and figure out what to focus on next.
        </p>
        <div class="chat-prompts">
          ${SUGGESTED_PROMPTS.map((prompt) => html`
            <button class="chat-prompt-card" data-act="usePrompt" data-text="${prompt.text}">
              ${icon(prompt.icon, { size: 16 })}
              <span>${prompt.text}</span>
            </button>
          `)}
        </div>
      </div>
    </div>
  `;
}

function conversationView(conv) {
  const user = session.user;
  return html`
    <div class="chat-messages" id="chat-messages">
      ${conv.messages.map((msg) => msg.role === 'user' ? userMessage(msg, user) : aiMessage(msg))}
    </div>
  `;
}

function userMessage(msg, user) {
  return html`
    <div class="chat-msg chat-msg-user">
      <div class="chat-msg-bubble chat-msg-bubble-user">
        <p>${formatMessageText(msg.text)}</p>
      </div>
    </div>
  `;
}

function aiMessage(msg) {
  return html`
    <div class="chat-msg chat-msg-ai">
      <div class="chat-msg-avatar">
        ${icon('sparkle', { size: 16 })}
      </div>
      <div class="chat-msg-bubble chat-msg-bubble-ai">
        <div class="chat-msg-content">${formatMessageText(msg.text)}</div>
      </div>
    </div>
  `;
}

function typingIndicator() {
  return html`
    <div class="chat-msg chat-msg-ai chat-msg-typing" id="chat-typing">
      <div class="chat-msg-avatar">
        ${icon('sparkle', { size: 16 })}
      </div>
      <div class="chat-msg-bubble chat-msg-bubble-ai">
        <div class="chat-typing-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>
  `;
}

function chatInput() {
  return html`
    <div class="chat-input-wrap">
      <div class="chat-input-bar">
        <div class="chat-attach-wrap">
          <button class="icon-btn chat-attach-btn" data-act="toggleAttach" aria-label="Attach file">
            ${icon('plus', { size: 18 })}
          </button>
          ${attachMenuOpen ? html`
            <div class="chat-attach-menu">
              <button class="chat-attach-option" data-act="attachImage">
                ${icon('image', { size: 15 })}<span>Image</span>
              </button>
              <button class="chat-attach-option" data-act="attachFile">
                ${icon('file', { size: 15 })}<span>File</span>
              </button>
            </div>
          ` : raw('')}
        </div>
        <textarea class="chat-textarea" id="chat-input"
                  placeholder="Ask Gravity anything..."
                  rows="1" data-act="chatInputKey"></textarea>
        <button class="chat-send-btn is-disabled" id="chat-send" data-act="sendMessage" aria-label="Send message" disabled>
          ${icon('arrowRight', { size: 16 })}
        </button>
      </div>
    </div>
  `;
}

/* --------------------------------------------------------------------------
   Message formatting
   -------------------------------------------------------------------------- */

function formatMessageText(text) {
  // Convert markdown-like formatting to HTML
  let formatted = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n- /g, '</p><ul><li>')
    .replace(/\n(\d+)\. /g, '</p><ol><li>')
    .replace(/\n/g, '<br>');

  // Wrap in paragraph if not already
  if (!formatted.startsWith('<')) formatted = '<p>' + formatted + '</p>';
  else if (!formatted.startsWith('<p>')) formatted = '<p>' + formatted + '</p>';

  // Simple list handling
  formatted = formatted.replace(/<\/p><ul><li>/g, '</p><ul><li>');
  formatted = formatted.replace(/<\/p><ol><li>/g, '</p><ol><li>');

  return raw(formatted);
}

/* --------------------------------------------------------------------------
   Actions
   -------------------------------------------------------------------------- */

function registerActions(view) {
  setLayer('page', {
    toggleChatSidebar: () => {
      sidebarOpen = !sidebarOpen;
      rerender(view);
    },
    newChat: () => {
      activeConvId = null;
      attachMenuOpen = false;
      rerender(view);
    },
    selectConv: (ds) => {
      activeConvId = ds.id;
      attachMenuOpen = false;
      rerender(view);
      scrollToBottom();
    },
    usePrompt: (ds) => {
      const input = document.getElementById('chat-input');
      if (input) {
        input.value = ds.text;
        input.dispatchEvent(new Event('input'));
        input.focus();
      }
    },
    toggleAttach: () => {
      attachMenuOpen = !attachMenuOpen;
      rerender(view);
    },
    attachImage: () => {
      attachMenuOpen = false;
      rerender(view);
    },
    attachFile: () => {
      attachMenuOpen = false;
      rerender(view);
    },
    sendMessage: () => sendMessage(view),
    chatInputKey: () => { /* handled by event listener */ },
  });
}

function rerender(view) {
  render(view, chatPage());
  autoResizeInput(view);
  scrollToBottom();
}

function autoResizeInput(view) {
  const textarea = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  if (!textarea) return;

  const resize = () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
  };

  const updateSendState = () => {
    const hasText = textarea.value.trim().length > 0;
    if (sendBtn) {
      sendBtn.disabled = !hasText;
      sendBtn.classList.toggle('is-disabled', !hasText);
    }
  };

  textarea.addEventListener('input', () => {
    resize();
    updateSendState();
  });

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (textarea.value.trim()) sendMessage(view);
    }
  });

  // Close attach menu on click outside
  document.addEventListener('click', (e) => {
    if (attachMenuOpen && !e.target.closest('.chat-attach-wrap')) {
      attachMenuOpen = false;
      rerender(view);
    }
  }, { once: true });

  resize();
  updateSendState();
}

async function sendMessage(view) {
  const textarea = document.getElementById('chat-input');
  if (!textarea) return;
  const text = textarea.value.trim();
  if (!text) return;

  // Create new conversation if none active
  if (!activeConvId) {
    const id = 'conv-' + Date.now();
    const title = text.length > 30 ? text.slice(0, 30) + '\u2026' : text;
    conversations = [{ id, title, messages: [] }, ...conversations];
    activeConvId = id;
  }

  // Add user message
  const conv = activeConversation();
  conv.messages.push({ role: 'user', text });

  // Clear input and rerender
  textarea.value = '';
  rerender(view);
  scrollToBottom();

  // Show typing indicator
  const messagesEl = document.getElementById('chat-messages');
  if (messagesEl) {
    const typingHtml = typingIndicator();
    messagesEl.insertAdjacentHTML('beforeend', typingHtml.toString());
    scrollToBottom();
  }

  // Mock AI response after delay
  await new Promise((resolve) => setTimeout(resolve, 1200 + Math.random() * 800));

  // Pick a mock response
  const response = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
  conv.messages.push({ role: 'ai', text: response });

  // Remove typing indicator and rerender
  rerender(view);
  scrollToBottom();
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    const el = document.getElementById('chat-messages');
    if (el) el.scrollTop = el.scrollHeight;
  });
}

/* --------------------------------------------------------------------------
   Export
   -------------------------------------------------------------------------- */

export default { render: renderChat };
