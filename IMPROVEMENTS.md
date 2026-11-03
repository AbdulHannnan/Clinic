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

### 🟡 Encryption key: secret manager (rotation path documented)
A key-version byte is now in the blob and `docs/deployment.md` documents the rotate-in-place procedure.
Remaining (deploy-time, Phase 5): source `DATA_ENCRYPTION_KEY` from a secrets manager / KMS rather than
a plain env file.

### 🟡 Secrets hygiene (currently OK)
`.gitignore` correctly excludes `.env`, `.env.*`, and `infra/clinics/*.env` while keeping the
`.example` files. `.env.example` ships an empty `DATA_ENCRYPTION_KEY=`. Good — keep it that way.

---

## 2. Correctness / Working

### 🟡 Fractional `sortOrder` precision (edge cases tested)
`emergencySortOrder` (`shared/src/queue.ts`) halves the gap between neighbors on each insert; after many
insertions floats could collide (harmless at a day's volume). Empty-queue and all-emergency cases are
now tested. A gap-based integer scheme or periodic rebalance would be sturdier — do it with the queue
write endpoints, which don't exist yet.

### 🟡 Treatment-plan lifecycle is incomplete (planned — Phase 4)
The cron sends reminders (`backend/src/modules/treatment-plans/treatment-plans.service.ts:21`) but
nothing advances `nextVisit`, increments `visitsDone`, or flips `status` to `COMPLETED`. MISSED
reminders are correctly deduped to once per `nextVisit`, but a plan never progresses. Expected for now —
track it.

### 🟡 No transactions around future multi-step writes
"Call next patient", payment+refund, and visit+prescription will each touch multiple rows. Wrap them in
`prisma.$transaction` when built.

---

## 3. Performance / Optimization

### 🟡 `daySummary` aggregates in JS (acceptable)
`payments.service.ts` loads every entry+payment for the day and reduces in memory. Fine at clinic scale;
revisit with SQL aggregation only if volumes grow. Left as-is intentionally.

---

## 4. Testing

Covered now: `shared/src/{queue,money,treatment}.test.ts` (15 tests); and backend (17 tests):
`encryption.test.ts`, `enum-parity.test.ts`, `services.test.ts` (mocked-Prisma units for `QueueService`,
`PaymentsService`, `NotificationsService` dedupe, `AuthService`), and `queue.db.test.ts` — DB-backed
tests that run against the CI Postgres via `TEST_DATABASE_URL` (skipped locally when unset). CI now sets
`TEST_DATABASE_URL`, so the provisioned Postgres is actually exercised end to end.
Coverage is wired via Node's built-in runner (`npm run test:coverage`); CI enforces a threshold on the
pure-logic `shared` package (95% lines / 90% branches / 95% funcs). A frontend smoke test for `LiveQueue`
runs under Vitest (`frontend/src/**/*.test.tsx`). Remaining gaps: `TreatmentPlansService` cron and
`AuditService` (thin wrappers), and a backend coverage gate (low until more handlers exist).

---

## 5. Tooling, DX & Housekeeping

### 🟡 Docker images added — not yet build-tested
`backend/Dockerfile` and `frontend/Dockerfile` (multi-stage, built from the repo root) plus a
`.dockerignore` now exist, and the frontend emits Next standalone output. They could not be built here
(no Docker in the dev environment) — validate with `docker build` before the pilot. See
`docs/deployment.md`.

---

## Suggested order of attack

1. ~~Auth + guards + audit writes~~ ✅ **done**.
2. ~~Fix `clinicDay` timezone and the dedupe race~~ ✅ **done**.
3. ~~Harden CORS/env validation, add helmet + throttler~~ ✅ **done**.
4. ~~Encryption version byte + allergies methods + decrypt error handling~~ ✅ **done** (AAD binding still open).
5. ~~Grow the test suite (business logic + DB-backed service tests in CI)~~ ✅ **done**.
6. ~~ESLint/Prettier in CI, enum parity, remove stray prototype~~ ✅ **done**.
7. ~~Low items: AAD binding, single-query `publicView`, Urdu-font/caching, coverage + frontend test,
   observability, Docker images~~ ✅ **done**. Remaining are planned-feature work (write-endpoint DTOs,
   treatment-plan lifecycle, multi-step transactions, `sortOrder` rebalance) or deploy-time ops
   (secrets manager, validate Docker builds).
