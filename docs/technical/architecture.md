# Architecture

```mermaid
flowchart LR
  U["Candidate browser"] --> W["Next.js public app"]
  A["Moderator browser"] --> W
  W --> API["Versioned application modules"]
  API --> PG[("PostgreSQL")]
  API --> Q["Async job boundary"]
  Q --> I["Ingestion workers"]
  I --> C{"Source compliance gate"}
  C -->|permitted| S["Public ATS / RSS / press source"]
  C -->|blocked| D["Reject + audit"]
  I --> O[("Raw object storage")]
  I --> PG
  PG --> R["Human review queue"]
  R --> P["Publish + invalidate pages"]
```

## Module boundaries

- Identity and permissions
- Companies, legal entities, GCCs, offices, and cities
- Events and timelines
- Sources, snapshots, evidence, and confidence
- Jobs and historical observations
- Search and discovery
- Saves, alerts, and notification preferences
- Contributions and moderation
- Audit and observability

Writes cross a module boundary through application services, not direct table mutation. Ingestion produces proposed facts; only reviewed/policy-approved facts become public.

## Primary request path

Public directory and profile reads use server-rendered pages backed by cacheable application queries. Query parameters are canonical filter state. The initial fixtures will be replaced by PostgreSQL repositories without changing component or HTTP contracts.
