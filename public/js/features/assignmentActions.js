/* ==========================================================================
   assignmentActions.js — assignment writes shared by the dashboard, the list
   and the detail drawer, so the same action behaves identically everywhere.
   ========================================================================== */

import { api } from '../services/api.js';
import { session } from '../services/store.js';
import { confirmDialog } from '../ui/overlay.js';
import { mutate } from './mutate.js';

export function completeAssignment(assignment, { rerender = true } = {}) {
  return mutate({
    run: () => api.updateAssignment(assignment.id, { status: 'completed', progress: 100, userId: session.id }),
    success: 'Marked complete',
    detail: `${assignment.title} is off your workload.`,
    failure: 'We couldn\'t mark this complete',
    rerender,
  });
}

export function reopenAssignment(assignment, { rerender = true } = {}) {
  return mutate({
    run: () => api.updateAssignment(assignment.id, { status: 'pending', userId: session.id }),
    success: 'Reopened',
    detail: `${assignment.title} is back in your workload.`,
    failure: 'We couldn\'t reopen this assignment',
    rerender,
  });
}

export function setAssignmentProgress(assignment, progress, { rerender = true } = {}) {
  return mutate({
    run: () => api.updateAssignment(assignment.id, { progress, userId: session.id }),
    success: 'Progress saved',
    detail: `${assignment.title} is now ${progress}% done.`,
    failure: 'We couldn\'t update this assignment',
    rerender,
  });
}

/** Confirms first; resolves to true when the assignment was actually removed. */
export async function deleteAssignment(assignment, { onCancel } = {}) {
  const ok = await confirmDialog({
    title: 'Delete this commitment?',
    message: `${assignment.title} will be removed from your workload, along with the time it was taking up. This can't be undone.`,
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!ok) {
    if (onCancel) onCancel();
    return false;
  }
  const result = await mutate({
    run: () => api.deleteAssignment(assignment.id),
    success: 'Commitment deleted',
    detail: `${assignment.title} was removed.`,
    failure: 'We couldn\'t delete that',
  });
  return Boolean(result);
}
