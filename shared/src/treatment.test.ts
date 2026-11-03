import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, planEndDate, planTotalVisits, reminderDue } from './treatment';

test('addMonths / planEndDate advance the calendar by whole months', () => {
  assert.equal(addMonths(new Date('2026-01-15T00:00:00Z'), 6).toISOString().slice(0, 10), '2026-07-15');
  assert.equal(planEndDate(new Date('2026-01-01T00:00:00Z'), 12).toISOString().slice(0, 10), '2027-01-01');
});

test('planTotalVisits counts the check-ups that fit in the plan window', () => {
  // Jan 1 → Jul 1 2026 is 181 days; at one visit every 30 days that is 6 intervals + the first visit.
  assert.equal(planTotalVisits(new Date('2026-01-01T00:00:00Z'), 6, 30), 7);
  assert.equal(planTotalVisits(new Date('2026-01-01T00:00:00Z'), 4, 14), Math.floor(120 / 14) + 1); // ~4 months
});

test('reminderDue boundaries: 3+ days off is silent, 1–2 days is the pre-reminder', () => {
  const today = new Date(2026, 10, 3, 9);
  assert.equal(reminderDue(new Date(2026, 10, 6), today), null); // 3 days away
  assert.equal(reminderDue(new Date(2026, 10, 5), today), 'TWO_DAYS_BEFORE');
  assert.equal(reminderDue(new Date(2026, 10, 4), today), 'TWO_DAYS_BEFORE'); // 1 day away still pre-reminder
});
