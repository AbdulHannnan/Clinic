'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { getSession } from '@/lib/auth';

const links = [
  { href: '/reception', key: 'reception' },
  { href: '/doctor', key: 'doctor' },
] as const;

/**
 * Switch between the management desk and the doctor's room. Every staff role may open both screens
 * (the API guards them for all staff), so both links show once signed in; the current one is marked.
 * Renders nothing until mounted with a session, so it stays off the login and patient pages.
 */
export function StaffNav() {
  const t = useTranslations('Staff');
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);

  // localStorage is browser-only; read it after mount to avoid an SSR/first-paint mismatch.
  useEffect(() => setSignedIn(!!getSession()), [pathname]);

  if (!signedIn) return null;

  return (
    <nav className="mb-4 flex gap-2" aria-label={t('reception')}>
      {links.map(({ href, key }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${active ? 'bg-accent text-white' : 'border border-line bg-surface'}`}
          >
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
