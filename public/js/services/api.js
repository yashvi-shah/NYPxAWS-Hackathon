/* ==========================================================================
   api.js — the only place in the frontend that talks to the network.
   Endpoints and payload shapes mirror the existing backend contract exactly;
   nothing here rewrites, mocks or "improves" it.
   ========================================================================== */

export class ApiError extends Error {
  constructor(message, { status = 0, payload = null, endpoint = '' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
    this.endpoint = endpoint;
    this.isOffline = status === 0;
  }
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function request(endpoint, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(endpoint, {
      method,
      headers: body === undefined ? undefined : JSON_HEADERS,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err && err.name === 'AbortError') throw err;
    throw new ApiError('Could not reach Gravity.', { endpoint });
  }

  const text = await res.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = null; }
  }

  if (!res.ok) {
    const message = (payload && (payload.error || payload.message)) || `Request failed (${res.status}).`;
    throw new ApiError(message, { status: res.status, payload, endpoint });
  }
  return payload;
}

/** Query string builder that skips empty values. */
function qs(params) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') search.set(k, v);
  });
  const s = search.toString();
  return s ? `?${s}` : '';
}

export const api = {
  /* ---- auth ---- */
  /** Returns the raw contract body: { success, user } or { success:false, error }. */
  async login(email, password) {
    try {
      return await request('/api/auth/login', { method: 'POST', body: { email, password } });
    } catch (err) {
      if (err instanceof ApiError && err.payload && err.payload.success === false) return err.payload;
      throw err;
    }
  },
  register: (payload) => request('/api/auth/register', { method: 'POST', body: payload }),

  /* ---- users ---- */
  users: () => request('/api/users'),
  user: (id) => request(`/api/users/${encodeURIComponent(id)}`),

  /* ---- assignments ---- */
  assignments: (opts) => request('/api/assignments', opts),
  createAssignment: (payload) => request('/api/assignments', { method: 'POST', body: payload }),
  updateAssignment: (id, payload) =>
    request(`/api/assignments/${encodeURIComponent(id)}`, { method: 'PUT', body: payload }),
  deleteAssignment: (id) =>
    request(`/api/assignments/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  /* ---- study plans ---- */
  studyPlans: (opts) => request('/api/study-plans', opts),
  generateStudyPlan: (assignmentId, userId) =>
    request('/api/study-plans/generate', { method: 'POST', body: { assignmentId, userId } }),
  setPlanTask: (planId, taskId, completed, userId) =>
    request(`/api/study-plans/${encodeURIComponent(planId)}/tasks/${encodeURIComponent(taskId)}`,
      { method: 'PUT', body: { completed, userId } }),

  /* ---- workload insight ---- */
  analytics: (userId, opts) => request(`/api/analytics${qs({ userId })}`, opts),
  recommendations: (userId, opts) => request(`/api/recommendations${qs({ userId })}`, opts),

  /* ---- community ---- */
  helpRequests: (opts) => request('/api/help-requests', opts),
  createHelpRequest: (payload) => request('/api/help-requests', { method: 'POST', body: payload }),
  respondToHelpRequest: (id, payload) =>
    request(`/api/help-requests/${encodeURIComponent(id)}/respond`, { method: 'POST', body: payload }),

  discussions: (opts) => request('/api/discussions', opts),
  createDiscussion: (payload) => request('/api/discussions', { method: 'POST', body: payload }),
  replyToDiscussion: (id, payload) =>
    request(`/api/discussions/${encodeURIComponent(id)}/reply`, { method: 'POST', body: payload }),

  /* ---- gamification ---- */
  leaderboard: (opts) => request('/api/leaderboard', opts),
  badges: (opts) => request('/api/badges', opts),
};

/**
 * Run several requests, tolerating individual failures.
 * Returns { data: [...], errors: [...] } so a page can render what it has
 * and still surface a retry for what it could not load.
 */
export async function loadAll(tasks) {
  const results = await Promise.allSettled(tasks.map((t) => (typeof t === 'function' ? t() : t)));
  const data = results.map((r) => (r.status === 'fulfilled' ? r.value : null));
  const errors = results.filter((r) => r.status === 'rejected').map((r) => r.reason);
  return { data, errors };
}
