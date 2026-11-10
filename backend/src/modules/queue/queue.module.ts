import { Module } from '@nestjs/common';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';
import { PatientsModule } from '../patients/patients.module';

@Module({ imports: [PatientsModule], controllers: [QueueController], providers: [QueueService], exports: [QueueService] })
export class QueueModule {}
