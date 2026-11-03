import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { LogProvider } from './providers/log.provider';
import { MESSAGE_PROVIDERS } from './providers/message-provider';

@Global()
@Module({
  providers: [
    NotificationsService,
    // Swap in the Meta WhatsApp Cloud API and an SMS aggregator per channel when keys are available.
    { provide: MESSAGE_PROVIDERS, useFactory: () => ({ WHATSAPP: new LogProvider('WHATSAPP'), SMS: new LogProvider('SMS'), APP: new LogProvider('APP') }) },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
