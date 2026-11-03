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

### 🟡 No AAD binding
GCM supports additional authenticated data. Binding ciphertext to context (e.g. `patientId` + field
name) prevents a blob being moved between records. (Version byte is now in place, so AAD can be added
under a new version without breaking existing data.)

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

Pure business logic is now covered: `shared/src/{queue,money,treatment}.test.ts` (15 tests) and
`backend/test/encryption.test.ts` (2 tests). Still thin on the service layer.

### 🟠 Untested services
The NestJS services have no tests yet: `QueueService.publicView`, `PaymentsService.daySummary`,
`NotificationsService` dedupe, `TreatmentPlansService` cron, `AuthService` login, `AuditService`.
These need either mocked-Prisma unit tests or the DB-backed tests below.

### 🟠 CI spins up Postgres but no test uses it
`.github/workflows/ci.yml` starts `postgres:17` and runs `prisma migrate deploy`, but `npm test` only
runs DB-free unit tests — so the DB only validates that migrations apply.
- Add Prisma-backed service/e2e tests (seed a test DB, assert `publicView`/`daySummary` end to end).

### 🟡 No coverage gate and no frontend tests
Add a coverage tool (`c8`) with a threshold, and at least a smoke/render test for `LiveQueue` and the
patient page.

---

## 6. Tooling, DX & Housekeeping

### 🟡 No app Dockerfile / deploy automation (planned — Phase 5)
`infra/docker-compose.yml` only provisions Postgres for local dev; there's no Dockerfile for the
"one copy per doctor" backend/frontend deploy. `docs/deployment.md` is still a plan.

### 🟡 Observability
No structured logging, request IDs, or metrics. Health check (`/api/health`) is liveness-only. Add
request logging and a readiness signal before the pilot (Phase 5).

---

## Suggested order of attack

1. ~~Auth + guards + audit writes~~ ✅ **done**.
2. ~~Fix `clinicDay` timezone and the dedupe race~~ ✅ **done**.
3. ~~Harden CORS/env validation, add helmet + throttler~~ ✅ **done**.
4. ~~Encryption version byte + allergies methods + decrypt error handling~~ ✅ **done** (AAD binding still open).
5. **Grow the test suite** — ✅ business logic done; DB-backed service tests in CI still open.
6. ~~ESLint/Prettier in CI, enum parity, remove stray prototype~~ ✅ **done**.
