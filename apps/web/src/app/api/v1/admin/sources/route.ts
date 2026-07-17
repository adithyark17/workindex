import postgres from "postgres";
import { apiErrorResponse, ApiError, readJsonObject } from "@/lib/api";
import { requireModerator } from "@/lib/admin-auth";
import { sourceRegistryFixtures } from "@/lib/admin";
import { runtimeConfig } from "@/lib/runtime-config";

export async function GET(request: Request) {
  try {
    await requireModerator(request);
    if (runtimeConfig.dataMode === "fixture") return Response.json({ data: sourceRegistryFixtures, meta: { demo: true } });
    if (!runtimeConfig.databaseUrl) throw new ApiError(503, "DATABASE_UNAVAILABLE", "Source registry is unavailable.");
    const sql = postgres(runtimeConfig.databaseUrl, { max: 1 });
    try {
      const data = await sql`SELECT id, domain, source_type, permitted_method, status, robots_status,
        terms_review_status, rate_limit_per_minute, attribution_requirement, retention_rule,
        allowed_fields, last_legal_reviewed_at, legal_review_expires_at, freshness_interval,
        adapter_key, parser_version, compliance_version FROM source_registry ORDER BY domain, source_type`;
      return Response.json({ data, meta: { demo: false } });
    } finally { await sql.end(); }
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const principal = await requireModerator(request);
    const body = await readJsonObject(request);
    const required = ["domain", "sourceType", "permittedMethod", "robotsStatus", "termsReviewStatus", "retentionRule"] as const;
    if (required.some((key) => typeof body[key] !== "string" || !(body[key] as string).trim())) {
      throw new ApiError(400, "INVALID_SOURCE", "The compliance source fields are incomplete.");
    }
    const status = body.status === "manual_only" ? "manual_only" : "blocked";
    const allowedFields = Array.isArray(body.allowedFields) && body.allowedFields.every((field) => typeof field === "string") ? body.allowedFields : [];
    const rateLimit = Math.min(Math.max(Number(body.rateLimitPerMinute ?? 1) || 1, 1), 60);
    if (runtimeConfig.dataMode === "fixture") return Response.json({ data: { id: crypto.randomUUID(), status, staged: true } }, { status: 202 });
    if (!runtimeConfig.databaseUrl) throw new ApiError(503, "DATABASE_UNAVAILABLE", "Source registry is unavailable.");
    const sql = postgres(runtimeConfig.databaseUrl, { max: 1 });
    try {
      const rows = await sql<{ id: string; status: string }[]>`
        INSERT INTO source_registry (domain, source_type, permitted_method, robots_status, terms_review_status,
          rate_limit_per_minute, attribution_requirement, retention_rule, allowed_fields, last_legal_reviewed_at,
          legal_review_expires_at, status, adapter_key, adapter_config, parser_version, freshness_interval)
        VALUES (${String(body.domain).toLowerCase()}, ${body.sourceType as string}, ${body.permittedMethod as string},
          ${body.robotsStatus as string}, ${body.termsReviewStatus as string}, ${rateLimit},
          ${typeof body.attributionRequirement === "string" ? body.attributionRequirement : null}, ${body.retentionRule as string},
          ${allowedFields}, ${typeof body.lastLegalReviewedAt === "string" ? body.lastLegalReviewedAt : null},
          ${typeof body.legalReviewExpiresAt === "string" ? body.legalReviewExpiresAt : null}, ${status},
          ${typeof body.adapterKey === "string" ? body.adapterKey : null}, ${sql.json((body.adapterConfig ?? {}) as never)},
          ${typeof body.parserVersion === "string" ? body.parserVersion : null},
          ${body.sourceType === "greenhouse" ? "1 hour" : "3 hours"}::interval)
        RETURNING id, status`;
      await sql`INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, after_state, reason, correlation_id)
        VALUES (${principal.userId}, 'source.registered', 'source_registry', ${rows[0]!.id}, ${sql.json(body as never)},
          'New source registered blocked pending explicit activation.', ${crypto.randomUUID()})`;
      return Response.json({ data: rows[0] }, { status: 201 });
    } finally { await sql.end(); }
  } catch (error) { return apiErrorResponse(error); }
}
