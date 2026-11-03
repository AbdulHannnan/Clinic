import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';

/** Patients are identified by phone number. Medical history is only ever stored encrypted. */
@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: EncryptionService,
  ) {}

  findOrCreate(phone: string, name: string) {
    return this.prisma.patient.upsert({ where: { phone }, update: {}, create: { phone, name } });
  }

  async setHistory(patientId: string, history: string) {
    await this.prisma.patient.update({ where: { id: patientId }, data: { historyEnc: this.crypto.encrypt(history) } });
  }

  async readHistory(patientId: string): Promise<string | null> {
    const p = await this.prisma.patient.findUniqueOrThrow({ where: { id: patientId }, select: { historyEnc: true } });
    return p.historyEnc ? this.crypto.decrypt(p.historyEnc) : null;
  }
}
