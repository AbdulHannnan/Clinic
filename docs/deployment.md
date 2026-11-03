# Deployment: one copy per doctor

Not set up yet (Phase 5). The plan:

1. Copy `infra/clinics/example.env` to `infra/clinics/<doctor-slug>.env` (never committed).
2. Create that doctor's PostgreSQL database and a fresh `DATA_ENCRYPTION_KEY` (`openssl rand -base64 32`).
3. Deploy backend and frontend with that env file, on the doctor's domain.
4. Run `prisma migrate deploy`, then set clinic name, logo, doctor profile and fee.
5. Daily encrypted database backups per doctor.

Releasing an update means deploying the same version to every doctor's copy, one after another,
with database migrations applied first.

## Container images

Each service has a multi-stage Dockerfile, built from the **repo root** so the `shared` workspace is
available:

```bash
docker build -f backend/Dockerfile  -t clinic-backend  .
docker build -f frontend/Dockerfile -t clinic-frontend .
```

- **backend** runs `prisma migrate deploy` then starts the API (port 4000). Needs `DATABASE_URL`,
  `DATA_ENCRYPTION_KEY`, `JWT_SECRET`, `FRONTEND_URL` in the environment.
- **frontend** serves Next.js standalone output (port 3000). Needs `NEXT_PUBLIC_API_URL`.

> ⚠️ These Dockerfiles are not build-tested in CI yet (no Docker in the current dev environment).
> Run `docker build` once and adjust — Prisma on Alpine needs `openssl`/`libc6-compat` (already added),
> and the monorepo layout puts the Next server at `frontend/server.js` inside the standalone bundle.

## Rotating `DATA_ENCRYPTION_KEY`

Stored blobs begin with a version byte (`EncryptionService.VERSION`), so a future key or algorithm can
coexist with old data: bump the version, decrypt-with-old / re-encrypt-with-new in a one-off migration,
then drop the old key. For production, source the key from a secrets manager / KMS rather than a plain
env file.
