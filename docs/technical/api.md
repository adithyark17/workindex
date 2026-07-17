# API

Base path: `/api/v1`

## Implemented

- `GET /health` — service status and semantic application version.
- `GET /companies` — demo directory records; filters: `query`, `city`, `capability`, `momentum`.

The list response is `{ data, meta: { count, demo } }` and is cacheable for five minutes with stale revalidation.

## Next endpoints

- `GET /companies/:slug`
- `GET /events`
- `GET /jobs`
- `POST /saves`
- `DELETE /saves/:companyId`
- `POST /alerts`
- `GET /me/alerts`
- `POST /admin/review-decisions`

All new endpoints require JSON-schema validation, explicit authentication/authorisation, bounded pagination, stable error codes, rate-limit policy, and OpenAPI generation.
