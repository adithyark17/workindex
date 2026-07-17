import postgres from "postgres";
import { apiErrorResponse, ApiError, readJsonObject } from "@/lib/api";
import { requireModerator } from "@/lib/admin-auth";
import { runtimeConfig } from "@/lib/runtime-config";

type CandidateRow = { evidence_id: string; review_status: string; item_id: string; entity_type: "job" | "company_event"; normalised_payload: Record<string, unknown>; source_id: string };

export async function POST(request: Request) {
  try {
    const principal = await requireModerator(request);
    const body = await readJsonObject(request);
    if (typeof body.evidenceId !== "string" || typeof body.companyId !== "string") {
      throw new ApiError(400, "INVALID_PUBLICATION", "evidenceId and companyId are required.");
    }
    const evidenceId = body.evidenceId;
    const companyId = body.companyId;
    if (runtimeConfig.dataMode === "fixture") return Response.json({ data: { evidenceId, companyId, staged: true } }, { status: 202 });
    if (!runtimeConfig.databaseUrl) throw new ApiError(503, "DATABASE_UNAVAILABLE", "Publication persistence is unavailable.");
    const sql = postgres(runtimeConfig.databaseUrl, { max: 1 });
    try {
      const result = await sql.begin(async (tx) => {
        const raw = await tx`
          SELECT ev.id AS evidence_id, ev.review_status, ii.id AS item_id, ii.entity_type, ii.normalised_payload, ev.source_id
          FROM evidence ev JOIN ingestion_items ii ON ev.entity_type = 'ingestion_item' AND ev.entity_id = ii.id
          WHERE ev.id = ${evidenceId} FOR UPDATE`;
        const candidate = (raw as unknown as CandidateRow[])[0];
        if (!candidate) throw new ApiError(404, "CANDIDATE_NOT_FOUND", "Reviewed ingestion candidate not found.");
        if (candidate.review_status !== "approved" && candidate.review_status !== "amended") {
          throw new ApiError(409, "CANDIDATE_NOT_APPROVED", "The evidence must be approved before publication.");
        }
        const payload = candidate.normalised_payload;
        const cityName = typeof payload.city === "string" ? payload.city : null;
        const cityRows = cityName ? await tx`SELECT id FROM cities WHERE canonical_name = ${cityName} LIMIT 1` : [];
        const cityId = (cityRows as unknown as { id: string }[])[0]?.id ?? null;
        let entityId: string;
        if (candidate.entity_type === "job") {
          const externalId = String(payload.externalId ?? "");
          const title = String(payload.rawTitle ?? "");
          const applicationUrl = String(payload.applicationUrl ?? "");
          if (!externalId || !title || !applicationUrl) throw new ApiError(400, "INVALID_JOB_CANDIDATE", "Job candidate is missing required fields.");
          const inserted = await tx`
            INSERT INTO jobs (company_id, city_id, external_id, source_id, raw_title, normalized_title, role_family,
              career_level, workplace_type, published_at, first_seen_at, last_seen_at, description_hash, application_url, confidence)
            VALUES (${companyId}, ${cityId}, ${externalId}, ${candidate.source_id}, ${title},
              ${typeof payload.normalizedTitle === "string" ? payload.normalizedTitle : null},
              ${typeof payload.roleFamily === "string" ? payload.roleFamily : null},
              ${typeof payload.careerLevel === "string" ? payload.careerLevel : null},
              ${typeof payload.workplaceType === "string" ? payload.workplaceType : "unknown"},
              ${typeof payload.publishedAt === "string" ? payload.publishedAt : null}, now(), now(),
              ${typeof payload.descriptionHash === "string" ? payload.descriptionHash : null}, ${applicationUrl}, 'high')
            ON CONFLICT (source_id, external_id) DO UPDATE SET raw_title = EXCLUDED.raw_title,
              normalized_title = EXCLUDED.normalized_title, role_family = EXCLUDED.role_family,
              career_level = EXCLUDED.career_level, workplace_type = EXCLUDED.workplace_type,
              last_seen_at = now(), closed_at = NULL, missing_observation_count = 0,
              description_hash = EXCLUDED.description_hash, application_url = EXCLUDED.application_url, updated_at = now()
            RETURNING id`;
          entityId = String((inserted as unknown as { id: string }[])[0]!.id);
        } else {
          const title = String(payload.title ?? "");
          if (!title) throw new ApiError(400, "INVALID_EVENT_CANDIDATE", "Event candidate is missing its title.");
          const inserted = await tx`
            INSERT INTO company_events (company_id, city_id, event_type, event_date, title, summary, status,
              confidence, confidence_reason, last_verified_at)
            VALUES (${companyId}, ${cityId}, ${String(payload.eventType ?? "other")},
              ${typeof payload.publishedAt === "string" ? payload.publishedAt : null}, ${title},
              ${typeof payload.summary === "string" ? payload.summary : null}, 'published', 'medium',
              'Deterministically extracted from an approved primary source and reviewed by a moderator.', now())
            RETURNING id`;
          entityId = String((inserted as unknown as { id: string }[])[0]!.id);
        }
        await tx`UPDATE ingestion_items SET status = 'accepted', resulting_entity_id = ${entityId}, updated_at = now() WHERE id = ${candidate.item_id}`;
        await tx`UPDATE evidence SET entity_type = ${candidate.entity_type}, entity_id = ${entityId}, last_verified_at = now() WHERE id = ${evidenceId}`;
        await tx`INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, after_state, reason, correlation_id)
          VALUES (${principal.userId}, 'candidate.published', ${candidate.entity_type}, ${entityId},
            ${tx.json({ evidenceId, companyId } as never)}, 'Approved candidate published through the separate publication gate.', ${crypto.randomUUID()})`;
        return { evidenceId, entityType: candidate.entity_type, entityId, published: true };
      });
      return Response.json({ data: result }, { status: 201 });
    } finally { await sql.end(); }
  } catch (error) { return apiErrorResponse(error); }
}
