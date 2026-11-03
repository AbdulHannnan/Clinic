import { Controller, Get, Param } from '@nestjs/common';
import { QueueService } from './queue.service';
import { CuidPipe } from '../../common/pipes/cuid.pipe';

@Controller('queue')
export class QueueController {
  constructor(private readonly queue: QueueService) {}

  @Get(':doctorId/public')
  publicView(@Param('doctorId', CuidPipe) doctorId: string) {
    return this.queue.publicView(doctorId);
  }
}
