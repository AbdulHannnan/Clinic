'use client';
import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { LiveQueue } from '@/features/queue/components/LiveQueue';
import { Link, useRouter } from '@/i18n/navigation';
import { authedApi } from '@/lib/auth';
import { bookAsPatient } from '@/lib/booking';
import { clearPatientSession, getPatientSession } from '@/lib/patientAuth';
import { api, type BookingTrack, type ClinicProfile, type PatientStatus, type PublicQueue, type QueueEntryStatus } from '@/lib/api';

const STATUS_KEY: Record<QueueEntryStatus, string> = {
  WAITING: 'statusWaiting',
  IN_ROOM: 'statusInRoom',
  DONE: 'statusDone',
  NO_SHOW: 'statusNoShow',
  CANCELLED: 'statusCancelled',
};

// A booking the patient is still in: it owns the screen. Anything else means they can book afresh.
const ACTIVE = new Set<QueueEntryStatus>(['WAITING', 'IN_ROOM']);

type Doctor = ClinicProfile['doctors'][number];

/** The patient portal: a signed-in patient sees the live queue, books their own visit, and tracks their turn. */
export function PatientPortal() {
  const t = useTranslations('Patient');
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);
  const [name, setName] = useState('');
  const [booking, setBooking] = useState<BookingTrack | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [queues, setQueues] = useState<Record<string, PublicQueue>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (token: string) => {
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
    },
    [t],
  );

  // The doctor list and their live queues are public: load them once so the patient can see and book.
  const loadClinic = useCallback(async () => {
    try {
      const clinic = await api<ClinicProfile>('/clinic');
      setDoctors(clinic.doctors);
      const results = await Promise.all(
        clinic.doctors.map(async (d) => {
          try {
            return [d.id, await api<PublicQueue>(`/queue/${d.id}/public`)] as const;
          } catch {
            return [d.id, null] as const;
          }
        }),
      );
      setQueues(Object.fromEntries(results.filter((r): r is readonly [string, PublicQueue] => r[1] !== null)));
    } catch {
      // The booking form falls back to the doctor's fee from the clinic call; without it we just hide it.
    }
  }, []);

  useEffect(() => {
    const session = getPatientSession();
    if (!session) {
      setNeedLogin(true);
      setReady(true);
      return;
    }
    setName(session.patient.name);
    void load(session.token);
    void loadClinic();
    // Light polling keeps the position fresh without a socket.
    const timer = setInterval(() => {
      const s = getPatientSession();
      if (s) void load(s.token);
    }, 15_000);
    return () => clearInterval(timer);
  }, [load, loadClinic]);

  const reload = useCallback(() => {
    const s = getPatientSession();
    return s ? load(s.token) : Promise.resolve();
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

  const activeBooking = booking && ACTIVE.has(booking.status) ? booking : null;

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

      {activeBooking ? (
        <BookingCard booking={activeBooking} />
      ) : (
        <div className="flex flex-col gap-4">
          {/* A finished/cancelled booking from earlier today: a short note, then let them book again. */}
          {booking && <Card className="text-sm font-semibold text-muted">{t(STATUS_KEY[booking.status])}</Card>}
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold">{t('bookHeading')}</h2>
            <p className="text-sm text-muted">{t('bookingAs', { name })}</p>
          </div>
          {doctors.length === 0 ? (
            <Card className="text-sm text-muted">{t('loadError')}</Card>
          ) : (
            doctors.map((d) => <BookDoctorCard key={d.id} doctor={d} queue={queues[d.id]} onBooked={reload} />)
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => void reload()}
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

/** One doctor the patient can book: their live queue, a Book button, and the booking form. */
function BookDoctorCard({ doctor, queue, onBooked }: { doctor: Doctor; queue: PublicQueue | undefined; onBooked: () => Promise<void> }) {
  const t = useTranslations('Booking');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [symptoms, setSymptoms] = useState('');
  const [age, setAge] = useState('');
  const [payAtClinic, setPayAtClinic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closed = doctor.status === 'CLOSED';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const session = getPatientSession();
    if (!session) {
      // Token vanished mid-form: let the portal reload and send them to sign in.
      await onBooked();
      return;
    }
    try {
      await bookAsPatient(session.token, doctor.id, {
        symptoms: symptoms.trim() || undefined,
        age: age ? Number(age) : undefined,
        payAtClinic,
      });
      await onBooked(); // refreshes /queue/me; the active booking now owns the screen
    } catch (err) {
      if ((err as Error).message === 'UNAUTHORIZED') {
        await onBooked();
        return;
      }
      setError(t('bookFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h3 className="text-lg font-bold">{locale === 'ur' && doctor.nameUr ? doctor.nameUr : doctor.name}</h3>
        <p className="text-sm text-muted">
          {locale === 'ur' && doctor.specialtyUr ? doctor.specialtyUr : doctor.specialty} · {doctor.qualifications}
        </p>
      </div>

      {queue && <LiveQueue initial={queue} />}

      {open ? (
        <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl bg-surface-2 p-3">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t('symptoms')}
            <input
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              maxLength={300}
              className="rounded-lg border border-line bg-surface px-3 py-2 font-normal"
              placeholder={t('symptomsPh')}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t('age')}
            <input
              value={age}
              onChange={(e) => setAge(e.target.value)}
              type="number"
              min={0}
              max={120}
              className="w-28 rounded-lg border border-line bg-surface px-3 py-2 font-mono font-normal"
            />
          </label>
          <div className="flex flex-col gap-1 text-sm font-semibold">
            {t('payment')}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPayAtClinic(false)}
                aria-pressed={!payAtClinic}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold ${!payAtClinic ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}
              >
                {t('payOnline')}
              </button>
              <button
                type="button"
                onClick={() => setPayAtClinic(true)}
                aria-pressed={payAtClinic}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold ${payAtClinic ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}
              >
                {t('payClinic')}
              </button>
            </div>
          </div>
          {error && <p className="text-sm font-semibold text-emergency">{error}</p>}
          <div className="flex items-center gap-2">
            <button type="submit" disabled={busy} className="rounded-lg bg-accent px-4 py-2 font-semibold text-white disabled:opacity-60">
              {busy ? t('booking') : `${t('confirm')} · Rs ${doctor.fee.toLocaleString('en-US')}`}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold">
              {t('back')}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between">
          <span className="font-mono font-semibold" dir="ltr">
            Rs {doctor.fee.toLocaleString('en-US')}
          </span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={closed}
            className="rounded-lg bg-accent px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {closed ? t('closed') : t('book')}
          </button>
        </div>
      )}
    </Card>
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
