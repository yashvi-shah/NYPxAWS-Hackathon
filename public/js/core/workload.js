/* ==========================================================================
   workload.js — Gravity's workload model.

   The backend owns priority scoring; this module answers the second question
   the product exists for: "can I realistically fit this into the time I have?"

   It derives effort in hours from fields the API already returns (type,
   weightage, confidence, progress) and from study-plan task durations when a
   plan exists, then lays that work across the student's available hours.
   No backend call, no new data model.
   ========================================================================== */

import { preferences } from '../services/store.js';
import { addDays, dayKey, daysUntil, startOfDay, toDate } from '../lib/format.js';

/** Typical total effort, in hours, for a full-weight piece of work of each type. */
export const EFFORT_BASE = {
  'Essay': 6,
  'Programming': 10,
  'Report': 7,
  'Presentation': 5,
  'Lab Report': 4,
  'Project': 14,
  'Default': 6,
};

const quarter = (h) => Math.round(h * 4) / 4;

/** Whole-task effort estimate before any progress is taken off. */
export function estimateTotalHours(assignment) {
  if (!assignment) return 0;
  const base = EFFORT_BASE[assignment.type] ?? EFFORT_BASE.Default;
  const weightage = Number(assignment.weightage) || 10;
  const confidence = Number.isFinite(Number(assignment.confidence)) ? Number(assignment.confidence) : 50;
  const weightFactor = 0.65 + weightage / 45;          // a 40% task costs ~1.5x a 10% one
  const confidenceFactor = 1 + (100 - confidence) / 220; // low confidence needs more runway
  return quarter(Math.max(0.5, base * weightFactor * confidenceFactor));
}

/** The plan generated for an assignment, if the student has one. */
export function planForAssignment(assignmentId, plans) {
  if (!assignmentId || !plans) return null;
  const matches = plans.filter((p) => p.assignmentId === assignmentId);
  if (!matches.length) return null;
  // Several plans can exist for one assignment; the newest is the live one.
  return matches.reduce((newest, p) => ((p.createdAt || '') > (newest.createdAt || '') ? p : newest));
}

export function planProgress(plan) {
  const tasks = (plan && plan.tasks) || [];
  const done = tasks.filter((t) => t.completed).length;
  return {
    done,
    total: tasks.length,
    percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    remainingMinutes: tasks.filter((t) => !t.completed).reduce((s, t) => s + (Number(t.duration) || 0), 0),
    totalMinutes: tasks.reduce((s, t) => s + (Number(t.duration) || 0), 0),
  };
}

/**
 * Hours of work left on an assignment.
 * A study plan is the better source of truth, so it wins when present.
 */
export function remainingHours(assignment, plan) {
  if (!assignment || assignment.status === 'completed') return 0;
  if (plan) {
    const { remainingMinutes } = planProgress(plan);
    if (remainingMinutes > 0) return quarter(remainingMinutes / 60);
  }
  const progress = Math.min(100, Math.max(0, Number(assignment.progress) || 0));
  return quarter(estimateTotalHours(assignment) * (1 - progress / 100));
}

/** Where the estimate came from — shown to the student so it never feels magic. */
export function effortSource(assignment, plan) {
  if (plan && planProgress(plan).remainingMinutes > 0) return 'plan';
  return 'estimate';
}

const isOpen = (a) => a && a.status !== 'completed' && a.deadline;

/**
 * Lay all open work across the days between now and each deadline.
 *
 * Each assignment is spread evenly over the days it has left, then any hours
 * that could not fit into the student's available time are pushed onto the
 * deadline day as overflow — which is what makes an impossible week visible.
 */
export function buildSchedule({ assignments = [], plans = [], horizonDays = 21, from = new Date() } = {}) {
  const today = startOfDay(from);
  const days = [];
  const byKey = new Map();

  for (let i = 0; i < horizonDays; i += 1) {
    const date = addDays(today, i);
    const day = {
      index: i,
      date,
      key: dayKey(date),
      capacity: preferences.capacityFor(date),
      allocated: 0,
      overflow: 0,
      items: [],
      deadlines: [],
      isToday: i === 0,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    };
    days.push(day);
    byKey.set(day.key, day);
  }

  const open = assignments.filter(isOpen).slice().sort((a, b) => {
    const byDeadline = String(a.deadline).localeCompare(String(b.deadline));
    if (byDeadline !== 0) return byDeadline;
    return (b.priorityScore || 0) - (a.priorityScore || 0);
  });

  const atRisk = [];
  const workItems = [];

  open.forEach((assignment) => {
    const plan = planForAssignment(assignment.id, plans);
    const required = remainingHours(assignment, plan);
    const dueIn = daysUntil(assignment.deadline);
    const lastIndex = Math.max(0, Math.min(horizonDays - 1, dueIn === null ? horizonDays - 1 : dueIn));
    const overdue = dueIn !== null && dueIn < 0;

    const dueDay = byKey.get(dayKey(toDate(assignment.deadline)));
    if (dueDay) {
      dueDay.deadlines.push({
        id: assignment.id,
        title: assignment.title,
        module: assignment.module,
        weightage: assignment.weightage,
        progress: assignment.progress,
        priorityLabel: assignment.priorityLabel,
        priorityScore: assignment.priorityScore,
        status: assignment.status,
      });
    }

    const item = {
      id: assignment.id,
      title: assignment.title,
      module: assignment.module,
      required,
      scheduled: 0,
      unfit: 0,
      overdue,
      source: effortSource(assignment, plan),
      dueIn,
      deadline: assignment.deadline,
    };
    workItems.push(item);
    if (required <= 0) return;

    const window = days.slice(0, lastIndex + 1);
    const free = (day) => Math.max(0, day.capacity - day.allocated);
    let left = required;

    const give = (day, amount) => {
      if (amount <= 0.01) return;
      day.allocated += amount;
      // One entry per assignment per day, so a day's drivers read cleanly.
      const existing = day.items.find((i) => i.id === assignment.id);
      if (existing) existing.hours += amount;
      else day.items.push({ id: assignment.id, title: assignment.title, module: assignment.module, hours: amount });
      item.scheduled += amount;
      left -= amount;
    };

    // Pass 1 — spread evenly so nothing is needlessly front-loaded.
    const evenShare = required / window.length;
    window.forEach((day) => give(day, Math.min(evenShare, left, free(day))));
    // Pass 2 — push what did not fit into the earliest remaining space.
    window.forEach((day) => { if (left > 0.01) give(day, Math.min(left, free(day))); });

    // Pass 3 — anything still left cannot fit before the deadline.
    if (left > 0.01) {
      const target = days[lastIndex];
      target.overflow += left;
      // Still attribute it, so a day's drivers add up to what it is being asked for.
      const existing = target.items.find((i) => i.id === assignment.id);
      if (existing) existing.hours += left;
      else target.items.push({ id: assignment.id, title: assignment.title, module: assignment.module, hours: left });
      item.unfit = quarter(left);
      atRisk.push({
        id: assignment.id,
        title: assignment.title,
        module: assignment.module,
        deadline: assignment.deadline,
        dueIn,
        required,
        shortfall: quarter(left),
        overdue,
      });
      left = 0;
    }
  });

  days.forEach((day) => {
    day.required = quarter(day.allocated + day.overflow);
    day.allocated = quarter(day.allocated);
    day.overflow = quarter(day.overflow);
    day.items.forEach((i) => { i.hours = quarter(i.hours); });
    day.over = quarter(Math.max(0, day.required - day.capacity));
    day.isOver = day.over > 0.01;
    day.freeHours = quarter(Math.max(0, day.capacity - day.required));
    day.items.sort((a, b) => b.hours - a.hours);
  });

  return {
    days,
    byKey,
    workItems,
    atRisk,
    today: days[0],
    window: (n) => summarise(days.slice(0, n)),
    week: summarise(days.slice(0, 7)),
    fortnight: summarise(days.slice(0, 14)),
    peakDay: days.slice(0, 14).reduce((peak, d) => (d.required > (peak?.required || 0) ? d : peak), null),
  };
}

function summarise(days) {
  const required = quarter(days.reduce((s, d) => s + d.required, 0));
  const capacity = quarter(days.reduce((s, d) => s + d.capacity, 0));
  const overloaded = days.filter((d) => d.isOver);
  return {
    days,
    required,
    capacity,
    balance: quarter(capacity - required),
    overloaded,
    overHours: quarter(overloaded.reduce((s, d) => s + d.over, 0)),
    utilisation: capacity > 0 ? Math.round((required / capacity) * 100) : 0,
  };
}

/**
 * One honest sentence about the week, plus the tone to render it in.
 * This is the line the dashboard leads with, so it must never overstate.
 */
export function weekVerdict(schedule) {
  const week = schedule.week;
  const overdue = schedule.atRisk.filter((r) => r.overdue);

  if (week.required <= 0.01) {
    return {
      tone: 'ok',
      line: 'Nothing is competing for your time this week.',
      detail: 'No open work falls inside the next seven days.',
    };
  }
  if (overdue.length) {
    return {
      tone: 'risk',
      line: overdue.length === 1
        ? 'One deadline has already passed.'
        : `${overdue.length} deadlines have already passed.`,
      detail: 'Clear these first — they are still counted in your workload until they are done.',
    };
  }
  if (week.balance < -0.24) {
    return {
      tone: 'risk',
      line: `You are ${fmtHours(Math.abs(week.balance))} short this week.`,
      detail: `Your open work needs ${fmtHours(week.required)} and you have ${fmtHours(week.capacity)} free. Something has to move, or your availability needs to go up.`,
    };
  }
  if (week.overloaded.length) {
    const names = week.overloaded.slice(0, 2).map((d) => dayName(d.date));
    return {
      tone: 'warn',
      line: week.overloaded.length === 1
        ? `${names[0]} is overloaded.`
        : `${names.join(' and ')} are overloaded.`,
      detail: `The week fits overall — ${fmtHours(week.required)} of work against ${fmtHours(week.capacity)} free — but the load is stacked on ${week.overloaded.length === 1 ? 'one day' : 'a few days'}. Pull some of it earlier.`,
    };
  }
  if (week.utilisation >= 80) {
    return {
      tone: 'warn',
      line: 'Your week is full but achievable.',
      detail: `${fmtHours(week.required)} of work against ${fmtHours(week.capacity)} free. There is little room for anything unexpected.`,
    };
  }
  return {
    tone: 'ok',
    line: 'Your week is manageable.',
    detail: `${fmtHours(week.required)} of work against ${fmtHours(week.capacity)} free — you have ${fmtHours(week.balance)} of slack.`,
  };
}

/** Today's capacity picture, including real plan blocks scheduled for today. */
export function todayPicture(schedule, plans = []) {
  const today = schedule.today;
  const key = dayKey(new Date());
  const blocks = [];

  (plans || []).forEach((plan) => {
    (plan.tasks || []).forEach((task) => {
      if (task.scheduledDate !== key) return;
      blocks.push({
        planId: plan.id,
        taskId: task.id,
        title: task.title,
        assignmentTitle: plan.assignmentTitle,
        module: plan.module,
        minutes: Number(task.duration) || 0,
        completed: Boolean(task.completed),
        snoozed: preferences.isSnoozed(plan.id, task.id),
      });
    });
  });

  blocks.sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));

  const plannedMinutes = blocks.filter((b) => !b.completed && !b.snoozed).reduce((s, b) => s + b.minutes, 0);
  const doneMinutes = blocks.filter((b) => b.completed).reduce((s, b) => s + b.minutes, 0);

  return {
    day: today,
    capacity: today.capacity,
    required: today.required,
    free: today.freeHours,
    over: today.over,
    blocks,
    plannedHours: quarter(plannedMinutes / 60),
    doneHours: quarter(doneMinutes / 60),
  };
}

/** Give the day's plan blocks real clock times from the student's start hour. */
export function timeBlocks(blocks, startHour = preferences.get('dayStartHour')) {
  let cursor = (Number(startHour) || 19) * 60;
  return blocks.map((block) => {
    const from = cursor;
    const to = cursor + Math.max(15, block.minutes);
    if (!block.completed && !block.snoozed) cursor = to + (block.minutes >= 60 ? 10 : 5);
    return { ...block, from, to };
  });
}

/** Hours of remaining work per module — "where does my time actually go?" */
export function effortByModule(assignments, plans) {
  const map = new Map();
  assignments.filter(isOpen).forEach((a) => {
    const plan = planForAssignment(a.id, plans);
    const hoursLeft = remainingHours(a, plan);
    if (hoursLeft <= 0) return;
    const entry = map.get(a.module) || { module: a.module, hours: 0, count: 0 };
    entry.hours = quarter(entry.hours + hoursLeft);
    entry.count += 1;
    map.set(a.module, entry);
  });
  return Array.from(map.values()).sort((a, b) => b.hours - a.hours);
}

/** What is driving an overloaded day, and the cheapest way to relieve it. */
export function relief(day, schedule) {
  const drivers = day.items.slice(0, 3);
  const earlier = schedule.days
    .slice(0, day.index)
    .filter((d) => d.freeHours > 0.24)
    .sort((a, b) => b.freeHours - a.freeHours)[0];

  if (!drivers.length) return null;
  const biggest = drivers[0];
  if (earlier) {
    return {
      text: `Move about ${fmtHours(Math.min(day.over, earlier.freeHours))} of ${biggest.title} to ${dayName(earlier.date)}, which has ${fmtHours(earlier.freeHours)} free.`,
    };
  }
  return {
    text: `Every day before this is already full. Either raise your available hours or accept that ${biggest.title} lands late.`,
  };
}

/* ---- small local formatters (kept here so the model reads as prose) ------ */
function fmtHours(value) {
  const total = Math.round((Number(value) || 0) * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h && !m) return 'no time';
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${m}m`;
}

function dayName(date) {
  const diff = daysUntil(date);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(date).getDay()];
}

export { fmtHours as scheduleHours, dayName as scheduleDayName };
