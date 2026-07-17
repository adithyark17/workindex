import { inngest } from "./client";
import { ingestSource, listDueSources } from "@/lib/ingestion/runner";
import { sendWeeklyDigests } from "@/lib/notifications/weekly-digest";

export const scheduleSourceIngestion = inngest.createFunction(
  { id: "schedule-due-sources", triggers: [{ cron: "7 * * * *" }] },
  async ({ step }) => {
    const sources = await step.run("load-due-sources", () => listDueSources());
    if (sources.length) {
      await step.sendEvent("fan-out-sources", sources.map(({ sourceId, domain }) => ({
        name: "workindex/ingestion.scheduled" as const,
        data: { sourceId, domain },
      })));
    }
    return { scheduled: sources.length };
  },
);

export const ingestScheduledSource = inngest.createFunction(
  { id: "ingest-source", retries: 3, concurrency: [{ limit: 1, key: "event.data.sourceId" }], throttle: { limit: 1, period: "1m", key: "event.data.domain" }, triggers: [{ event: "workindex/ingestion.scheduled" }] },
  async ({ event, step, attempt }) => step.run("fetch-parse-stage", () => ingestSource(event.data.sourceId, attempt)),
);

export const weeklySignalDigest = inngest.createFunction(
  { id: "weekly-signal-digest", triggers: [{ cron: "TZ=Asia/Kolkata 0 9 * * 1" }], retries: 2 },
  async ({ step }) => step.run("send-reviewed-digests", () => sendWeeklyDigests()),
);

export const ingestionFunctions = [scheduleSourceIngestion, ingestScheduledSource, weeklySignalDigest];
