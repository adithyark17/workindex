import type { ComplianceRecord, IngestionSource, RetrievalMethod } from "./contracts";

export class ComplianceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "blocked"
      | "registry_mismatch"
      | "domain_mismatch"
      | "method_mismatch"
      | "missing_review"
      | "expired_review"
      | "policy_rejected",
  ) {
    super(message);
    this.name = "ComplianceError";
  }
}

function normaliseDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
}

function isSameOrSubdomain(hostname: string, registeredDomain: string): boolean {
  const host = normaliseDomain(hostname);
  const domain = normaliseDomain(registeredDomain);
  return host === domain || host.endsWith(`.${domain}`);
}

function isRejectedReviewStatus(status: string): boolean {
  return /(?:blocked|prohibited|rejected|denied|not[_ -]?allowed)/i.test(status);
}

export function assertFetchPermitted(
  source: IngestionSource,
  compliance: ComplianceRecord,
  method: RetrievalMethod,
  now = new Date(),
): void {
  if (compliance.status !== "active") {
    throw new ComplianceError("The source registry entry is blocked.", "blocked");
  }
  if (source.registryId !== compliance.id) {
    throw new ComplianceError("The source is not attached to this compliance record.", "registry_mismatch");
  }
  if (compliance.permittedMethod !== method) {
    throw new ComplianceError(
      `Retrieval method ${method} is not permitted for this source.`,
      "method_mismatch",
    );
  }

  const url = new URL(source.canonicalUrl);
  if (!isSameOrSubdomain(url.hostname, compliance.domain)) {
    throw new ComplianceError("The source hostname is outside the reviewed domain.", "domain_mismatch");
  }
  if (!compliance.lastLegalReviewedAt) {
    throw new ComplianceError("The source has no recorded legal review.", "missing_review");
  }
  if (
    compliance.legalReviewExpiresAt &&
    new Date(compliance.legalReviewExpiresAt).getTime() <= now.getTime()
  ) {
    throw new ComplianceError("The source legal review has expired.", "expired_review");
  }
  if (
    isRejectedReviewStatus(compliance.robotsStatus) ||
    isRejectedReviewStatus(compliance.termsReviewStatus)
  ) {
    throw new ComplianceError("The robots or terms review rejects retrieval.", "policy_rejected");
  }
}

export function retainAllowedFields<T extends Record<string, unknown>>(
  value: T,
  allowedFields: readonly string[],
): Partial<T> {
  const allowlist = new Set(allowedFields);
  return Object.fromEntries(
    Object.entries(value).filter(([field]) => allowlist.has(field)),
  ) as Partial<T>;
}
