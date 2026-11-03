import { DoctorStatus, QueueStatus, QueueType } from './enums';

export interface QueueItem {
  sortOrder: number;
  type: QueueType;
  status: QueueStatus;
}

/** Arrival window cushion either side of the estimated time. */
export const ARRIVAL_CUSHION_MIN = 5;
/** Reminder goes out when this many patients are before someone. */
export const REMIND_WHEN_AHEAD = 3;
/** Extra minutes added to estimates while the doctor is on break. */
export const BREAK_BUFFER_MIN = 10;

const waiting = (q: QueueItem[]) => q.filter((x) => x.status === QueueStatus.WAITING);

/** What the public sees: emergencies are hidden. */
export function patientsAheadPublic(queue: QueueItem[], me: QueueItem): number {
  return waiting(queue).filter((x) => x.sortOrder < me.sortOrder && x.type !== QueueType.EMERGENCY).length;
}

/** Real doctor time ahead, including hidden emergencies. */
export function patientsAheadAll(queue: QueueItem[], me: QueueItem): number {
  return waiting(queue).filter((x) => x.sortOrder < me.sortOrder).length;
}

/** While an emergency patient is inside, the public sees the doctor as on break. */
export function publicDoctorStatus(status: DoctorStatus, queue: QueueItem[]): DoctorStatus {
  if (status === DoctorStatus.CLOSED) return status;
  const inRoom = queue.find((x) => x.status === QueueStatus.IN_ROOM);
  return status === DoctorStatus.BREAK || inRoom?.type === QueueType.EMERGENCY ? DoctorStatus.BREAK : DoctorStatus.AVAILABLE;
}

/** Minutes until `me` is likely called. */
export function estimateWaitMinutes(queue: QueueItem[], me: QueueItem, minutesPerPatient: number, status: DoctorStatus): number {
  const someoneInRoom = queue.some((x) => x.status === QueueStatus.IN_ROOM);
  return (
    patientsAheadAll(queue, me) * minutesPerPatient +
    (someoneInRoom ? Math.round(minutesPerPatient / 2) : 0) +
    (status === DoctorStatus.BREAK ? BREAK_BUFFER_MIN : 0)
  );
}

/** Sort position for a new emergency: after the patient in the room and earlier emergencies, before everyone else. */
export function emergencySortOrder(queue: QueueItem[]): number {
  const wl = waiting(queue).sort((a, b) => a.sortOrder - b.sortOrder);
  const inRoom = queue.find((x) => x.status === QueueStatus.IN_ROOM);
  const firstNormal = wl.find((x) => x.type !== QueueType.EMERGENCY);
  const lastEmergency = wl.filter((x) => x.type === QueueType.EMERGENCY && (!firstNormal || x.sortOrder < firstNormal.sortOrder)).pop();
  const lo = lastEmergency?.sortOrder ?? inRoom?.sortOrder ?? (firstNormal ? firstNormal.sortOrder - 1 : 0);
  const hi = firstNormal?.sortOrder ?? lo + 2;
  return (lo + hi) / 2;
}

/** The clinic's calendar day as a UTC-midnight Date, which is how a Postgres DATE column stores it. */
export function clinicDay(at: Date = new Date()): Date {
  return new Date(Date.UTC(at.getFullYear(), at.getMonth(), at.getDate()));
}
