/* ==========================================================================
   mutate.js — one path for every write.
   Invalidates the read cache, refreshes the student's XP/streak from the
   server, reports the outcome and re-renders. XP shown in the toast is the
   real difference the backend awarded, never a hardcoded guess.
   ========================================================================== */

import { invalidate, refreshUser, session } from '../services/store.js';
import { toastOk, toastError } from '../ui/toast.js';
import { refresh as refreshView } from '../core/router.js';

/**
 * @param {object} options
 * @param {Function} options.run           the api call
 * @param {string}   options.success       toast headline on success
 * @param {string}  [options.detail]       toast supporting line
 * @param {string}  [options.failure]      toast headline on failure
 * @param {boolean} [options.rerender]     re-render the current page afterwards
 * @param {Function}[options.after]        callback with the api result
 */
export async function mutate({
  run,
  success,
  detail,
  failure = 'That didn\'t go through',
  rerender = true,
  after,
  silent = false,
}) {
  const xpBefore = Number(session.user?.xp) || 0;
  try {
    const result = await run();
    invalidate();
    const user = await refreshUser();
    const delta = (Number(user?.xp) || 0) - xpBefore;
    if (!silent) toastOk(success, { message: detail, xp: delta || undefined });
    if (after) await after(result);
    if (rerender) refreshView();
    return result;
  } catch (err) {
    toastError(failure, err);
    return null;
  }
}
