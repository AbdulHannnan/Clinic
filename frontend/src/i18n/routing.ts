import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({ locales: ['en', 'ur'], defaultLocale: 'en' });
export const isRtl = (locale: string) => locale === 'ur';
