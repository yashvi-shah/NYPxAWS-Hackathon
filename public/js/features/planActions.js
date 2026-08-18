/* ==========================================================================
   planActions.js — study plan writes shared by several screens.
   ========================================================================== */

import { api } from '../services/api.js';
import { session, preferences } from '../services/store.js';
import { navigate } from '../core/router.js';
import { mutate } from './mutate.js';
import { toast } from '../ui/toast.js';

/** Ask the backend for a task breakdown, then take the student to the plan. */
export function generatePlan(assignmentId, { goToPlans = true, title } = {}) {
  return mutate({
    run: () => api.generateStudyPlan(assignmentId, session.id),
    success: 'Study plan ready',
    detail: title
      ? `${title} is broken into timed steps across the days you have left.`
      : 'Your work is broken into timed steps across the days you have left.',
    failure: 'We couldn\'t build a study plan',
    rerender: !goToPlans,
    after: () => { if (goToPlans) navigate('study-plans'); },
  });
}

export function setTaskDone(planId, taskId, completed) {
  return mutate({
    run: () => api.setPlanTask(planId, taskId, completed, session.id),
    success: completed ? 'Step done' : 'Step reopened',
    detail: completed ? 'Removed from tonight\'s remaining time.' : 'Added back to your remaining time.',
    failure: 'We couldn\'t update that step',
  });
}

/**
 * Snoozing is frontend-only state.
 *
 * FRONTEND REQUIREMENT: rescheduling a study-plan task needs a backend
 * capability — e.g. PUT /api/study-plans/:planId/tasks/:taskId accepting
 * { scheduledDate } — so a moved step survives a reload and is visible on
 * other devices. Until then a snooze is remembered locally for today only and
 * is labelled as such in the UI.
 */
export function snoozeTask(planId, taskId, title) {
  if (preferences.isSnoozed(planId, taskId)) {
    preferences.unsnooze(planId, taskId);
    toast('Step is back in today\'s plan', { message: title, tone: 'info' });
  } else {
    preferences.snooze(planId, taskId);
    toast('Pushed out of today', {
      message: 'Kept on this device for today only — your saved plan is unchanged.',
      tone: 'info',
    });
  }
}
