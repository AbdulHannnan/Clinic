'use client';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { RealtimeEvent } from '@clinic/shared';
import { Card } from '@/components/ui/Card';
import { Link, useRouter } from '@/i18n/navigation';
import { authedApi, clearSession, getSession } from '@/lib/auth';
import { createStaffSocket } from '@/lib/socket';
import type { DeskEntry, DeskQueue, FinanceSummary, QueueEntryType } from '@/lib/api';

const rs = (n: number) => `Rs ${n.toLocaleString('en-US')}`;
const typeClass: Record<QueueEntryType, string> = {
  ONLINE: 'bg-online/15 text-online',
  WALKIN: 'bg-walkin/15 text-walkin',
  EMERGENCY: 'bg-emergency/15 text-emergency',
};
const ACTIVE = new Set(['WAITING', 'IN_ROOM']);

function TypeBadge({ type, label }: { type: QueueEntryType; label: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${typeClass[type]}`}>{label}</span>;
}

/** The management desk: run the live queue, register walk-ins, take payments, and watch the day's money. */
export function ReceptionDesk() {
  const t = useTranslations('Reception');
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [desk, setDesk] = useState<DeskQueue | null>(null);
  const [finance, setFinance] = useState<FinanceSummary | null>(null);
  const [tab, setTab] = useState<'queue' | 'finance'>('queue');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Walk-in form
  const [wName, setWName] = useState('');
  const [wPhone, setWPhone] = useState('');
  const [wAge, setWAge] = useState('');
  const [wBusy, setWBusy] = useState(false);
  const [wErr, setWErr] = useState<string | null>(null);

  const requireLogin = useCallback(() => {
    clearSession();
    setNeedLogin(true);
    setReady(true);
  }, []);

  const load = useCallback(
    async (token: string, doctorId: string) => {
      const [d, f] = await Promise.allSettled([
        authedApi<DeskQueue>(token, `/queue/${doctorId}/desk`),
        authedApi<FinanceSummary>(token, `/finance/${doctorId}/today`),
      ]);
      if (d.status === 'fulfilled') setDesk(d.value);
      else if ((d.reason as Error).message === 'UNAUTHORIZED') return requireLogin();
      if (f.status === 'fulfilled') setFinance(f.value);
      setReady(true);
    },
    [requireLogin],
  );

  useEffect(() => {
    const session = getSession();
    if (!session) {
      setNeedLogin(true);
      setReady(true);
      return;
    }
    const { token, staff } = session;
    const doctorId = staff.doctorId;
    if (!doctorId) {
      setError(t('noDoctor'));
      setReady(true);
      return;
    }
    load(token, doctorId);

    const socket = createStaffSocket(token);
    const join = () => socket.emit('join', `staff:${doctorId}`);
    const onUpdate = () => load(token, doctorId);
    socket.on('connect', join);
    socket.on(RealtimeEvent.QUEUE_UPDATED, onUpdate);
    join();
    return () => {
      socket.off('connect', join);
      socket.off(RealtimeEvent.QUEUE_UPDATED, onUpdate);
      socket.disconnect();
    };
  }, [t, load]);

  // A desk action (arrived / no-show / collect), then a refresh so every panel stays in step.
  async function act(path: string, body?: unknown) {
    const session = getSession();
    if (!session?.staff.doctorId) return requireLogin();
    try {
      await authedApi(session.token, path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : { method: 'POST' });
      await load(session.token, session.staff.doctorId);
    } catch (err) {
      if ((err as Error).message === 'UNAUTHORIZED') requireLogin();
    }
  }

  async function rowAction(entry: DeskEntry, path: string, body?: unknown) {
    setBusyId(entry.id);
    await act(path, body);
    setBusyId(null);
  }

  async function registerWalkIn(emergency: boolean) {
    const session = getSession();
    if (!session?.staff.doctorId) return requireLogin();
    if (wName.trim().length < 2 || wPhone.trim().length < 7) {
      setWErr(t('walkInNeeds'));
      return;
    }
    setWErr(null);
    setWBusy(true);
    try {
      await authedApi(session.token, `/queue/${session.staff.doctorId}/walkin`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: wName.trim(), phone: wPhone.trim(), age: wAge ? Number(wAge) : undefined, emergency }),
      });
      setWName('');
      setWPhone('');
      setWAge('');
      await load(session.token, session.staff.doctorId);
    } catch (err) {
      if ((err as Error).message === 'UNAUTHORIZED') requireLogin();
      else setWErr(t('walkInFailed'));
    } finally {
      setWBusy(false);
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
  if (error || !desk) return <Card className="text-warn">{error ?? t('loadFailed')}</Card>;

  const active = desk.entries.filter((e) => ACTIVE.has(e.status));
  const finished = desk.entries.filter((e) => !ACTIVE.has(e.status));

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted">
            {desk.doctor.name}
            {desk.clinicName ? ` · ${desk.clinicName}` : ''}
          </p>
        </div>
        <button onClick={logout} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold">
          {t('signOut')}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['queue', 'finance'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            aria-pressed={tab === k}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${tab === k ? 'bg-accent text-white' : 'border border-line bg-surface'}`}
          >
            {t(k)}
          </button>
        ))}
      </div>

      {tab === 'queue' ? (
        <>
          {/* Snapshot */}
          <div className="grid grid-cols-3 gap-2">
            <Card className="p-3">
              <div className="text-xs font-bold uppercase text-muted">{t('nowServing')}</div>
              <div className="font-mono text-2xl font-semibold" dir="ltr">
                {desk.nowServing ? `#${desk.nowServing.token}` : '—'}
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-xs font-bold uppercase text-muted">{t('waiting')}</div>
              <div className="font-mono text-2xl font-semibold">{desk.waitingCount}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs font-bold uppercase text-muted">{t('mix')}</div>
              <div className="text-sm font-semibold">
                {desk.onlineWaiting} {t('online')} · {desk.walkinWaiting} {t('walkin')}
              </div>
            </Card>
          </div>

          {/* Walk-in registration */}
          <Card className="flex flex-col gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{t('addWalkIn')}</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <input value={wName} onChange={(e) => setWName(e.target.value)} placeholder={t('name')} className="col-span-2 rounded-lg border border-line bg-surface px-3 py-2 sm:col-span-2" />
              <input value={wPhone} onChange={(e) => setWPhone(e.target.value)} placeholder={t('phone')} type="tel" dir="ltr" className="rounded-lg border border-line bg-surface px-3 py-2 font-mono" />
              <input value={wAge} onChange={(e) => setWAge(e.target.value)} placeholder={t('age')} type="number" min={0} max={120} className="rounded-lg border border-line bg-surface px-3 py-2 font-mono" />
            </div>
            {wErr && <p className="text-sm font-semibold text-emergency">{wErr}</p>}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => registerWalkIn(false)} disabled={wBusy} className="rounded-lg bg-accent px-4 py-2 font-semibold text-white disabled:opacity-60">
                {t('addToQueue')}
              </button>
              <button onClick={() => registerWalkIn(true)} disabled={wBusy} className="rounded-lg border border-emergency bg-surface px-4 py-2 font-semibold text-emergency disabled:opacity-60">
                {t('addEmergency')}
              </button>
            </div>
          </Card>

          {/* Live queue */}
          <div>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">{t('queue')}</h2>
            {active.length === 0 ? (
              <p className="text-sm text-muted">{t('queueEmpty')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {active.map((e) => {
                  const inRoom = e.status === 'IN_ROOM';
                  return (
                    <li key={e.id} className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 ${inRoom ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}>
                      <span className="w-10 shrink-0 text-center font-mono text-lg font-semibold" dir="ltr">
                        {e.token}
                      </span>
                      <span className="min-w-[8rem] flex-1 font-semibold">
                        {e.name}
                        <span className="ms-2 font-mono text-xs font-normal text-muted" dir="ltr">
                          {e.phone}
                        </span>
                      </span>
                      <TypeBadge type={e.type} label={t(`type.${e.type}`)} />
                      {inRoom ? (
                        <span className="rounded-full bg-ok/15 px-2 py-0.5 text-xs font-bold text-ok">{t('inRoom')}</span>
                      ) : e.arrived ? (
                        <span className="rounded-full bg-ok/15 px-2 py-0.5 text-xs font-bold text-ok">{t('arrived')}</span>
                      ) : (
                        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-muted">{t('notArrived')}</span>
                      )}
                      {e.balance > 0 ? (
                        <span className="rounded-full bg-warn/15 px-2 py-0.5 text-xs font-bold text-warn">{t('due', { amount: rs(e.balance) })}</span>
                      ) : (
                        <span className="rounded-full bg-ok/15 px-2 py-0.5 text-xs font-bold text-ok">{t('paid')}</span>
                      )}
                      <div className="ms-auto flex flex-wrap gap-1">
                        {!inRoom && !e.arrived && (
                          <button onClick={() => rowAction(e, `/queue/entry/${e.id}/arrived`)} disabled={busyId === e.id} className="rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60">
                            {t('markArrived')}
                          </button>
                        )}
                        {e.balance > 0 && (
                          <button onClick={() => rowAction(e, `/finance/entry/${e.id}/collect`, { method: 'CASH' })} disabled={busyId === e.id} className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-semibold disabled:opacity-60">
                            {t('collectCash')}
                          </button>
                        )}
                        {e.status === 'WAITING' && (
                          <button onClick={() => rowAction(e, `/queue/entry/${e.id}/no-show`)} disabled={busyId === e.id} className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-emergency disabled:opacity-60">
                            {t('noShow')}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Completed */}
          {finished.length > 0 && (
            <details className="rounded-xl border border-line bg-surface px-3 py-2">
              <summary className="cursor-pointer text-sm font-semibold text-muted">{t('completed', { count: finished.length })}</summary>
              <ul className="mt-2 flex flex-col gap-1">
                {finished.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 text-sm">
                    <span className="w-10 text-center font-mono" dir="ltr">
                      {e.token}
                    </span>
                    <span className="flex-1">{e.name}</span>
                    <span className="text-xs text-muted">{t(`status.${e.status}`)}</span>
                    {e.balance > 0 && (
                      <button onClick={() => rowAction(e, `/finance/entry/${e.id}/collect`, { method: 'CASH' })} disabled={busyId === e.id} className="rounded-lg border border-line px-2 py-0.5 text-xs font-semibold disabled:opacity-60">
                        {t('collectCash')}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      ) : (
        // ---- Finance tab ----
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Card className="p-3">
              <div className="text-xs font-bold uppercase text-muted">{t('collected')}</div>
              <div className="font-mono text-2xl font-semibold" dir="ltr">{finance ? rs(finance.collected) : '—'}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs font-bold uppercase text-muted">{t('patients')}</div>
              <div className="font-mono text-2xl font-semibold">{finance?.patients ?? '—'}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs font-bold uppercase text-muted">{t('pending')}</div>
              <div className="font-mono text-2xl font-semibold" dir="ltr">{finance ? rs(finance.due) : '—'}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs font-bold uppercase text-muted">{t('discounts')}</div>
              <div className="font-mono text-2xl font-semibold" dir="ltr">{finance ? rs(finance.discount) : '—'}</div>
            </Card>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['CASH', 'CARD', 'ONLINE'] as const).map((m) => (
              <Card key={m} className="p-3">
                <div className="text-xs font-bold uppercase text-muted">{t(`method.${m}`)}</div>
                <div className="font-mono text-xl font-semibold" dir="ltr">{finance ? rs(finance.byMethod[m]) : '—'}</div>
              </Card>
            ))}
          </div>

          {/* Payment log from today's entries */}
          <div>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">{t('payLog')}</h2>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-xs uppercase text-muted">
                  <tr>
                    <th className="px-3 py-2 text-start">#</th>
                    <th className="px-3 py-2 text-start">{t('name')}</th>
                    <th className="px-3 py-2 text-end">{t('fee')}</th>
                    <th className="px-3 py-2 text-end">{t('paidCol')}</th>
                    <th className="px-3 py-2 text-end">{t('balanceCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {desk.entries.map((e) => (
                    <tr key={e.id} className="border-t border-line">
                      <td className="px-3 py-2 font-mono" dir="ltr">{e.token}</td>
                      <td className="px-3 py-2">{e.name}</td>
                      <td className="px-3 py-2 text-end font-mono" dir="ltr">{rs(e.fee)}</td>
                      <td className="px-3 py-2 text-end font-mono" dir="ltr">{rs(e.paid - e.refunded)}</td>
                      <td className={`px-3 py-2 text-end font-mono ${e.balance > 0 ? 'text-warn' : 'text-muted'}`} dir="ltr">
                        {e.balance > 0 ? rs(e.balance) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
