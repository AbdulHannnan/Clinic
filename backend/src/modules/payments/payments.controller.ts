import { Controller, Get, Param } from '@nestjs/common';
import { PaymentsService } from './payments.service';

// TODO(auth): staff only, once the auth module lands.
@Controller('finance')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get(':doctorId/today')
  today(@Param('doctorId') doctorId: string) {
    return this.payments.daySummary(doctorId);
  }
}
