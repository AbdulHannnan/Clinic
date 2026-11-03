import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MESSAGE_PROVIDERS, type ChannelName, type MessageProviders, type OutgoingMessage } from './providers/message-provider';

type Kind = Prisma.NotificationCreateInput['kind'];

/** Sends one message on several channels and records each attempt. A dedupeKey stops repeats. */
@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MESSAGE_PROVIDERS) private readonly providers: MessageProviders,
  ) {}

  async send(opts: { kind: Kind; patientId?: string; channels: ChannelName[]; dedupeKey?: string } & OutgoingMessage) {
    for (const channel of opts.channels) {
      const dedupeKey = opts.dedupeKey ? `${opts.dedupeKey}:${channel}` : undefined;
      if (dedupeKey && (await this.prisma.notification.findUnique({ where: { dedupeKey } }))) continue;
      const row = await this.prisma.notification.create({
        data: { kind: opts.kind, channel, phone: opts.phone, patientId: opts.patientId, payload: { template: opts.template, params: opts.params }, dedupeKey },
      });
      try {
        const { providerId } = await this.providers[channel].send(opts);
        await this.prisma.notification.update({ where: { id: row.id }, data: { status: 'SENT', providerId, sentAt: new Date() } });
      } catch (err) {
        this.log.error(`Failed to send ${opts.kind} on ${channel}`, err as Error);
        await this.prisma.notification.update({ where: { id: row.id }, data: { status: 'FAILED', error: String(err) } });
      }
    }
  }
}
