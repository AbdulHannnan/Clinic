'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { RealtimeEvent } from '@clinic/shared';
import { api, type PublicQueue } from '@/lib/api';
import { getSocket } from '@/lib/socket';

const statusClass = { AVAILABLE: 'bg-ok/15 text-ok', BREAK: 'bg-warn/15 text-warn', CLOSED: 'bg-surface-2 text-muted' };

/** Now serving + waiting count, updated live from the clinic. */
export function LiveQueue({ initial }: { initial: PublicQueue }) {
  const t = useTranslations('Queue');
  const [q, setQ] = useState(initial);

  useEffect(() => {
    const socket = getSocket();
    const join = () => socket.emit('join', `public:${initial.doctorId}`);
    // On every (re)connect, rejoin and pull the current state: pushes can be missed while disconnected
    // and the SSR snapshot goes stale between render and the socket connecting.
    const refresh = async () => {
      join();
      try {
        setQ(await api<PublicQueue>(`/queue/${initial.doctorId}/public`));
      } catch {
        // Keep the last known queue if the refetch fails; the next push will correct it.
      }
    };
    join();
    socket.on('connect', refresh);
    socket.on(RealtimeEvent.QUEUE_UPDATED, setQ);
    return () => {
      socket.off('connect', refresh);
      socket.off(RealtimeEvent.QUEUE_UPDATED, setQ);
    };
  }, [initial.doctorId]);

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-xl bg-surface-2 px-3 py-2">
        <div className="text-xs font-bold uppercase text-muted">{t('nowServing')}</div>
        {q.nowServing ? (
          <div className="font-mono text-3xl font-semibold" dir="ltr">
            #{q.nowServing}
          </div>
        ) : (
          <div>
            <div className="text-lg font-semibold text-muted">{t('noneYet')}</div>
            {q.lastServed && (
              <div className="text-xs text-muted" dir="ltr">
                {t('lastServed', { token: q.lastServed })}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="rounded-xl bg-surface-2 px-3 py-2">
        <div className="text-xs font-bold uppercase text-muted">{t('waiting')}</div>
        <div className="font-mono text-3xl font-semibold">{q.waiting.length}</div>
      </div>
      <span className={`col-span-2 justify-self-start rounded-full px-3 py-1 text-xs font-bold ${statusClass[q.status]}`}>{t(`status.${q.status}`)}</span>
    </div>
  );
}
