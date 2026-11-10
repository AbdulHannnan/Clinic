export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  // Default to no-store for live data; callers opt into caching via `cache` or Next's `next`.
  const cacheHinted = !!init && ('cache' in init || 'next' in init);
  const res = await fetch(`${API_URL}/api${path}`, { ...(cacheHinted ? {} : { cache: 'no-store' }), ...init });
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

export type StaffRole = 'ADMIN' | 'DOCTOR' | 'MANAGEMENT';

export interface StaffPrincipal {
  id: string;
  role: StaffRole;
  name: string;
  doctorId: string | null;
}

export interface LoginResponse {
  token: string;
  staff: StaffPrincipal;
}

export type QueueEntryType = 'ONLINE' | 'WALKIN' | 'EMERGENCY';
export type QueueEntryStatus = 'WAITING' | 'IN_ROOM' | 'DONE' | 'NO_SHOW' | 'CANCELLED';

export interface StaffQueueEntry {
  id: string;
  token: string;
  name: string;
  type: QueueEntryType;
  status: QueueEntryStatus;
  arrived: boolean;
  sortOrder: number;
  symptoms: string | null;
}

export interface StaffQueue {
  doctorId: string;
  clinicName: string | null;
  doctor: {
    id: string;
    name: string;
    nameUr: string | null;
    specialty: string;
    specialtyUr: string | null;
    qualifications: string;
  };
  status: 'AVAILABLE' | 'BREAK' | 'CLOSED';
  minutesPerPatient: number;
  seenToday: number;
  waitingCount: number;
  current: StaffQueueEntry | null;
  upNext: StaffQueueEntry[];
}

export interface DeskEntry {
  id: string;
  token: string;
  name: string;
  phone: string;
  type: QueueEntryType;
  status: QueueEntryStatus;
  arrived: boolean;
  fee: number;
  discount: number;
  paid: number;
  refunded: number;
  balance: number;
}

export interface DeskQueue {
  doctorId: string;
  clinicName: string | null;
  doctor: { id: string; name: string; nameUr: string | null; specialty: string; specialtyUr: string | null };
  status: 'AVAILABLE' | 'BREAK' | 'CLOSED';
  minutesPerPatient: number;
  nowServing: DeskEntry | null;
  waitingCount: number;
  onlineWaiting: number;
  walkinWaiting: number;
  entries: DeskEntry[];
}

export interface WalkInInput {
  name: string;
  phone: string;
  age?: number;
  symptoms?: string;
  emergency?: boolean;
}

export interface FinanceSummary {
  day: string;
  patients: number;
  collected: number;
  discount: number;
  due: number;
  toRefund: number;
  byMethod: { CASH: number; CARD: number; ONLINE: number };
}

export interface BookInput {
  name: string;
  phone: string;
  symptoms?: string;
  age?: number;
  payAtClinic?: boolean;
}

export interface BookResult {
  id: string;
  doctorId: string;
  token: string;
  fee: number;
  payAtClinic: boolean;
}

export interface BookingTrack {
  id: string;
  doctorId: string;
  token: string;
  status: QueueEntryStatus;
  arrived: boolean;
  type: QueueEntryType;
  aheadCount: number;
  nowServing: string | null;
  minutesPerPatient: number;
  doctorStatus: 'AVAILABLE' | 'BREAK' | 'CLOSED';
}

export interface PublicQueue {
  doctorId: string;
  status: 'AVAILABLE' | 'BREAK' | 'CLOSED';
  minutesPerPatient: number;
  nowServing: string | null; // the token actually in the room, or null when nobody is
  lastServed: string | null; // most recently finished token, by finish time
  waiting: { token: string; sortOrder: number }[];
}
