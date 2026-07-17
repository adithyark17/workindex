export const ingestionEvents = {
  scheduled: "workindex/ingestion.scheduled",
  fetched: "workindex/ingestion.fetched",
  parsed: "workindex/ingestion.parsed",
  failed: "workindex/ingestion.failed",
} as const;

export const ingestionFunctionDefinitions = [
  {
    id: "ingestion-fetch-source",
    event: ingestionEvents.scheduled,
    concurrencyKey: "event.data.sourceId",
    retries: 3,
    timeout: "30s",
  },
  {
    id: "ingestion-parse-snapshot",
    event: ingestionEvents.fetched,
    concurrencyKey: "event.data.sourceId",
    retries: 2,
    timeout: "30s",
  },
  {
    id: "ingestion-reconcile-items",
    event: ingestionEvents.parsed,
    concurrencyKey: "event.data.sourceId",
    retries: 2,
    timeout: "30s",
  },
] as const;

// These are dependency-free descriptors. The application can bind them to an
// Inngest client once that package and the persistence layer are introduced.
