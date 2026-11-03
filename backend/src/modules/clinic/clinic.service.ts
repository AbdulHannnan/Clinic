import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Branding and the doctor's public profile: everything a patient sees before booking. */
@Injectable()
export class ClinicService {
  constructor(private readonly prisma: PrismaService) {}

  async publicProfile() {
    const settings = await this.prisma.clinicSettings.findUnique({ where: { id: 1 } });
    if (!settings) throw new NotFoundException('Clinic is not set up yet. Run npm run db:seed.');
    const doctors = await this.prisma.doctor.findMany({
      select: {
        id: true,
        name: true,
        nameUr: true,
        specialty: true,
        specialtyUr: true,
        qualifications: true,
        fee: true,
        minutesPerPatient: true,
        status: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return { ...settings, doctors };
  }
}
