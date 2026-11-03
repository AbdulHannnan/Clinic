import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { validateEnv } from './config/env';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { HealthModule } from './modules/health/health.module';
import { ClinicModule } from './modules/clinic/clinic.module';
import { PatientsModule } from './modules/patients/patients.module';
import { QueueModule } from './modules/queue/queue.module';
import { VisitsModule } from './modules/visits/visits.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { TreatmentPlansModule } from './modules/treatment-plans/treatment-plans.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RealtimeModule } from './modules/realtime/realtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CryptoModule,
    RealtimeModule,
    NotificationsModule,
    HealthModule,
    ClinicModule,
    PatientsModule,
    QueueModule,
    VisitsModule,
    PaymentsModule,
    TreatmentPlansModule,
  ],
})
export class AppModule {}
