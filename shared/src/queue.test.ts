import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clinicDay,
  emergencySortOrder,
  estimateWaitMinutes,
  needsRebalance,
  patientsAheadAll,
  patientsAheadPublic,
  publicDoctorStatus,
  rebalanceSortOrders,
  SORT_STEP,
} from './queue';
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

test('publicDoctorStatus: closed stays closed, a normal patient in the room stays available', () => {
  assert.equal(publicDoctorStatus('CLOSED', [...q]), 'CLOSED');
  assert.equal(publicDoctorStatus('AVAILABLE', [...q]), 'AVAILABLE'); // the IN_ROOM one is ONLINE
  assert.equal(publicDoctorStatus('BREAK', []), 'BREAK');
});

test('patientsAheadPublic hides every waiting emergency, not just one', () => {
  const withEmergencies = [
    { sortOrder: 8, type: 'ONLINE', status: 'IN_ROOM' },
    { sortOrder: 8.3, type: 'EMERGENCY', status: 'WAITING' },
    { sortOrder: 8.6, type: 'EMERGENCY', status: 'WAITING' },
    { sortOrder: 9, type: 'WALKIN', status: 'WAITING' },
    { sortOrder: 10, type: 'ONLINE', status: 'WAITING' },
  ] as const;
  const me = withEmergencies[4];
  assert.equal(patientsAheadPublic([...withEmergencies], me), 1); // only the walk-in is visible
  assert.equal(patientsAheadAll([...withEmergencies], me), 3); // walk-in + two emergencies
});

test('estimateWaitMinutes: people ahead, half a slot for the one inside, and a break buffer', () => {
  const me = q[2]; // waiting at sortOrder 10, one WAITING ahead, one IN_ROOM
  assert.equal(estimateWaitMinutes([...q], me, 10, 'AVAILABLE'), 1 * 10 + 5); // 1 ahead + half slot
  assert.equal(estimateWaitMinutes([...q], me, 10, 'BREAK'), 1 * 10 + 5 + 10); // + break buffer
});

test('emergencySortOrder handles an empty queue and an all-emergency queue', () => {
  assert.equal(emergencySortOrder([]), SORT_STEP); // first slot on a fresh queue, one wide step in
  const order = emergencySortOrder([{ sortOrder: 5, type: 'EMERGENCY', status: 'WAITING' }]);
  assert.ok(order > 5); // slots after the existing emergency, not before it
});

test('needsRebalance trips only once adjacent waiting gaps shrink toward collision', () => {
  const roomy = [
    { sortOrder: 1000, type: 'ONLINE', status: 'WAITING' },
    { sortOrder: 2000, type: 'ONLINE', status: 'WAITING' },
  ] as const;
  assert.equal(needsRebalance([...roomy]), false);
  const tight = [
    { sortOrder: 1000, type: 'ONLINE', status: 'WAITING' },
    { sortOrder: 1000 + 1e-9, type: 'EMERGENCY', status: 'WAITING' },
  ] as const;
  assert.equal(needsRebalance([...tight]), true);
  // Non-waiting entries (done/in-room) are ignored, even when their positions sit right on top of each other.
  const settled = [
    { sortOrder: 1, type: 'ONLINE', status: 'DONE' },
    { sortOrder: 1, type: 'ONLINE', status: 'IN_ROOM' },
  ] as const;
  assert.equal(needsRebalance([...settled]), false);
});

test('rebalanceSortOrders hands back wide, evenly spaced integer positions in order', () => {
  assert.deepEqual(rebalanceSortOrders(3), [1000, 2000, 3000]);
  assert.deepEqual(rebalanceSortOrders(0), []);
  // The result restores a queue that needsRebalance flagged.
  const rebalanced = rebalanceSortOrders(2).map((sortOrder) => ({ sortOrder, type: 'ONLINE', status: 'WAITING' }) as const);
  assert.equal(needsRebalance(rebalanced), false);
});

test('discount after online payment means a refund is owed', () => {
  assert.equal(balance({ status: 'DONE', fee: 1500, discount: 750, paid: 1500, refunded: 0 }), -750);
});

test('clinicDay resolves the date in the clinic time zone, not the server local time', () => {
  // 20:00 UTC on Nov 3 is already 01:00 on Nov 4 in Asia/Karachi (UTC+5).
  assert.equal(clinicDay(new Date('2026-11-03T20:00:00Z'), 'Asia/Karachi').toISOString(), '2026-11-04T00:00:00.000Z');
  // 18:00 UTC on Nov 3 is still 23:00 on Nov 3 in Asia/Karachi.
  assert.equal(clinicDay(new Date('2026-11-03T18:00:00Z'), 'Asia/Karachi').toISOString(), '2026-11-03T00:00:00.000Z');
});

test('treatment reminders: 2 days before, on the day, missed', () => {
  const today = new Date(2026, 10, 3, 9);
  assert.equal(reminderDue(new Date(2026, 10, 5), today), 'TWO_DAYS_BEFORE');
  assert.equal(reminderDue(new Date(2026, 10, 3, 18), today), 'ON_THE_DAY');
  assert.equal(reminderDue(new Date(2026, 10, 2), today), 'MISSED');
  assert.equal(reminderDue(new Date(2026, 10, 9), today), null);
});
