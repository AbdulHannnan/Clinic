import { API_URL, type PatientLoginResponse, type PatientPrincipal } from './api';

// Patient session is stored separately from the staff session so the two never collide in one browser.
const KEY = 'clinic_patient_session';

export interface PatientSession {
  token: string;
  patient: PatientPrincipal;
}

export function getPatientSession(): PatientSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PatientSession) : null;
  } catch {
    return null;
  }
}

export function setPatientSession(session: PatientSession): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Private mode or blocked storage: the session simply won't persist across reloads.
  }
}

export function clearPatientSession(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

/** Exchange phone + password for a patient token. Throws 'INVALID' on bad credentials. */
export async function patientLogin(phone: string, password: string): Promise<PatientSession> {
  const res = await fetch(`${API_URL}/api/auth/patient/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });
  if (!res.ok) throw new Error(res.status === 401 ? 'INVALID' : `HTTP ${res.status}`);
  const data = (await res.json()) as PatientLoginResponse;
  const session: PatientSession = { token: data.token, patient: data.patient };
  setPatientSession(session);
  return session;
}
