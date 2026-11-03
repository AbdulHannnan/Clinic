import { Module } from '@nestjs/common';
import { TreatmentPlansService } from './treatment-plans.service';

@Module({ providers: [TreatmentPlansService], exports: [TreatmentPlansService] })
export class TreatmentPlansModule {}
