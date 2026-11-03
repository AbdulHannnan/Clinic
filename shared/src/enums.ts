// Mirrors the enums in backend/prisma/schema.prisma. Keep both in sync.
export const QueueType = { ONLINE: 'ONLINE', WALKIN: 'WALKIN', EMERGENCY: 'EMERGENCY' } as const;
export type QueueType = (typeof QueueType)[keyof typeof QueueType];

export const QueueStatus = {
  WAITING: 'WAITING',
  IN_ROOM: 'IN_ROOM',
  DONE: 'DONE',
  NO_SHOW: 'NO_SHOW',
  CANCELLED: 'CANCELLED',
} as const;
export type QueueStatus = (typeof QueueStatus)[keyof typeof QueueStatus];

export const DoctorStatus = { AVAILABLE: 'AVAILABLE', BREAK: 'BREAK', CLOSED: 'CLOSED' } as const;
export type DoctorStatus = (typeof DoctorStatus)[keyof typeof DoctorStatus];

export const PaymentMethod = { CASH: 'CASH', CARD: 'CARD', ONLINE: 'ONLINE' } as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const StaffRole = { ADMIN: 'ADMIN', DOCTOR: 'DOCTOR', MANAGEMENT: 'MANAGEMENT' } as const;
export type StaffRole = (typeof StaffRole)[keyof typeof StaffRole];

/** Realtime events pushed to every screen (patient, management, doctor). */
export const RealtimeEvent = {
  QUEUE_UPDATED: 'queue.updated',
  DOCTOR_STATUS: 'doctor.status',
} as const;

export const PaymentKind = { PAYMENT: 'PAYMENT', REFUND: 'REFUND' } as const;
export type PaymentKind = (typeof PaymentKind)[keyof typeof PaymentKind];
