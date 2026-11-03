export type ChannelName = 'WHATSAPP' | 'SMS' | 'APP';

export interface OutgoingMessage {
  phone: string;
  /** Pre-approved template name (WhatsApp requires Meta-approved templates). */
  template: string;
  params: Record<string, string | number>;
  lang: 'en' | 'ur';
}

export interface MessageProvider {
  send(msg: OutgoingMessage): Promise<{ providerId: string }>;
}

export const MESSAGE_PROVIDERS = Symbol('MESSAGE_PROVIDERS');
export type MessageProviders = Record<ChannelName, MessageProvider>;
