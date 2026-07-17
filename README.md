# WorkIndex

Evidence-backed employment intelligence for India's technology workforce.

This repository contains the MVP vertical slice and Sprint 2 production foundation: a GCC launch and hiring tracker for Bengaluru, Hyderabad, and Pune, compliant Greenhouse/official-announcement ingestion, human review operations, saves, alerts, and weekly digests. Fixture mode remains conspicuously labelled; database mode exposes only reviewed, published records.

## Run locally

```bash
cd apps/web
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

Copy `apps/web/.env.example` to `.env.local`. Leave `WORKINDEX_DATA_MODE=fixture` for local UI development. Database mode requires the managed-service credentials documented in `docs/technical/sprint-2-runbook.md`.

## Quality checks

```bash
cd apps/web
pnpm lint
pnpm typecheck
pnpm test
pnpm validate:migrations
pnpm build
pnpm test:e2e
```

## Repository map

- `apps/web` — Next.js 16 candidate-facing application and versioned HTTP routes.
- `docs/POA.md` — integrated product, brand, GTM, and engineering plan of action.
- `docs/technical` — architecture and operating contracts.
- `infra/postgres/migrations` — reviewed SQL migrations for the production data model.
- `docs/data/seed-candidate-register.md` — the 25-company research queue; entries are not public claims.
- `docs/technical/sprint-2-runbook.md` — provider setup, source activation, freshness, and release gates.

## Data policy

No record in fixture mode represents a real company. Production publishing is gated on source compliance, field-level provenance, and human review. WorkIndex does not use unauthorised LinkedIn/X scraping, copy licensed research, or bypass anti-bot systems.
