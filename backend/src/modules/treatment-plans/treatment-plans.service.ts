import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { completeTreatmentVisit, reminderDue } from '@clinic/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const KIND = { TWO_DAYS_BEFORE: 'PLAN_REMINDER', ON_THE_DAY: 'PLAN_REMINDER', MISSED: 'PLAN_MISSED' } as const;

/** Long-term treatments (diabetes, TB...) and their automatic check-up reminders. */
@Injectable()
export class TreatmentPlansService {
  private readonly log = new Logger(TreatmentPlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Every morning: 2 days before, on the day, and once after a missed visit. */
  @Cron(process.env.REMINDER_CRON ?? '0 9 * * *', { timeZone: process.env.TZ ?? 'Asia/Karachi' })
  async sendDailyReminders(now = new Date()) {
    const plans = await this.prisma.treatmentPlan.findMany({ where: { status: 'ACTIVE' }, include: { patient: true } });
    let sent = 0;
    for (const plan of plans) {
      const due = reminderDue(plan.nextVisit, now);
      if (!due) continue;
      await this.notifications.send({
        kind: KIND[due],
        patientId: plan.patientId,
        phone: plan.patient.phone,
        channels: ['WHATSAPP', 'SMS', 'APP'],
        template: due === 'MISSED' ? 'plan_missed' : 'plan_reminder',
        params: { name: plan.patient.name, condition: plan.condition, date: plan.nextVisit.toDateString() },
        lang: 'en',
        dedupeKey: `plan:${plan.id}:${plan.nextVisit.toISOString().slice(0, 10)}:${due}`,
      });
      sent++;
    }
    this.log.log(`Treatment reminders checked: ${plans.length} plans, ${sent} due`);
    return sent;
  }

  /**
   * Record that a plan check-up was attended: advance `visitsDone` and `nextVisit`, and flip `status`
   * to `COMPLETED` on the final visit. Read-modify-write is wrapped in a transaction so two concurrent
   * records can't both increment off the same stale count. The visit write path calls this when a
   * queue entry carrying a `treatmentPlanId` is finished.
   */
  recordVisit(planId: string, at: Date = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.treatmentPlan.findUnique({ where: { id: planId } });
      if (!plan || plan.status !== 'ACTIVE') throw new NotFoundException('Active treatment plan not found');
      const { visitsDone, nextVisit, done } = completeTreatmentVisit(plan, at);
      return tx.treatmentPlan.update({ where: { id: planId }, data: { visitsDone, nextVisit, status: done ? 'COMPLETED' : 'ACTIVE' } });
    });
  }
}
