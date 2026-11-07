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
  const lo = lastEmergency?.sortOrder ?? inRoom?.sortOrder ?? (firstNormal ? firstNormal.sortOrder - SORT_STEP : 0);
  const hi = firstNormal?.sortOrder ?? lo + 2 * SORT_STEP;
  return (lo + hi) / 2;
}

/**
 * Wide, even integer spacing for fresh sort positions. Emergencies and skips are slotted between
 * neighbors by midpoint (`emergencySortOrder`), which halves the gap each time; starting from a wide
 * integer step leaves plenty of room before floats get close enough to collide.
 */
export const SORT_STEP = 1000;

/**
 * True when two adjacent waiting entries sit so close that the next midpoint insert between them risks
 * a float collision. The queue write path checks this and calls `rebalanceSortOrders` when it trips.
 */
export function needsRebalance(queue: QueueItem[], minGap = 1e-6): boolean {
  const orders = waiting(queue)
    .map((x) => x.sortOrder)
    .sort((a, b) => a - b);
  for (let i = 1; i < orders.length; i++) if (orders[i] - orders[i - 1] < minGap) return true;
  return false;
}

/**
 * Fresh, evenly spaced integer sort positions for `count` entries already in their intended order:
 * `[SORT_STEP, 2*SORT_STEP, ...]`. Reassigning positions with this — at the start of a day, or once
 * `needsRebalance` trips — restores wide gaps so there is always room to insert between any two entries.
 */
export function rebalanceSortOrders(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i + 1) * SORT_STEP);
}

/** The clinic's time zone. One deployment serves one clinic; override per deployment if needed. */
export const CLINIC_TIME_ZONE = 'Asia/Karachi';

/**
 * The clinic's calendar day as a UTC-midnight Date, which is how a Postgres DATE column stores it.
 * The date is resolved in an explicit IANA time zone via Intl, so it never depends on the server's
 * local time (an unset/UTC `TZ` used to roll the day over at the wrong hour).
 */
export function clinicDay(at: Date = new Date(), timeZone: string = CLINIC_TIME_ZONE): Date {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const part = (type: 'year' | 'month' | 'day') => Number(parts.find((p) => p.type === type)!.value);
  return new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
}
