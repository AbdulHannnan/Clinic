import type { Metadata } from 'next';
import { Figtree, Noto_Nastaliq_Urdu } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { isRtl, routing } from '@/i18n/routing';
import '../globals.css';

const figtree = Figtree({ subsets: ['latin'], variable: '--font-figtree' });
// preload: false + applying the variable only for `ur` keeps the Urdu font off English pages.
const nastaliq = Noto_Nastaliq_Urdu({ subsets: ['arabic'], weight: ['400', '600'], variable: '--font-nastaliq', preload: false });

export const metadata: Metadata = { title: 'Clinic' };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <html lang={locale} dir={isRtl(locale) ? 'rtl' : 'ltr'} className={`${figtree.variable} ${isRtl(locale) ? nastaliq.variable : ''}`}>
      <body className="font-sans antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
