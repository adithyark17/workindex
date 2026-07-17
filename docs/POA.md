# WorkIndex MVP Plan of Action

Status: Sprint 2 implementation completed locally 17 July 2026; managed-service provisioning and live corpus review pending  
Planning horizon: 90 days  
Launch wedge: evidence-backed GCC intelligence for technology candidates in Bengaluru, Hyderabad, and Pune

## Executive decision

WorkIndex will begin as a candidate-first GCC intelligence product, not a generic job board, broad salary portal, startup database, or enterprise analytics suite. The first repeatable user loop is:

1. Discover a GCC launch, expansion, or active hiring signal.
2. Inspect the India mandate, city, jobs, source trail, freshness, and confidence.
3. Save the company or create a relevant alert.
4. Return when the signal changes.

The source documents are ambitious requirement briefs rather than approved final strategies. This POA resolves their open choices into a staged build.

## Four-role synthesis

### Product lead

- Primary users: India-based software, data, AI/ML, product, and engineering professionals with 3–12 years of experience.
- Core job: identify credible GCC opportunities early and understand what the India team actually owns.
- Public MVP target: 300–500 quality-gated profiles, reached through staged ingestion and editorial review.
- Product guardrail: no unlabelled inference, mock data, or synthetic salary data.

### Brand and UX lead

- Category: India technology employment intelligence.
- Promise: every important career signal, with context, source, freshness, and confidence.
- Voice: evidence-led, incisive, composed, candid, and locally informed.
- Visual direction: trusted data terminal meets modern financial product and editorial business publication.
- Accessibility baseline: WCAG 2.2 AA; keyboard operation, strong focus treatment, semantic data, reduced-motion support, and no colour-only meaning.

### GTM lead

- Beachhead: active and near-active candidates in Bengaluru, Hyderabad, and Pune evaluating GCC roles.
- Launch motion: founder-led research, high-intent SEO, a weekly email signal, and a small set of credible city/role communities.
- North star: Weekly Activated Intelligence Users—users taking at least two high-intent actions, including one durable or contributory action.
- Public launch is conditional on data quality and retention, not an arbitrary calendar date or profile count.

### Technical lead

- Start with a modular monolith: Next.js App Router for public surfaces and versioned route handlers, PostgreSQL for the system of record, and asynchronous ingestion workers introduced behind explicit contracts.
- Store field-level evidence for material facts and reject blocked sources before fetching.
- Add Redis, object storage, PostHog, email delivery, and a worker runtime only when the vertical slice needs them.
- Defer OpenSearch until PostgreSQL full-text/trigram search no longer meets measured latency and relevance needs.

## MVP scope

### P0 — launch-critical

- Canonical parent company, Indian legal entity, GCC, office, city, event, source, evidence, and job model.
- Searchable/filterable GCC directory for the three launch cities.
- Company profiles with India mandate, locations, capabilities, current roles, timeline, provenance, freshness, and confidence.
- Launch and expansion tracker powered by the same event model.
- Source registry and ingestion compliance gate.
- Admin review queue for extracted facts, corrections, and publish decisions.
- Saves, company/city/function alerts, newsletter opt-in, consent, and unsubscribe.
- Analytics for discovery → profile → source → save/alert activation.
- Responsive, keyboard-accessible primary journeys.

### P1 — private beta

- Public ATS ingestion for Greenhouse plus company RSS/press releases.
- Historical job snapshots and explicit stale/closed rules.
- Salary submission and benchmark experiment, suppressed below the approved privacy threshold.
- Saved searches, segmented digests, share cards, city indexes, and correction workflow.

### Explicitly deferred

- Startup vertical, native mobile apps, automatic applications, recruiter marketplace, predictive scores, employer dashboard, offer comparison, interviews, benefits, workplace policies, public API, data exports, ads, and broad B2B analytics.

## Delivery plan

### Sprint 1 — trustworthy discovery slice (days 1–14)

Goal: “Find GCCs hiring in Hyderabad, inspect the evidence model, and reach a save/alert contract.”

- [x] Establish brand tokens, accessible shell, homepage, GCC directory, URL-synchronised filters, profiles, methodology page, and versioned read API.
- [x] Create 12 fictional, visibly labelled fixture records with provenance and confidence metadata.
- [x] Define architecture, source-compliance, ingestion, security, API, observability, deployment, and data-model contracts.
- [x] Add a reviewed PostgreSQL foundation migration.
- [x] Add authentication and saved-company persistence.
- [x] Add alert preference persistence and email verification contract.
- [x] Add browser-level tests for directory → profile and mobile/keyboard behaviour.
- [ ] Deploy a preview environment and instrument the activation funnel.

Exit: a deployable, accessible demo; shareable filter URLs; no ambiguous demo claims; automated static, type, unit, and production-build checks.

### Sprint 2 — ingestion and operations (days 15–28)

- [x] Greenhouse and RSS/press-release adapters with fixtures and rate limits.
- [x] Raw snapshot storage, content hashing, parse/normalise/dedupe flow, retry/dead-letter handling.
- [x] Source registry enforcement before network access.
- [x] Human review queue with approve/amend/reject/escalate and audit log.
- [x] Current-job freshness and explicit closure logic.
- [x] Saved companies, alert preferences, weekly digest, and consent persistence.
- [x] Clerk, Inngest, Supabase Storage, Resend, PostHog, Vercel, CI, and OpenAPI integration contracts.
- [ ] Provision managed services, apply staging migrations, configure webhooks/secrets, and deploy staging.
- [ ] Run reviewed live ingestion to reach 25 profiles, 100 current job observations, and 10 events.

Exit: two permitted source types produce reviewable, source-linked records without live sources in automated tests.

### Private alpha (days 29–60)

- Curate 75–150 profile-quality records.
- Invite 75–150 beachhead users in cohorts.
- Conduct weekly discovery interviews and review the activation funnel.
- Publish Bengaluru, Hyderabad, and Pune seed indexes and methodology-led research.
- Gate: at least 40% activation, 25% week-two retention among activated users, 70% useful searches, and 90% priority records inside freshness SLA.

### Private beta and conditional launch (days 61–90)

- Expand toward 200–300 quality-gated profiles and 400–750 users.
- Add segmented alerts, correction workflow, referral attribution, and a privacy-safe salary experiment only for viable cohorts.
- Publish one GCC hiring report and three city indexes.
- Gate: at least 30% week-four retention among activated alert users, no severe privacy/trust issue, and data provenance/freshness targets met.

## Acceptance criteria for the public MVP

- Every material fact shows source, publication/observation date, fetch/verification date, and confidence context.
- Unknown values remain unknown; direct statements and inference are visibly distinct.
- Filter state is shareable and survives reload.
- Results expose city, capabilities, hiring status, latest event, freshness, and confidence.
- Jobs preserve first seen, last seen, canonical URL, source, and closure state.
- Blocked sources cannot be fetched or published.
- Admin changes preserve before/after state, reviewer, reason, and timestamp.
- Salary slices below the legally approved cohort threshold are not published.
- Critical journeys pass automated tests and WCAG 2.2 AA checks.

## Metrics and decision gates

### Product

- Activation: view three relevant records plus create an alert/save.
- Search utility: percentage of searches producing a useful profile visit.
- Source engagement: source expansion/click-through rate.
- W1/W4 retention for activated users.

### Data trust

- Source-linked material facts ≥ 90% before alpha.
- Core-field completeness ≥ 80% before alpha.
- Priority records within freshness SLA ≥ 90%.
- Correction rate and median correction-resolution time.

### GTM

- 20 candidate and 10 recruiter/GCC interviews before alpha.
- 500 qualified waitlist signups or a founder-approved demand proxy before widening launch.
- Weekly email open/click rate and alert-driven return rate.

## Key open decisions

1. Approve measurable definitions for GCC, launch, expansion, strategic mandate, and active hiring.
2. Approve capability, role, level, city, and event taxonomies.
3. Complete legal review for salary anonymity, retention, corrections, defamation risk, and source reuse.
4. Choose identity, email, analytics, and hosting vendors after a small cost/security review.
5. Validate the WorkIndex name, domain, trademark, and search-confusion risk.
6. Name owners for product/engineering, data/research, growth/content, moderation/support, and privacy.
