import { Injectable } from '@nestjs/common';
import type { DiscountReason } from '@prisma/client';
import { PaymentKind, PaymentMethod, QueueStatus, balance } from '@clinic/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { today } from '../queue/queue.service';

/** Fees, discounts, collections and refunds, and the daily finance summary. */
@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Apply a discount and, if it leaves the patient having overpaid (e.g. a discount after an online
   * payment), refund the difference. The discount update and the refund row are written in one
   * transaction, so the books never show a discount without its matching refund. The refund goes back
   * via the method the last payment came in on.
   */
  applyDiscount(queueEntryId: string, discount: number, reason: DiscountReason, byStaffId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.queueEntry.findUniqueOrThrow({ where: { id: queueEntryId }, include: { payments: true } });
      const paid = entry.payments.filter((p) => p.kind === PaymentKind.PAYMENT).reduce((a, p) => a + p.amount, 0);
      const refunded = entry.payments.filter((p) => p.kind === PaymentKind.REFUND).reduce((a, p) => a + p.amount, 0);

      await tx.queueEntry.update({ where: { id: queueEntryId }, data: { discount, discountReason: reason, discountById: byStaffId ?? null } });

      // balance < 0 means the patient is owed money back after the discount.
      const owed = -balance({ status: entry.status as QueueStatus, fee: entry.fee, discount, paid, refunded });
      if (owed > 0) {
        const method = entry.payments.filter((p) => p.kind === PaymentKind.PAYMENT).at(-1)?.method ?? PaymentMethod.ONLINE;
        await tx.payment.create({ data: { queueEntryId, kind: PaymentKind.REFUND, method, amount: owed, byStaffId: byStaffId ?? null } });
      }
      return tx.queueEntry.findUniqueOrThrow({ where: { id: queueEntryId }, include: { payments: true } });
    });
  }

  async daySummary(doctorId: string, day = today()) {
    const entries = await this.prisma.queueEntry.findMany({ where: { doctorId, day }, include: { payments: true } });
    const byMethod: Record<PaymentMethod, number> = { CASH: 0, CARD: 0, ONLINE: 0 };
    let collected = 0,
      discount = 0,
      due = 0,
      toRefund = 0,
      patients = 0;

    for (const e of entries) {
      const paid = e.payments.filter((p) => p.kind === PaymentKind.PAYMENT).reduce((a, p) => a + p.amount, 0);
      const refunded = e.payments.filter((p) => p.kind === PaymentKind.REFUND).reduce((a, p) => a + p.amount, 0);
      for (const p of e.payments) byMethod[p.method as PaymentMethod] += p.kind === PaymentKind.PAYMENT ? p.amount : -p.amount;
      collected += paid - refunded;
      const b = balance({ status: e.status as QueueStatus, fee: e.fee, discount: e.discount, paid, refunded });
      if (b > 0) due += b;
      else toRefund -= b;
      if (e.status !== QueueStatus.CANCELLED && e.status !== QueueStatus.NO_SHOW) {
        patients++;
        discount += e.discount;
      }
    }
    return { day, patients, collected, discount, due, toRefund, byMethod };
  }
}
