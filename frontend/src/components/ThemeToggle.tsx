'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { applyTheme, getStoredTheme, THEMES, type Theme } from '@/lib/theme';

/** Cycles System → Light → Dark, remembering the choice. Matches LanguageSwitch in size and shape. */
export function ThemeToggle() {
  const t = useTranslations('Common');
  const [theme, setTheme] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);

  // Read the stored choice after mount (localStorage is browser-only); the pre-paint
  // script in the layout has already applied it, so this only syncs the button's label.
  useEffect(() => {
    setTheme(getStoredTheme());
    setMounted(true);
  }, []);

  function cycle() {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    setTheme(next);
    applyTheme(next);
  }

  // Render a stable label until mounted to avoid a hydration mismatch.
  const current = mounted ? theme : 'system';

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={t('theme', { mode: t(`theme_${current}`) })}
      title={t('theme', { mode: t(`theme_${current}`) })}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold"
    >
      <ThemeIcon theme={current} />
      <span>{t(`theme_${current}`)}</span>
    </button>
  );
}

function ThemeIcon({ theme }: { theme: Theme }) {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (theme === 'light') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }
  if (theme === 'dark') {
    return (
      <svg {...common}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    );
  }
  // system: a half-filled circle
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" />
    </svg>
  );
}
