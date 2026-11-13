// Sample data for local development only. Doctor, clinic and patients are fictional.
import { PrismaClient, type QueueType, type QueueStatus } from '@prisma/client';
import { clinicDay } from '@clinic/shared';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const day = clinicDay();

async function main() {
  await prisma.clinicSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { name: 'City Care Clinic', address: 'Gulberg III, Lahore', phone: '0300 5550100' },
  });

  const doctor =
    (await prisma.doctor.findFirst()) ??
    (await prisma.doctor.create({
      data: {
        name: 'Dr. Ayesha Siddiqui',
        nameUr: 'ڈاکٹر عائشہ صدیقی',
        specialty: 'General Physician',
        specialtyUr: 'جنرل فزیشن',
        qualifications: 'MBBS, FCPS (Medicine)',
        fee: 1500,
        minutesPerPatient: 10,
        status: 'AVAILABLE',
      },
    }));

  // Development logins only — fictional accounts, change before any real use.
  // Each box on the sign-in screen has a matching account below.
  const devStaff: { name: string; phone: string; role: 'ADMIN' | 'DOCTOR' | 'MANAGEMENT'; password: string }[] = [
    { name: 'Clinic Admin', phone: '03000000000', role: 'ADMIN', password: 'admin123' },
    { name: 'Front Desk', phone: '03000000001', role: 'MANAGEMENT', password: 'reception123' }, // Receptionist box
    { name: 'Dr. Ayesha Siddiqui', phone: '03000000002', role: 'DOCTOR', password: 'doctor123' }, // Doctor box
  ];
  for (const s of devStaff) {
    await prisma.staffUser.upsert({
      where: { phone: s.phone },
      update: {},
      create: { name: s.name, phone: s.phone, role: s.role, passwordHash: await bcrypt.hash(s.password, 10), doctorId: doctor.id },
    });
  }

  // Patient box: a demo patient portal account. Phone 03000000003 / password patient123.
  const patientHash = await bcrypt.hash('patient123', 10);
  await prisma.patient.upsert({
    where: { phone: '03000000003' },
    update: { passwordHash: patientHash },
    create: { name: 'Demo Patient', phone: '03000000003', passwordHash: patientHash },
  });

  if ((await prisma.preset.count()) === 0) {
    const notes = ['Viral fever', 'Throat infection', 'Seasonal allergy', 'Acidity / gastritis', 'BP normal', 'Rest for 3 days', 'Drink plenty of fluids'];
    const meds = [
      { label: 'Paracetamol 500mg tab', data: { dose: '1+1+1', days: '3', instructions: 'After meal' } },
      { label: 'Cetirizine 10mg tab', data: { dose: '0+0+1', days: '5', instructions: 'At night' } },
      { label: 'Omeprazole 20mg cap', data: { dose: '1+0+0', days: '14', instructions: 'Before breakfast' } },
    ];
    await prisma.preset.createMany({
      data: [
        ...notes.map((label, position) => ({ kind: 'NOTE' as const, label, position })),
        ...meds.map((m, position) => ({ kind: 'MEDICINE' as const, ...m, position })),
      ],
    });
  }

  if ((await prisma.queueEntry.count({ where: { day } })) === 0) {
    const rows: [string, string, QueueType, QueueStatus][] = [
      ['Fatima Noor', '03005550108', 'ONLINE', 'IN_ROOM'],
      ['Muhammad Bilal', '03005550109', 'WALKIN', 'WAITING'],
      ['Hina Shah', '03005550110', 'ONLINE', 'WAITING'],
      ['Usman Tariq', '03005550111', 'ONLINE', 'WAITING'],
    ];
    for (const [i, [name, phone, type, status]] of rows.entries()) {
      const patient = await prisma.patient.upsert({ where: { phone }, update: {}, create: { name, phone } });
      await prisma.queueEntry.create({
        data: {
          doctorId: doctor.id,
          patientId: patient.id,
          day,
          token: String(i + 8),
          sortOrder: i + 8,
          type,
          status,
          arrived: status !== 'WAITING',
          fee: doctor.fee,
        },
      });
    }
  }
  console.log(`Seeded clinic with doctor ${doctor.id}`);
  console.log('Dev logins (phone / password):');
  console.log('  Admin        03000000000 / admin123');
  console.log('  Receptionist 03000000001 / reception123');
  console.log('  Doctor       03000000002 / doctor123');
  console.log('  Patient      03000000003 / patient123');
}

main().finally(() => prisma.$disconnect());
