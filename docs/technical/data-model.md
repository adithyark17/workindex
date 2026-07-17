# Data Model

## Identity hierarchy

```mermaid
erDiagram
  COMPANY ||--o{ COMPANY_ALIAS : has
  COMPANY ||--o{ LEGAL_ENTITY : owns
  COMPANY ||--o| GCC_PROFILE : operates
  GCC_PROFILE ||--o{ OFFICE : includes
  CITY ||--o{ OFFICE : locates
  COMPANY ||--o{ COMPANY_EVENT : experiences
  COMPANY ||--o{ JOB : advertises
  SOURCE ||--o{ SOURCE_SNAPSHOT : captured_as
  SOURCE_SNAPSHOT ||--o{ EVIDENCE : supports
  COMPANY_EVENT ||--o{ EVIDENCE : evidenced_by
  JOB ||--o{ EVIDENCE : evidenced_by
```

## Invariants

- Parent company, Indian legal entity, GCC profile, and office are distinct.
- Aliases do not replace canonical identifiers.
- Each material public field has at least one evidence edge.
- Jobs are immutable identities with mutable observations; closure never deletes history.
- Entity merges are reversible and audited.
- Public records use soft lifecycle states: draft, review, published, superseded, withdrawn.

See `infra/postgres/migrations/0001_core.sql` for the first executable schema.

## Post-MVP entities

Salary/offer/interview submissions, role and level taxonomies, benefits, workplace policies, employer claims, and B2B access remain outside migration 0001. They will be added only with approved privacy, retention, and moderation rules.
