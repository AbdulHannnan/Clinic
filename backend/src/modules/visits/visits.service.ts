import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';

export interface PrescriptionInput {
  notes: string[];
  followUp?: string;
  items: { medicine: string; dose: string; days: string; instructions?: string }[];
}

/** The doctor's notes and prescription for one queue entry. Created when the doctor presses Done. */
@Injectable()
export class VisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: EncryptionService,
  ) {}

  record(queueEntryId: string, doctorId: string, patientId: string, rx: PrescriptionInput) {
    return this.prisma.visit.create({
      data: {
        queueEntryId,
        doctorId,
        patientId,
        followUp: rx.followUp,
        notesEnc: rx.notes.length ? this.crypto.encrypt(JSON.stringify(rx.notes)) : null,
        items: { create: rx.items.map((it, position) => ({ ...it, position })) },
      },
    });
  }
}
