import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: the process is up. No dependencies touched. */
  @Get('live')
  live() {
    return { ok: true, time: new Date().toISOString() };
  }

  /** Readiness: the database is reachable, so the app can actually serve. */
  @Get('ready')
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true, time: new Date().toISOString() };
  }

  /** Back-compat default: the readiness check. */
  @Get()
  check() {
    return this.ready();
  }
}
