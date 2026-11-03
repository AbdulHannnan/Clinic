# Clinic

Queue, consultation and finance system for doctors in Pakistan. Each doctor gets their own copy
(own web address, branding and database). English and Urdu.

> "Clinic" and "ClinicQ" are working names.

## What's inside

```
Clinic/
├── frontend/          Next.js web app: patient pages, management desk, doctor's room
│   ├── messages/      en.json, ur.json (all screen text)
│   └── src/
│       ├── app/[locale]/          pages (thin; they compose features)
│       │   ├── page.tsx           patient home: doctor profile + live queue
│       │   └── (staff)/           reception/ and doctor/ (login-protected later)
│       ├── features/              one folder per business feature (see its README)
│       ├── components/            shared UI
│       ├── i18n/                  language routing, RTL for Urdu
│       └── lib/                   API client, realtime socket
├── backend/           NestJS API, realtime queue, scheduled reminders
│   ├── prisma/        schema.prisma (database design), migrations, seed
│   ├── src/
│   │   ├── modules/   clinic, patients, queue, visits, payments, treatment-plans,
│   │   │              notifications (WhatsApp/SMS/app), realtime, health
│   │   ├── common/    encryption of medical data, shared guards later
│   │   ├── config/    environment checks
│   │   └── prisma/    database client
│   └── test/
├── shared/            Business rules used by both sides (queue counts, wait times,
│                      fees/refunds, treatment reminders) + their tests
├── infra/             docker-compose for local Postgres, per-doctor env template
├── docs/              architecture, roadmap, deployment, the clickable prototype
└── .github/workflows/ CI: typecheck, tests, build on every push
```

## Run it locally

Needs Node 22+ and PostgreSQL (local, or `docker compose -f infra/docker-compose.yml up -d`).

```bash
npm install
cp backend/.env.example backend/.env          # then set DATABASE_URL and DATA_ENCRYPTION_KEY
cp frontend/.env.example frontend/.env.local
npm run build:shared
npm run db:migrate                            # creates the tables
npm run db:seed                               # sample clinic, doctor and queue
npm run dev:backend                           # http://localhost:4000/api/health
npm run dev:frontend                          # http://localhost:3000
```

`npm test` runs the business-rule and encryption tests. `npm run typecheck` checks all three packages.

## Docs

- [Architecture](docs/architecture.md): how the pieces fit and why
- [Roadmap](docs/roadmap.md): what gets built, in what order
- [Deployment](docs/deployment.md): one copy per doctor
- [Prototype](docs/prototype/prototype.html): the clickable prototype the build follows
