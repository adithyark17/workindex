import type { AdapterResult, IngestionAdapter, JobCandidate, SourceDocument } from "../contracts";
import { sha256, stableJsonHash } from "../hash";
import { canonicalisePublicUrl } from "../normalization";
import { sanitiseExternalText } from "../security";
import { parseOptionalDate, textFromMarkup } from "./shared";

type GreenhouseJob = {
  id?: number | string;
  title?: string;
  absolute_url?: string;
  updated_at?: string;
  location?: { name?: string };
  content?: string;
};

export const GREENHOUSE_PARSER_VERSION = "greenhouse-v1";

export function greenhouseBoardUrl(boardToken: string): string {
  if (!/^[a-z0-9_-]+$/i.test(boardToken)) throw new Error("Invalid Greenhouse board token.");
  return `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;
}

function workplaceType(job: GreenhouseJob): JobCandidate["workplaceType"] {
  const value = `${job.location?.name ?? ""} ${job.title ?? ""}`.toLowerCase();
  if (/\bremote\b/.test(value)) return "remote";
  if (/\bhybrid\b/.test(value)) return "hybrid";
  if (/\b(?:on[- ]?site|in office)\b/.test(value)) return "on_site";
  return "unknown";
}

export const greenhouseAdapter: IngestionAdapter<JobCandidate> = {
  key: "greenhouse",
  method: "greenhouse_api",
  parserVersion: GREENHOUSE_PARSER_VERSION,
  parse(document: SourceDocument): AdapterResult<JobCandidate> {
    const issues: AdapterResult<JobCandidate>["issues"] = [];
    let payload: { jobs?: GreenhouseJob[] };
    try {
      payload = JSON.parse(document.body) as { jobs?: GreenhouseJob[] };
    } catch {
      return {
        items: [],
        issues: [{ code: "invalid_json", message: "Greenhouse response was not valid JSON." }],
        parserVersion: GREENHOUSE_PARSER_VERSION,
      };
    }
    if (!Array.isArray(payload.jobs)) {
      return {
        items: [],
        issues: [{ code: "invalid_shape", message: "Greenhouse response did not contain a jobs array." }],
        parserVersion: GREENHOUSE_PARSER_VERSION,
      };
    }

    const items: JobCandidate[] = [];
    for (const raw of payload.jobs) {
      const itemKey = raw.id == null ? undefined : String(raw.id);
      if (!itemKey || !raw.title || !raw.absolute_url) {
        issues.push({
          code: "missing_required_field",
          message: "Greenhouse job requires id, title, and absolute_url.",
          itemKey,
        });
        continue;
      }
      let applicationUrl: string;
      try {
        applicationUrl = canonicalisePublicUrl(raw.absolute_url);
      } catch {
        issues.push({ code: "invalid_url", message: "Greenhouse job URL was invalid.", itemKey });
        continue;
      }
      const description = raw.content ? sanitiseExternalText(textFromMarkup(raw.content)) : null;
      const title = sanitiseExternalText(raw.title, 500);
      const location = raw.location?.name
        ? sanitiseExternalText(raw.location.name, 500)
        : null;
      const publishedAt = parseOptionalDate(raw.updated_at);
      items.push({
        sourceId: document.source.id,
        externalId: itemKey,
        rawTitle: title,
        rawLocation: location,
        rawDescription: description,
        applicationUrl,
        publishedAt,
        updatedAt: publishedAt,
        workplaceType: workplaceType(raw),
        contentHash: stableJsonHash({ title, location, description, applicationUrl, publishedAt }),
        descriptionHash: description ? sha256(description) : null,
      });
    }
    return { items, issues, parserVersion: GREENHOUSE_PARSER_VERSION };
  },
};
