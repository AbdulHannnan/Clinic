import { API_URL, type LoginResponse, type StaffPrincipal, type StaffRole } from './api';

/** Where a staff member lands after signing in: a doctor opens the room, everyone else the desk. */
export function staffHome(role: StaffRole): '/doctor' | '/reception' {
  return role === 'DOCTOR' ? '/doctor' : '/reception';
}

// Staff session lives in localStorage: a browser-only store, so every access is guarded for SSR.
const KEY = 'clinic_staff_session';

export interface StaffSession {
  token: string;
  staff: StaffPrincipal;
}

export function getSession(): StaffSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StaffSession) : null;
  } catch {
    return null;
  }
}

export function setSession(session: StaffSession): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Private mode or blocked storage: the session simply won't persist across reloads.
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

/** Exchange phone + password for a token. Throws on bad credentials so callers can show the message. */
export async function login(phone: string, password: string): Promise<StaffSession> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });
  if (!res.ok) throw new Error(res.status === 401 ? 'INVALID' : `HTTP ${res.status}`);
  const data = (await res.json()) as LoginResponse;
  const session: StaffSession = { token: data.token, staff: data.staff };
  setSession(session);
  return session;
}

/** fetch against the API with the staff bearer token attached. Throws 'UNAUTHORIZED' on 401. */
export async function authedApi<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    cache: 'no-store',
    ...init,
    headers: { ...(init?.headers ?? {}), authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
  return res.json() as Promise<T>;
}
