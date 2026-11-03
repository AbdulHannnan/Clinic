import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'DOCTOR', 'MANAGEMENT')
@Controller('finance')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get(':doctorId/today')
  today(@Param('doctorId') doctorId: string) {
    return this.payments.daySummary(doctorId);
  }
}
