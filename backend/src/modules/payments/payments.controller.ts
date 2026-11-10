import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CollectDto } from './dto/collect.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CuidPipe } from '../../common/pipes/cuid.pipe';
import type { StaffPrincipal } from '../auth/jwt.strategy';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'DOCTOR', 'MANAGEMENT')
@Controller('finance')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get(':doctorId/today')
  today(@Param('doctorId', CuidPipe) doctorId: string) {
    return this.payments.daySummary(doctorId);
  }

  // Take the outstanding balance on one visit, recorded against the staff member who collected it.
  @Post('entry/:entryId/collect')
  collect(@Param('entryId', CuidPipe) entryId: string, @Body() dto: CollectDto, @CurrentUser() staff: StaffPrincipal) {
    return this.payments.collect(entryId, dto.method, staff.id);
  }
}
