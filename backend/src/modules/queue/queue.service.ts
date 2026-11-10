import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentKind, QueueStatus, QueueType, balance, clinicDay, publicDoctorStatus, type DoctorStatus } from '@clinic/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { PatientsService } from '../patients/patients.service';
import type { BookDto } from './dto/book.dto';
import type { WalkInDto } from './dto/walk-in.dto';

// Resolve "today" in the clinic's time zone (CLINIC_TIME_ZONE env overrides the default), never the server's.
export const today = () => clinicDay(new Date(), process.env.CLINIC_TIME_ZONE);

/** Today's queue for one doctor: the single list that online bookings, walk-ins and emergencies share. */
@Injectable()
export class QueueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patients: PatientsService,
  ) {}

  /**
   * A patient booking themselves onto today's queue (an ONLINE entry). The patient is matched or created
   * by phone. Token and sort order are read and the row written in one transaction so two bookings landing
   * together can't take the same token; the DB's unique (doctor, day, token) is the final guard.
   */
  async book(doctorId: string, dto: BookDto) {
    const doctor = await this.prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) throw new NotFoundException('Doctor not found');

    const patient = await this.patients.findOrCreate(dto.phone, dto.name);
    if (dto.age != null) {
      await this.prisma.patient.update({ where: { id: patient.id }, data: { birthYear: new Date().getFullYear() - dto.age } });
    }

    const day = today();
    const entry = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.queueEntry.findMany({ where: { doctorId, day }, select: { token: true, sortOrder: true } });
      // Numeric tokens only (emergencies are "E1" etc.); the next patient takes the highest + 1.
      const maxToken = existing.map((e) => parseInt(e.token, 10)).filter((n) => !Number.isNaN(n)).reduce((a, b) => Math.max(a, b), 0);
      const maxSort = existing.reduce((a, e) => Math.max(a, e.sortOrder), 0);
      return tx.queueEntry.create({
        data: {
          doctorId,
          patientId: patient.id,
          day,
          token: String(maxToken + 1),
          sortOrder: maxSort + 1,
          type: QueueType.ONLINE,
          fee: doctor.fee,
          symptoms: dto.symptoms ?? null,
        },
      });
    });
    return { id: entry.id, doctorId, token: entry.token, fee: entry.fee, payAtClinic: dto.payAtClinic ?? false };
  }

  /** One patient's own view of where they stand: their status, how many are ahead, who is in now. */
  async track(entryId: string) {
    const entry = await this.prisma.queueEntry.findUnique({
      where: { id: entryId },
      include: { doctor: { select: { minutesPerPatient: true, status: true } } },
    });
    if (!entry) throw new NotFoundException('Booking not found');
    const aheadCount = await this.prisma.queueEntry.count({
      where: { doctorId: entry.doctorId, day: entry.day, status: QueueStatus.WAITING, sortOrder: { lt: entry.sortOrder } },
    });
    const inRoom = await this.prisma.queueEntry.findFirst({
      where: { doctorId: entry.doctorId, day: entry.day, status: QueueStatus.IN_ROOM },
      select: { token: true },
    });
    return {
      id: entry.id,
      doctorId: entry.doctorId,
      token: entry.token,
      status: entry.status as QueueStatus,
      arrived: entry.arrived,
      type: entry.type as QueueType,
      aheadCount,
      nowServing: inRoom?.token ?? null,
      minutesPerPatient: entry.doctor.minutesPerPatient,
      doctorStatus: entry.doctor.status as DoctorStatus,
    };
  }

  /** Patient marks themselves present at the clinic. Returns the owning doctor so callers can push updates. */
  async markArrived(entryId: string) {
    const entry = await this.prisma.queueEntry.findUnique({ where: { id: entryId }, select: { id: true, doctorId: true, status: true } });
    if (!entry) throw new NotFoundException('Booking not found');
    if (entry.status === QueueStatus.WAITING) {
      await this.prisma.queueEntry.update({ where: { id: entryId }, data: { arrived: true } });
    }
    return entry.doctorId;
  }

  /** Patient cancels their own booking while still waiting. No-op once they've been called in. */
  async cancel(entryId: string) {
    const entry = await this.prisma.queueEntry.findUnique({ where: { id: entryId }, select: { id: true, doctorId: true, status: true } });
    if (!entry) throw new NotFoundException('Booking not found');
    if (entry.status === QueueStatus.WAITING) {
      await this.prisma.queueEntry.update({ where: { id: entryId }, data: { status: QueueStatus.CANCELLED } });
    }
    return entry.doctorId;
  }

  /**
   * Reception adds a patient who is physically present. A walk-in takes the next numeric token at the
   * back; an emergency gets an "E" token slotted just ahead of everyone still waiting. Either way the
   * patient is marked arrived, since they're standing at the desk.
   */
  async registerWalkIn(doctorId: string, dto: WalkInDto) {
    const doctor = await this.prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) throw new NotFoundException('Doctor not found');
    const patient = await this.patients.findOrCreate(dto.phone, dto.name);
    if (dto.age != null) {
      await this.prisma.patient.update({ where: { id: patient.id }, data: { birthYear: new Date().getFullYear() - dto.age } });
    }
    const day = today();
    const entry = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.queueEntry.findMany({ where: { doctorId, day }, select: { token: true, sortOrder: true, status: true } });
      const maxSort = existing.reduce((a, e) => Math.max(a, e.sortOrder), 0);
      const common = { doctorId, patientId: patient.id, day, fee: doctor.fee, arrived: true, symptoms: dto.symptoms ?? null };
      if (dto.emergency) {
        const emergencies = existing.filter((e) => e.token.startsWith('E')).length;
        const waitingSorts = existing.filter((e) => e.status === QueueStatus.WAITING).map((e) => e.sortOrder);
        const slot = waitingSorts.length ? Math.min(...waitingSorts) - 0.5 : maxSort + 1;
        return tx.queueEntry.create({ data: { ...common, token: `E${emergencies + 1}`, sortOrder: slot, type: QueueType.EMERGENCY } });
      }
      const maxToken = existing.map((e) => parseInt(e.token, 10)).filter((n) => !Number.isNaN(n)).reduce((a, b) => Math.max(a, b), 0);
      return tx.queueEntry.create({ data: { ...common, token: String(maxToken + 1), sortOrder: maxSort + 1, type: QueueType.WALKIN } });
    });
    return { id: entry.id, doctorId, token: entry.token, type: entry.type };
  }

  /** Reception marks a waiting patient as a no-show. No-op once they've been called in or finished. */
  async markNoShow(entryId: string) {
    const entry = await this.prisma.queueEntry.findUnique({ where: { id: entryId }, select: { id: true, doctorId: true, status: true } });
    if (!entry) throw new NotFoundException('Booking not found');
    if (entry.status === QueueStatus.WAITING) {
      await this.prisma.queueEntry.update({ where: { id: entryId }, data: { status: QueueStatus.NO_SHOW } });
    }
    return entry.doctorId;
  }

  /**
   * The management desk's view of today: every entry with the patient's name, phone and money state
   * (what's been paid and what's still owed), so reception can run the queue and the till.
   */
  async deskView(doctorId: string) {
    const [doctor, settings] = await Promise.all([
      this.prisma.doctor.findUnique({
        where: { id: doctorId },
        include: {
          queueEntries: {
            where: { day: today() },
            orderBy: { sortOrder: 'asc' },
            include: { patient: { select: { name: true, phone: true } }, payments: true },
          },
        },
      }),
      this.prisma.clinicSettings.findUnique({ where: { id: 1 }, select: { name: true } }),
    ]);
    if (!doctor) throw new NotFoundException('Doctor not found');
    const entries = doctor.queueEntries.map((e) => {
      const paid = e.payments.filter((p) => p.kind === PaymentKind.PAYMENT).reduce((a, p) => a + p.amount, 0);
      const refunded = e.payments.filter((p) => p.kind === PaymentKind.REFUND).reduce((a, p) => a + p.amount, 0);
      return {
        id: e.id,
        token: e.token,
        name: e.patient.name,
        phone: e.patient.phone,
        type: e.type as QueueType,
        status: e.status as QueueStatus,
        arrived: e.arrived,
        fee: e.fee,
        discount: e.discount,
        paid,
        refunded,
        balance: balance({ status: e.status as QueueStatus, fee: e.fee, discount: e.discount, paid, refunded }),
      };
    });
    const waiting = entries.filter((e) => e.status === QueueStatus.WAITING);
    return {
      doctorId,
      clinicName: settings?.name ?? null,
      doctor: { id: doctor.id, name: doctor.name, nameUr: doctor.nameUr, specialty: doctor.specialty, specialtyUr: doctor.specialtyUr },
      status: doctor.status as DoctorStatus,
      minutesPerPatient: doctor.minutesPerPatient,
      nowServing: entries.find((e) => e.status === QueueStatus.IN_ROOM) ?? null,
      waitingCount: waiting.length,
      onlineWaiting: waiting.filter((e) => e.type === QueueType.ONLINE).length,
      walkinWaiting: waiting.filter((e) => e.type === QueueType.WALKIN).length,
      entries,
    };
  }

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

  /**
   * The doctor's own view of today's queue: full names, every type (including emergencies), who is in
   * the room now and who is up next. Unlike publicView this is staff-only and must sit behind auth.
   */
  async staffView(doctorId: string) {
    const [doctor, settings] = await Promise.all([
      this.prisma.doctor.findUnique({
        where: { id: doctorId },
        include: {
          queueEntries: {
            where: { day: today() },
            orderBy: { sortOrder: 'asc' },
            include: { patient: { select: { name: true } } },
          },
        },
      }),
      this.prisma.clinicSettings.findUnique({ where: { id: 1 }, select: { name: true } }),
    ]);
    if (!doctor) throw new NotFoundException('Doctor not found');
    const map = (e: (typeof doctor.queueEntries)[number]) => ({
      id: e.id,
      token: e.token,
      name: e.patient.name,
      type: e.type,
      status: e.status,
      arrived: e.arrived,
      sortOrder: e.sortOrder,
      symptoms: e.symptoms,
    });
    const entries = doctor.queueEntries;
    const current = entries.find((e) => e.status === QueueStatus.IN_ROOM) ?? null;
    const upNext = entries.filter((e) => e.status === QueueStatus.WAITING);
    return {
      doctorId,
      clinicName: settings?.name ?? null,
      doctor: {
        id: doctor.id,
        name: doctor.name,
        nameUr: doctor.nameUr,
        specialty: doctor.specialty,
        specialtyUr: doctor.specialtyUr,
        qualifications: doctor.qualifications,
      },
      status: doctor.status as DoctorStatus,
      minutesPerPatient: doctor.minutesPerPatient,
      seenToday: entries.filter((e) => e.status === QueueStatus.DONE).length,
      waitingCount: upNext.length,
      current: current ? map(current) : null,
      upNext: upNext.map(map),
    };
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
