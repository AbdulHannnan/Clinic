# Code Review & Improvement Plan

A full review of the current codebase (Phase 0 foundation, early Phase 1). Findings are grouped by
theme and tagged by severity:

- 🔴 **High** — security/correctness risk; address before real patient data or production.
- 🟠 **Medium** — should fix before the feature it touches ships.
- 🟡 **Low** — polish, hardening, or future-proofing.

Many items are *expected gaps* for this stage (auth, staff screens, write endpoints). They're listed
anyway so the plan is complete, but flagged as "planned" where the roadmap already covers them.

---

## 1. Testing

Covered now: `shared/src/{queue,money,treatment}.test.ts` (18 tests); and backend (25 tests):
`encryption.test.ts`, `enum-parity.test.ts`, `env.test.ts` (file-backed secrets), `services.test.ts`
(mocked-Prisma units for `QueueService` incl. `callNext`, `PaymentsService` incl. `applyDiscount`,
`NotificationsService` dedupe, `AuthService`, `TreatmentPlansService.recordVisit`), and `queue.db.test.ts`
— DB-backed tests that run against the CI Postgres via `TEST_DATABASE_URL` (skipped locally when unset).
CI now sets `TEST_DATABASE_URL`, so the provisioned Postgres is actually exercised end to end.
Coverage is wired via Node's built-in runner (`npm run test:coverage`); CI enforces a threshold on the
pure-logic `shared` package (95% lines / 90% branches / 95% funcs). A frontend smoke test for `LiveQueue`
runs under Vitest (`frontend/src/**/*.test.tsx`). Remaining gaps: `TreatmentPlansService` cron and
`AuditService` (thin wrappers), and a backend coverage gate (low until more handlers exist).

---

## 2. Tooling, DX & Housekeeping

### 🟡 Docker images added — not yet build-tested
`backend/Dockerfile` and `frontend/Dockerfile` (multi-stage, built from the repo root) plus a
`.dockerignore` now exist, and the frontend emits Next standalone output. They could not be built here
(no Docker in the dev environment) — validate with `docker build` before the pilot. See
`docs/deployment.md`.

---

## Remaining work

All the foundation and hardening items above are done. The only item left is a deploy-time one:
validate the Docker builds (no Docker in the current dev environment).
