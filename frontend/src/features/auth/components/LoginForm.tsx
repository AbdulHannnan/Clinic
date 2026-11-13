'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { login, staffHome } from '@/lib/auth';
import { patientLogin } from '@/lib/patientAuth';

// The three sign-in boxes. This is only a visual picker: the real role comes from the account,
// so the choice here just tailors the heading — it is never sent to the API.
type RoleKey = 'patient' | 'reception' | 'doctor';

const ROLES: { key: RoleKey; icon: string }[] = [
  { key: 'patient', icon: '👤' },
  { key: 'reception', icon: '🗂️' },
  { key: 'doctor', icon: '🩺' },
];

/** Staff login: pick who is signing in, then phone + password in exchange for the staff token. */
export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations('Auth');
  const router = useRouter();
  const [role, setRole] = useState<RoleKey | null>(null);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (role === 'patient') {
        // Patients sign in to their own portal, not the staff screens.
        await patientLogin(phone.trim(), password);
        router.push('/patient');
        return;
      }
      const session = await login(phone.trim(), password);
      // No explicit target given: send each role to the screen it works from.
      router.push(next ?? staffHome(session.staff.role));
    } catch (err) {
      setError((err as Error).message === 'INVALID' ? t('invalid') : t('failed'));
      setBusy(false);
    }
  }

  // Step 1 — choose who is signing in.
  if (!role) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold">{t('chooseRole')}</p>
        <div className="flex flex-col gap-2">
          {ROLES.map(({ key, icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setRole(key)}
              className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-start transition hover:border-accent hover:bg-surface-2"
            >
              <span className="text-2xl" aria-hidden>
                {icon}
              </span>
              <span className="flex flex-col">
                <span className="font-semibold">{t(roleLabel(key))}</span>
                <span className="text-xs text-muted">{t(roleHint(key))}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Step 2 — credentials for the chosen role.
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => {
          setRole(null);
          setError(null);
        }}
        className="flex items-center gap-1 self-start text-sm font-semibold text-muted hover:text-ink"
      >
        <span aria-hidden>←</span> {t('back')}
      </button>
      <p className="text-sm font-semibold">{t(roleLabel(role))}</p>
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

function roleLabel(key: RoleKey): 'rolePatient' | 'roleReception' | 'roleDoctor' {
  return key === 'patient' ? 'rolePatient' : key === 'reception' ? 'roleReception' : 'roleDoctor';
}

function roleHint(key: RoleKey): 'rolePatientHint' | 'roleReceptionHint' | 'roleDoctorHint' {
  return key === 'patient' ? 'rolePatientHint' : key === 'reception' ? 'roleReceptionHint' : 'roleDoctorHint';
}
