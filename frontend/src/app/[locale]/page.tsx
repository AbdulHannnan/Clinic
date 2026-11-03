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

  let clinic: ClinicProfile | null;
  let queues: Record<string, PublicQueue> = {};
  try {
    // Branding changes rarely; cache it briefly instead of refetching on every request.
    clinic = await api<ClinicProfile>('/clinic', { next: { revalidate: 60 } });
    // One queue per doctor, fetched independently so one doctor's failure doesn't blank the page.
    const results = await Promise.all(
      clinic.doctors.map(async (d) => {
        try {
          return [d.id, await api<PublicQueue>(`/queue/${d.id}/public`)] as const;
        } catch {
          return [d.id, null] as const;
        }
      }),
    );
    queues = Object.fromEntries(results.filter((r): r is readonly [string, PublicQueue] => r[1] !== null));
  } catch {
    clinic = null;
    queues = {};
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
          {queues[d.id] && <LiveQueue initial={queues[d.id]} />}
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
