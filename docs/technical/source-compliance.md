# Source Compliance Registry

Every source domain records source type, permitted retrieval method, robots review, terms review, rate limit, attribution requirements, retention rule, allowed fields, legal-review date, and active/blocked status.

## Enforcement

1. Scheduler requests a source by registry ID.
2. Worker loads the active compliance record.
3. Missing, expired, or blocked records fail closed before DNS/network access.
4. Fetch logs the registry version used for the decision.
5. Parser may emit only fields on the registry allowlist.
6. Publication preserves required attribution and retention policy.

Registry changes are admin-only and audited. Robots/terms reviews are not inferred automatically as legal approval.

## Initial policy

- Permitted candidates: official company career pages and press rooms, public ATS feeds, government/state investment announcements, corporate filings/disclosures, employer-provided feeds, and reviewed RSS sources.
- Prohibited: unauthorised LinkedIn scraping, anti-bot circumvention, credential sharing, or fetching a domain marked blocked.
