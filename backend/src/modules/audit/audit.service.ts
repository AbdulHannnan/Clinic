import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntry {
  actorId?: string | null; // staff member who acted; null for system/unauthenticated
  action: string; // e.g. 'history.view', 'payment.create', 'discount.apply'
  entity: string; // e.g. 'Patient', 'QueueEntry', 'Payment'
  entityId: string;
  meta?: Prisma.InputJsonValue;
}

/**
 * Append-only record of who did what and when. Write a row for every view of medical history
 * and every money movement (payments, discounts, refunds) as those write paths are built.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(entry: AuditEntry) {
    return this.prisma.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        ...(entry.meta === undefined ? {} : { meta: entry.meta }),
      },
    });
  }
}
