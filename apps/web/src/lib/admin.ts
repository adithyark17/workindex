export type SourceRegistryStatus = "active" | "blocked" | "manual_only";
export type ComplianceReviewStatus = "approved" | "review_due" | "blocked";
export type SourceHealth = "healthy" | "degraded" | "not_run";

export type SourceRegistryReadModel = {
  id: string;
  domain: string;
  publisher: string;
  sourceType: "greenhouse" | "rss" | "press_room";
  permittedMethod: string;
  status: SourceRegistryStatus;
  robotsStatus: ComplianceReviewStatus;
  termsReviewStatus: ComplianceReviewStatus;
  rateLimitPerMinute: number;
  attributionRequirement: string;
  retentionRule: string;
  allowedFields: string[];
  lastLegalReviewedAt: string | null;
  lastRunAt: string | null;
  health: SourceHealth;
  isDemo: true;
};

export type IngestionRunStatus = "succeeded" | "running" | "failed" | "partial" | "blocked";

export type IngestionRunReadModel = {
  id: string;
  sourceId: string;
  sourceLabel: string;
  adapter: string;
  parserVersion: string;
  status: IngestionRunStatus;
  startedAt: string;
  completedAt: string | null;
  fetchedRecords: number;
  newSnapshots: number;
  proposedFacts: number;
  reviewItems: number;
  errorCategory: string | null;
  errorSummary: string | null;
  correlationId: string;
  isDemo: true;
};

export type EvidenceReviewStatus = "pending" | "escalated";
export type EvidenceConfidence = "high" | "medium" | "limited";

export type EvidenceReviewReadModel = {
  id: string;
  status: EvidenceReviewStatus;
  entityType: "company_event" | "job" | "gcc_profile";
  entityLabel: string;
  fieldName: string;
  currentValue: string | null;
  proposedValue: string;
  evidenceSnippet: string;
  sourceLabel: string;
  sourceUrl: string;
  observedAt: string;
  queuedAt: string;
  extractionMethod: "deterministic" | "model_assisted";
  extractionConfidence: number;
  confidence: EvidenceConfidence;
  escalationReason: string | null;
  runId: string;
  isDemo: true;
};

export const sourceRegistryFixtures: SourceRegistryReadModel[] = [
  {
    id: "src-reg-001",
    domain: "boards.greenhouse.io",
    publisher: "Astera Health Systems careers",
    sourceType: "greenhouse",
    permittedMethod: "Public Greenhouse job board feed",
    status: "active",
    robotsStatus: "approved",
    termsReviewStatus: "approved",
    rateLimitPerMinute: 12,
    attributionRequirement: "Link to the canonical employer application page.",
    retentionRule: "Retain metadata; review raw snapshots after 90 days.",
    allowedFields: ["job title", "location", "description", "application URL"],
    lastLegalReviewedAt: "2026-07-08T10:30:00+05:30",
    lastRunAt: "2026-07-17T08:41:00+05:30",
    health: "healthy",
    isDemo: true,
  },
  {
    id: "src-reg-002",
    domain: "northstarpayments.example",
    publisher: "Northstar Payments newsroom",
    sourceType: "rss",
    permittedMethod: "Published RSS feed",
    status: "active",
    robotsStatus: "approved",
    termsReviewStatus: "approved",
    rateLimitPerMinute: 6,
    attributionRequirement: "Publisher and canonical article link required.",
    retentionRule: "Retain source metadata and content hash for 12 months.",
    allowedFields: ["headline", "publication date", "summary", "canonical URL"],
    lastLegalReviewedAt: "2026-07-05T16:10:00+05:30",
    lastRunAt: "2026-07-17T08:12:00+05:30",
    health: "degraded",
    isDemo: true,
  },
  {
    id: "src-reg-003",
    domain: "verdantmobility.example",
    publisher: "Verdant Mobility press room",
    sourceType: "press_room",
    permittedMethod: "Reviewed public press index",
    status: "blocked",
    robotsStatus: "approved",
    termsReviewStatus: "review_due",
    rateLimitPerMinute: 4,
    attributionRequirement: "Canonical article link required.",
    retentionRule: "Do not fetch while blocked; retain registry audit only.",
    allowedFields: ["headline", "publication date", "summary"],
    lastLegalReviewedAt: "2026-04-11T11:00:00+05:30",
    lastRunAt: null,
    health: "not_run",
    isDemo: true,
  },
  {
    id: "src-reg-004",
    domain: "jobs.example-network.test",
    publisher: "Unreviewed aggregator",
    sourceType: "press_room",
    permittedMethod: "None approved",
    status: "blocked",
    robotsStatus: "blocked",
    termsReviewStatus: "blocked",
    rateLimitPerMinute: 1,
    attributionRequirement: "Not applicable while blocked.",
    retentionRule: "Registry and audit record only; no source content.",
    allowedFields: [],
    lastLegalReviewedAt: null,
    lastRunAt: null,
    health: "not_run",
    isDemo: true,
  },
];

export const ingestionRunFixtures: IngestionRunReadModel[] = [
  {
    id: "run-20260717-0841",
    sourceId: "src-reg-001",
    sourceLabel: "Astera Health Systems careers",
    adapter: "greenhouse",
    parserVersion: "greenhouse@0.2.1",
    status: "succeeded",
    startedAt: "2026-07-17T08:41:00+05:30",
    completedAt: "2026-07-17T08:41:18+05:30",
    fetchedRecords: 31,
    newSnapshots: 4,
    proposedFacts: 7,
    reviewItems: 2,
    errorCategory: null,
    errorSummary: null,
    correlationId: "corr_01J2P7QW8J9F",
    isDemo: true,
  },
  {
    id: "run-20260717-0812",
    sourceId: "src-reg-002",
    sourceLabel: "Northstar Payments newsroom",
    adapter: "rss",
    parserVersion: "rss@0.1.3",
    status: "partial",
    startedAt: "2026-07-17T08:12:00+05:30",
    completedAt: "2026-07-17T08:12:11+05:30",
    fetchedRecords: 14,
    newSnapshots: 1,
    proposedFacts: 1,
    reviewItems: 1,
    errorCategory: "item_parse",
    errorSummary: "Two older feed items omitted a canonical publication date.",
    correlationId: "corr_01J2P5ZZ3V1K",
    isDemo: true,
  },
  {
    id: "run-20260717-0750",
    sourceId: "src-reg-001",
    sourceLabel: "Astera Health Systems careers",
    adapter: "greenhouse",
    parserVersion: "greenhouse@0.2.1",
    status: "running",
    startedAt: "2026-07-17T07:50:00+05:30",
    completedAt: null,
    fetchedRecords: 18,
    newSnapshots: 0,
    proposedFacts: 0,
    reviewItems: 0,
    errorCategory: null,
    errorSummary: null,
    correlationId: "corr_01J2P4C7XK9A",
    isDemo: true,
  },
  {
    id: "run-20260716-1915",
    sourceId: "src-reg-002",
    sourceLabel: "Northstar Payments newsroom",
    adapter: "rss",
    parserVersion: "rss@0.1.3",
    status: "failed",
    startedAt: "2026-07-16T19:15:00+05:30",
    completedAt: "2026-07-16T19:15:31+05:30",
    fetchedRecords: 0,
    newSnapshots: 0,
    proposedFacts: 0,
    reviewItems: 0,
    errorCategory: "upstream_timeout",
    errorSummary: "The source exceeded the adapter timeout after the configured retry budget.",
    correlationId: "corr_01J2MZ8NG6R4",
    isDemo: true,
  },
  {
    id: "run-20260716-1800",
    sourceId: "src-reg-003",
    sourceLabel: "Verdant Mobility press room",
    adapter: "press_room",
    parserVersion: "press-room@0.1.0",
    status: "blocked",
    startedAt: "2026-07-16T18:00:00+05:30",
    completedAt: "2026-07-16T18:00:01+05:30",
    fetchedRecords: 0,
    newSnapshots: 0,
    proposedFacts: 0,
    reviewItems: 0,
    errorCategory: "compliance_gate",
    errorSummary: "Terms review is due. The compliance gate rejected the fetch before network access.",
    correlationId: "corr_01J2MY16E3D2",
    isDemo: true,
  },
];

export const evidenceReviewFixtures: EvidenceReviewReadModel[] = [
  {
    id: "ev-001",
    status: "pending",
    entityType: "gcc_profile",
    entityLabel: "Astera Health Systems",
    fieldName: "mandate_summary",
    currentValue: "Clinical platforms and healthcare analytics",
    proposedValue: "Clinical platforms, healthcare analytics, and applied AI for clinical operations",
    evidenceSnippet: "The Hyderabad centre will establish an applied AI team supporting clinical operations.",
    sourceLabel: "Astera Health Systems newsroom",
    sourceUrl: "https://astera-health.example/newsroom/hyderabad-ai-team",
    observedAt: "2026-07-17T08:41:00+05:30",
    queuedAt: "2026-07-17T08:42:00+05:30",
    extractionMethod: "deterministic",
    extractionConfidence: 0.94,
    confidence: "high",
    escalationReason: null,
    runId: "run-20260717-0841",
    isDemo: true,
  },
  {
    id: "ev-002",
    status: "pending",
    entityType: "job",
    entityLabel: "Astera Health Systems · Staff ML Engineer",
    fieldName: "career_level",
    currentValue: null,
    proposedValue: "staff",
    evidenceSnippet: "Lead technical direction across multiple machine-learning product workstreams.",
    sourceLabel: "Astera Health Systems careers",
    sourceUrl: "https://boards.greenhouse.io/example/jobs/1001",
    observedAt: "2026-07-17T08:41:00+05:30",
    queuedAt: "2026-07-17T08:42:10+05:30",
    extractionMethod: "deterministic",
    extractionConfidence: 0.88,
    confidence: "medium",
    escalationReason: null,
    runId: "run-20260717-0841",
    isDemo: true,
  },
  {
    id: "ev-003",
    status: "escalated",
    entityType: "company_event",
    entityLabel: "Northstar Payments",
    fieldName: "event_type",
    currentValue: null,
    proposedValue: "expansion",
    evidenceSnippet: "The new reliability group extends the remit of our India technology organisation.",
    sourceLabel: "Northstar Payments newsroom",
    sourceUrl: "https://northstarpayments.example/news/india-reliability",
    observedAt: "2026-07-17T08:12:00+05:30",
    queuedAt: "2026-07-17T08:13:00+05:30",
    extractionMethod: "model_assisted",
    extractionConfidence: 0.67,
    confidence: "limited",
    escalationReason: "Expansion versus capability-change taxonomy needs editorial judgement.",
    runId: "run-20260717-0812",
    isDemo: true,
  },
];

function includesQuery(values: Array<string | null>, query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  return !normalized || values.some((value) => value?.toLocaleLowerCase().includes(normalized));
}

export function filterSources(query = "", status = "all") {
  return sourceRegistryFixtures.filter(
    (source) =>
      (status === "all" || source.status === status) &&
      includesQuery([source.domain, source.publisher, source.sourceType], query),
  );
}

export function filterRuns(query = "", status = "all") {
  return ingestionRunFixtures.filter(
    (run) =>
      (status === "all" || run.status === status) &&
      includesQuery([run.id, run.sourceLabel, run.adapter, run.correlationId], query),
  );
}

export function filterReviewItems(query = "", status = "all") {
  return evidenceReviewFixtures.filter(
    (item) =>
      (status === "all" || item.status === status) &&
      includesQuery(
        [
          item.entityLabel,
          item.fieldName,
          item.proposedValue,
          item.sourceLabel,
          item.evidenceSnippet,
          item.escalationReason,
        ],
        query,
      ),
  );
}

export function findReviewItem(id?: string) {
  return evidenceReviewFixtures.find((item) => item.id === id);
}

export function formatAdminDateTime(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
