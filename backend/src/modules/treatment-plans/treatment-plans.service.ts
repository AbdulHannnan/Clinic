import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { reminderDue } from '@clinic/shared';
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
}
