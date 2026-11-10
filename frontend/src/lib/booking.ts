import { api, type BookInput, type BookResult, type BookingTrack } from './api';

// Patients have no login: their own booking (the capability id + token) lives in this browser only.
const key = (doctorId: string) => `clinic_booking_${doctorId}`;

export interface StoredBooking {
  id: string;
  token: string;
}

export function getStoredBooking(doctorId: string): StoredBooking | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key(doctorId));
    return raw ? (JSON.parse(raw) as StoredBooking) : null;
  } catch {
    return null;
  }
}

export function saveBooking(doctorId: string, booking: StoredBooking): void {
  try {
    window.localStorage.setItem(key(doctorId), JSON.stringify(booking));
  } catch {
    // Storage blocked: the booking still exists server-side; the patient just can't track it here.
  }
}

export function clearBooking(doctorId: string): void {
  try {
    window.localStorage.removeItem(key(doctorId));
  } catch {
    // Nothing to clear.
  }
}

export const book = (doctorId: string, input: BookInput) =>
  api<BookResult>(`/queue/${doctorId}/book`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });

export const trackBooking = (entryId: string) => api<BookingTrack>(`/queue/entry/${entryId}`);
export const markArrived = (entryId: string) => api<BookingTrack>(`/queue/entry/${entryId}/arrived`, { method: 'POST' });
export const cancelBooking = (entryId: string) => api<BookingTrack>(`/queue/entry/${entryId}/cancel`, { method: 'POST' });
