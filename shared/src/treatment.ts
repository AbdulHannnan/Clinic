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

export function planEndDate(start: Date, months: number): Date {
  return addMonths(start, months);
}

export function planTotalVisits(start: Date, months: number, intervalDays: number): number {
  return Math.floor((planEndDate(start, months).getTime() - start.getTime()) / (intervalDays * DAY_MS)) + 1;
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
