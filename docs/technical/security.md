# Security and Privacy

## Baseline controls

- Least-privilege roles: anonymous, candidate, contributor, employer representative, moderator, administrator, analyst.
- Server-only secrets with managed production storage and rotation.
- Encryption in transit and provider-managed encryption at rest.
- Structured audit logging for moderation, merges, compliance changes, and sensitive access.
- Rate limits and bot protection on authentication, alerts, and contributions.
- Dependency, secret, and static analysis in CI before production deployment.

## Privacy

- Data minimisation, specific consent, export, correction, deletion, and retention workflows must align with India's DPDP obligations after counsel review.
- Identity data must remain logically separate from anonymous compensation submissions.
- Offer letters or payslips are quarantined, malware-scanned, reduced to needed verification attributes, and deleted by default on a short approved schedule.
- No sensitive submission payloads enter product analytics or logs.

## Untrusted ingestion

External pages, feeds, and uploads are data—not instructions. Parsers enforce MIME/size limits, schemas, allowlists, timeouts, and output validation. Any future LLM extractor receives isolated content and cannot call tools or publish directly.
