# Code Review & Improvement Plan

A full review of the current codebase (Phase 0 foundation, early Phase 1). Findings are grouped by
theme and tagged by severity:

- 🔴 **High** — security/correctness risk; address before real patient data or production.
- 🟠 **Medium** — should fix before the feature it touches ships.
- 🟡 **Low** — polish, hardening, or future-proofing.

Many items are *expected gaps* for this stage (auth, staff screens, write endpoints). They're listed
anyway so the plan is complete, but flagged as "planned" where the roadmap already covers them.

---

## 1. Security

### 🔴 No authentication or authorization (planned — Phase 1)
Every endpoint and socket room is open. `GET /api/finance/:doctorId/today`
(`backend/src/modules/payments/payments.controller.ts:4`) exposes revenue with only a `TODO(auth)`.
The socket `join` handler (`backend/src/modules/realtime/realtime.gateway.ts:15`) lets **any** client
join `staff:<doctorId>` — the format regex validates shape, not identity.
- Add the staff auth module (phone + password → JWT/session), a `RolesGuard`, and a WS auth guard that
  rejects `staff:*` joins without a valid staff token. Keep `public:*` open.

### 🔴 CORS falls back to "allow all" when `FRONTEND_URL` is unset
`backend/src/main.ts:8` and `realtime.gateway.ts:9` pass `origin: process.env.FRONTEND_URL`. If that
env var is missing, the `cors` package treats `origin: undefined` as *reflect any origin*. Combined
with no auth yet, that's wide open.
- Validate `FRONTEND_URL` in `config/env.ts` (fail fast), or default to a safe literal. Set
  `credentials: true` explicitly once cookies/sessions exist.

### 🔴 `AuditLog` is designed but never written
The schema (`backend/prisma/schema.prisma:210`) and `docs/architecture.md` promise an audit trail for
payments, discounts, refunds, and *every view of medical history*. No code writes an `AuditLog` row —
including `PatientsService.readHistory` (`backend/src/modules/patients/patients.service.ts:21`). For
medical data this is a compliance gap, not just a nicety.
- Write audit rows at every history decrypt and every money mutation, capturing actor, entity, and time.

### 🟠 No rate limiting / throttling
No `@nestjs/throttler`. Public endpoints (clinic profile, queue) and especially the future **phone OTP**
and booking flows (Phase 2) are abuse targets.
- Add global throttling now; add a stricter per-phone limit on OTP when it lands.

### 🟠 No security headers
No `helmet`. Add it to the Express adapter for HSTS, `X-Content-Type-Options`, frame options, etc.
Document TLS termination + HSTS in `docs/deployment.md`.

### 🟠 No input-validation DTOs yet
`ValidationPipe({ whitelist: true, transform: true })` is wired (`main.ts:9`) but there are no
`class-validator` DTOs because there are no write endpoints yet. Route params like `:doctorId` are
trusted raw.
- When write endpoints land, add DTOs with validation; validate `:doctorId` as a cuid.

### 🟡 Encryption key: no rotation path or secret manager
The key is read once from a plaintext env var at boot
(`backend/src/common/crypto/encryption.service.ts:13`). The whole privacy model rests on it, yet there's
no rotation story and no key-version marker in the stored blob (see §3). For production, source the key
from a secrets manager / KMS rather than a committed-adjacent `.env`.

### 🟡 Secrets hygiene (currently OK)
`.gitignore` correctly excludes `.env`, `.env.*`, and `infra/clinics/*.env` while keeping the
`.example` files. `.env.example` ships an empty `DATA_ENCRYPTION_KEY=`. Good — keep it that way.

---

## 2. Correctness / Working

### 🔴 `clinicDay()` depends on the server's local timezone
`shared/src/queue.ts:57` builds the "clinic day" from `at.getFullYear()/getMonth()/getDate()` (local
time) wrapped in `Date.UTC(...)`, then stores it in a Postgres `DATE` column. Correctness is coupled to
the Node process TZ (`TZ=Asia/Karachi` in `.env.example:11`). If TZ is unset/UTC on any host, "today"
rolls over at 05:00 PKT and splits a clinic's day across two `day` values.
- Derive the clinic day from an **explicit clinic timezone** (store it in `ClinicSettings`), not from
  `process.env.TZ`. Compute with a TZ-aware library or `Intl` offset.

### 🟠 Dedupe is a check-then-insert race
`NotificationsService.send` (`backend/src/modules/notifications/notifications.service.ts:21`) does
`findUnique(dedupeKey)` then `create(...)`. Two concurrent sends with the same key both pass the check,
then the second `create` throws an **uncaught** `P2002` on the unique constraint.
- Rely on the DB constraint: `try { create } catch (P2002) { skip }`, or use `upsert` / `createMany`
  with `skipDuplicates`.

### 🟠 `nowServing` can mislead patients
`QueueService.publicView` (`backend/src/modules/queue/queue.service.ts:28`) falls back to the last
`DONE` token when no one is in the room, labeling it "now serving". It also picks `lastDone` by
`sortOrder` order, not by `finishedAt`, so it isn't reliably the most recently served.
- Show a distinct "waiting for next patient" state; order DONE by `finishedAt` if you must show a last token.

### 🟠 Patient page implies multi-doctor but only wires doctor[0]
`frontend/src/app/[locale]/page.tsx:17` fetches the queue only for `clinic.doctors[0].id`, yet maps over
*all* doctors and renders `<LiveQueue>` only when `queue.doctorId === d.id` (`page.tsx:42`). Any second
doctor shows no live queue. Fine for one-doctor-per-deployment today, but the loop is misleading.
- Either fetch a queue per doctor, or render for the single doctor explicitly.

### 🟠 No refetch on socket (re)connect
`LiveQueue` (`frontend/src/features/queue/components/LiveQueue.tsx:15`) joins on connect and then waits
for the next server push. Between SSR and connect, or after a reconnect, the view is stale until
something changes. Staff screens get only a `{ doctorId }` nudge and must refetch — not yet built.
- On `connect`/reconnect, refetch the current public view (and have staff screens refetch on nudge).

### 🟡 Fractional `sortOrder` precision
`emergencySortOrder` (`shared/src/queue.ts:46`) halves the gap between neighbors on each insert. After
many insertions between the same two integers, floats collide. Harmless at a day's volume, but a
gap-based integer scheme or periodic rebalance is sturdier. Add tests for empty-queue and
all-emergency cases.

### 🟡 Treatment-plan lifecycle is incomplete (planned — Phase 4)
The cron sends reminders (`backend/src/modules/treatment-plans/treatment-plans.service.ts:21`) but
nothing advances `nextVisit`, increments `visitsDone`, or flips `status` to `COMPLETED`. MISSED
reminders are correctly deduped to once per `nextVisit`, but a plan never progresses. Expected for now —
track it.

### 🟡 No transactions around future multi-step writes
"Call next patient", payment+refund, and visit+prescription will each touch multiple rows. Wrap them in
`prisma.$transaction` when built.

---

## 3. Encryption

The AES-256-GCM implementation itself is **correct**: fresh random 12-byte IV per encrypt, auth tag
stored, `IV|tag|ciphertext` layout (`backend/src/common/crypto/encryption.service.ts`). Improvements:

### 🟠 No version/algorithm marker in the blob
Rotation or an algorithm change is impossible without a migration flag, because nothing distinguishes
one key/scheme from another.
- Prefix a 1-byte version to the stored blob (e.g. `0x01 | IV | tag | ciphertext`) so future keys/schemes
  can coexist during rotation.

### 🟠 `allergiesEnc` is dead
The schema has `allergiesEnc` (`schema.prisma:70`) but `PatientsService` only reads/writes `historyEnc`.
Allergy data is never encrypted-stored or surfaced.
- Add set/read methods for allergies (and audit the reads).

### 🟡 No AAD binding
GCM supports additional authenticated data. Binding ciphertext to context (e.g. `patientId` + field
name) prevents a blob being moved between records.

### 🟡 Decrypt errors are unhandled
`decrypt` throws on a wrong key or tampered blob; `readHistory` doesn't catch it, so a corrupt/foreign
blob becomes a 500.
- Catch, log/audit, and return a graceful "unavailable" to the doctor's view.

---

## 4. Performance / Optimization

### 🟠 Staff "nudge then everyone refetches" thundering herd
`RealtimeGateway.queueChanged` (`realtime.gateway.ts:21`) sends staff only `{ doctorId }`, so every staff
client refetches on each change. On a busy desk that multiplies queries.
- Send the staff payload directly over the socket, as the public room already does.

### 🟡 `publicView` uses two queries
`queue.service.ts` fetches the doctor and the entries separately — collapse into one `findUnique` with a
scoped `include`/relation query.

### 🟡 `daySummary` aggregates in JS
`payments.service.ts:12` loads every entry+payment for the day and reduces in memory. Fine at clinic
scale; revisit with SQL aggregation if volumes grow.

### 🟡 Urdu font loads on English pages
`Noto_Nastaliq_Urdu` is loaded unconditionally (`frontend/src/app/[locale]/layout.tsx:10`). Load it only
for `ur` to trim the English payload.

### 🟡 Clinic branding fetched with `no-store`
`frontend/src/lib/api.ts:5` disables caching for all calls. Correct for the live queue; the static
clinic profile could use `revalidate` instead.

---

## 5. Testing

Current coverage: `shared/src/queue.test.ts` (4 tests) and `backend/test/encryption.test.ts` (1 test).
That's thin for the amount of business logic.

### 🟠 Untested core logic
- `money.ts`: `netCharge` branches for `CANCELLED` and `NO_SHOW` are never asserted (only one `balance`
  case is).
- `queue.ts`: `estimateWaitMinutes`, `publicDoctorStatus` (BREAK/CLOSED paths), `clinicDay`,
  `patientsAheadPublic` with multiple emergencies.
- `treatment.ts`: `planTotalVisits`, `planEndDate`, `addMonths`.
- Services: `QueueService.publicView`, `PaymentsService.daySummary`, `NotificationsService` dedupe,
  `TreatmentPlansService` cron.

### 🟠 CI spins up Postgres but no test uses it
`.github/workflows/ci.yml` starts `postgres:17` and runs `prisma migrate deploy`, but `npm test` only
runs DB-free unit tests — so the DB only validates that migrations apply.
- Add Prisma-backed service/e2e tests (seed a test DB, assert `publicView`/`daySummary` end to end).

### 🟡 No coverage gate and no frontend tests
Add a coverage tool (`c8`) with a threshold, and at least a smoke/render test for `LiveQueue` and the
patient page.

---

## 6. Tooling, DX & Housekeeping

### 🟠 No linting
No ESLint/Prettier config and no lint step in CI (only `.editorconfig`). Add ESLint + Prettier and a
`lint` job so style/error rules are enforced on every push.

### 🟠 Enum duplication drifts
Enums are hand-mirrored between `backend/prisma/schema.prisma` and `shared/src/enums.ts` with a
"keep in sync" comment — and they already differ (`shared/enums.ts` omits `Gender`, `Lang`, `StaffRole`,
`PresetKind`, `Channel`, `NotificationKind`, `DiscountReason`; `TreatmentCondition` lives separately in
`treatment.ts`).
- Generate shared enums from Prisma, or add a test asserting parity between the two.

### 🟡 Stray duplicate prototype
`clinicq-prototype.html` (untracked, repo root) duplicates `docs/prototype/prototype.html`. Remove it or
add to `.gitignore`.

### 🟡 No app Dockerfile / deploy automation (planned — Phase 5)
`infra/docker-compose.yml` only provisions Postgres for local dev; there's no Dockerfile for the
"one copy per doctor" backend/frontend deploy. `docs/deployment.md` is still a plan.

### 🟡 Observability
No structured logging, request IDs, or metrics. Health check (`/api/health`) is liveness-only. Add
request logging and a readiness signal before the pilot (Phase 5).

---

## Suggested order of attack

1. **Auth + guards + audit writes** (unblocks every staff feature and closes the two 🔴 security holes).
2. **Fix `clinicDay` timezone** and the **dedupe race** (silent data-correctness bugs).
3. **Harden CORS/env validation, add helmet + throttler.**
4. **Encryption version byte + allergies methods + decrypt error handling.**
5. **Grow the test suite** (business logic first, then DB-backed service tests in CI).
6. **ESLint/Prettier in CI, enum parity, remove stray prototype.**
