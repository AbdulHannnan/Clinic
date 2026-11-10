import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { QueueService } from './queue.service';
import { CuidPipe } from '../../common/pipes/cuid.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Controller('queue')
export class QueueController {
  constructor(
    private readonly queue: QueueService,
    private readonly realtime: RealtimeGateway,
  ) {}

  @Get(':doctorId/public')
  publicView(@Param('doctorId', CuidPipe) doctorId: string) {
    return this.queue.publicView(doctorId);
  }

  // Staff-only: the doctor's room sees full names and every queue type.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCTOR', 'MANAGEMENT')
  @Get(':doctorId/doctor')
  staffView(@Param('doctorId', CuidPipe) doctorId: string) {
    return this.queue.staffView(doctorId);
  }

  // Finish whoever is in the room and call the next waiting patient, then push both views live.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCTOR', 'MANAGEMENT')
  @Post(':doctorId/call-next')
  async callNext(@Param('doctorId', CuidPipe) doctorId: string) {
    await this.queue.callNext(doctorId);
    const [publicView, staffView] = await Promise.all([this.queue.publicView(doctorId), this.queue.staffView(doctorId)]);
    this.realtime.queueChanged(doctorId, publicView, staffView);
    return staffView;
  }
}
