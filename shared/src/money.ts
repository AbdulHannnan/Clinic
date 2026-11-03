import { QueueStatus } from './enums';

/** All amounts are whole Pakistani rupees. */
export interface Charge {
  status: QueueStatus;
  fee: number;
  discount: number;
  paid: number;
  refunded: number;
}

/** What this visit should cost. Cancelled visits cost nothing; a no-show keeps whatever was paid. */
export function netCharge(c: Charge): number {
  if (c.status === QueueStatus.CANCELLED) return 0;
  if (c.status === QueueStatus.NO_SHOW) return c.paid - c.refunded;
  return Math.max(0, c.fee - c.discount);
}

/** > 0: still to collect. < 0: owed back to the patient. */
export function balance(c: Charge): number {
  return netCharge(c) - c.paid + c.refunded;
}
