import { Injectable, NotFoundException } from '@nestjs/common';
import { QueueStatus, QueueType, clinicDay, publicDoctorStatus, type DoctorStatus } from '@clinic/shared';
import { PrismaService } from '../../prisma/prisma.service';

// Resolve "today" in the clinic's time zone (CLINIC_TIME_ZONE env overrides the default), never the server's.
export const today = () => clinicDay(new Date(), process.env.CLINIC_TIME_ZONE);

/** Today's queue for one doctor: the single list that online bookings, walk-ins and emergencies share. */
@Injectable()
export class QueueService {
  constructor(private readonly prisma: PrismaService) {}

  entriesToday(doctorId: string) {
    return this.prisma.queueEntry.findMany({ where: { doctorId, day: today() }, orderBy: { sortOrder: 'asc' } });
  }

  /**
   * Finish whoever is in the room and call the next waiting patient (lowest sortOrder). Both steps run
   * in one transaction so the queue is never left with two people in the room or none finished — if the
   * second step fails, the first rolls back. Returns the called entry, or null when nobody is waiting.
   */
  callNext(doctorId: string) {
    const day = today();
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.queueEntry.updateMany({
        where: { doctorId, day, status: QueueStatus.IN_ROOM },
        data: { status: QueueStatus.DONE, finishedAt: now },
      });
      const next = await tx.queueEntry.findFirst({ where: { doctorId, day, status: QueueStatus.WAITING }, orderBy: { sortOrder: 'asc' } });
      if (!next) return null;
      return tx.queueEntry.update({ where: { id: next.id }, data: { status: QueueStatus.IN_ROOM, calledAt: now } });
    });
  }

  /** What patients at home see. No names, no emergencies. */
  async publicView(doctorId: string) {
    // One query: the doctor plus today's entries in sort order.
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      include: { queueEntries: { where: { day: today() }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!doctor) throw new NotFoundException('Doctor not found');
    const entries = doctor.queueEntries;
    const visible = entries.filter((e) => e.type !== QueueType.EMERGENCY);
    const inRoom = visible.find((e) => e.status === QueueStatus.IN_ROOM);
    // Most recently finished patient, by when they actually finished — not by queue order.
    const lastServed = visible
      .filter((e) => e.status === QueueStatus.DONE)
      .sort((a, b) => (a.finishedAt?.getTime() ?? 0) - (b.finishedAt?.getTime() ?? 0))
      .at(-1);
    return {
      doctorId,
      status: publicDoctorStatus(doctor.status as DoctorStatus, entries),
      minutesPerPatient: doctor.minutesPerPatient,
      // Only a patient actually in the room is "now serving"; otherwise the public sees nobody is in yet.
      nowServing: inRoom?.token ?? null,
      lastServed: lastServed?.token ?? null,
      waiting: visible.filter((e) => e.status === QueueStatus.WAITING).map((e) => ({ token: e.token, sortOrder: e.sortOrder })),
    };
  }
}
