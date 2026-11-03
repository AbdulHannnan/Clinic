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

  /** What patients at home see. No names, no emergencies. */
  async publicView(doctorId: string) {
    const doctor = await this.prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) throw new NotFoundException('Doctor not found');
    const entries = await this.entriesToday(doctorId);
    const visible = entries.filter((e) => e.type !== QueueType.EMERGENCY);
    const inRoom = visible.find((e) => e.status === QueueStatus.IN_ROOM);
    const lastDone = visible.filter((e) => e.status === QueueStatus.DONE).at(-1);
    return {
      doctorId,
      status: publicDoctorStatus(doctor.status as DoctorStatus, entries),
      minutesPerPatient: doctor.minutesPerPatient,
      nowServing: (inRoom ?? lastDone)?.token ?? null,
      waiting: visible.filter((e) => e.status === QueueStatus.WAITING).map((e) => ({ token: e.token, sortOrder: e.sortOrder })),
    };
  }
}
