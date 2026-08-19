const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Simple JSON file database
class Database {
  constructor(filename) {
    this.filepath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(this.filepath)) {
      fs.writeFileSync(this.filepath, '[]');
    }
  }
  
  getAll() {
    return JSON.parse(fs.readFileSync(this.filepath, 'utf8'));
  }
  
  getById(id) {
    return this.getAll().find(item => item.id === id);
  }
  
  create(item) {
    const items = this.getAll();
    item.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    item.createdAt = new Date().toISOString();
    items.push(item);
    fs.writeFileSync(this.filepath, JSON.stringify(items, null, 2));
    return item;
  }
  
  update(id, updates) {
    const items = this.getAll();
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return null;
    items[index] = { ...items[index], ...updates, updatedAt: new Date().toISOString() };
    fs.writeFileSync(this.filepath, JSON.stringify(items, null, 2));
    return items[index];
  }
  
  delete(id) {
    const items = this.getAll();
    const filtered = items.filter(item => item.id !== id);
    fs.writeFileSync(this.filepath, JSON.stringify(filtered, null, 2));
    return filtered.length < items.length;
  }
  
  save(items) {
    fs.writeFileSync(this.filepath, JSON.stringify(items, null, 2));
  }
}

// Initialize databases
const db = {
  users: new Database('users.json'),
  assignments: new Database('assignments.json'),
  studyPlans: new Database('study-plans.json'),
  helpRequests: new Database('help-requests.json'),
  discussions: new Database('discussions.json'),
  activities: new Database('activities.json'),
  badges: new Database('badges.json')
};

// AI Priority Engine
function calculatePriority(assignment) {
  const now = new Date();
  const deadline = new Date(assignment.deadline);
  const daysUntilDue = Math.max(0, (deadline - now) / (1000 * 60 * 60 * 24));
  
  let score = 0;
  
  // Deadline urgency (0-40 points)
  if (daysUntilDue <= 1) score += 40;
  else if (daysUntilDue <= 3) score += 35;
  else if (daysUntilDue <= 7) score += 25;
  else if (daysUntilDue <= 14) score += 15;
  else score += 5;
  
  // Weightage (0-25 points)
  score += (assignment.weightage || 10) * 0.25 * 5;
  
  // Confidence inverse (0-20 points) - lower confidence = higher priority
  const confidence = assignment.confidence || 50;
  score += (100 - confidence) * 0.2;
  
  // Progress inverse (0-15 points) - less progress = higher priority
  const progress = assignment.progress || 0;
  score += (100 - progress) * 0.15;
  
  return Math.min(100, Math.round(score));
}

function getPriorityLabel(score) {
  if (score >= 75) return 'Critical';
  if (score >= 50) return 'High';
  if (score >= 25) return 'Medium';
  return 'Low';
}

function getPriorityColor(score) {
  if (score >= 75) return '#ef4444';
  if (score >= 50) return '#f97316';
  if (score >= 25) return '#eab308';
  return '#22c55e';
}

// AI Study Plan Generator
function generateStudyPlan(assignment) {
  const now = new Date();
  const deadline = new Date(assignment.deadline);
  const daysAvailable = Math.max(1, Math.ceil((deadline - now) / (1000 * 60 * 60 * 24)));
  
  const tasks = [];
  const taskTemplates = {
    'Essay': ['Research topic & gather sources', 'Create outline', 'Write introduction', 'Write body paragraphs', 'Write conclusion', 'Proofread & format'],
    'Programming': ['Understand requirements', 'Design solution architecture', 'Set up project structure', 'Implement core features', 'Testing & debugging', 'Documentation & submission'],
    'Report': ['Research & data collection', 'Analyze findings', 'Create structure/outline', 'Write draft', 'Add visuals/charts', 'Review & finalize'],
    'Presentation': ['Research content', 'Create slide outline', 'Design slides', 'Add visuals & animations', 'Practice delivery', 'Final review'],
    'Lab Report': ['Review lab procedures', 'Organize data & observations', 'Write methodology', 'Analyze results', 'Write discussion & conclusion', 'Format & references'],
    'Project': ['Define scope & objectives', 'Research & planning', 'Initial development', 'Core implementation', 'Testing & iteration', 'Final submission prep'],
    'Default': ['Understand requirements', 'Research & planning', 'Initial draft/work', 'Development/writing', 'Review & refine', 'Final submission']
  };
  
  const template = taskTemplates[assignment.type] || taskTemplates['Default'];
  const tasksPerDay = Math.ceil(template.length / daysAvailable);
  
  let currentDate = new Date(now);
  template.forEach((task, index) => {
    const taskDate = new Date(currentDate);
    taskDate.setDate(taskDate.getDate() + Math.floor(index * daysAvailable / template.length));
    
    tasks.push({
      id: `task-${index}`,
      title: task,
      scheduledDate: taskDate.toISOString().split('T')[0],
      duration: Math.max(30, Math.round(120 / template.length * (assignment.weightage || 10) / 10)),
      completed: false,
      order: index + 1
    });
  });
  
  return {
    assignmentId: assignment.id,
    assignmentTitle: assignment.title,
    module: assignment.module,
    totalDays: daysAvailable,
    tasks,
    estimatedHours: tasks.reduce((sum, t) => sum + t.duration, 0) / 60
  };
}

// XP and Leveling System
function calculateLevel(xp) {
  // Each level requires progressively more XP
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

function awardXp(userId, amount, reason) {
  const users = db.users.getAll();
  const user = users.find(u => u.id === userId);
  if (!user) return null;
  
  user.xp = (user.xp || 0) + amount;
  user.xpHistory = user.xpHistory || [];
  user.xpHistory.push({ amount, reason, date: new Date().toISOString() });
  
  // Update streak
  const today = new Date().toISOString().split('T')[0];
  if (user.lastActiveDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (user.lastActiveDate === yesterday) {
      user.streak = (user.streak || 0) + 1;
    } else if (user.lastActiveDate !== today) {
      user.streak = 1;
    }
    user.lastActiveDate = today;
  }
  
  db.users.save(users);
  return user;
}

// MIME types for static files
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Parse request body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

// Send JSON response
function sendJSON(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

// API Router
async function handleAPI(req, res, pathname) {
  const method = req.method;
  const body = method !== 'GET' ? await parseBody(req) : {};
  
  // Users / Auth
  if (pathname === '/api/auth/login' && method === 'POST') {
    const users = db.users.getAll();
    const user = users.find(u => u.email === body.email);
    if (user && user.password === body.password) {
      const { password, ...safeUser } = user;
      return sendJSON(res, { success: true, user: { ...safeUser, levelInfo: calculateLevel(user.xp || 0) } });
    }
    return sendJSON(res, { success: false, error: 'Invalid credentials' }, 401);
  }
  
  if (pathname === '/api/auth/register' && method === 'POST') {
    const users = db.users.getAll();
    if (users.find(u => u.email === body.email)) {
      return sendJSON(res, { success: false, error: 'Email already exists' }, 400);
    }
    const user = db.users.create({
      name: body.name,
      email: body.email,
      password: body.password,
      course: body.course || 'Engineering',
      year: body.year || 1,
      xp: 0,
      streak: 0,
      lastActiveDate: new Date().toISOString().split('T')[0],
      avatar: body.avatar || '🎓',
      badges: [],
      xpHistory: []
    });
    const { password, ...safeUser } = user;
    return sendJSON(res, { success: true, user: safeUser }, 201);
  }
  
  if (pathname === '/api/users' && method === 'GET') {
    const users = db.users.getAll().map(u => {
      const { password, ...safe } = u;
      return { ...safe, levelInfo: calculateLevel(u.xp || 0) };
    });
    return sendJSON(res, users);
  }
  
  if (pathname.startsWith('/api/users/') && method === 'GET') {
    const userId = pathname.split('/')[3];
    const user = db.users.getById(userId);
    if (!user) return sendJSON(res, { error: 'User not found' }, 404);
    const { password, ...safe } = user;
    return sendJSON(res, { ...safe, levelInfo: calculateLevel(user.xp || 0) });
  }

  // Settings — safe subset of user fields (won't touch xp/badges/etc)
  if (pathname.match(/^\/api\/users\/[^/]+\/settings$/) && method === 'PUT') {
    const userId = pathname.split('/')[3];
    const user = db.users.getById(userId);
    if (!user) return sendJSON(res, { error: 'User not found' }, 404);
    // Only allow settings-safe fields
    const allowed = ['displayName', 'name', 'year', 'semester', 'theme', 'profilePic', 'course'];
    const patch = {};
    for (const key of allowed) {
      if (body[key] !== undefined) patch[key] = body[key];
    }
    const updated = db.users.update(userId, patch);
    const { password, ...safe } = updated;
    return sendJSON(res, { ...safe, levelInfo: calculateLevel(updated.xp || 0) });
  }

  if (pathname.startsWith('/api/users/') && method === 'PUT') {
    const userId = pathname.split('/')[3];
    const user = db.users.getById(userId);
    if (!user) return sendJSON(res, { error: 'User not found' }, 404);
    const updated = db.users.update(userId, body);
    const { password, ...safe } = updated;
    return sendJSON(res, { ...safe, levelInfo: calculateLevel(updated.xp || 0) });
  }

  // Reward redemption — deducts XP
  if (pathname === '/api/rewards/redeem' && method === 'POST') {
    const { userId, xpCost, rewardName } = body;
    if (!userId || !xpCost) return sendJSON(res, { error: 'userId and xpCost required' }, 400);
    const users = db.users.getAll();
    const user = users.find(u => u.id === userId);
    if (!user) return sendJSON(res, { error: 'User not found' }, 404);
    if ((user.xp || 0) < xpCost) return sendJSON(res, { error: 'Not enough XP' }, 400);
    
    user.xp = (user.xp || 0) - xpCost;
    user.xpHistory = user.xpHistory || [];
    user.xpHistory.push({ amount: -xpCost, reason: `Redeemed: ${rewardName || 'reward'}`, date: new Date().toISOString() });
    db.users.save(users);
    
    const { password, ...safe } = user;
    return sendJSON(res, { ...safe, levelInfo: calculateLevel(user.xp || 0) });
  }
  
  // Assignments
  if (pathname === '/api/assignments' && method === 'GET') {
    const assignments = db.assignments.getAll().map(a => ({
      ...a,
      priorityScore: calculatePriority(a),
      priorityLabel: getPriorityLabel(calculatePriority(a)),
      priorityColor: getPriorityColor(calculatePriority(a))
    }));
    assignments.sort((a, b) => b.priorityScore - a.priorityScore);
    return sendJSON(res, assignments);
  }
  
  if (pathname === '/api/assignments' && method === 'POST') {
    const assignment = db.assignments.create({
      title: body.title,
      module: body.module,
      type: body.type || 'Default',
      deadline: body.deadline,
      weightage: body.weightage || 10,
      confidence: body.confidence || 50,
      progress: body.progress || 0,
      status: 'pending',
      description: body.description || '',
      userId: body.userId
    });
    assignment.priorityScore = calculatePriority(assignment);
    assignment.priorityLabel = getPriorityLabel(assignment.priorityScore);
    
    // Award XP for adding assignment
    if (body.userId) awardXp(body.userId, 10, 'Added new assignment');
    
    return sendJSON(res, assignment, 201);
  }
  
  if (pathname.startsWith('/api/assignments/') && method === 'PUT') {
    const id = pathname.split('/')[3];
    const updated = db.assignments.update(id, body);
    if (!updated) return sendJSON(res, { error: 'Not found' }, 404);
    
    // Award XP for completing
    if (body.status === 'completed' && body.userId) {
      const deadline = new Date(updated.deadline);
      const now = new Date();
      const earlyBonus = deadline > now ? 25 : 0;
      const latePenalty = now > deadline ? -15 : 0;
      awardXp(body.userId, 50 + earlyBonus + latePenalty, 
        `Completed: ${updated.title}${earlyBonus ? ' (early bonus!)' : ''}${latePenalty ? ' (late penalty)' : ''}`);
    }
    
    // Award XP for progress updates
    if (body.progress && body.userId && body.progress > (updated.progress || 0)) {
      awardXp(body.userId, 5, `Progress on: ${updated.title}`);
    }
    
    updated.priorityScore = calculatePriority(updated);
    updated.priorityLabel = getPriorityLabel(updated.priorityScore);
    return sendJSON(res, updated);
  }
  
  if (pathname.startsWith('/api/assignments/') && method === 'DELETE') {
    const id = pathname.split('/')[3];
    db.assignments.delete(id);
    return sendJSON(res, { success: true });
  }
  
  // Study Plans
  if (pathname === '/api/study-plans/generate' && method === 'POST') {
    const assignment = db.assignments.getById(body.assignmentId);
    if (!assignment) return sendJSON(res, { error: 'Assignment not found' }, 404);
    
    const plan = generateStudyPlan(assignment);
    const saved = db.studyPlans.create(plan);
    
    if (body.userId) awardXp(body.userId, 15, 'Generated study plan');
    return sendJSON(res, saved, 201);
  }
  
  if (pathname === '/api/study-plans' && method === 'GET') {
    return sendJSON(res, db.studyPlans.getAll());
  }
  
  if (pathname.startsWith('/api/study-plans/') && pathname.includes('/tasks/') && method === 'PUT') {
    const parts = pathname.split('/');
    const planId = parts[3];
    const taskId = parts[5];
    const plans = db.studyPlans.getAll();
    const plan = plans.find(p => p.id === planId);
    if (!plan) return sendJSON(res, { error: 'Plan not found' }, 404);
    
    const task = plan.tasks.find(t => t.id === taskId);
    if (task) {
      task.completed = body.completed;
      db.studyPlans.save(plans);
      if (body.completed && body.userId) awardXp(body.userId, 10, `Completed task: ${task.title}`);
    }
    return sendJSON(res, plan);
  }
  
  // Help Requests (Peer Tutoring)
  if (pathname === '/api/help-requests' && method === 'GET') {
    return sendJSON(res, db.helpRequests.getAll().reverse());
  }
  
  if (pathname === '/api/help-requests' && method === 'POST') {
    const request = db.helpRequests.create({
      title: body.title,
      description: body.description,
      category: body.category || 'Academic',
      module: body.module || '',
      urgency: body.urgency || 'medium',
      userId: body.userId,
      userName: body.userName,
      status: 'open',
      responses: []
    });
    if (body.userId) awardXp(body.userId, 5, 'Posted help request');
    return sendJSON(res, request, 201);
  }
  
  if (pathname.startsWith('/api/help-requests/') && pathname.endsWith('/respond') && method === 'POST') {
    const id = pathname.split('/')[3];
    const requests = db.helpRequests.getAll();
    const request = requests.find(r => r.id === id);
    if (!request) return sendJSON(res, { error: 'Not found' }, 404);
    
    request.responses = request.responses || [];
    request.responses.push({
      userId: body.userId,
      userName: body.userName,
      message: body.message,
      date: new Date().toISOString()
    });
    db.helpRequests.save(requests);
    
    // Award XP to helper
    if (body.userId) awardXp(body.userId, 20, 'Helped a peer');
    return sendJSON(res, request);
  }
  
  // Discussions
  if (pathname === '/api/discussions' && method === 'GET') {
    return sendJSON(res, db.discussions.getAll().reverse());
  }
  
  if (pathname === '/api/discussions' && method === 'POST') {
    const discussion = db.discussions.create({
      title: body.title,
      content: body.content,
      module: body.module || '',
      tags: body.tags || [],
      userId: body.userId,
      userName: body.userName,
      replies: [],
      upvotes: 0
    });
    if (body.userId) awardXp(body.userId, 5, 'Started a discussion');
    return sendJSON(res, discussion, 201);
  }
  
  if (pathname.startsWith('/api/discussions/') && pathname.endsWith('/reply') && method === 'POST') {
    const id = pathname.split('/')[3];
    const discussions = db.discussions.getAll();
    const disc = discussions.find(d => d.id === id);
    if (!disc) return sendJSON(res, { error: 'Not found' }, 404);
    
    disc.replies = disc.replies || [];
    disc.replies.push({
      userId: body.userId,
      userName: body.userName,
      content: body.content,
      date: new Date().toISOString()
    });
    db.discussions.save(discussions);
    if (body.userId) awardXp(body.userId, 10, 'Replied to discussion');
    return sendJSON(res, disc);
  }
  
  // Analytics
  if (pathname === '/api/analytics' && method === 'GET') {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const userId = url.searchParams.get('userId');
    
    const assignments = db.assignments.getAll().filter(a => !userId || a.userId === userId);
    const completed = assignments.filter(a => a.status === 'completed');
    const pending = assignments.filter(a => a.status !== 'completed');
    
    // Workload heatmap data (next 8 weeks)
    const heatmap = [];
    const today = new Date();
    for (let i = 0; i < 56; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const dueCount = assignments.filter(a => a.deadline && a.deadline.startsWith(dateStr)).length;
      heatmap.push({ date: dateStr, count: dueCount, day: date.getDay() });
    }
    
    // Weekly workload
    const weeklyLoad = [];
    for (let w = 0; w < 8; w++) {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() + w * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      
      const count = assignments.filter(a => {
        const d = new Date(a.deadline);
        return d >= weekStart && d < weekEnd;
      }).length;
      
      weeklyLoad.push({
        week: `Week ${w + 1}`,
        startDate: weekStart.toISOString().split('T')[0],
        count,
        intensity: count === 0 ? 'none' : count <= 2 ? 'low' : count <= 4 ? 'medium' : 'high'
      });
    }
    
    // Module breakdown
    const modules = {};
    assignments.forEach(a => {
      if (!modules[a.module]) modules[a.module] = { total: 0, completed: 0 };
      modules[a.module].total++;
      if (a.status === 'completed') modules[a.module].completed++;
    });
    
    const user = userId ? db.users.getById(userId) : null;
    
    return sendJSON(res, {
      totalAssignments: assignments.length,
      completedAssignments: completed.length,
      pendingAssignments: pending.length,
      completionRate: assignments.length ? Math.round(completed.length / assignments.length * 100) : 0,
      averageProgress: pending.length ? Math.round(pending.reduce((s, a) => s + (a.progress || 0), 0) / pending.length) : 0,
      heatmap,
      weeklyLoad,
      moduleBreakdown: Object.entries(modules).map(([name, data]) => ({ name, ...data })),
      streak: user ? user.streak || 0 : 0,
      xpHistory: user ? (user.xpHistory || []).slice(-20) : []
    });
  }
  
  // Leaderboard
  if (pathname === '/api/leaderboard' && method === 'GET') {
    const users = db.users.getAll()
      .map(u => ({
        id: u.id,
        name: u.name,
        avatar: u.avatar,
        course: u.course,
        xp: u.xp || 0,
        streak: u.streak || 0,
        levelInfo: calculateLevel(u.xp || 0)
      }))
      .sort((a, b) => b.xp - a.xp);
    return sendJSON(res, users);
  }
  
  // Badges
  if (pathname === '/api/badges' && method === 'GET') {
    const allBadges = [
      { id: 'first-assignment', name: 'First Steps', description: 'Add your first assignment', icon: '🎯', xpReward: 25 },
      { id: 'streak-3', name: 'On Fire', description: '3-day study streak', icon: '🔥', xpReward: 50 },
      { id: 'streak-7', name: 'Unstoppable', description: '7-day study streak', icon: '⚡', xpReward: 100 },
      { id: 'early-bird', name: 'Early Bird', description: 'Submit an assignment early', icon: '🐦', xpReward: 30 },
      { id: 'helper', name: 'Helpful Hand', description: 'Help 3 peers', icon: '🤝', xpReward: 75 },
      { id: 'planner', name: 'Master Planner', description: 'Generate 5 study plans', icon: '📋', xpReward: 50 },
      { id: 'all-clear', name: 'All Clear', description: 'Complete all assignments in a week', icon: '✨', xpReward: 100 },
      { id: 'social', name: 'Community Star', description: 'Start 5 discussions', icon: '⭐', xpReward: 50 },
      { id: 'level-5', name: 'Rising Scholar', description: 'Reach Level 5', icon: '📚', xpReward: 75 },
      { id: 'level-10', name: 'Academic Hero', description: 'Reach Level 10', icon: '🏆', xpReward: 150 }
    ];
    return sendJSON(res, allBadges);
  }
  
  // AI Recommendations
  if (pathname === '/api/recommendations' && method === 'GET') {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const userId = url.searchParams.get('userId');
    
    const assignments = db.assignments.getAll()
      .filter(a => a.status !== 'completed' && (!userId || a.userId === userId))
      .map(a => ({ ...a, priorityScore: calculatePriority(a) }))
      .sort((a, b) => b.priorityScore - a.priorityScore);
    
    const recommendations = assignments.slice(0, 3).map((a, i) => {
      const daysLeft = Math.max(0, Math.ceil((new Date(a.deadline) - new Date()) / (1000 * 60 * 60 * 24)));
      let reason = '';
      
      if (daysLeft <= 1) reason = '⚠️ Due tomorrow! Focus on this immediately.';
      else if (daysLeft <= 3) reason = `📅 Due in ${daysLeft} days. High priority based on deadline and weightage.`;
      else if (a.confidence < 30) reason = `🤔 Low confidence (${a.confidence}%). Consider getting help or starting research.`;
      else if (a.weightage >= 30) reason = `📊 High weightage (${a.weightage}%). Important for your grade.`;
      else reason = `📝 ${daysLeft} days left. Good time to make progress.`;
      
      return {
        rank: i + 1,
        assignment: a,
        reason,
        suggestedAction: a.progress < 20 ? 'Start working on this' : a.progress < 80 ? 'Continue making progress' : 'Final review and submit'
      };
    });
    
    return sendJSON(res, recommendations);
  }
  
  return sendJSON(res, { error: 'Not found' }, 404);
}

// Static file server
function serveStatic(res, filepath) {
  const ext = path.extname(filepath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  
  fs.readFile(filepath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

// Main request handler
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;
  
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  
  // API routes
  if (pathname.startsWith('/api/')) {
    return handleAPI(req, res, pathname);
  }
  
  // Static files
  let filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);
  
  // SPA fallback - serve index.html for non-file routes
  if (!path.extname(filePath) && !fs.existsSync(filePath)) {
    filePath = path.join(__dirname, 'public', 'index.html');
  }
  
  serveStatic(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Gravity is running at http://localhost:${PORT}`);
  console.log(`📚 API available at http://localhost:${PORT}/api/`);
});
