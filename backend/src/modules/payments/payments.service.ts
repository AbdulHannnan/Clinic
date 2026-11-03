import { Injectable } from '@nestjs/common';
import { PaymentKind, PaymentMethod, QueueStatus, balance } from '@clinic/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { today } from '../queue/queue.service';

/** Fees, discounts, collections and refunds, and the daily finance summary. */
@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

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
