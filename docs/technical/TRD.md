# Technical Requirements Document

## Goal

Deliver a trustworthy GCC intelligence product that can ingest permitted public sources, retain field-level provenance, support human review, and serve fast candidate-facing discovery experiences.

## Architecture principles

1. Modular monolith first; asynchronous workers at ingestion boundaries.
2. PostgreSQL is the system of record. JSONB is reserved for source-specific payloads, not core domain fields.
3. Deterministic parsing and mappings precede any language-model extraction.
4. All external content is untrusted; AI outputs use strict schemas and deterministic validation.
5. Compliance is a fetch-time gate, not a documentation afterthought.
6. Unknown information is never converted into a confident public claim.

## MVP service objectives

- Monthly availability: 99.5%.
- Directory/search p95: under 500 ms at MVP load.
- Company profile p95: under 1 second.
- Permitted job sources refreshed daily.
- Important GCC events processed within 12 hours.
- RPO: 24 hours; RTO: 4 hours.

## Current implementation

- Next.js 16.2 App Router, React 19, TypeScript, Tailwind CSS 4.
- Versioned JSON endpoints under `/api/v1`.
- Fictional in-process fixtures prove product/evidence contracts.
- PostgreSQL foundation migration is prepared but runtime persistence is a Sprint 2 integration.

## Deferred infrastructure triggers

- Add Redis when idempotent queueing, distributed rate limits, or shared cache invalidation becomes necessary.
- Add S3-compatible storage when raw source snapshots enter the pipeline.
- Add OpenSearch only after PostgreSQL search fails measured relevance/latency targets.
- Add a separate FastAPI service only when Python-native extraction workloads cannot be operated cleanly inside workers.
