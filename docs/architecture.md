# Architecture

## One copy per doctor
Every doctor gets their own deployment: frontend, backend and a separate PostgreSQL database,
on their own domain with their own name, logo and colours. Data never mixes between doctors.
All copies run the **same code**; only the environment file differs (`infra/clinics/example.env`).
A bug fix or new feature is released to every doctor at once.

Tables still carry `doctorId`, so a clinic with two doctors can share one copy later.

## Pieces

| Part | Tech | Job |
|---|---|---|
| `frontend` | Next.js 15, React 19, Tailwind 4, next-intl | Patient pages, management desk, doctor's room. `/en` and `/ur` (right-to-left). |
| `backend` | NestJS 11, Prisma 6, PostgreSQL 17 | REST API under `/api`, Socket.IO for live updates, daily cron for reminders. |
| `shared` | TypeScript | Rules both sides must agree on: patients ahead, wait estimate, emergency placement, fee balance, reminder timing. |

## Real time
The backend pushes changes over Socket.IO. Each doctor has two rooms:
- `public:<doctorId>`: patients at home. Only tokens, counts and status. Never names, never emergencies.
- `staff:<doctorId>`: management and the doctor.

## Rules carried over from the prototype
- One queue. Online, walk-in (next number) and emergency (hidden from the public; public sees "On break" while one is inside).
- Reminder when 3 patients are before someone. Arrival window ±5 minutes.
- Time per patient is set by the doctor or management; estimates follow it.
- Discounts are set by the doctor with a reason. A discount after online payment creates a refund.
- Long-term plans (diabetes, TB...): reminders 2 days before, on the day, and the day after a missed visit.

## Privacy and security
- Medical history, allergies and visit notes are encrypted in the app (AES-256-GCM) before they are saved.
  The key lives only in that doctor's environment (`DATA_ENCRYPTION_KEY`).
- The doctor's screen shows history as view-only; there is no download or export of medical data.
- `AuditLog` records payments, discounts, refunds and every view of medical history, with who and when.
- Staff login and role checks (doctor / management / admin) come in Phase 1; staff endpoints are marked `TODO(auth)` until then.

## Messages
`NotificationsService` sends one message on WhatsApp, SMS and app, records each attempt, and uses a
`dedupeKey` so a reminder never goes out twice. Providers are swappable: `log` (prints, for development)
now; Meta WhatsApp Cloud API and a Pakistani SMS aggregator later. WhatsApp needs Meta-approved templates.

## Money
Whole rupees. Each queue entry has `fee` and `discount`; `Payment` rows record money in (PAYMENT) and out
(REFUND) with method (cash, card, online). Balances are computed with `shared/src/money.ts`.
