import type { JobCandidate } from "./contracts";

export type ExistingJobState = {
  sourceId: string;
  externalId: string;
  rawTitle: string;
  applicationUrl: string;
  contentHash: string;
  firstSeenAt: string;
  lastSeenAt: string;
  closedAt: string | null;
  missingObservationCount: number;
};

export type JobLifecycleAction = {
  type: "discovered" | "seen" | "changed" | "missing" | "closed" | "reopened";
  key: string;
  candidate: JobCandidate | null;
  next: ExistingJobState;
};

function jobKey(sourceId: string, externalId: string): string {
  return `${sourceId}:${externalId}`;
}

export function reconcileJobLifecycle(input: {
  existing: readonly ExistingJobState[];
  observed: readonly JobCandidate[];
  observedAt: string;
  closeAfterMissingObservations?: number;
}): JobLifecycleAction[] {
  const closeAfter = input.closeAfterMissingObservations ?? 2;
  if (!Number.isInteger(closeAfter) || closeAfter < 1) {
    throw new Error("closeAfterMissingObservations must be a positive integer.");
  }
  const existingByKey = new Map(input.existing.map((job) => [jobKey(job.sourceId, job.externalId), job]));
  const observedByKey = new Map<string, JobCandidate>();
  for (const job of input.observed) {
    const key = jobKey(job.sourceId, job.externalId);
    if (observedByKey.has(key)) throw new Error(`Duplicate job observation: ${key}`);
    observedByKey.set(key, job);
  }

  const actions: JobLifecycleAction[] = [];
  for (const [key, candidate] of observedByKey) {
    const previous = existingByKey.get(key);
    if (!previous) {
      actions.push({
        type: "discovered",
        key,
        candidate,
        next: {
          sourceId: candidate.sourceId,
          externalId: candidate.externalId,
          rawTitle: candidate.rawTitle,
          applicationUrl: candidate.applicationUrl,
          contentHash: candidate.contentHash,
          firstSeenAt: input.observedAt,
          lastSeenAt: input.observedAt,
          closedAt: null,
          missingObservationCount: 0,
        },
      });
      continue;
    }
    const reopened = previous.closedAt !== null;
    const changed =
      previous.contentHash !== candidate.contentHash ||
      previous.applicationUrl !== candidate.applicationUrl ||
      previous.rawTitle !== candidate.rawTitle;
    actions.push({
      type: reopened ? "reopened" : changed ? "changed" : "seen",
      key,
      candidate,
      next: {
        ...previous,
        rawTitle: candidate.rawTitle,
        applicationUrl: candidate.applicationUrl,
        contentHash: candidate.contentHash,
        lastSeenAt: input.observedAt,
        closedAt: null,
        missingObservationCount: 0,
      },
    });
  }

  for (const [key, previous] of existingByKey) {
    if (observedByKey.has(key)) continue;
    const missingObservationCount = previous.missingObservationCount + 1;
    const shouldClose = previous.closedAt === null && missingObservationCount >= closeAfter;
    actions.push({
      type: shouldClose ? "closed" : "missing",
      key,
      candidate: null,
      next: {
        ...previous,
        missingObservationCount,
        closedAt: shouldClose ? input.observedAt : previous.closedAt,
      },
    });
  }

  return actions.sort((left, right) => left.key.localeCompare(right.key));
}
