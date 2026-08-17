// ===== Page Renderer =====

async function renderPage(page) {
  const content = document.getElementById('content');
  
  switch (page) {
    case 'dashboard': return renderDashboard(content);
    case 'assignments': return renderAssignments(content);
    case 'calendar': return renderCalendar(content);
    case 'study-plans': return renderStudyPlans(content);
    case 'community': return renderCommunity(content);
    case 'leaderboard': return renderLeaderboard(content);
    case 'analytics': return renderAnalytics(content);
    default: return renderDashboard(content);
  }
}

// ===== DASHBOARD =====
async function renderDashboard(container) {
  container.innerHTML = '<div class="text-center mt-3"><p>Loading...</p></div>';
  
  const [assignments, recommendations, analytics, user] = await Promise.all([
    api('/api/assignments'),
    api(`/api/recommendations?userId=${currentUser.id}`),
    api(`/api/analytics?userId=${currentUser.id}`),
    api(`/api/users/${currentUser.id}`)
  ]);
  
  if (user) {
    currentUser = { ...currentUser, ...user };
    localStorage.setItem('studysphere_user', JSON.stringify(currentUser));
    updateSidebarUser();
  }
  
  const levelInfo = calculateLevel(currentUser.xp || 0);
  const myAssignments = (assignments || []).filter(a => a.userId === currentUser.id && a.status !== 'completed');
  
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Welcome back, ${currentUser.name.split(' ')[0]}! 👋</h1>
        <p class="page-subtitle">Here's your academic overview for today</p>
      </div>
      <div class="streak-display">
        <span style="font-size: 1.5rem;">🔥</span>
        <div>
          <div class="streak-number">${currentUser.streak || 0}</div>
          <div class="streak-label">day streak</div>
        </div>
      </div>
    </div>
    
    <!-- XP Progress -->
    <div class="card mb-3">
      <div class="flex items-center justify-between mb-1">
        <div class="flex items-center gap-1">
          <span style="font-size: 1.5rem;">${currentUser.avatar || '🎓'}</span>
          <div>
            <strong>Level ${levelInfo.level}</strong>
            <span style="color: var(--text-secondary); font-size: 0.85rem;"> • ${levelInfo.totalXp} XP total</span>
          </div>
        </div>
        <span style="color: var(--accent); font-weight: 600;">⭐ ${levelInfo.currentXp}/${levelInfo.xpForNextLevel} XP to next level</span>
      </div>
      <div class="xp-bar">
        <div class="xp-bar-fill" style="width: ${(levelInfo.currentXp / levelInfo.xpForNextLevel) * 100}%"></div>
      </div>
    </div>
    
    <!-- Stats -->
    <div class="grid-4 mb-3">
      <div class="stat-card">
        <div class="stat-label">Pending</div>
        <div class="stat-value">${analytics?.pendingAssignments || 0}</div>
        <div class="stat-change ${(analytics?.pendingAssignments || 0) > 5 ? 'negative' : 'positive'}">
          ${(analytics?.pendingAssignments || 0) > 5 ? '⚠️ Heavy load' : '✅ Manageable'}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Completed</div>
        <div class="stat-value">${analytics?.completedAssignments || 0}</div>
        <div class="stat-change positive">
          ${analytics?.completionRate || 0}% rate
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg Progress</div>
        <div class="stat-value">${analytics?.averageProgress || 0}%</div>
        <div class="progress-bar mt-1">
          <div class="progress-fill" style="width: ${analytics?.averageProgress || 0}%"></div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Study Streak</div>
        <div class="stat-value">🔥 ${currentUser.streak || 0}</div>
        <div class="stat-change positive">days in a row</div>
      </div>
    </div>
    
    <!-- AI Recommendations -->
    <div class="grid-2">
      <div>
        <h3 class="mb-2" style="font-size: 1.1rem;">🤖 AI Priority Recommendations</h3>
        <div id="recommendations-list">
          ${(recommendations || []).map(rec => `
            <div class="recommendation-card">
              <div class="flex items-center gap-1">
                <div class="recommendation-rank">${rec.rank}</div>
                <div>
                  <strong>${rec.assignment.title}</strong>
                  <div style="font-size: 0.8rem; color: var(--text-secondary);">${rec.assignment.module}</div>
                </div>
              </div>
              <div class="recommendation-reason">${rec.reason}</div>
              <div class="flex items-center justify-between mt-1">
                <span class="priority-badge" style="background: ${rec.assignment.priorityColor}20; color: ${rec.assignment.priorityColor}">
                  Priority: ${rec.assignment.priorityScore}/100
                </span>
                <span style="font-size: 0.8rem; color: var(--text-muted);">${formatRelativeDate(rec.assignment.deadline)}</span>
              </div>
            </div>
          `).join('') || '<p style="color: var(--text-muted);">No pending assignments. Great job! 🎉</p>'}
        </div>
      </div>
      
      <!-- Upcoming Deadlines -->
      <div>
        <h3 class="mb-2" style="font-size: 1.1rem;">📅 Upcoming Deadlines</h3>
        ${myAssignments.slice(0, 5).map(a => `
          <div class="assignment-card ${a.priorityLabel.toLowerCase()} mb-1">
            <div class="flex items-center justify-between">
              <strong style="font-size: 0.9rem;">${a.title}</strong>
              <span class="priority-badge" style="background: ${a.priorityColor}20; color: ${a.priorityColor}">
                ${a.priorityLabel}
              </span>
            </div>
            <div class="assignment-meta">
              <span>📚 ${a.module}</span>
              <span>📅 ${formatRelativeDate(a.deadline)}</span>
              <span>📊 ${a.progress}% done</span>
            </div>
            <div class="progress-bar mt-1">
              <div class="progress-fill" style="width: ${a.progress}%"></div>
            </div>
          </div>
        `).join('') || '<p style="color: var(--text-muted);">No upcoming deadlines!</p>'}
        
        <!-- Workload Preview -->
        <h3 class="mt-3 mb-2" style="font-size: 1.1rem;">📊 Workload Heatmap (8 weeks)</h3>
        <div class="card">
          <div class="heatmap-grid">
            ${(analytics?.weeklyLoad || []).map(w => `
              <div class="heatmap-cell intensity-${w.intensity}" title="${w.week}: ${w.count} assignments due">
                <div style="text-align: center;">
                  <div style="font-weight: 600;">${w.count}</div>
                  <div style="font-size: 0.6rem; color: var(--text-muted);">${w.week.replace('Week ', 'W')}</div>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="flex items-center gap-1 mt-1" style="font-size: 0.7rem; color: var(--text-muted);">
            <span>Less busy</span>
            <div class="heatmap-cell intensity-none" style="width: 16px; height: 16px; min-height: 16px;"></div>
            <div class="heatmap-cell intensity-low" style="width: 16px; height: 16px; min-height: 16px;"></div>
            <div class="heatmap-cell intensity-medium" style="width: 16px; height: 16px; min-height: 16px;"></div>
            <div class="heatmap-cell intensity-high" style="width: 16px; height: 16px; min-height: 16px;"></div>
            <span>More busy</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ===== ASSIGNMENTS =====
async function renderAssignments(container) {
  container.innerHTML = '<div class="text-center mt-3"><p>Loading...</p></div>';
  
  const assignments = await api('/api/assignments');
  const myAssignments = (assignments || []).filter(a => a.userId === currentUser.id);
  const pending = myAssignments.filter(a => a.status !== 'completed');
  const completed = myAssignments.filter(a => a.status === 'completed');
  
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">📝 Assignments</h1>
        <p class="page-subtitle">${pending.length} pending • ${completed.length} completed</p>
      </div>
      <button class="btn btn-primary" onclick="showAddAssignmentModal()">+ Add Assignment</button>
    </div>
    
    <div class="tabs">
      <div class="tab active" onclick="filterAssignments('all')">All (${myAssignments.length})</div>
      <div class="tab" onclick="filterAssignments('pending')">Pending (${pending.length})</div>
      <div class="tab" onclick="filterAssignments('completed')">Completed (${completed.length})</div>
    </div>
    
    <div id="assignments-list">
      ${pending.map(a => renderAssignmentCard(a)).join('')}
      ${completed.length > 0 ? `
        <h3 class="mt-3 mb-2" style="color: var(--text-secondary);">✅ Completed</h3>
        ${completed.map(a => renderAssignmentCard(a)).join('')}
      ` : ''}
    </div>
  `;
}

function renderAssignmentCard(a) {
  const isOverdue = daysUntil(a.deadline) < 0 && a.status !== 'completed';
  return `
    <div class="assignment-card ${a.priorityLabel?.toLowerCase() || 'medium'} mb-2" style="${a.status === 'completed' ? 'opacity: 0.7;' : ''}">
      <div class="flex items-center justify-between">
        <div>
          <strong>${a.title}</strong>
          ${a.status === 'completed' ? '<span style="color: var(--secondary); font-size: 0.8rem;"> ✅ Done</span>' : ''}
          ${isOverdue ? '<span style="color: var(--danger); font-size: 0.8rem;"> ⚠️ Overdue</span>' : ''}
        </div>
        <div class="flex gap-1">
          <span class="priority-badge" style="background: ${a.priorityColor}20; color: ${a.priorityColor}">
            ${a.priorityLabel} (${a.priorityScore})
          </span>
        </div>
      </div>
      <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem;">${a.description || ''}</p>
      <div class="assignment-meta">
        <span>📚 ${a.module}</span>
        <span>📅 ${formatRelativeDate(a.deadline)}</span>
        <span>⚖️ ${a.weightage}%</span>
        <span>💪 ${a.confidence}% confidence</span>
        <span>📊 ${a.type}</span>
      </div>
      <div class="flex items-center gap-1 mt-1">
        <div class="progress-bar" style="flex: 1;">
          <div class="progress-fill" style="width: ${a.progress}%"></div>
        </div>
        <span style="font-size: 0.8rem; color: var(--text-secondary);">${a.progress}%</span>
      </div>
      ${a.status !== 'completed' ? `
        <div class="flex gap-1 mt-1">
          <button class="btn btn-sm btn-secondary" onclick="updateAssignmentProgress('${a.id}', ${Math.min(100, a.progress + 25)})">+25% Progress</button>
          <button class="btn btn-sm btn-success" onclick="completeAssignment('${a.id}')">✓ Complete</button>
          <button class="btn btn-sm btn-ghost" onclick="generatePlanForAssignment('${a.id}')">📋 Study Plan</button>
          <button class="btn btn-sm btn-ghost" onclick="deleteAssignment('${a.id}')" style="color: var(--danger);">🗑️</button>
        </div>
      ` : ''}
    </div>
  `;
}

function showAddAssignmentModal() {
  showModal('Add New Assignment', `
    <form id="add-assignment-form">
      <div class="form-group">
        <label>Title</label>
        <input type="text" id="asgn-title" required placeholder="e.g., Machine Learning Report">
      </div>
      <div class="form-group">
        <label>Module</label>
        <input type="text" id="asgn-module" required placeholder="e.g., IT3402 - AI & ML">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Type</label>
          <select id="asgn-type">
            <option value="Essay">Essay</option>
            <option value="Programming">Programming</option>
            <option value="Report">Report</option>
            <option value="Presentation">Presentation</option>
            <option value="Lab Report">Lab Report</option>
            <option value="Project">Project</option>
          </select>
        </div>
        <div class="form-group">
          <label>Deadline</label>
          <input type="date" id="asgn-deadline" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Weightage (%)</label>
          <input type="number" id="asgn-weightage" min="1" max="100" value="10">
        </div>
        <div class="form-group">
          <label>Confidence (%)</label>
          <input type="number" id="asgn-confidence" min="0" max="100" value="50">
        </div>
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea id="asgn-desc" placeholder="Assignment details..."></textarea>
      </div>
      <button type="submit" class="btn btn-primary btn-full">Add Assignment</button>
    </form>
  `);
  
  // Set default date to a week from now
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  document.getElementById('asgn-deadline').value = nextWeek.toISOString().split('T')[0];
  
  document.getElementById('add-assignment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const assignment = {
      title: document.getElementById('asgn-title').value,
      module: document.getElementById('asgn-module').value,
      type: document.getElementById('asgn-type').value,
      deadline: document.getElementById('asgn-deadline').value,
      weightage: parseInt(document.getElementById('asgn-weightage').value),
      confidence: parseInt(document.getElementById('asgn-confidence').value),
      description: document.getElementById('asgn-desc').value,
      userId: currentUser.id
    };
    
    await api('/api/assignments', { method: 'POST', body: assignment });
    closeModal();
    showToast('Assignment added! +10 XP 🎯', 'success');
    currentUser.xp = (currentUser.xp || 0) + 10;
    updateSidebarUser();
    renderAssignments(document.getElementById('content'));
  });
}

async function updateAssignmentProgress(id, progress) {
  await api(`/api/assignments/${id}`, {
    method: 'PUT',
    body: { progress, userId: currentUser.id }
  });
  showToast(`Progress updated! +5 XP 📈`, 'success');
  currentUser.xp = (currentUser.xp || 0) + 5;
  updateSidebarUser();
  renderAssignments(document.getElementById('content'));
}

async function completeAssignment(id) {
  await api(`/api/assignments/${id}`, {
    method: 'PUT',
    body: { status: 'completed', progress: 100, userId: currentUser.id }
  });
  showToast('Assignment completed! +50 XP 🎉', 'success');
  currentUser.xp = (currentUser.xp || 0) + 50;
  updateSidebarUser();
  renderAssignments(document.getElementById('content'));
}

async function deleteAssignment(id) {
  if (confirm('Are you sure you want to delete this assignment?')) {
    await api(`/api/assignments/${id}`, { method: 'DELETE' });
    showToast('Assignment deleted', 'info');
    renderAssignments(document.getElementById('content'));
  }
}

async function generatePlanForAssignment(assignmentId) {
  const result = await api('/api/study-plans/generate', {
    method: 'POST',
    body: { assignmentId, userId: currentUser.id }
  });
  if (result) {
    showToast('Study plan generated! +15 XP 📋', 'success');
    currentUser.xp = (currentUser.xp || 0) + 15;
    updateSidebarUser();
    navigateTo('study-plans');
  }
}

// ===== CALENDAR =====
async function renderCalendar(container) {
  container.innerHTML = '<div class="text-center mt-3"><p>Loading...</p></div>';
  
  const assignments = await api('/api/assignments');
  const myAssignments = (assignments || []).filter(a => a.userId === currentUser.id);
  
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Build calendar days
  let calendarHTML = '';
  dayNames.forEach(d => {
    calendarHTML += `<div class="calendar-header-cell">${d}</div>`;
  });
  
  // Previous month filler
  for (let i = 0; i < startOffset; i++) {
    const prevDate = new Date(year, month, -(startOffset - i - 1));
    calendarHTML += `<div class="calendar-cell other-month"><span>${prevDate.getDate()}</span></div>`;
  }
  
  // Current month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = day === now.getDate();
    const deadlines = myAssignments.filter(a => a.deadline && a.deadline.startsWith(dateStr));
    const hasDeadline = deadlines.length > 0;
    
    calendarHTML += `
      <div class="calendar-cell ${isToday ? 'today' : ''} ${hasDeadline ? 'has-deadline' : ''}" 
           ${hasDeadline ? `title="${deadlines.map(d => d.title).join(', ')}"` : ''}>
        <span>${day}</span>
        ${hasDeadline ? `<span class="deadline-dot"></span>` : ''}
        ${hasDeadline ? `<span style="font-size: 0.6rem; color: var(--danger);">${deadlines.length}</span>` : ''}
      </div>
    `;
  }
  
  // Next month filler
  const totalCells = startOffset + lastDay.getDate();
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    calendarHTML += `<div class="calendar-cell other-month"><span>${i}</span></div>`;
  }
  
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">📅 Calendar</h1>
        <p class="page-subtitle">${monthNames[month]} ${year}</p>
      </div>
    </div>
    
    <div class="grid-2">
      <div class="card">
        <h3 class="card-title mb-2">${monthNames[month]} ${year}</h3>
        <div class="calendar-grid">
          ${calendarHTML}
        </div>
        <div class="flex items-center gap-1 mt-2" style="font-size: 0.8rem;">
          <div style="width: 10px; height: 10px; border-radius: 50%; background: var(--primary);"></div>
          <span style="color: var(--text-secondary);">Today</span>
          <div style="width: 10px; height: 10px; border-radius: 50%; background: var(--danger); margin-left: 1rem;"></div>
          <span style="color: var(--text-secondary);">Deadline</span>
        </div>
      </div>
      
      <div>
        <h3 class="mb-2" style="font-size: 1.1rem;">📋 This Month's Deadlines</h3>
        ${myAssignments
          .filter(a => {
            const d = new Date(a.deadline);
            return d.getMonth() === month && d.getFullYear() === year;
          })
          .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
          .map(a => `
            <div class="assignment-card ${a.priorityLabel?.toLowerCase()} mb-1">
              <div class="flex items-center justify-between">
                <strong style="font-size: 0.9rem;">${a.title}</strong>
                <span class="priority-badge" style="background: ${a.priorityColor}20; color: ${a.priorityColor}">
                  ${a.priorityLabel}
                </span>
              </div>
              <div class="assignment-meta">
                <span>📅 ${formatDate(a.deadline)}</span>
                <span>📚 ${a.module}</span>
                <span>📊 ${a.progress}%</span>
              </div>
            </div>
          `).join('') || '<p style="color: var(--text-muted);">No deadlines this month! 🎉</p>'}
      </div>
    </div>
  `;
}

// ===== STUDY PLANS =====
async function renderStudyPlans(container) {
  container.innerHTML = '<div class="text-center mt-3"><p>Loading...</p></div>';
  
  const plans = await api('/api/study-plans');
  
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">📋 AI Study Plans</h1>
        <p class="page-subtitle">AI-generated task breakdowns for your assignments</p>
      </div>
    </div>
    
    ${(plans || []).length === 0 ? `
      <div class="card text-center" style="padding: 3rem;">
        <p style="font-size: 2rem;">📋</p>
        <h3 class="mt-1">No study plans yet</h3>
        <p style="color: var(--text-secondary); margin-top: 0.5rem;">Generate a study plan from any assignment to get started!</p>
        <button class="btn btn-primary mt-2" onclick="navigateTo('assignments')">Go to Assignments</button>
      </div>
    ` : (plans || []).map(plan => {
      const completedTasks = plan.tasks.filter(t => t.completed).length;
      const totalTasks = plan.tasks.length;
      const progress = Math.round(completedTasks / totalTasks * 100);
      
      return `
        <div class="card mb-2">
          <div class="card-header">
            <div>
              <h3 class="card-title">${plan.assignmentTitle}</h3>
              <p class="card-subtitle">${plan.module} • ${plan.totalDays} days • ~${plan.estimatedHours.toFixed(1)} hours total</p>
            </div>
            <span style="font-size: 0.85rem; color: var(--primary-light);">${completedTasks}/${totalTasks} tasks</span>
          </div>
          <div class="progress-bar mb-2">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
          <div>
            ${plan.tasks.map(task => `
              <div class="plan-task ${task.completed ? 'completed' : ''}">
                <div class="task-checkbox ${task.completed ? 'checked' : ''}" 
                     onclick="togglePlanTask('${plan.id}', '${task.id}', ${!task.completed})"></div>
                <span class="plan-task-title">${task.title}</span>
                <span class="plan-task-date">${task.scheduledDate}</span>
                <span class="plan-task-duration">${task.duration}min</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('')}
  `;
}

async function togglePlanTask(planId, taskId, completed) {
  await api(`/api/study-plans/${planId}/tasks/${taskId}`, {
    method: 'PUT',
    body: { completed, userId: currentUser.id }
  });
  if (completed) {
    showToast('Task completed! +10 XP ✅', 'success');
    currentUser.xp = (currentUser.xp || 0) + 10;
    updateSidebarUser();
  }
  renderStudyPlans(document.getElementById('content'));
}

// ===== COMMUNITY =====
async function renderCommunity(container) {
  container.innerHTML = '<div class="text-center mt-3"><p>Loading...</p></div>';
  
  const [helpRequests, discussions] = await Promise.all([
    api('/api/help-requests'),
    api('/api/discussions')
  ]);
  
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">👥 Community</h1>
        <p class="page-subtitle">Get help, share knowledge, and collaborate</p>
      </div>
      <div class="flex gap-1">
        <button class="btn btn-primary" onclick="showNewHelpRequestModal()">🆘 Ask for Help</button>
        <button class="btn btn-secondary" onclick="showNewDiscussionModal()">💬 New Discussion</button>
      </div>
    </div>
    
    <div class="tabs">
      <div class="tab active" id="tab-help" onclick="switchCommunityTab('help')">🆘 Help Requests (${(helpRequests || []).length})</div>
      <div class="tab" id="tab-discussions" onclick="switchCommunityTab('discussions')">💬 Discussions (${(discussions || []).length})</div>
    </div>
    
    <div id="community-content">
      <!-- Help Requests -->
      <div id="help-section">
        ${(helpRequests || []).map(req => `
          <div class="help-card">
            <div class="help-card-header">
              <div>
                <strong>${req.title}</strong>
                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem;">
                  by ${req.userName} • ${req.module ? req.module + ' • ' : ''}${req.category}
                </div>
              </div>
              <span class="help-urgency urgency-${req.urgency}">${req.urgency}</span>
            </div>
            <p style="font-size: 0.9rem; color: var(--text-secondary);">${req.description}</p>
            
            ${(req.responses || []).length > 0 ? `
              <div class="mt-1">
                <strong style="font-size: 0.8rem; color: var(--text-muted);">${req.responses.length} response(s):</strong>
                ${req.responses.map(r => `
                  <div class="response-item">
                    <div class="response-meta">${r.userName} • ${formatDate(r.date)}</div>
                    <p style="font-size: 0.85rem;">${r.message}</p>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            
            <div class="mt-1">
              <button class="btn btn-sm btn-ghost" onclick="showRespondModal('${req.id}')">💬 Respond</button>
            </div>
          </div>
        `).join('') || '<p style="color: var(--text-muted);">No help requests yet.</p>'}
      </div>
      
      <!-- Discussions (hidden by default) -->
      <div id="discussions-section" class="hidden">
        ${(discussions || []).map(disc => `
          <div class="discussion-card">
            <div class="flex items-center justify-between">
              <strong>${disc.title}</strong>
              <span style="font-size: 0.8rem; color: var(--text-muted);">👍 ${disc.upvotes} • 💬 ${(disc.replies || []).length}</span>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem;">${disc.content.substring(0, 200)}${disc.content.length > 200 ? '...' : ''}</p>
            <div class="flex items-center justify-between mt-1">
              <div class="discussion-tags">
                ${disc.module ? `<span class="tag">${disc.module}</span>` : ''}
                ${(disc.tags || []).map(t => `<span class="tag">#${t}</span>`).join('')}
              </div>
              <span style="font-size: 0.75rem; color: var(--text-muted);">by ${disc.userName}</span>
            </div>
            
            ${(disc.replies || []).length > 0 ? `
              <div class="mt-1">
                ${disc.replies.slice(0, 2).map(r => `
                  <div class="response-item">
                    <div class="response-meta">${r.userName} • ${formatDate(r.date)}</div>
                    <p style="font-size: 0.85rem;">${r.content}</p>
                  </div>
                `).join('')}
                ${disc.replies.length > 2 ? `<p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem;">+${disc.replies.length - 2} more replies</p>` : ''}
              </div>
            ` : ''}
            
            <button class="btn btn-sm btn-ghost mt-1" onclick="showReplyModal('${disc.id}')">💬 Reply</button>
          </div>
        `).join('') || '<p style="color: var(--text-muted);">No discussions yet.</p>'}
      </div>
    </div>
  `;
}

function switchCommunityTab(tab) {
  document.getElementById('help-section').classList.toggle('hidden', tab !== 'help');
  document.getElementById('discussions-section').classList.toggle('hidden', tab !== 'discussions');
  document.getElementById('tab-help').classList.toggle('active', tab === 'help');
  document.getElementById('tab-discussions').classList.toggle('active', tab === 'discussions');
}

function showNewHelpRequestModal() {
  showModal('Ask for Help', `
    <form id="help-form">
      <div class="form-group">
        <label>What do you need help with?</label>
        <input type="text" id="help-title" required placeholder="e.g., Arduino sensor calibration">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Category</label>
          <select id="help-category">
            <option value="Academic">Academic</option>
            <option value="Practical">Practical (Soldering, 3D Print, etc.)</option>
            <option value="Project">Group Project</option>
            <option value="Career">Career/Internship</option>
          </select>
        </div>
        <div class="form-group">
          <label>Urgency</label>
          <select id="help-urgency">
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Module (optional)</label>
        <input type="text" id="help-module" placeholder="e.g., EE4301 - IoT Systems">
      </div>
      <div class="form-group">
        <label>Details</label>
        <textarea id="help-desc" required placeholder="Describe what you need help with..."></textarea>
      </div>
      <button type="submit" class="btn btn-primary btn-full">Post Help Request</button>
    </form>
  `);
  
  document.getElementById('help-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await api('/api/help-requests', {
      method: 'POST',
      body: {
        title: document.getElementById('help-title').value,
        description: document.getElementById('help-desc').value,
        category: document.getElementById('help-category').value,
        module: document.getElementById('help-module').value,
        urgency: document.getElementById('help-urgency').value,
        userId: currentUser.id,
        userName: currentUser.name
      }
    });
    closeModal();
    showToast('Help request posted! +5 XP', 'success');
    currentUser.xp = (currentUser.xp || 0) + 5;
    updateSidebarUser();
    renderCommunity(document.getElementById('content'));
  });
}

function showNewDiscussionModal() {
  showModal('Start a Discussion', `
    <form id="discussion-form">
      <div class="form-group">
        <label>Title</label>
        <input type="text" id="disc-title" required placeholder="Discussion topic...">
      </div>
      <div class="form-group">
        <label>Module (optional)</label>
        <input type="text" id="disc-module" placeholder="e.g., IT3402 - AI & ML">
      </div>
      <div class="form-group">
        <label>Content</label>
        <textarea id="disc-content" required placeholder="Share your thoughts, tips, or questions..."></textarea>
      </div>
      <div class="form-group">
        <label>Tags (comma-separated)</label>
        <input type="text" id="disc-tags" placeholder="e.g., tips, exam-prep, python">
      </div>
      <button type="submit" class="btn btn-primary btn-full">Post Discussion</button>
    </form>
  `);
  
  document.getElementById('discussion-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await api('/api/discussions', {
      method: 'POST',
      body: {
        title: document.getElementById('disc-title').value,
        content: document.getElementById('disc-content').value,
        module: document.getElementById('disc-module').value,
        tags: document.getElementById('disc-tags').value.split(',').map(t => t.trim()).filter(Boolean),
        userId: currentUser.id,
        userName: currentUser.name
      }
    });
    closeModal();
    showToast('Discussion posted! +5 XP', 'success');
    currentUser.xp = (currentUser.xp || 0) + 5;
    updateSidebarUser();
    renderCommunity(document.getElementById('content'));
  });
}

function showRespondModal(requestId) {
  showModal('Respond to Help Request', `
    <form id="respond-form">
      <div class="form-group">
        <label>Your Response</label>
        <textarea id="response-message" required placeholder="Share your advice or solution..."></textarea>
      </div>
      <button type="submit" class="btn btn-primary btn-full">Send Response (+20 XP)</button>
    </form>
  `);
  
  document.getElementById('respond-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await api(`/api/help-requests/${requestId}/respond`, {
      method: 'POST',
      body: {
        message: document.getElementById('response-message').value,
        userId: currentUser.id,
        userName: currentUser.name
      }
    });
    closeModal();
    showToast('Response sent! +20 XP for helping! 🤝', 'success');
    currentUser.xp = (currentUser.xp || 0) + 20;
    updateSidebarUser();
    renderCommunity(document.getElementById('content'));
  });
}

function showReplyModal(discussionId) {
  showModal('Reply to Discussion', `
    <form id="reply-form">
      <div class="form-group">
        <label>Your Reply</label>
        <textarea id="reply-content" required placeholder="Share your thoughts..."></textarea>
      </div>
      <button type="submit" class="btn btn-primary btn-full">Post Reply (+10 XP)</button>
    </form>
  `);
  
  document.getElementById('reply-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await api(`/api/discussions/${discussionId}/reply`, {
      method: 'POST',
      body: {
        content: document.getElementById('reply-content').value,
        userId: currentUser.id,
        userName: currentUser.name
      }
    });
    closeModal();
    showToast('Reply posted! +10 XP 💬', 'success');
    currentUser.xp = (currentUser.xp || 0) + 10;
    updateSidebarUser();
    renderCommunity(document.getElementById('content'));
  });
}

// ===== LEADERBOARD =====
async function renderLeaderboard(container) {
  container.innerHTML = '<div class="text-center mt-3"><p>Loading...</p></div>';
  
  const [leaderboard, badges] = await Promise.all([
    api('/api/leaderboard'),
    api('/api/badges')
  ]);
  
  const rankColors = ['gold', 'silver', 'bronze'];
  const rankEmoji = ['🥇', '🥈', '🥉'];
  
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">🏆 Leaderboard & Achievements</h1>
        <p class="page-subtitle">Compete with peers and earn badges</p>
      </div>
    </div>
    
    <div class="grid-2">
      <div>
        <h3 class="mb-2">🏅 Top Students</h3>
        ${(leaderboard || []).map((user, i) => `
          <div class="leaderboard-item" style="${user.id === currentUser.id ? 'border: 1px solid var(--primary);' : ''}">
            <div class="leaderboard-rank ${rankColors[i] || ''}">${i < 3 ? rankEmoji[i] : i + 1}</div>
            <span style="font-size: 1.5rem;">${user.avatar}</span>
            <div class="leaderboard-info">
              <div class="leaderboard-name">${user.name} ${user.id === currentUser.id ? '(You)' : ''}</div>
              <div class="leaderboard-stats">${user.course} • Level ${user.levelInfo.level} • 🔥 ${user.streak} day streak</div>
            </div>
            <div class="leaderboard-xp">${user.xp} XP</div>
          </div>
        `).join('')}
      </div>
      
      <div>
        <h3 class="mb-2">🎖️ Badges</h3>
        <div class="badges-grid">
          ${(badges || []).map(badge => {
            const earned = (currentUser.badges || []).includes(badge.id);
            return `
              <div class="badge-item ${earned ? 'earned' : 'locked'}">
                <span class="badge-icon">${badge.icon}</span>
                <span class="badge-name">${badge.name}</span>
                <span style="font-size: 0.65rem; color: var(--text-muted); margin-top: 0.25rem;">${badge.description}</span>
                ${earned ? '<span style="font-size: 0.65rem; color: var(--accent); margin-top: 0.25rem;">✅ Earned</span>' : 
                  `<span style="font-size: 0.65rem; color: var(--text-muted); margin-top: 0.25rem;">+${badge.xpReward} XP</span>`}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

// ===== ANALYTICS =====
async function renderAnalytics(container) {
  container.innerHTML = '<div class="text-center mt-3"><p>Loading...</p></div>';
  
  const analytics = await api(`/api/analytics?userId=${currentUser.id}`);
  if (!analytics) return;
  
  const maxCount = Math.max(...(analytics.weeklyLoad || []).map(w => w.count), 1);
  
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">📈 Analytics Dashboard</h1>
        <p class="page-subtitle">Track your productivity and study habits</p>
      </div>
    </div>
    
    <!-- Key Metrics -->
    <div class="grid-4 mb-3">
      <div class="stat-card">
        <div class="stat-label">Completion Rate</div>
        <div class="stat-value" style="color: var(--secondary);">${analytics.completionRate}%</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Assignments</div>
        <div class="stat-value">${analytics.totalAssignments}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Study Streak</div>
        <div class="stat-value" style="color: var(--warning);">🔥 ${analytics.streak}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg Progress</div>
        <div class="stat-value">${analytics.averageProgress}%</div>
      </div>
    </div>
    
    <div class="grid-2 mb-3">
      <!-- Weekly Workload Chart -->
      <div class="chart-container">
        <h3 class="card-title mb-2">📊 Weekly Workload (Next 8 Weeks)</h3>
        <div class="bar-chart" style="margin-bottom: 2rem;">
          ${(analytics.weeklyLoad || []).map(w => `
            <div class="bar" style="height: ${maxCount > 0 ? (w.count / maxCount * 100) : 0}%; background: ${
              w.intensity === 'high' ? 'linear-gradient(180deg, var(--danger), #991b1b)' :
              w.intensity === 'medium' ? 'linear-gradient(180deg, var(--warning), #c2410c)' :
              w.intensity === 'low' ? 'linear-gradient(180deg, var(--secondary), #047857)' :
              'linear-gradient(180deg, var(--bg-elevated), var(--bg-hover))'
            }; min-height: ${w.count > 0 ? '20px' : '4px'}">
              <span class="bar-value">${w.count}</span>
              <span class="bar-label">${w.week.replace('Week ', 'W')}</span>
            </div>
          `).join('')}
        </div>
      </div>
      
      <!-- Module Breakdown -->
      <div class="chart-container">
        <h3 class="card-title mb-2">📚 Module Breakdown</h3>
        ${(analytics.moduleBreakdown || []).map(mod => `
          <div class="mb-2">
            <div class="flex items-center justify-between mb-1">
              <span style="font-size: 0.85rem;">${mod.name}</span>
              <span style="font-size: 0.8rem; color: var(--text-secondary);">${mod.completed}/${mod.total}</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${mod.total > 0 ? (mod.completed / mod.total * 100) : 0}%"></div>
            </div>
          </div>
        `).join('') || '<p style="color: var(--text-muted);">No data yet</p>'}
      </div>
    </div>
    
    <!-- XP History -->
    <div class="chart-container">
      <h3 class="card-title mb-2">⭐ Recent XP Activity</h3>
      ${(analytics.xpHistory || []).length > 0 ? `
        <div style="max-height: 300px; overflow-y: auto;">
          ${(analytics.xpHistory || []).reverse().map(entry => `
            <div class="flex items-center justify-between" style="padding: 0.5rem; border-bottom: 1px solid var(--border);">
              <div>
                <span style="font-size: 0.85rem;">${entry.reason}</span>
                <div style="font-size: 0.7rem; color: var(--text-muted);">${formatDate(entry.date)}</div>
              </div>
              <span style="color: ${entry.amount > 0 ? 'var(--accent)' : 'var(--danger)'}; font-weight: 600;">
                ${entry.amount > 0 ? '+' : ''}${entry.amount} XP
              </span>
            </div>
          `).join('')}
        </div>
      ` : '<p style="color: var(--text-muted);">No XP history yet. Start completing tasks!</p>'}
    </div>
    
    <!-- Heatmap -->
    <div class="chart-container mt-3">
      <h3 class="card-title mb-2">🗓️ Deadline Heatmap (Next 8 Weeks)</h3>
      <div style="display: grid; grid-template-columns: repeat(14, 1fr); gap: 3px;">
        ${(analytics.heatmap || []).slice(0, 56).map(h => `
          <div style="
            aspect-ratio: 1;
            border-radius: 3px;
            background: ${h.count === 0 ? 'var(--bg)' : h.count === 1 ? 'rgba(34, 197, 94, 0.3)' : h.count === 2 ? 'rgba(249, 115, 22, 0.4)' : 'rgba(239, 68, 68, 0.5)'};
            border: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.55rem;
            color: var(--text-muted);
          " title="${h.date}: ${h.count} assignment(s) due">${h.count > 0 ? h.count : ''}</div>
        `).join('')}
      </div>
      <div class="flex items-center gap-1 mt-1" style="font-size: 0.7rem; color: var(--text-muted);">
        <span>0</span>
        <div style="width: 12px; height: 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 2px;"></div>
        <div style="width: 12px; height: 12px; background: rgba(34, 197, 94, 0.3); border-radius: 2px;"></div>
        <div style="width: 12px; height: 12px; background: rgba(249, 115, 22, 0.4); border-radius: 2px;"></div>
        <div style="width: 12px; height: 12px; background: rgba(239, 68, 68, 0.5); border-radius: 2px;"></div>
        <span>3+</span>
        <span style="margin-left: 0.5rem;">assignments due</span>
      </div>
    </div>
  `;
}
