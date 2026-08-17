// ===== Reusable Components & Utilities =====

// Filter assignments on the assignments page
function filterAssignments(filter) {
  // Update tab UI
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  event.target.classList.add('active');
  
  // Re-render with filter
  renderFilteredAssignments(filter);
}

async function renderFilteredAssignments(filter) {
  const assignments = await api('/api/assignments');
  const myAssignments = (assignments || []).filter(a => a.userId === currentUser.id);
  
  let filtered;
  switch (filter) {
    case 'pending':
      filtered = myAssignments.filter(a => a.status !== 'completed');
      break;
    case 'completed':
      filtered = myAssignments.filter(a => a.status === 'completed');
      break;
    default:
      filtered = myAssignments;
  }
  
  document.getElementById('assignments-list').innerHTML = 
    filtered.map(a => renderAssignmentCard(a)).join('') || 
    '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No assignments found.</p>';
}

// Confidence slider component
function renderConfidenceSlider(value) {
  const color = value < 30 ? 'var(--danger)' : value < 60 ? 'var(--warning)' : 'var(--secondary)';
  return `
    <div class="flex items-center gap-1">
      <div class="progress-bar" style="flex: 1;">
        <div class="progress-fill" style="width: ${value}%; background: ${color};"></div>
      </div>
      <span style="font-size: 0.8rem; color: ${color}; font-weight: 600;">${value}%</span>
    </div>
  `;
}

// Countdown timer component
function renderCountdown(deadline) {
  const now = new Date();
  const end = new Date(deadline);
  const diff = end - now;
  
  if (diff < 0) {
    return '<span style="color: var(--danger); font-weight: 600;">⚠️ Overdue</span>';
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  let color = 'var(--secondary)';
  if (days <= 1) color = 'var(--danger)';
  else if (days <= 3) color = 'var(--warning)';
  else if (days <= 7) color = 'var(--accent)';
  
  return `<span style="color: ${color}; font-weight: 600;">${days}d ${hours}h remaining</span>`;
}

// Empty state component
function renderEmptyState(icon, title, description, actionText, actionFn) {
  return `
    <div class="card text-center" style="padding: 3rem;">
      <p style="font-size: 3rem;">${icon}</p>
      <h3 class="mt-2">${title}</h3>
      <p style="color: var(--text-secondary); margin-top: 0.5rem;">${description}</p>
      ${actionText ? `<button class="btn btn-primary mt-2" onclick="${actionFn}">${actionText}</button>` : ''}
    </div>
  `;
}

// Notification badge
function renderNotificationBadge(count) {
  if (count <= 0) return '';
  return `<span style="
    background: var(--danger);
    color: white;
    font-size: 0.65rem;
    padding: 0.1rem 0.4rem;
    border-radius: 10px;
    font-weight: 700;
  ">${count}</span>`;
}

// Time ago helper
function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(dateStr);
}

// Priority color helper
function getPriorityStyles(score) {
  if (score >= 75) return { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', label: 'Critical' };
  if (score >= 50) return { bg: 'rgba(249, 115, 22, 0.1)', color: '#f97316', label: 'High' };
  if (score >= 25) return { bg: 'rgba(234, 179, 8, 0.1)', color: '#eab308', label: 'Medium' };
  return { bg: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', label: 'Low' };
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Escape to close modal
  if (e.key === 'Escape') {
    closeModal();
  }
  
  // Quick navigation with Ctrl/Cmd + number
  if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '7') {
    e.preventDefault();
    const pages = ['dashboard', 'assignments', 'calendar', 'study-plans', 'community', 'leaderboard', 'analytics'];
    const pageIndex = parseInt(e.key) - 1;
    if (pages[pageIndex]) {
      navigateTo(pages[pageIndex]);
    }
  }
});

// Auto-refresh dashboard data every 30 seconds
let refreshInterval;
function startAutoRefresh() {
  refreshInterval = setInterval(() => {
    if (currentPage === 'dashboard' && currentUser) {
      // Silently refresh user data
      api(`/api/users/${currentUser.id}`).then(user => {
        if (user) {
          currentUser = { ...currentUser, ...user };
          localStorage.setItem('studysphere_user', JSON.stringify(currentUser));
          updateSidebarUser();
        }
      });
    }
  }, 30000);
}

// Start auto-refresh when app loads
document.addEventListener('DOMContentLoaded', startAutoRefresh);

// ===== Service Worker Registration (PWA-ready) =====
// Commented out for now, but the structure is here for future PWA support
// if ('serviceWorker' in navigator) {
//   navigator.serviceWorker.register('/sw.js');
// }

console.log('🎓 StudySphere loaded! Use Ctrl+1-7 for quick navigation.');
