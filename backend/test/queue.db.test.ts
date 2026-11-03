import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { clinicDay } from '@clinic/shared';
import { QueueService } from '../src/modules/queue/queue.service';
import { PaymentsService } from '../src/modules/payments/payments.service';

// DB-backed tests run only when TEST_DATABASE_URL points at a migrated Postgres (CI, or a local opt-in).
// Without it they are skipped so `npm test` stays green on a machine with no database.
const url = process.env.TEST_DATABASE_URL;
const run = !!url;
let prisma: PrismaClient;
const day = clinicDay();

before(async () => {
  if (!run) return;
  prisma = new PrismaClient({ datasources: { db: { url } } });
  await prisma.$connect();
  // Clean in FK order so the test is repeatable against a reused database.
  await prisma.payment.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.queueEntry.deleteMany();
  await prisma.treatmentPlan.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.doctor.deleteMany();
});

after(async () => {
  if (run && prisma) await prisma.$disconnect();
});

test('QueueService.publicView reflects real rows and hides emergencies', { skip: !run }, async () => {
  const doctor = await prisma.doctor.create({
    data: { name: 'Dr Test', specialty: 'GP', qualifications: 'MBBS', fee: 1500, minutesPerPatient: 10, status: 'AVAILABLE' },
  });
  const patient = await prisma.patient.create({ data: { name: 'P', phone: '03000000001' } });
  const rows = [
    { token: '5', sortOrder: 5, type: 'ONLINE' as const, status: 'DONE' as const, finishedAt: new Date() },
    { token: '6', sortOrder: 6, type: 'ONLINE' as const, status: 'IN_ROOM' as const },
    { token: 'E1', sortOrder: 6.5, type: 'EMERGENCY' as const, status: 'WAITING' as const },
    { token: '7', sortOrder: 7, type: 'WALKIN' as const, status: 'WAITING' as const },
  ];
  for (const r of rows) {
    await prisma.queueEntry.create({ data: { doctorId: doctor.id, patientId: patient.id, day, fee: 1500, ...r } });
  }

  const view = await new QueueService(prisma as never).publicView(doctor.id);
  assert.equal(view.nowServing, '6');
  assert.equal(view.lastServed, '5');
  assert.deepEqual(
    view.waiting.map((w) => w.token),
    ['7'], // emergency hidden
  );
});

test('PaymentsService.daySummary totals real payments', { skip: !run }, async () => {
  const doctor = await prisma.doctor.create({
    data: { name: 'Dr Pay', specialty: 'GP', qualifications: 'MBBS', fee: 1500, minutesPerPatient: 10, status: 'AVAILABLE' },
  });
  const patient = await prisma.patient.create({ data: { name: 'P2', phone: '03000000002' } });
  const entry = await prisma.queueEntry.create({
    data: { doctorId: doctor.id, patientId: patient.id, day, token: '1', sortOrder: 1, type: 'WALKIN', status: 'DONE', fee: 1500 },
  });
  await prisma.payment.create({ data: { queueEntryId: entry.id, kind: 'PAYMENT', method: 'CASH', amount: 1000 } });

  const summary = await new PaymentsService(prisma as never).daySummary(doctor.id, day);
  assert.equal(summary.collected, 1000);
  assert.equal(summary.due, 500); // fee 1500 − paid 1000
  assert.deepEqual(summary.byMethod, { CASH: 1000, CARD: 0, ONLINE: 0 });
});
