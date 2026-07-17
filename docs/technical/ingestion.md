# Ingestion

```mermaid
flowchart TD
  R["Register source"] --> C{"Compliance active?"}
  C -->|no| X["Reject and audit"]
  C -->|yes| S["Schedule"]
  S --> F["Fetch with rate limit"]
  F --> H["Hash + store raw snapshot"]
  H --> P["Deterministic parse"]
  P --> E["Extract entities and events"]
  E --> N["Normalise + resolve + dedupe"]
  N --> Q{"Confidence / policy gate"}
  Q -->|uncertain| M["Human review"]
  Q -->|eligible| V["Publish candidate"]
  M --> V
  V --> I["Index + alerts + page invalidation"]
```

## First adapters

1. Greenhouse public job board API/feed.
2. Company RSS or press-release feed.

Automated tests use recorded fixtures, never live sources. Each adapter implements a permit check, conditional fetch, timeout, retry budget, content-size limit, parser version, stable content hash, and source-specific freshness policy.

## Safety

- No anti-bot bypass or unauthorised LinkedIn scraping.
- External text cannot change system instructions or schema.
- LLM extraction, when later enabled, records model/prompt version and returns a strict validated object.
- Unsupported or conflicting facts enter review rather than public output.
- Dead-letter records retain error category and retry history without silently dropping data.
