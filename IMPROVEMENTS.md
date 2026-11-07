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

---

## 2. Correctness / Working

### 🟡 Treatment-plan lifecycle is incomplete (planned — Phase 4)
The cron sends reminders (`backend/src/modules/treatment-plans/treatment-plans.service.ts:21`) but
nothing advances `nextVisit`, increments `visitsDone`, or flips `status` to `COMPLETED`. MISSED
reminders are correctly deduped to once per `nextVisit`, but a plan never progresses. Expected for now —
track it.

### 🟡 No transactions around future multi-step writes
"Call next patient", payment+refund, and visit+prescription will each touch multiple rows. Wrap them in
`prisma.$transaction` when built.

---

## 3. Testing

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

## 4. Tooling, DX & Housekeeping

### 🟡 Docker images added — not yet build-tested
`backend/Dockerfile` and `frontend/Dockerfile` (multi-stage, built from the repo root) plus a
`.dockerignore` now exist, and the frontend emits Next standalone output. They could not be built here
(no Docker in the dev environment) — validate with `docker build` before the pilot. See
`docs/deployment.md`.

--
## Remaining work

All the foundation and hardening items above are done. What's left is planned-feature work
(write-endpoint DTOs, treatment-plan lifecycle, multi-step transactions) or deploy-time ops
(secrets manager, validate Docker builds).
