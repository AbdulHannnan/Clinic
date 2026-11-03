'use client';
import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

export function LanguageSwitch() {
  const t = useTranslations('Common');
  const locale = useLocale();
  const pathname = usePathname();
  return (
    <Link href={pathname} locale={locale === 'en' ? 'ur' : 'en'} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold">
      {t('switchLanguage')}
    </Link>
  );
}
