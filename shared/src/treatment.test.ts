import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, completeTreatmentVisit, planEndDate, planTotalVisits, reminderDue } from './treatment';

test('addMonths / planEndDate advance the calendar by whole months', () => {
  assert.equal(addMonths(new Date('2026-01-15T00:00:00Z'), 6).toISOString().slice(0, 10), '2026-07-15');
  assert.equal(planEndDate(new Date('2026-01-01T00:00:00Z'), 12).toISOString().slice(0, 10), '2027-01-01');
});

test('planTotalVisits counts the check-ups that fit in the plan window', () => {
  // Jan 1 → Jul 1 2026 is 181 days; at one visit every 30 days that is 6 intervals + the first visit.
  assert.equal(planTotalVisits(new Date('2026-01-01T00:00:00Z'), 6, 30), 7);
  assert.equal(planTotalVisits(new Date('2026-01-01T00:00:00Z'), 4, 14), Math.floor(120 / 14) + 1); // ~4 months
});

test('completeTreatmentVisit advances the schedule, then completes the course on the last visit', () => {
  // 6-month plan, one visit every 30 days = 7 total visits (see planTotalVisits above).
  const base = { startDate: new Date('2026-01-01T00:00:00Z'), months: 6, intervalDays: 30, nextVisit: new Date('2026-01-01T00:00:00Z') };
  const at = new Date('2026-01-02T00:00:00Z');

  const first = completeTreatmentVisit({ ...base, visitsDone: 0 }, at);
  assert.equal(first.visitsDone, 1);
  assert.equal(first.done, false);
  assert.equal(first.nextVisit.toISOString().slice(0, 10), '2026-02-01'); // 30 days after the attended visit

  const last = completeTreatmentVisit({ ...base, visitsDone: 6 }, at);
  assert.equal(last.visitsDone, 7);
  assert.equal(last.done, true);
  assert.equal(last.nextVisit.toISOString(), base.nextVisit.toISOString()); // nothing further to schedule
});

test('reminderDue boundaries: 3+ days off is silent, 1–2 days is the pre-reminder', () => {
  const today = new Date(2026, 10, 3, 9);
  assert.equal(reminderDue(new Date(2026, 10, 6), today), null); // 3 days away
  assert.equal(reminderDue(new Date(2026, 10, 5), today), 'TWO_DAYS_BEFORE');
  assert.equal(reminderDue(new Date(2026, 10, 4), today), 'TWO_DAYS_BEFORE'); // 1 day away still pre-reminder
});
