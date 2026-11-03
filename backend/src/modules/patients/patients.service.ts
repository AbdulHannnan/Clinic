import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { AuditService } from '../audit/audit.service';

/** Patients are identified by phone number. Medical history is only ever stored encrypted. */
@Injectable()
export class PatientsService {
  private readonly log = new Logger(PatientsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: EncryptionService,
    private readonly audit: AuditService,
  ) {}

  findOrCreate(phone: string, name: string) {
    return this.prisma.patient.upsert({ where: { phone }, update: {}, create: { phone, name } });
  }

  // Binds each blob to this patient and field, so ciphertext can't be moved to another record.
  private aad(patientId: string, field: 'history' | 'allergies') {
    return `patient:${patientId}:${field}`;
  }

  async setHistory(patientId: string, history: string) {
    await this.prisma.patient.update({ where: { id: patientId }, data: { historyEnc: this.crypto.encrypt(history, this.aad(patientId, 'history')) } });
  }

  async setAllergies(patientId: string, allergies: string) {
    await this.prisma.patient.update({ where: { id: patientId }, data: { allergiesEnc: this.crypto.encrypt(allergies, this.aad(patientId, 'allergies')) } });
  }

  /** Reading medical history is always recorded against the staff member who viewed it. */
  async readHistory(patientId: string, actorId?: string | null): Promise<string | null> {
    const p = await this.prisma.patient.findUniqueOrThrow({ where: { id: patientId }, select: { historyEnc: true } });
    await this.audit.record({ actorId, action: 'history.view', entity: 'Patient', entityId: patientId });
    return this.safeDecrypt(p.historyEnc, patientId, 'history', actorId);
  }

  async readAllergies(patientId: string, actorId?: string | null): Promise<string | null> {
    const p = await this.prisma.patient.findUniqueOrThrow({ where: { id: patientId }, select: { allergiesEnc: true } });
    await this.audit.record({ actorId, action: 'allergies.view', entity: 'Patient', entityId: patientId });
    return this.safeDecrypt(p.allergiesEnc, patientId, 'allergies', actorId);
  }

  /** Decrypt, but turn a corrupt/foreign blob into an audited 503 instead of an opaque crash. */
  private async safeDecrypt(blob: Uint8Array | null, patientId: string, field: 'history' | 'allergies', actorId?: string | null): Promise<string | null> {
    if (!blob) return null;
    try {
      return this.crypto.decrypt(blob, this.aad(patientId, field));
    } catch (err) {
      this.log.error(`Failed to decrypt ${field} for patient ${patientId}`, err as Error);
      await this.audit.record({ actorId, action: `${field}.decrypt_error`, entity: 'Patient', entityId: patientId });
      throw new ServiceUnavailableException(`Patient ${field} could not be read.`);
    }
  }
}
