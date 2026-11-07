import { test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { QueueService } from '../src/modules/queue/queue.service';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { TreatmentPlansService } from '../src/modules/treatment-plans/treatment-plans.service';

// Hand-rolled Prisma doubles: each test passes only the methods the service under test calls.
const fakePrisma = (overrides: Record<string, unknown>) => overrides as never;

test('QueueService.publicView: in-room token serves, emergencies hidden, lastServed by finish time', async () => {
  const entries = [
    { type: 'ONLINE', status: 'DONE', token: '6', sortOrder: 6, finishedAt: new Date('2026-01-01T09:00:00Z') },
    { type: 'ONLINE', status: 'DONE', token: '5', sortOrder: 5, finishedAt: new Date('2026-01-01T09:30:00Z') }, // finished later
    { type: 'ONLINE', status: 'IN_ROOM', token: '7', sortOrder: 7, finishedAt: null },
    { type: 'EMERGENCY', status: 'WAITING', token: 'E1', sortOrder: 7.5, finishedAt: null },
    { type: 'WALKIN', status: 'WAITING', token: '8', sortOrder: 8, finishedAt: null },
  ];
  const svc = new QueueService(
    fakePrisma({
      doctor: { findUnique: async () => ({ id: 'd', status: 'AVAILABLE', minutesPerPatient: 10, queueEntries: entries }) },
    }),
  );
  const view = await svc.publicView('d');
  assert.equal(view.nowServing, '7');
  assert.equal(view.lastServed, '5'); // '5' finished after '6', despite lower sort order
  assert.deepEqual(
    view.waiting.map((w) => w.token),
    ['8'], // emergency excluded
  );
  assert.equal(view.status, 'AVAILABLE');
});

test('QueueService.publicView: nobody in the room means nowServing is null', async () => {
  const svc = new QueueService(
    fakePrisma({
      doctor: {
        findUnique: async () => ({
          id: 'd',
          status: 'AVAILABLE',
          minutesPerPatient: 10,
          queueEntries: [{ type: 'ONLINE', status: 'DONE', token: '3', sortOrder: 3, finishedAt: new Date() }],
        }),
      },
    }),
  );
  const view = await svc.publicView('d');
  assert.equal(view.nowServing, null);
  assert.equal(view.lastServed, '3');
});

test('QueueService.callNext: finishes the in-room patient and calls the next, in one transaction', async () => {
  const seen: { finished?: Record<string, unknown>; called?: Record<string, unknown> } = {};
  const next = { id: 'q2', status: 'WAITING', sortOrder: 2 };
  const tx = {
    queueEntry: {
      updateMany: async (args: { data: Record<string, unknown> }) => {
        seen.finished = args.data;
        return { count: 1 };
      },
      findFirst: async () => next,
      update: async (args: { data: Record<string, unknown> }) => {
        seen.called = args.data;
        return { ...next, ...args.data };
      },
    },
  };
  const svc = new QueueService(fakePrisma({ $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) }));
  const res = await svc.callNext('d');
  assert.equal(seen.finished?.status, 'DONE');
  assert.equal(seen.called?.status, 'IN_ROOM');
  assert.equal((res as { status: string }).status, 'IN_ROOM');
});

test('QueueService.callNext: returns null (and calls nobody) when the queue is empty', async () => {
  const tx = {
    queueEntry: {
      updateMany: async () => ({ count: 0 }),
      findFirst: async () => null,
      update: async () => {
        throw new Error('must not call anyone when nobody is waiting');
      },
    },
  };
  const svc = new QueueService(fakePrisma({ $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) }));
  assert.equal(await svc.callNext('d'), null);
});

test('PaymentsService.applyDiscount: an online overpayment is refunded in the same transaction', async () => {
  const entry = { id: 'q1', status: 'DONE', fee: 1500, discount: 0, payments: [{ kind: 'PAYMENT', method: 'ONLINE', amount: 1500 }] };
  let refund: Record<string, unknown> | undefined;
  const tx = {
    queueEntry: { findUniqueOrThrow: async () => entry, update: async () => ({}) },
    payment: {
      create: async (args: { data: Record<string, unknown> }) => {
        refund = args.data;
        return refund;
      },
    },
  };
  const svc = new PaymentsService(fakePrisma({ $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) }));
  await svc.applyDiscount('q1', 750, 'NEEDY' as never, 'staff1');
  assert.equal(refund?.kind, 'REFUND');
  assert.equal(refund?.amount, 750); // paid 1500, now owes only 750 → refund 750
  assert.equal(refund?.method, 'ONLINE');
});

test('PaymentsService.applyDiscount: no refund when the patient has not overpaid', async () => {
  const entry = { id: 'q1', status: 'DONE', fee: 1500, discount: 0, payments: [] }; // nothing collected yet
  let created = false;
  const tx = {
    queueEntry: { findUniqueOrThrow: async () => entry, update: async () => ({}) },
    payment: {
      create: async () => {
        created = true;
        return {};
      },
    },
  };
  const svc = new PaymentsService(fakePrisma({ $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) }));
  await svc.applyDiscount('q1', 500, 'SENIOR' as never);
  assert.equal(created, false);
});

test('PaymentsService.daySummary: collected, due, and per-method totals', async () => {
  const entries = [
    { status: 'DONE', fee: 1500, discount: 0, payments: [{ kind: 'PAYMENT', method: 'CASH', amount: 1500 }] },
    { status: 'DONE', fee: 1500, discount: 0, payments: [] }, // unpaid → due
    {
      status: 'CANCELLED',
      fee: 1500,
      discount: 0,
      payments: [
        { kind: 'PAYMENT', method: 'ONLINE', amount: 1500 },
        { kind: 'REFUND', method: 'ONLINE', amount: 1500 },
      ],
    },
  ];
  const svc = new PaymentsService(fakePrisma({ queueEntry: { findMany: async () => entries } }));
  const s = await svc.daySummary('d');
  assert.equal(s.patients, 2); // cancelled not counted
  assert.equal(s.collected, 1500);
  assert.equal(s.due, 1500);
  assert.equal(s.toRefund, 0);
  assert.deepEqual(s.byMethod, { CASH: 1500, CARD: 0, ONLINE: 0 });
});

test('NotificationsService.send: a duplicate (P2002) is skipped, never sent twice', async () => {
  let sends = 0;
  const providers = {
    WHATSAPP: { send: async () => ({ providerId: 'p' }) },
    SMS: { send: async () => ({ providerId: 'p' }) },
    APP: { send: async () => ({ providerId: 'p' }) },
  };
  const prisma = fakePrisma({
    notification: {
      create: async () => {
        throw new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' });
      },
      update: async () => ({}),
    },
  });
  const svc = new NotificationsService(prisma, providers as never);
  // Count real provider sends by wrapping afterwards would miss the skip; instead assert no throw and no send.
  providers.WHATSAPP.send = async () => {
    sends++;
    return { providerId: 'p' };
  };
  await svc.send({ kind: 'YOUR_TURN', channels: ['WHATSAPP'], phone: '0300', template: 't', params: {}, lang: 'en', dedupeKey: 'dup' });
  assert.equal(sends, 0);
});

test('NotificationsService.send: a fresh message is created and dispatched', async () => {
  let sends = 0;
  const providers = {
    WHATSAPP: {
      send: async () => {
        sends++;
        return { providerId: 'p1' };
      },
    },
    SMS: { send: async () => ({ providerId: 'p' }) },
    APP: { send: async () => ({ providerId: 'p' }) },
  };
  const prisma = fakePrisma({
    notification: { create: async () => ({ id: 'n1' }), update: async () => ({}) },
  });
  const svc = new NotificationsService(prisma, providers as never);
  await svc.send({ kind: 'YOUR_TURN', channels: ['WHATSAPP'], phone: '0300', template: 't', params: {}, lang: 'en' });
  assert.equal(sends, 1);
});

test('AuthService.login: correct password issues a token; bad input is rejected', async () => {
  const staff = { id: 'c'.padEnd(25, '1'), role: 'ADMIN', name: 'Admin', doctorId: null, active: true, passwordHash: await bcrypt.hash('secret', 10) };
  const prisma = fakePrisma({ staffUser: { findUnique: async ({ where }: { where: { phone: string } }) => (where.phone === '0300' ? staff : null) } });
  const jwt = { signAsync: async () => 'token123' } as never;
  const svc = new AuthService(prisma, jwt);

  const res = await svc.login('0300', 'secret');
  assert.equal(res.token, 'token123');
  assert.equal(res.staff.role, 'ADMIN');

  await assert.rejects(() => svc.login('0300', 'wrong'));
  await assert.rejects(() => svc.login('unknown', 'secret'));
});

test('AuthService.login: an inactive staff member cannot log in', async () => {
  const staff = { id: 'c'.padEnd(25, '1'), role: 'ADMIN', name: 'Admin', doctorId: null, active: false, passwordHash: await bcrypt.hash('secret', 10) };
  const prisma = fakePrisma({ staffUser: { findUnique: async () => staff } });
  const svc = new AuthService(prisma, { signAsync: async () => 't' } as never);
  await assert.rejects(() => svc.login('0300', 'secret'));
});

test('TreatmentPlansService.recordVisit: advances an active plan, completing it on the final visit', async () => {
  const start = new Date('2026-01-01T00:00:00Z');
  // 6-month / 30-day plan = 7 visits; this is the 7th, so it completes.
  const plan = { id: 'p1', status: 'ACTIVE', visitsDone: 6, startDate: start, nextVisit: start, months: 6, intervalDays: 30 };
  let saved: Record<string, unknown> | undefined;
  const tx = {
    treatmentPlan: {
      findUnique: async () => plan,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        saved = data;
        return { ...plan, ...data };
      },
    },
  };
  const prisma = fakePrisma({ $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) });
  const svc = new TreatmentPlansService(prisma, {} as never);

  const res = await svc.recordVisit('p1', new Date('2026-06-01T00:00:00Z'));
  assert.equal(saved?.visitsDone, 7);
  assert.equal(saved?.status, 'COMPLETED');
  assert.equal((res as { status: string }).status, 'COMPLETED');
});

test('TreatmentPlansService.recordVisit: a non-active plan is rejected', async () => {
  const tx = { treatmentPlan: { findUnique: async () => ({ id: 'p', status: 'STOPPED' }), update: async () => ({}) } };
  const prisma = fakePrisma({ $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) });
  const svc = new TreatmentPlansService(prisma, {} as never);
  await assert.rejects(() => svc.recordVisit('p'));
});
