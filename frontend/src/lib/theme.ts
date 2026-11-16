// Light / dark / system theme, chosen by the user and remembered in this browser.
// 'system' follows the OS (prefers-color-scheme); 'light'/'dark' pin the theme via a
// data-theme attribute on <html> that globals.css reads.

export type Theme = 'light' | 'dark' | 'system';

export const THEME_KEY = 'clinic_theme';
export const THEMES: Theme[] = ['system', 'light', 'dark'];

/** The stored choice, or 'system' when nothing is set (or storage is unavailable). */
export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

/** Apply a theme now (sets/clears data-theme on <html>) and remember it. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  try {
    if (theme === 'system') window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage blocked (private mode): the choice holds for this page view but won't persist.
  }
}

/**
 * Runs before first paint (inlined at the top of <body>) so the saved theme is applied without a flash.
 * Kept tiny and defensive: any failure just leaves the OS preference in charge.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}`;
