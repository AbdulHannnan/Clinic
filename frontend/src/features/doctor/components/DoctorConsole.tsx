'use client';
import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { RealtimeEvent } from '@clinic/shared';
import { Card } from '@/components/ui/Card';
import { Link, useRouter } from '@/i18n/navigation';
import { authedApi, clearSession, getSession } from '@/lib/auth';
import { createStaffSocket } from '@/lib/socket';
import type { FinanceSummary, QueueEntryType, StaffQueue, StaffQueueEntry } from '@/lib/api';

const statusClass: Record<StaffQueue['status'], string> = {
  AVAILABLE: 'bg-ok/15 text-ok',
  BREAK: 'bg-warn/15 text-warn',
  CLOSED: 'bg-surface-2 text-muted',
};
const typeClass: Record<QueueEntryType, string> = {
  ONLINE: 'bg-online/15 text-online',
  WALKIN: 'bg-walkin/15 text-walkin',
  EMERGENCY: 'bg-emergency/15 text-emergency',
};

function TypeBadge({ type, label }: { type: QueueEntryType; label: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${typeClass[type]}`}>{label}</span>;
}

/** The doctor's room: live queue with names, who is in the room, and the single "Call next" control. */
export function DoctorConsole() {
  const t = useTranslations('Doctor');
  const locale = useLocale();
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);
  const [queue, setQueue] = useState<StaffQueue | null>(null);
  const [finance, setFinance] = useState<FinanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calling, setCalling] = useState(false);

  // One place to turn a lost/expired session into the login prompt.
  const requireLogin = useCallback(() => {
    clearSession();
    setNeedLogin(true);
    setReady(true);
  }, []);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      setNeedLogin(true);
      setReady(true);
      return;
    }
    const { token, staff } = session;
    if (!staff.doctorId) {
      setError(t('noDoctor'));
      setReady(true);
      return;
    }
    const doctorId = staff.doctorId;
    let active = true;

    const loadFinance = () =>
      authedApi<FinanceSummary>(token, `/finance/${doctorId}/today`)
        .then((f) => active && setFinance(f))
        .catch(() => {
          /* earnings are secondary; a failure here shouldn't blank the console */
        });

    authedApi<StaffQueue>(token, `/queue/${doctorId}/doctor`)
      .then((q) => {
        if (!active) return;
        setQueue(q);
        setReady(true);
      })
      .catch((err) => {
        if (!active) return;
        if ((err as Error).message === 'UNAUTHORIZED') requireLogin();
        else {
          setError(t('loadFailed'));
          setReady(true);
        }
      });
    loadFinance();

    // Live updates: the gateway pushes the full staff view to this doctor's staff room.
    const socket = createStaffSocket(token);
    const join = () => socket.emit('join', `staff:${doctorId}`);
    const onUpdate = (payload: StaffQueue | { doctorId: string }) => {
      if ('doctor' in payload) setQueue(payload);
      loadFinance();
    };
    socket.on('connect', join);
    socket.on(RealtimeEvent.QUEUE_UPDATED, onUpdate);
    join();

    return () => {
      active = false;
      socket.off('connect', join);
      socket.off(RealtimeEvent.QUEUE_UPDATED, onUpdate);
      socket.disconnect();
    };
  }, [t, requireLogin]);

  async function callNext() {
    const session = getSession();
    if (!session?.staff.doctorId) return requireLogin();
    setCalling(true);
    try {
      const updated = await authedApi<StaffQueue>(session.token, `/queue/${session.staff.doctorId}/call-next`, { method: 'POST' });
      setQueue(updated);
      authedApi<FinanceSummary>(session.token, `/finance/${session.staff.doctorId}/today`)
        .then(setFinance)
        .catch(() => {});
    } catch (err) {
      if ((err as Error).message === 'UNAUTHORIZED') requireLogin();
    } finally {
      setCalling(false);
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!ready) return <Card className="text-muted">{t('loading')}</Card>;

  if (needLogin) {
    return (
      <Card className="flex flex-col items-start gap-3">
        <p className="text-muted">{t('signedOut')}</p>
        <Link href="/login" className="rounded-lg bg-accent px-4 py-2 font-semibold text-white">
          {t('goToLogin')}
        </Link>
      </Card>
    );
  }

  if (error || !queue) return <Card className="text-warn">{error ?? t('loadFailed')}</Card>;

  const d = queue.doctor;
  const docName = locale === 'ur' && d.nameUr ? d.nameUr : d.name;
  const specialty = locale === 'ur' && d.specialtyUr ? d.specialtyUr : d.specialty;
  const current = queue.current;
  const hasWaiting = queue.upNext.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Header: identity + live badge + sign out */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{docName}</h1>
          <p className="text-sm text-muted">
            {specialty}
            {queue.clinicName ? ` · ${queue.clinicName}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emergency/15 px-3 py-1 text-xs font-bold text-emergency">{t('live')}</span>
          <button onClick={logout} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold">
            {t('signOut')}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3">
          <div className="text-xs font-bold uppercase text-muted">{t('seenToday')}</div>
          <div className="font-mono text-2xl font-semibold">{queue.seenToday}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs font-bold uppercase text-muted">{t('waiting')}</div>
          <div className="font-mono text-2xl font-semibold">{queue.waitingCount}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs font-bold uppercase text-muted">{t('earnedToday')}</div>
          <div className="font-mono text-2xl font-semibold" dir="ltr">
            {finance ? `Rs ${finance.collected.toLocaleString('en-US')}` : '—'}
          </div>
        </Card>
      </div>

      {/* Status + pace (read-only for now) */}
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass[queue.status]}`}>{t(`status.${queue.status}`)}</span>
        <span className="text-sm text-muted">{t('minsPerPatient', { mins: queue.minutesPerPatient })}</span>
      </div>

      {/* Current patient, or the call-next prompt when the room is empty */}
      {current ? (
        <Card className="flex flex-col gap-3 border-accent">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase text-accent">{t('inRoom')}</div>
              <div className="text-xl font-bold">{current.name}</div>
              {current.symptoms && <p className="mt-1 text-sm text-muted">{current.symptoms}</p>}
            </div>
            <span className="font-mono text-2xl font-semibold" dir="ltr">
              #{current.token}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <TypeBadge type={current.type} label={t(`type.${current.type}`)} />
            <button onClick={callNext} disabled={calling} className="ml-auto rounded-lg bg-accent px-4 py-2 font-semibold text-white disabled:opacity-60">
              {calling ? t('working') : t('doneNext')}
            </button>
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col items-start gap-3">
          <p className="text-muted">{hasWaiting ? t('noPatient') : t('queueEmpty')}</p>
          {hasWaiting && (
            <button onClick={callNext} disabled={calling} className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-white disabled:opacity-60">
              {calling ? t('working') : `${t('startClinic')} · #${queue.upNext[0].token}`}
            </button>
          )}
        </Card>
      )}

      {/* Up next */}
      <div>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">{t('upNext')}</h2>
        {queue.upNext.length === 0 ? (
          <p className="text-sm text-muted">{t('queueEmpty')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {queue.upNext.slice(0, 8).map((p: StaffQueueEntry) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2">
                <span className="w-10 shrink-0 text-center font-mono text-lg font-semibold" dir="ltr">
                  {p.token}
                </span>
                <span className="flex-1 font-semibold">{p.name}</span>
                <TypeBadge type={p.type} label={t(`type.${p.type}`)} />
                {p.arrived ? (
                  <span className="rounded-full bg-ok/15 px-2 py-0.5 text-xs font-bold text-ok">{t('arrived')}</span>
                ) : (
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-muted">{t('notArrived')}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
