'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { login, staffHome } from '@/lib/auth';

/** Staff login: phone + password in exchange for the token the doctor's room and desk carry. */
export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations('Auth');
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await login(phone.trim(), password);
      // No explicit target given: send each role to the screen it works from.
      router.push(next ?? staffHome(session.staff.role));
    } catch (err) {
      setError((err as Error).message === 'INVALID' ? t('invalid') : t('failed'));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold">{t('phone')}</span>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="username"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          dir="ltr"
          className="rounded-lg border border-line bg-surface px-3 py-2 font-mono"
          placeholder="03000000000"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold">{t('password')}</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="rounded-lg border border-line bg-surface px-3 py-2"
        />
      </label>
      {error && <p className="text-sm font-semibold text-emergency">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-accent px-4 py-2 font-semibold text-white disabled:opacity-60"
      >
        {busy ? t('signingIn') : t('signIn')}
      </button>
    </form>
  );
}
