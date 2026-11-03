import { Controller, Get, Param } from '@nestjs/common';
import { QueueService } from './queue.service';

@Controller('queue')
export class QueueController {
  constructor(private readonly queue: QueueService) {}

  @Get(':doctorId/public')
  publicView(@Param('doctorId') doctorId: string) {
    return this.queue.publicView(doctorId);
  }
}
