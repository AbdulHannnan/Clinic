import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emergencySortOrder, patientsAheadAll, patientsAheadPublic, publicDoctorStatus } from './queue';
import { balance } from './money';
import { reminderDue } from './treatment';

const q = [
  { sortOrder: 8, type: 'ONLINE', status: 'IN_ROOM' },
  { sortOrder: 9, type: 'WALKIN', status: 'WAITING' },
  { sortOrder: 10, type: 'ONLINE', status: 'WAITING' },
] as const;

test('emergency goes after the patient in the room and stays hidden from the public count', () => {
  const order = emergencySortOrder([...q]);
  assert.ok(order > 8 && order < 9);
  const withE = [...q, { sortOrder: order, type: 'EMERGENCY', status: 'WAITING' } as const];
  const me = withE[2];
  assert.equal(patientsAheadPublic(withE, me), 1);
  assert.equal(patientsAheadAll(withE, me), 2);
});

test('public sees a break while an emergency is inside', () => {
  assert.equal(publicDoctorStatus('AVAILABLE', [{ sortOrder: 1, type: 'EMERGENCY', status: 'IN_ROOM' }]), 'BREAK');
});

test('discount after online payment means a refund is owed', () => {
  assert.equal(balance({ status: 'DONE', fee: 1500, discount: 750, paid: 1500, refunded: 0 }), -750);
});

test('treatment reminders: 2 days before, on the day, missed', () => {
  const today = new Date(2026, 10, 3, 9);
  assert.equal(reminderDue(new Date(2026, 10, 5), today), 'TWO_DAYS_BEFORE');
  assert.equal(reminderDue(new Date(2026, 10, 3, 18), today), 'ON_THE_DAY');
  assert.equal(reminderDue(new Date(2026, 10, 2), today), 'MISSED');
  assert.equal(reminderDue(new Date(2026, 10, 9), today), null);
});
