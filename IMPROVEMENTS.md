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

### 🟡 Request-body DTOs await write endpoints (planned)
`ValidationPipe({ whitelist, transform })` is wired and `:doctorId` params are now validated as cuids
(`common/pipes/cuid.pipe.ts`). Body DTOs with `class-validator` still need adding as each write
endpoint lands (`LoginDto` is the first example).

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

Covered now: `shared/src/{queue,money,treatment}.test.ts` (15 tests); and backend (17 tests):
`encryption.test.ts`, `enum-parity.test.ts`, `services.test.ts` (mocked-Prisma units for `QueueService`,
`PaymentsService`, `NotificationsService` dedupe, `AuthService`), and `queue.db.test.ts` — DB-backed
tests that run against the CI Postgres via `TEST_DATABASE_URL` (skipped locally when unset). CI now sets
`TEST_DATABASE_URL`, so the provisioned Postgres is actually exercised end to end.
Remaining gaps: `TreatmentPlansService` cron and `AuditService` (thin wrappers), and coverage.

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
5. ~~Grow the test suite (business logic + DB-backed service tests in CI)~~ ✅ **done**.
6. ~~ESLint/Prettier in CI, enum parity, remove stray prototype~~ ✅ **done**.
