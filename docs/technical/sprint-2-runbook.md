# Sprint 2 operations runbook

## Environment setup

1. Create Vercel, Supabase, Clerk, Inngest, Resend, and PostHog projects.
2. Apply SQL migrations in numeric order to staging Supabase PostgreSQL.
3. Create a private Supabase Storage bucket named `raw-source-snapshots`; only the service role may read or write it.
4. Copy `apps/web/.env.example` into the provider secret stores. Preview uses `WORKINDEX_DATA_MODE=fixture`; staging and production use `database`.
5. Register `/api/inngest`, `/api/webhooks/clerk`, and `/api/webhooks/resend` with the respective providers.
6. Grant the first operator `admin` in `user_roles` after their Clerk webhook has created the local identity.

## Source activation

1. Register a source blocked, or `manual_only` for research/social leads.
2. Record terms, robots, allowed fields, rate limit, attribution, retention, and legal-review expiry.
3. Configure the exact canonical source URL and adapter settings.
4. Activate only after an administrator records the decision.
5. Confirm the first fetch stores a private snapshot and creates review candidates without publishing them.

## Freshness and incident response

- Greenhouse sources use a one-hour `freshness_interval`; official announcements use three hours.
- An unchanged response records `not_modified` and advances the next eligible time.
- Three exhausted attempts create a dead letter; replay only after correcting the underlying source or parser issue.
- Failed fetches never increment job-missing state. Two successful missing observations are required before closure.
- Block a source immediately when permission, attribution, data quality, or unexpected access behaviour is in doubt.

## Release gate

- 25 reviewed profiles distributed 9 Bengaluru, 8 Hyderabad, and 8 Pune.
- At least 100 current job observations and 10 reviewed events.
- Every published material field has evidence and a verification date.
- Review approval and publication are separate audited actions.
- No social/research content is automatically fetched without explicit permission.
