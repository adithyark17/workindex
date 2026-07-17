export type RetrievalMethod = "greenhouse_api" | "rss_atom" | "configured_html";
export type SourceStatus = "active" | "blocked" | "manual_only";
export type IngestionEntityType = "job" | "company_event";

export type ComplianceRecord = {
  id: string;
  version: number;
  domain: string;
  sourceType: string;
  permittedMethod: RetrievalMethod;
  robotsStatus: string;
  termsReviewStatus: string;
  rateLimitPerMinute: number;
  attributionRequirement?: string | null;
  retentionRule: string;
  allowedFields: readonly string[];
  lastLegalReviewedAt: string | null;
  legalReviewExpiresAt?: string | null;
  status: SourceStatus;
};

export type IngestionSource = {
  id: string;
  registryId: string;
  canonicalUrl: string;
  publisher: string;
  sourceType: string;
};

export type ConditionalFetchState = {
  etag?: string | null;
  lastModified?: string | null;
};

export type SourceDocument = {
  source: IngestionSource;
  fetchedAt: string;
  httpStatus: number;
  contentType: string;
  body: string;
  etag?: string | null;
  lastModified?: string | null;
};

export type ParserIssue = {
  code: string;
  message: string;
  itemKey?: string;
};

export type AdapterResult<T> = {
  items: T[];
  issues: ParserIssue[];
  parserVersion: string;
};

export interface IngestionAdapter<T> {
  readonly key: string;
  readonly method: RetrievalMethod;
  readonly parserVersion: string;
  parse(document: SourceDocument): AdapterResult<T>;
}

export type JobCandidate = {
  sourceId: string;
  externalId: string;
  rawTitle: string;
  rawLocation: string | null;
  rawDescription: string | null;
  applicationUrl: string;
  publishedAt: string | null;
  updatedAt: string | null;
  workplaceType: "remote" | "hybrid" | "on_site" | "unknown";
  contentHash: string;
  descriptionHash: string | null;
};

export type CompanyEventType =
  | "launch"
  | "expansion"
  | "leadership"
  | "hiring"
  | "contraction"
  | "closure"
  | "other";

export type AnnouncementCandidate = {
  sourceId: string;
  externalId: string;
  title: string;
  summary: string | null;
  url: string;
  publishedAt: string | null;
  eventType: CompanyEventType;
  city: string | null;
  contentHash: string;
};

export type NormalizedJobCandidate = JobCandidate & {
  normalizedTitle: string;
  roleFamily: string | null;
  careerLevel: string | null;
  city: string | null;
};
