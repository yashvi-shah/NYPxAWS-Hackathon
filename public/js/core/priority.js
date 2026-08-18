/* ==========================================================================
   priority.js — turns the backend's priority signal into language.

   Ordering and scoring stay with the backend (/api/recommendations and the
   priorityScore on /api/assignments). This module never re-ranks; it only
   explains, using the same fields the score was built from, so the student
   sees reasoning instead of an arbitrary number out of 100.
   ========================================================================== */

import { daysUntil } from '../lib/format.js';
import { planForAssignment, planProgress, remainingHours, scheduleHours } from './workload.js';

/** Map the backend's label onto the app's three-tone status language. */
export function priorityTone(assignment) {
  const label = String(assignment?.priorityLabel || '').toLowerCase();
  if (label === 'critical') return 'risk';
  if (label === 'high') return 'warn';
  if (label === 'low') return 'ok';
  return 'none';
}

export function priorityText(assignment) {
  const label = assignment?.priorityLabel || 'Medium';
  return label === 'Critical' ? 'Do now' : label === 'High' ? 'High' : label === 'Medium' ? 'Medium' : 'Low';
}

export function deadlineTone(assignment) {
  if (!assignment || assignment.status === 'completed') return 'ok';
  const d = daysUntil(assignment.deadline);
  if (d === null) return 'none';
  if (d < 0) return 'risk';
  if (d <= 1) return 'risk';
  if (d <= 3) return 'warn';
  return 'none';
}

const TONE_RANK = { risk: 0, warn: 1, ok: 2, none: 3 };

/**
 * Build the "why this first?" reasons for an assignment.
 * Every bullet is traceable to a field the student filled in or the API returned.
 *
 * @param {object} assignment
 * @param {{plans?: array, assignments?: array, schedule?: object}} context
 * @returns {{bullets: Array<{text: string, tone: string, icon: string}>, hoursLeft: number}}
 */
export function explain(assignment, context = {}) {
  const { plans = [], assignments = [], schedule = null } = context;
  const bullets = [];
  const days = daysUntil(assignment.deadline);
  const plan = planForAssignment(assignment.id, plans);
  const hoursLeft = remainingHours(assignment, plan);
  const progress = Number(assignment.progress) || 0;
  const weightage = Number(assignment.weightage) || 0;
  const confidence = Number(assignment.confidence);

  /* ---- deadline pressure ---- */
  if (days !== null) {
    if (days < 0) {
      bullets.push({ tone: 'risk', icon: 'alert', text: `The deadline passed ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} ago and it is still open.` });
    } else if (days === 0) {
      bullets.push({ tone: 'risk', icon: 'alert', text: 'It is due today.' });
    } else if (days === 1) {
      bullets.push({ tone: 'risk', icon: 'clock', text: 'It is due tomorrow, so today is the last full day you have.' });
    } else if (days <= 3) {
      bullets.push({ tone: 'warn', icon: 'clock', text: `Only ${days} days left before the deadline.` });
    } else if (days <= 7) {
      bullets.push({ tone: 'none', icon: 'calendar', text: `Due in ${days} days — inside this week.` });
    }
  }

  /* ---- how much is genuinely left ---- */
  if (progress >= 85 && progress < 100) {
    bullets.push({ tone: 'ok', icon: 'checkCircle', text: `It is ${progress}% done — about ${scheduleHours(hoursLeft)} of work would close it out and remove a deadline.` });
  } else if (progress === 0 && days !== null && days <= 5) {
    bullets.push({ tone: 'risk', icon: 'hourglass', text: `Nothing has been started yet, and it needs roughly ${scheduleHours(hoursLeft)}.` });
  } else if (hoursLeft > 0) {
    bullets.push({ tone: 'none', icon: 'hourglass', text: `Roughly ${scheduleHours(hoursLeft)} of work left${progress > 0 ? ` at ${progress}% complete` : ''}.` });
  }

  /* ---- does it actually fit before the deadline? ---- */
  if (schedule) {
    const risk = schedule.atRisk.find((r) => r.id === assignment.id);
    if (risk && !risk.overdue) {
      bullets.push({ tone: 'risk', icon: 'alertCircle', text: `Your free time before the deadline is ${scheduleHours(risk.shortfall)} short of what this needs.` });
    }
  }

  /* ---- grade stake ---- */
  if (weightage >= 25) {
    const heaviest = assignments
      .filter((a) => a.status !== 'completed')
      .every((a) => (Number(a.weightage) || 0) <= weightage);
    bullets.push({
      tone: 'warn',
      icon: 'scale',
      text: heaviest && assignments.length > 1
        ? `At ${weightage}% it carries more of your grade than anything else you have open.`
        : `It is worth ${weightage}% of the module grade.`,
    });
  } else if (weightage > 0 && bullets.length < 3) {
    bullets.push({ tone: 'none', icon: 'scale', text: `Worth ${weightage}% of the module grade.` });
  }

  /* ---- self-rated confidence ---- */
  if (Number.isFinite(confidence) && confidence <= 40) {
    bullets.push({ tone: 'warn', icon: 'gauge', text: `You rated your confidence at ${confidence}%, so it is likely to take longer than it looks.` });
  }

  /* ---- plan momentum ---- */
  if (plan) {
    const p = planProgress(plan);
    if (p.total) {
      bullets.push({
        tone: p.done ? 'ok' : 'none',
        icon: 'plans',
        text: p.done
          ? `${p.done} of ${p.total} planned steps are done — the next one is ready to pick up.`
          : `A ${p.total}-step plan is ready, so you can start without deciding where to begin.`,
      });
    }
  }

  bullets.sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone]);
  return { bullets: bullets.slice(0, 4), hoursLeft, plan };
}

/** Short imperative for the primary button, taken from the backend's suggestion. */
export function actionLabel(assignment, backendSuggestion) {
  if (backendSuggestion) return backendSuggestion;
  const progress = Number(assignment?.progress) || 0;
  if (progress < 20) return 'Start working on this';
  if (progress < 80) return 'Continue making progress';
  return 'Final review and submit';
}

/**
 * The backend's recommendation reason arrives with leading emoji and
 * exclamation marks. Keep the sentence, drop the decoration.
 */
export function tidyReason(reason) {
  return String(reason || '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/!+/g, '.')
    .trim();
}
