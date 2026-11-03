export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, { cache: 'no-store', ...init });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
  return res.json() as Promise<T>;
}

export interface ClinicProfile {
  name: string;
  address: string;
  phone: string | null;
  brandColor: string;
  doctors: {
    id: string;
    name: string;
    nameUr: string | null;
    specialty: string;
    specialtyUr: string | null;
    qualifications: string;
    fee: number;
    minutesPerPatient: number;
    status: string;
  }[];
}

export interface PublicQueue {
  doctorId: string;
  status: 'AVAILABLE' | 'BREAK' | 'CLOSED';
  minutesPerPatient: number;
  nowServing: string | null; // the token actually in the room, or null when nobody is
  lastServed: string | null; // most recently finished token, by finish time
  waiting: { token: string; sortOrder: number }[];
}
