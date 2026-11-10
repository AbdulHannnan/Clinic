import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Card } from '@/components/ui/Card';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { LoginForm } from '@/features/auth/components/LoginForm';

/** Staff sign-in for the management desk and the doctor's room. */
export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Auth');

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-10">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">{t('title')}</h1>
        <LanguageSwitch />
      </header>
      <Card className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t('subtitle')}</p>
        <LoginForm />
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">{t('devHint')}</p>
      </Card>
    </main>
  );
}
