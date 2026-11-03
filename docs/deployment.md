# Deployment: one copy per doctor

Not set up yet (Phase 5). The plan:

1. Copy `infra/clinics/example.env` to `infra/clinics/<doctor-slug>.env` (never committed).
2. Create that doctor's PostgreSQL database and a fresh `DATA_ENCRYPTION_KEY` (`openssl rand -base64 32`).
3. Deploy backend and frontend with that env file, on the doctor's domain.
4. Run `prisma migrate deploy`, then set clinic name, logo, doctor profile and fee.
5. Daily encrypted database backups per doctor.

Releasing an update means deploying the same version to every doctor's copy, one after another,
with database migrations applied first.
