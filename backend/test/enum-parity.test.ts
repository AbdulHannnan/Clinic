import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Prisma from '@prisma/client';
import { DoctorStatus, PaymentKind, PaymentMethod, QueueStatus, QueueType, StaffRole } from '@clinic/shared';

// shared/src/enums.ts hand-mirrors a subset of the Prisma enums for the frontend and business rules.
// This test fails if either side drifts, so the "keep both in sync" comment is actually enforced.
const mirrored: Record<string, Record<string, string>> = {
  QueueType,
  QueueStatus,
  DoctorStatus,
  PaymentMethod,
  StaffRole,
  PaymentKind,
};

for (const [name, sharedEnum] of Object.entries(mirrored)) {
  test(`shared ${name} matches the Prisma enum`, () => {
    const prismaEnum = (Prisma as unknown as Record<string, Record<string, string>>)[name];
    assert.ok(prismaEnum, `Prisma does not export an enum named ${name}`);
    assert.deepEqual({ ...sharedEnum }, { ...prismaEnum });
  });
}
