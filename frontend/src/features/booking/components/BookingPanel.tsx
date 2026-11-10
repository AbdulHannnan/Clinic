'use client';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { RealtimeEvent } from '@clinic/shared';
import { getSocket } from '@/lib/socket';
import { book, cancelBooking, clearBooking, getStoredBooking, markArrived, saveBooking, trackBooking } from '@/lib/booking';
import type { BookingTrack } from '@/lib/api';

type View = 'idle' | 'form' | 'tracking';
const TERMINAL = new Set(['DONE', 'NO_SHOW', 'CANCELLED']);

/** A patient's booking for one doctor: the Book button, the booking form, and the live turn tracker. */
export function BookingPanel({ doctorId, fee, status }: { doctorId: string; fee: number; status: 'AVAILABLE' | 'BREAK' | 'CLOSED' }) {
  const t = useTranslations('Booking');
  const [view, setView] = useState<View>('idle');
  const [track, setTrack] = useState<BookingTrack | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [age, setAge] = useState('');
  const [payAtClinic, setPayAtClinic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const stored = getStoredBooking(doctorId);
    if (!stored) return;
    try {
      const tr = await trackBooking(stored.id);
      setTrack(tr);
    } catch {
      // The booking id is gone (e.g. a reseed): forget it so the patient can book afresh.
      clearBooking(doctorId);
      setTrack(null);
      setView('idle');
    }
  }, [doctorId]);

  // On mount, pick up any booking this browser already holds and show the tracker.
  useEffect(() => {
    if (getStoredBooking(doctorId)) {
      setView('tracking');
      refresh();
    }
  }, [doctorId, refresh]);

  // The booking's position changes whenever the doctor's queue moves: re-pull on every public update.
  useEffect(() => {
    if (view !== 'tracking') return;
    const socket = getSocket();
    const join = () => socket.emit('join', `public:${doctorId}`);
    const onUpdate = () => refresh();
    join();
    socket.on('connect', join);
    socket.on(RealtimeEvent.QUEUE_UPDATED, onUpdate);
    return () => {
      socket.off('connect', join);
      socket.off(RealtimeEvent.QUEUE_UPDATED, onUpdate);
    };
  }, [view, doctorId, refresh]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await book(doctorId, {
        name: name.trim(),
        phone: phone.trim(),
        symptoms: symptoms.trim() || undefined,
        age: age ? Number(age) : undefined,
        payAtClinic,
      });
      saveBooking(doctorId, { id: result.id, token: result.token });
      setView('tracking');
      await refresh();
    } catch {
      setError(t('bookFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function imHere() {
    if (!track) return;
    setBusy(true);
    try {
      setTrack(await markArrived(track.id));
    } catch {
      /* a failed tap is harmless; the next queue update re-syncs */
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!track) return;
    setBusy(true);
    try {
      await cancelBooking(track.id);
    } catch {
      /* ignore */
    }
    clearBooking(doctorId);
    setTrack(null);
    setBusy(false);
    setView('idle');
  }

  function startOver() {
    clearBooking(doctorId);
    setTrack(null);
    setView('idle');
  }

  // ---- Tracking: the patient's live "my turn" card ----
  if (view === 'tracking' && track) {
    if (TERMINAL.has(track.status)) {
      const msg = track.status === 'DONE' ? t('seen') : track.status === 'CANCELLED' ? t('cancelled') : t('missed');
      return (
        <div className="flex flex-col gap-2 rounded-xl bg-surface-2 p-3">
          <p className="font-semibold">{msg}</p>
          <button onClick={startOver} className="self-start rounded-lg bg-accent px-4 py-2 font-semibold text-white">
            {t('bookAgain')}
          </button>
        </div>
      );
    }
    const inRoom = track.status === 'IN_ROOM';
    const est = track.aheadCount * track.minutesPerPatient;
    return (
      <div className="flex flex-col gap-3 rounded-xl bg-accent-soft p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase text-muted">{t('yourNumber')}</div>
            <div className="font-mono text-3xl font-semibold" dir="ltr">
              #{track.token}
            </div>
          </div>
          <div className="text-right">
            {inRoom ? (
              <span className="rounded-full bg-ok/20 px-3 py-1 text-sm font-bold text-ok">{t('yourTurn')}</span>
            ) : (
              <>
                <div className="font-mono text-2xl font-semibold">{track.aheadCount}</div>
                <div className="text-xs text-muted">{track.aheadCount === 1 ? t('oneAhead') : t('ahead')}</div>
              </>
            )}
          </div>
        </div>
        {!inRoom && (
          <div className="text-sm text-muted">
            {t('nowServing')}: <span className="font-mono font-semibold">{track.nowServing ? `#${track.nowServing}` : '—'}</span>
            {track.aheadCount > 0 && ` · ${t('estWait', { mins: est })}`}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {track.arrived ? (
            <span className="rounded-full bg-ok/15 px-3 py-1 text-xs font-bold text-ok">{t('checkedIn')}</span>
          ) : (
            <button onClick={imHere} disabled={busy} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">
              {t('imHere')}
            </button>
          )}
          <button onClick={cancel} disabled={busy} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-emergency disabled:opacity-60">
            {t('cancel')}
          </button>
        </div>
      </div>
    );
  }

  // ---- Form: collect the booking ----
  if (view === 'form') {
    return (
      <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl bg-surface-2 p-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t('name')}
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} className="rounded-lg border border-line bg-surface px-3 py-2 font-normal" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t('phone')}
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required type="tel" dir="ltr" className="rounded-lg border border-line bg-surface px-3 py-2 font-mono font-normal" placeholder="0300…" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t('age')}
            <input value={age} onChange={(e) => setAge(e.target.value)} type="number" min={0} max={120} className="rounded-lg border border-line bg-surface px-3 py-2 font-mono font-normal" />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t('symptoms')}
          <input value={symptoms} onChange={(e) => setSymptoms(e.target.value)} maxLength={300} className="rounded-lg border border-line bg-surface px-3 py-2 font-normal" placeholder={t('symptomsPh')} />
        </label>
        <div className="flex flex-col gap-1 text-sm font-semibold">
          {t('payment')}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setPayAtClinic(false)} aria-pressed={!payAtClinic} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${!payAtClinic ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}>
              {t('payOnline')}
            </button>
            <button type="button" onClick={() => setPayAtClinic(true)} aria-pressed={payAtClinic} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${payAtClinic ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}>
              {t('payClinic')}
            </button>
          </div>
        </div>
        {error && <p className="text-sm font-semibold text-emergency">{error}</p>}
        <div className="flex items-center gap-2">
          <button type="submit" disabled={busy} className="rounded-lg bg-accent px-4 py-2 font-semibold text-white disabled:opacity-60">
            {busy ? t('booking') : `${t('confirm')} · Rs ${fee.toLocaleString('en-US')}`}
          </button>
          <button type="button" onClick={() => setView('idle')} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold">
            {t('back')}
          </button>
        </div>
      </form>
    );
  }

  // ---- Idle: the Book button ----
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono font-semibold" dir="ltr">
        Rs {fee.toLocaleString('en-US')}
      </span>
      <button
        onClick={() => setView('form')}
        disabled={status === 'CLOSED'}
        className="rounded-lg bg-accent px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === 'CLOSED' ? t('closed') : t('book')}
      </button>
    </div>
  );
}
