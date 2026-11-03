import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Card } from '@/components/ui/Card';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations('Staff');
  return (
    <Card className="flex flex-col gap-2">
      <h1 className="text-xl font-bold">{t('doctor')}</h1>
      <p className="text-muted">{t('comingSoon')}</p>
    </Card>
  );
}
