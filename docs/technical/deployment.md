# Deployment

## Environments

- Local: Next.js development server; PostgreSQL added in Sprint 2.
- Preview: isolated deployment for each pull request with fictional fixtures only.
- Staging: production-shaped services and sanitised/approved test data.
- Production: multi-AZ managed PostgreSQL, encrypted backups, managed secrets, edge/CDN delivery, and worker isolation.

## Release process

1. Lint, typecheck, unit tests, route/browser tests, dependency scan, and production build.
2. Apply reviewed forward-only migrations in staging.
3. Run smoke tests and migration checks.
4. Deploy application, then workers.
5. Monitor technical and freshness signals; rollback application on regression.

Database rollback uses a documented compensating migration or point-in-time recovery—never an unreviewed destructive reset.

## Initial environment variables

- `DATABASE_URL` — PostgreSQL connection string (Sprint 2).
- `APP_BASE_URL` — canonical public origin.
- `AUTH_SECRET` — managed identity secret (Sprint 2).
- `EMAIL_API_KEY` — server-only notification credential (Sprint 2).
- `POSTHOG_KEY` and `POSTHOG_HOST` — analytics configuration after consent review.
- `OBJECT_STORAGE_*` — raw snapshot storage after ingestion is enabled.
