import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { QueueService } from './queue.service';
import { BookDto } from './dto/book.dto';
import { WalkInDto } from './dto/walk-in.dto';
import { CuidPipe } from '../../common/pipes/cuid.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PatientAuthGuard, type PatientPrincipal } from '../auth/guards/patient-auth.guard';
import { CurrentPatient } from '../auth/decorators/current-patient.decorator';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Controller('queue')
export class QueueController {
  constructor(
    private readonly queue: QueueService,
    private readonly realtime: RealtimeGateway,
  ) {}

  // Push the fresh public + staff views to everyone watching this doctor after any queue change.
  private async broadcast(doctorId: string) {
    const [publicView, staffView] = await Promise.all([this.queue.publicView(doctorId), this.queue.staffView(doctorId)]);
    this.realtime.queueChanged(doctorId, publicView, staffView);
  }

  @Get(':doctorId/public')
  publicView(@Param('doctorId', CuidPipe) doctorId: string) {
    return this.queue.publicView(doctorId);
  }

  // Patient portal: the signed-in patient's own queue status for today.
  @UseGuards(PatientAuthGuard)
  @Get('me')
  myStatus(@CurrentPatient() patient: PatientPrincipal) {
    return this.queue.myStatus(patient.id);
  }

  // Patient self-booking. Public, but rate-limited so the queue can't be flooded.
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post(':doctorId/book')
  async book(@Param('doctorId', CuidPipe) doctorId: string, @Body() dto: BookDto) {
    const booking = await this.queue.book(doctorId, dto);
    await this.broadcast(doctorId);
    return booking;
  }

  // Patient tracks their own booking by its (unguessable) id.
  @Get('entry/:entryId')
  track(@Param('entryId', CuidPipe) entryId: string) {
    return this.queue.track(entryId);
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post('entry/:entryId/arrived')
  async arrived(@Param('entryId', CuidPipe) entryId: string) {
    const doctorId = await this.queue.markArrived(entryId);
    await this.broadcast(doctorId);
    return this.queue.track(entryId);
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post('entry/:entryId/cancel')
  async cancel(@Param('entryId', CuidPipe) entryId: string) {
    const doctorId = await this.queue.cancel(entryId);
    await this.broadcast(doctorId);
    return this.queue.track(entryId);
  }

  // Staff-only: the doctor's room sees full names and every queue type.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCTOR', 'MANAGEMENT')
  @Get(':doctorId/doctor')
  staffView(@Param('doctorId', CuidPipe) doctorId: string) {
    return this.queue.staffView(doctorId);
  }

  // Staff-only: the management desk's full queue, with names, phones and money state.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCTOR', 'MANAGEMENT')
  @Get(':doctorId/desk')
  deskView(@Param('doctorId', CuidPipe) doctorId: string) {
    return this.queue.deskView(doctorId);
  }

  // Reception registers a patient who is physically present (walk-in or emergency).
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCTOR', 'MANAGEMENT')
  @Post(':doctorId/walkin')
  async walkIn(@Param('doctorId', CuidPipe) doctorId: string, @Body() dto: WalkInDto) {
    const entry = await this.queue.registerWalkIn(doctorId, dto);
    await this.broadcast(doctorId);
    return entry;
  }

  // Reception marks a waiting patient as a no-show.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCTOR', 'MANAGEMENT')
  @Post('entry/:entryId/no-show')
  async noShow(@Param('entryId', CuidPipe) entryId: string) {
    const doctorId = await this.queue.markNoShow(entryId);
    await this.broadcast(doctorId);
    return this.queue.track(entryId);
  }

  // Finish whoever is in the room and call the next waiting patient, then push both views live.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCTOR', 'MANAGEMENT')
  @Post(':doctorId/call-next')
  async callNext(@Param('doctorId', CuidPipe) doctorId: string) {
    await this.queue.callNext(doctorId);
    const staffView = await this.queue.staffView(doctorId);
    this.realtime.queueChanged(doctorId, await this.queue.publicView(doctorId), staffView);
    return staffView;
  }
}
