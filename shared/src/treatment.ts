export const TreatmentCondition = {
  DIABETES: 'DIABETES',
  TB: 'TB',
  HYPERTENSION: 'HYPERTENSION',
  HEPATITIS_C: 'HEPATITIS_C',
  THYROID: 'THYROID',
  OTHER: 'OTHER',
} as const;
export type TreatmentCondition = (typeof TreatmentCondition)[keyof typeof TreatmentCondition];

export const PLAN_LENGTH_MONTHS = [4, 6, 12] as const;
export const PLAN_INTERVAL_DAYS = [7, 14, 30] as const;

const DAY_MS = 86_400_000;

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function planEndDate(start: Date, months: number): Date {
  return addMonths(start, months);
}

export function planTotalVisits(start: Date, months: number, intervalDays: number): number {
  return Math.floor((planEndDate(start, months).getTime() - start.getTime()) / (intervalDays * DAY_MS)) + 1;
}

export interface PlanProgress {
  visitsDone: number;
  startDate: Date;
  nextVisit: Date;
  months: number;
  intervalDays: number;
}

/**
 * The plan state after a check-up is actually attended: one more visit done, the next visit scheduled
 * `intervalDays` after the one just attended, and whether the course is now complete (all visits done).
 * A completed plan keeps its existing `nextVisit` — there is nothing further to schedule. Progression is
 * attendance-driven, so a missed visit never advances a plan; the morning cron just keeps reminding.
 */
export function completeTreatmentVisit(plan: PlanProgress, at: Date = new Date()): { visitsDone: number; nextVisit: Date; done: boolean } {
  const visitsDone = plan.visitsDone + 1;
  const done = visitsDone >= planTotalVisits(plan.startDate, plan.months, plan.intervalDays);
  return { visitsDone, nextVisit: done ? plan.nextVisit : addDays(at, plan.intervalDays), done };
}

export type ReminderKind = 'TWO_DAYS_BEFORE' | 'ON_THE_DAY' | 'MISSED';

/** Which reminder (if any) a plan needs today. Runs once every morning. */
export function reminderDue(nextVisit: Date, today: Date): ReminderKind | null {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(nextVisit) - startOfDay(today)) / DAY_MS);
  if (days < 0) return 'MISSED';
  if (days === 0) return 'ON_THE_DAY';
  if (days <= 2) return 'TWO_DAYS_BEFORE';
  return null;
}
