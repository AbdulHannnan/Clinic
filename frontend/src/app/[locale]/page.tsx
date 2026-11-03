import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Card } from '@/components/ui/Card';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { LiveQueue } from '@/features/queue/components/LiveQueue';
import { api, type ClinicProfile, type PublicQueue } from '@/lib/api';

/** Patient home: the doctor's own branded page with the live queue. */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Home');

  let clinic: ClinicProfile | null = null;
  let queue: PublicQueue | null = null;
  try {
    clinic = await api<ClinicProfile>('/clinic');
    if (clinic.doctors[0]) queue = await api<PublicQueue>(`/queue/${clinic.doctors[0].id}/public`);
  } catch {
    clinic = null;
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{clinic?.name ?? 'Clinic'}</h1>
          {clinic && <p className="text-sm text-muted">{clinic.address}</p>}
        </div>
        <LanguageSwitch />
      </header>

      {!clinic && <Card className="text-warn">{t('offline')}</Card>}

      {clinic?.doctors.map((d) => (
        <Card key={d.id} className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-bold">{locale === 'ur' && d.nameUr ? d.nameUr : d.name}</h2>
            <p className="text-sm text-muted">
              {locale === 'ur' && d.specialtyUr ? d.specialtyUr : d.specialty} · {d.qualifications}
            </p>
          </div>
          {queue?.doctorId === d.id && <LiveQueue initial={queue} />}
          <div className="flex items-center justify-between">
            <span className="font-mono font-semibold" dir="ltr">
              {t('fee')}: Rs {d.fee.toLocaleString('en-US')}
            </span>
            <button className="rounded-lg bg-accent px-4 py-2 font-semibold text-white" disabled>
              {t('book')}
            </button>
          </div>
        </Card>
      ))}
    </main>
  );
}
