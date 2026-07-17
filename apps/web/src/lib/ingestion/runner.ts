import postgres from "postgres";
import { runtimeConfig } from "@/lib/runtime-config";
import { greenhouseAdapter } from "./adapters/greenhouse";
import { createHtmlAnnouncementAdapter, type HtmlAnnouncementConfig } from "./adapters/html-announcements";
import { rssAtomAnnouncementAdapter } from "./adapters/rss-atom";
import type { AnnouncementCandidate, ComplianceRecord, IngestionSource, JobCandidate, RetrievalMethod } from "./contracts";
import { sha256 } from "./hash";
import { normaliseJob } from "./normalization";
import { fetchPermittedSource } from "./security";
import { retainAllowedFields } from "./compliance";

type SourceRow = {
  source_id: string; registry_id: string; canonical_url: string; publisher: string; source_type: string;
  domain: string; permitted_method: RetrievalMethod; robots_status: string; terms_review_status: string;
  rate_limit_per_minute: number; attribution_requirement: string | null; retention_rule: string;
  allowed_fields: string[]; last_legal_reviewed_at: Date | null; legal_review_expires_at: Date | null;
  status: "active" | "blocked" | "manual_only"; compliance_version: number; adapter_key: string;
  adapter_config: Record<string, unknown>; parser_version: string | null; etag: string | null; last_modified: string | null; last_content_hash: string | null;
};

function sqlClient() {
  if (!runtimeConfig.databaseUrl) throw new Error("DATABASE_URL is required for ingestion");
  return postgres(runtimeConfig.databaseUrl, { max: 2, idle_timeout: 20 });
}

export async function listDueSources(now = new Date()) {
  const sql = sqlClient();
  try {
    const rows = await sql<{ source_id: string; domain: string }[]>`
      SELECT s.id AS source_id, r.domain FROM sources s
      JOIN source_registry r ON r.id = s.registry_id
      LEFT JOIN source_fetch_state f ON f.source_id = s.id
      WHERE r.status = 'active'
        AND (r.legal_review_expires_at IS NULL OR r.legal_review_expires_at > ${now})
        AND (f.next_eligible_at IS NULL OR f.next_eligible_at <= ${now})
        AND (f.lease_expires_at IS NULL OR f.lease_expires_at <= ${now})
      ORDER BY COALESCE(f.next_eligible_at, '-infinity'::timestamptz), s.id
      LIMIT 100`;
    return rows.map((row) => ({ sourceId: row.source_id, domain: row.domain }));
  } finally { await sql.end(); }
}

export async function listDueSourceIds(now = new Date()) {
  return (await listDueSources(now)).map(({ sourceId }) => sourceId);
}

async function loadSource(sourceId: string): Promise<SourceRow> {
  const sql = sqlClient();
  try {
    const rows = await sql<SourceRow[]>`
      SELECT s.id AS source_id, s.registry_id, s.canonical_url, s.publisher, s.source_type,
        r.domain, r.permitted_method, r.robots_status, r.terms_review_status,
        r.rate_limit_per_minute, r.attribution_requirement, r.retention_rule,
        r.allowed_fields, r.last_legal_reviewed_at, r.legal_review_expires_at,
        r.status, r.compliance_version, r.adapter_key, r.adapter_config, r.parser_version,
        f.etag, f.last_modified, f.last_content_hash
      FROM sources s JOIN source_registry r ON r.id = s.registry_id
      LEFT JOIN source_fetch_state f ON f.source_id = s.id
      WHERE s.id = ${sourceId} LIMIT 1`;
    if (!rows[0]) throw new Error(`Unknown ingestion source ${sourceId}`);
    return rows[0];
  } finally { await sql.end(); }
}

function sourceContract(row: SourceRow): { source: IngestionSource; compliance: ComplianceRecord } {
  return {
    source: { id: row.source_id, registryId: row.registry_id, canonicalUrl: row.canonical_url, publisher: row.publisher, sourceType: row.source_type },
    compliance: {
      id: row.registry_id, version: row.compliance_version, domain: row.domain, sourceType: row.source_type,
      permittedMethod: row.permitted_method, robotsStatus: row.robots_status, termsReviewStatus: row.terms_review_status,
      rateLimitPerMinute: row.rate_limit_per_minute, attributionRequirement: row.attribution_requirement,
      retentionRule: row.retention_rule, allowedFields: row.allowed_fields,
      lastLegalReviewedAt: row.last_legal_reviewed_at?.toISOString() ?? null,
      legalReviewExpiresAt: row.legal_review_expires_at?.toISOString() ?? null, status: row.status,
    },
  };
}

async function storeSnapshot(sourceId: string, contentHash: string, body: string, contentType: string) {
  if (!runtimeConfig.supabaseUrl || !runtimeConfig.supabaseServiceRoleKey) {
    throw new Error("Supabase snapshot storage is not configured");
  }
  const objectKey = `${sourceId}/${contentHash}`;
  const endpoint = `${runtimeConfig.supabaseUrl.replace(/\/$/, "")}/storage/v1/object/${runtimeConfig.snapshotBucket}/${objectKey}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${runtimeConfig.supabaseServiceRoleKey}`,
      apikey: runtimeConfig.supabaseServiceRoleKey,
      "Content-Type": contentType || "application/octet-stream",
      "x-upsert": "false",
    },
    body,
  });
  if (!response.ok && response.status !== 409 && response.status !== 400) {
    throw new Error(`Snapshot storage failed with HTTP ${response.status}`);
  }
  return objectKey;
}

function parseDocument(row: SourceRow, document: Awaited<ReturnType<typeof fetchPermittedSource>>) {
  if (row.permitted_method === "greenhouse_api") return greenhouseAdapter.parse(document);
  if (row.permitted_method === "rss_atom") return rssAtomAnnouncementAdapter.parse(document);
  if (row.permitted_method === "configured_html") {
    return createHtmlAnnouncementAdapter(row.adapter_config as unknown as HtmlAnnouncementConfig).parse(document);
  }
  throw new Error(`Unsupported adapter ${row.permitted_method}`);
}

export async function ingestSource(sourceId: string, attempt = 0, now = new Date()) {
  const row = await loadSource(sourceId);
  const { source, compliance } = sourceContract(row);
  const correlationId = crypto.randomUUID();
  const sql = sqlClient();
  const leases = await sql<{ source_id: string }[]>`
    INSERT INTO source_fetch_state (source_id, lease_owner, lease_expires_at, updated_at)
    VALUES (${sourceId}, ${correlationId}, now() + interval '10 minutes', now())
    ON CONFLICT (source_id) DO UPDATE SET lease_owner = EXCLUDED.lease_owner,
      lease_expires_at = EXCLUDED.lease_expires_at, updated_at = now()
    WHERE source_fetch_state.lease_owner IS NULL OR source_fetch_state.lease_expires_at <= now()
    RETURNING source_id`;
  if (!leases[0]) { await sql.end(); return { runId: null, status: "leased" as const, itemCount: 0 }; }
  const runRows = await sql<{ id: string }[]>`
    INSERT INTO ingestion_runs (source_id, registry_id, compliance_version, compliance_snapshot,
      adapter_key, parser_version, scheduled_for, started_at, status, attempt_number, correlation_id)
    VALUES (${sourceId}, ${row.registry_id}, ${row.compliance_version}, ${sql.json(compliance as never)},
      ${row.adapter_key}, ${row.parser_version ?? "unversioned"}, ${now}, ${now}, 'running', ${attempt + 1}, ${correlationId})
    RETURNING id`;
  const runId = runRows[0]!.id;
  try {
    const document = await fetchPermittedSource({
      source, compliance, method: row.permitted_method,
      conditional: { etag: row.etag, lastModified: row.last_modified }, now,
      limits: { maxBytes: 5_000_000 },
    });
    if (document.httpStatus === 304) {
      await sql.begin(async (tx) => {
        await tx`UPDATE ingestion_runs SET status = 'not_modified', completed_at = now(), response_http_status = 304, updated_at = now() WHERE id = ${runId}`;
        await tx`INSERT INTO source_fetch_state (source_id, last_attempted_at, last_succeeded_at, next_eligible_at, consecutive_failures, updated_at)
          VALUES (${sourceId}, now(), now(), now() + (SELECT freshness_interval FROM source_registry WHERE id = ${row.registry_id}), 0, now())
          ON CONFLICT (source_id) DO UPDATE SET last_attempted_at = now(), last_succeeded_at = now(),
          next_eligible_at = now() + (SELECT freshness_interval FROM source_registry WHERE id = ${row.registry_id}), consecutive_failures = 0,
          lease_owner = NULL, lease_expires_at = NULL, updated_at = now()`;
      });
      return { runId, status: "not_modified" as const, itemCount: 0 };
    }
    const contentHash = sha256(document.body);
    if (row.last_content_hash === contentHash) {
      await sql.begin(async (tx) => {
        await tx`UPDATE ingestion_runs SET status = 'not_modified', completed_at = now(), response_http_status = ${document.httpStatus}, updated_at = now() WHERE id = ${runId}`;
        await tx`UPDATE source_fetch_state SET last_attempted_at = now(), last_succeeded_at = now(),
          next_eligible_at = now() + (SELECT freshness_interval FROM source_registry WHERE id = ${row.registry_id}),
          consecutive_failures = 0, etag = ${document.etag ?? row.etag}, last_modified = ${document.lastModified ?? row.last_modified},
          lease_owner = NULL, lease_expires_at = NULL, updated_at = now()
          WHERE source_id = ${sourceId}`;
      });
      return { runId, status: "not_modified" as const, itemCount: 0 };
    }
    const objectKey = await storeSnapshot(sourceId, contentHash, document.body, document.contentType);
    const parsed = parseDocument(row, document);
    const items = parsed.items.map((item) => "rawTitle" in item ? normaliseJob(item as JobCandidate) : item as AnnouncementCandidate);
    await sql.begin(async (tx) => {
      const rawSnapshots = await tx`
        INSERT INTO source_snapshots (source_id, fetched_at, content_hash, object_key, http_status, parser_version)
        VALUES (${sourceId}, ${now}, ${contentHash}, ${objectKey}, ${document.httpStatus}, ${parsed.parserVersion})
        ON CONFLICT (source_id, content_hash) DO UPDATE SET fetched_at = EXCLUDED.fetched_at
        RETURNING id`;
      const snapshots = rawSnapshots as unknown as { id: string }[];
      const snapshotId = snapshots[0]!.id;
      for (const item of items) {
        const externalId = item.externalId;
        const entityType = "rawTitle" in item ? "job" : "company_event";
        const permittedItem = retainAllowedFields(item as unknown as Record<string, unknown>, [
          ...row.allowed_fields, "sourceId", "externalId", "contentHash",
        ]);
        const rawInserted = await tx`
          INSERT INTO ingestion_items (ingestion_run_id, source_item_key, entity_type, status, content_hash, raw_payload, normalised_payload)
          VALUES (${runId}, ${externalId}, ${entityType}, 'review', ${item.contentHash}, ${tx.json(permittedItem as never)}, ${tx.json(permittedItem as never)})
          ON CONFLICT (ingestion_run_id, source_item_key) DO UPDATE SET normalised_payload = EXCLUDED.normalised_payload, updated_at = now()
          RETURNING id`;
        const inserted = rawInserted as unknown as { id: string }[];
        await tx`INSERT INTO evidence (entity_type, entity_id, field_name, extracted_value, source_id, source_snapshot_id,
          extraction_method, extraction_confidence, review_status, created_at)
          VALUES ('ingestion_item', ${inserted[0]!.id}, 'candidate', ${tx.json(permittedItem as never)}, ${sourceId}, ${snapshotId},
            'deterministic', ${parsed.issues.length ? 0.7 : 0.95}, 'pending', now())`;
      }
      if (row.permitted_method === "greenhouse_api") {
        const externalIds = items.map((item) => item.externalId);
        const reopenedRows = await tx`SELECT id FROM jobs WHERE source_id = ${sourceId} AND external_id = ANY(${externalIds}) AND closed_at IS NOT NULL`;
        const reopenedIds = new Set((reopenedRows as unknown as { id: string }[]).map((job) => job.id));
        const seenRows = await tx`
          UPDATE jobs SET last_seen_at = ${now}, closed_at = NULL, missing_observation_count = 0, updated_at = now()
          WHERE source_id = ${sourceId} AND external_id = ANY(${externalIds})
          RETURNING id`;
        for (const seen of seenRows as unknown as { id: string }[]) {
          await tx`INSERT INTO job_observations (job_id, ingestion_run_id, source_snapshot_id, observed_at, observation_type)
            VALUES (${seen.id}, ${runId}, ${snapshotId}, ${now}, ${reopenedIds.has(seen.id) ? "reopened" : "seen"}) ON CONFLICT DO NOTHING`;
        }
        const missingRows = await tx`
          UPDATE jobs SET missing_observation_count = missing_observation_count + 1,
            closed_at = CASE WHEN missing_observation_count + 1 >= 2 THEN ${now} ELSE closed_at END, updated_at = now()
          WHERE source_id = ${sourceId} AND NOT (external_id = ANY(${externalIds})) AND closed_at IS NULL
          RETURNING id, missing_observation_count, closed_at`;
        for (const missing of missingRows as unknown as { id: string; missing_observation_count: number; closed_at: Date | null }[]) {
          await tx`INSERT INTO job_observations (job_id, ingestion_run_id, source_snapshot_id, observed_at, observation_type)
            VALUES (${missing.id}, ${runId}, ${snapshotId}, ${now}, ${missing.closed_at ? "closed" : "missing"}) ON CONFLICT DO NOTHING`;
        }
      }
      await tx`UPDATE ingestion_runs SET status = 'succeeded', completed_at = now(), response_http_status = ${document.httpStatus},
        source_snapshot_id = ${snapshotId}, fetched_bytes = ${new TextEncoder().encode(document.body).byteLength},
        discovered_count = ${items.length}, review_count = ${items.length}, updated_at = now() WHERE id = ${runId}`;
      await tx`INSERT INTO source_fetch_state (source_id, etag, last_modified, last_attempted_at, last_succeeded_at,
        next_eligible_at, consecutive_failures, last_content_hash, updated_at)
        VALUES (${sourceId}, ${document.etag ?? null}, ${document.lastModified ?? null}, now(), now(),
          now() + (SELECT freshness_interval FROM source_registry WHERE id = ${row.registry_id}), 0, ${contentHash}, now())
        ON CONFLICT (source_id) DO UPDATE SET etag = EXCLUDED.etag, last_modified = EXCLUDED.last_modified,
          last_attempted_at = now(), last_succeeded_at = now(), next_eligible_at = EXCLUDED.next_eligible_at,
          consecutive_failures = 0, last_content_hash = EXCLUDED.last_content_hash,
          lease_owner = NULL, lease_expires_at = NULL, updated_at = now()`;
    });
    return { runId, status: "succeeded" as const, itemCount: items.length };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown ingestion error";
    await sql`UPDATE ingestion_runs SET status = ${attempt >= 2 ? "dead_lettered" : "failed"}, completed_at = now(),
      error_category = ${error instanceof Error ? error.name : "unknown"}, error_detail = ${detail.slice(0, 2000)}, updated_at = now() WHERE id = ${runId}`;
    await sql`INSERT INTO source_fetch_state (source_id, last_attempted_at, next_eligible_at, consecutive_failures, updated_at)
      VALUES (${sourceId}, now(), now() + interval '15 minutes', 1, now())
      ON CONFLICT (source_id) DO UPDATE SET last_attempted_at = now(), next_eligible_at = now() + interval '15 minutes',
      consecutive_failures = source_fetch_state.consecutive_failures + 1,
      lease_owner = NULL, lease_expires_at = NULL, updated_at = now()`;
    if (attempt >= 2) {
      await sql`INSERT INTO ingestion_dead_letters (ingestion_run_id, source_id, error_category, error_detail, retry_count)
        VALUES (${runId}, ${sourceId}, ${error instanceof Error ? error.name : "unknown"}, ${detail.slice(0, 2000)}, ${attempt + 1})`;
    }
    throw error;
  } finally { await sql.end(); }
}
