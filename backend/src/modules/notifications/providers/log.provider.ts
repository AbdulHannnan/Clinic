import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ChannelName, MessageProvider, OutgoingMessage } from './message-provider';

/** Development provider: prints the message instead of sending it. */
export class LogProvider implements MessageProvider {
  private readonly log: Logger;
  constructor(channel: ChannelName) {
    this.log = new Logger(`Message:${channel}`);
  }
  async send(msg: OutgoingMessage) {
    this.log.log(`${msg.phone} ← ${msg.template} ${JSON.stringify(msg.params)}`);
    return { providerId: `log-${randomUUID()}` };
  }
}
