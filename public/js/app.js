// ===== StudySphere App Core =====

const API_BASE = '';
let currentUser = null;
let currentPage = 'dashboard';

// ===== API Helper =====
async function api(endpoint, options = {}) {
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options
  };
  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, config);
    return await res.json();
  } catch (err) {
    console.error('API Error:', err);
    showToast('Network error. Please try again.', 'error');
    return null;
  }
}

// ===== Auth =====
function initAuth() {
  const saved = localStorage.getItem('studysphere_user');
  if (saved) {
    currentUser = JSON.parse(saved);
    showApp();
  }
}

async function login(email, password) {
  const result = await api('/api/auth/login', {
    method: 'POST',
    body: { email, password }
  });
  
  if (result && result.success) {
    currentUser = result.user;
    localStorage.setItem('studysphere_user', JSON.stringify(currentUser));
    showApp();
    showToast(`Welcome back, ${currentUser.name}! 🎓`, 'success');
  } else {
    showToast(result?.error || 'Login failed', 'error');
  }
}

function logout() {
  currentUser = null;
  localStorage.removeItem('studysphere_user');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('main-app').classList.add('hidden');
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');
  updateSidebarUser();
  navigateTo('dashboard');
}

function updateSidebarUser() {
  if (!currentUser) return;
  const levelInfo = calculateLevel(currentUser.xp || 0);
  document.getElementById('sidebar-user').innerHTML = `
    <span class="user-avatar">${currentUser.avatar || '🎓'}</span>
    <div class="user-details">
      <span class="user-name">${currentUser.name}</span>
      <span class="user-level">Level ${levelInfo.level} • ${currentUser.xp || 0} XP</span>
    </div>
  `;
}

function calculateLevel(xp) {
  let level = 1;
  let xpNeeded = 100;
  let totalXpNeeded = 0;
  
  while (totalXpNeeded + xpNeeded <= xp) {
    totalXpNeeded += xpNeeded;
    level++;
    xpNeeded = Math.floor(100 * Math.pow(1.5, level - 1));
  }
  
  return {
    level,
    currentXp: xp - totalXpNeeded,
    xpForNextLevel: xpNeeded,
    totalXp: xp
  };
}

// ===== Navigation =====
function navigateTo(page) {
  currentPage = page;
  
  // Update nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === page);
  });
  
  // Render page
  renderPage(page);
}

// ===== Toast Notifications =====
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ===== Modal =====
function showModal(title, content) {
  document.getElementById('modal-body').innerHTML = `
    <h2 class="modal-title">${title}</h2>
    ${content}
  `;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

// ===== Date Helpers =====
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatRelativeDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
  
  if (diff < 0) return `${Math.abs(diff)} days overdue`;
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  if (diff <= 7) return `${diff} days left`;
  return `${diff} days left`;
}

function daysUntil(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  return Math.ceil((date - now) / (1000 * 60 * 60 * 24));
}

// ===== Event Listeners =====
document.addEventListener('DOMContentLoaded', () => {
  // Login form
  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    login(email, password);
  });
  
  // Navigation
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(link.dataset.page);
    });
  });
  
  // Logout
  document.getElementById('logout-btn').addEventListener('click', logout);
  
  // Modal close
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  
  // Init auth
  initAuth();
});
