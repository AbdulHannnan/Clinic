'use client';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { Link, useRouter } from '@/i18n/navigation';
import { authedApi } from '@/lib/auth';
import { clearPatientSession, getPatientSession } from '@/lib/patientAuth';
import type { BookingTrack, PatientStatus, QueueEntryStatus } from '@/lib/api';

const STATUS_KEY: Record<QueueEntryStatus, string> = {
  WAITING: 'statusWaiting',
  IN_ROOM: 'statusInRoom',
  DONE: 'statusDone',
  NO_SHOW: 'statusNoShow',
  CANCELLED: 'statusCancelled',
};

/** The patient portal: a signed-in patient sees their own token and live position in today's queue. */
export function PatientPortal() {
  const t = useTranslations('Patient');
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);
  const [name, setName] = useState('');
  const [booking, setBooking] = useState<BookingTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (token: string) => {
    setBusy(true);
    try {
      const data = await authedApi<PatientStatus>(token, '/queue/me');
      setBooking(data.booking);
      setError(null);
    } catch (err) {
      if ((err as Error).message === 'UNAUTHORIZED') {
        clearPatientSession();
        setNeedLogin(true);
      } else {
        setError(t('loadError'));
      }
    } finally {
      setBusy(false);
      setReady(true);
    }
  }, [t]);

  useEffect(() => {
    const session = getPatientSession();
    if (!session) {
      setNeedLogin(true);
      setReady(true);
      return;
    }
    setName(session.patient.name);
    void load(session.token);
    // Light polling keeps the position fresh without a socket.
    const timer = setInterval(() => {
      const s = getPatientSession();
      if (s) void load(s.token);
    }, 15_000);
    return () => clearInterval(timer);
  }, [load]);

  function signOut() {
    clearPatientSession();
    router.push('/login');
  }

  if (!ready) {
    return <main className="mx-auto max-w-md px-4 py-10 text-muted">…</main>;
  }

  if (needLogin) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-10">
        <header className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight">{t('title')}</h1>
          <LanguageSwitch />
        </header>
        <Card className="flex flex-col gap-3">
          <p className="text-sm text-muted">{t('signInPrompt')}</p>
          <Link href="/login" className="rounded-lg bg-accent px-4 py-2 text-center font-semibold text-white">
            {t('signInCta')}
          </Link>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-10">
      <header className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="text-2xl font-extrabold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted">{t('greeting', { name })}</p>
        </div>
        <LanguageSwitch />
      </header>

      {error && <p className="text-sm font-semibold text-emergency">{error}</p>}

      {booking ? <BookingCard booking={booking} /> : <Card className="text-sm text-muted">{t('noBooking')}</Card>}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            const s = getPatientSession();
            if (s) void load(s.token);
          }}
          disabled={busy}
          className="rounded-lg border border-line px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {busy ? t('refreshing') : t('refresh')}
        </button>
        <button type="button" onClick={signOut} className="text-sm font-semibold text-muted hover:text-ink">
          {t('signOut')}
        </button>
      </div>
    </main>
  );
}

function BookingCard({ booking }: { booking: BookingTrack }) {
  const t = useTranslations('Patient');
  const waiting = booking.status === 'WAITING';
  const minutes = booking.aheadCount * booking.minutesPerPatient;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">{t('yourToken')}</span>
          <span className="text-5xl font-extrabold tabular-nums text-accent">{booking.token}</span>
        </div>
        <span className="rounded-full bg-surface-2 px-3 py-1 text-sm font-bold">{t(STATUS_KEY[booking.status])}</span>
      </div>

      {waiting && (
        <div className="flex flex-col gap-1 border-t border-line pt-3">
          <p className="font-semibold">{t('ahead', { count: booking.aheadCount })}</p>
          {minutes > 0 && <p className="text-sm text-muted">{t('estimate', { minutes })}</p>}
          <p className="text-sm text-muted">
            {t('nowServing')}: <span className="font-semibold text-ink">{booking.nowServing ?? t('none')}</span>
          </p>
          {booking.doctorStatus === 'BREAK' && <p className="text-sm text-walkin">{t('doctorBreak')}</p>}
          {booking.doctorStatus === 'CLOSED' && <p className="text-sm text-emergency">{t('doctorClosed')}</p>}
        </div>
      )}
    </Card>
  );
}
