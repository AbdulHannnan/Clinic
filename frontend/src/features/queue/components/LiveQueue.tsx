'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { RealtimeEvent } from '@clinic/shared';
import type { PublicQueue } from '@/lib/api';
import { getSocket } from '@/lib/socket';

const statusClass = { AVAILABLE: 'bg-ok/15 text-ok', BREAK: 'bg-warn/15 text-warn', CLOSED: 'bg-surface-2 text-muted' };

/** Now serving + waiting count, updated live from the clinic. */
export function LiveQueue({ initial }: { initial: PublicQueue }) {
  const t = useTranslations('Queue');
  const [q, setQ] = useState(initial);

  useEffect(() => {
    const socket = getSocket();
    const join = () => socket.emit('join', `public:${initial.doctorId}`);
    join();
    socket.on('connect', join);
    socket.on(RealtimeEvent.QUEUE_UPDATED, setQ);
    return () => {
      socket.off('connect', join);
      socket.off(RealtimeEvent.QUEUE_UPDATED, setQ);
    };
  }, [initial.doctorId]);

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-xl bg-surface-2 px-3 py-2">
        <div className="text-xs font-bold uppercase text-muted">{t('nowServing')}</div>
        <div className="font-mono text-3xl font-semibold" dir="ltr">
          {q.nowServing ? `#${q.nowServing}` : '–'}
        </div>
      </div>
      <div className="rounded-xl bg-surface-2 px-3 py-2">
        <div className="text-xs font-bold uppercase text-muted">{t('waiting')}</div>
        <div className="font-mono text-3xl font-semibold">{q.waiting.length}</div>
      </div>
      <span className={`col-span-2 justify-self-start rounded-full px-3 py-1 text-xs font-bold ${statusClass[q.status]}`}>{t(`status.${q.status}`)}</span>
    </div>
  );
}
