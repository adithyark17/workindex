import postgres from "postgres";
import { apiErrorResponse, ApiError, readJsonObject } from "@/lib/api";
import { requireModerator } from "@/lib/admin-auth";
import { runtimeConfig } from "@/lib/runtime-config";

const decisions = ["approve", "amend", "reject", "escalate"] as const;
type Decision = (typeof decisions)[number];

export async function POST(request: Request) {
  try {
    const principal = await requireModerator(request);
    const body = await readJsonObject(request);
    if (typeof body.evidenceId !== "string" || typeof body.decision !== "string" || !decisions.includes(body.decision as Decision)) {
      throw new ApiError(400, "INVALID_REVIEW_DECISION", "evidenceId and a valid decision are required.");
    }
    const evidenceId = body.evidenceId;
    const decision = body.decision as Decision;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if ((decision !== "approve" && reason.length < 10) || reason.length > 2000) {
      throw new ApiError(400, "INVALID_REVIEW_REASON", "Non-approval decisions require a 10–2000 character reason.");
    }
    if (decision === "amend" && body.amendedValue === undefined) {
      throw new ApiError(400, "MISSING_AMENDED_VALUE", "An amended value is required.");
    }
    if (runtimeConfig.dataMode === "fixture") {
      return Response.json({ data: { evidenceId, decision, staged: true, reviewer: principal.subject } }, { status: 202 });
    }
    if (!runtimeConfig.databaseUrl) throw new ApiError(503, "DATABASE_UNAVAILABLE", "Review persistence is unavailable.");
    const sql = postgres(runtimeConfig.databaseUrl, { max: 1 });
    try {
      const result = await sql.begin(async (tx) => {
        const rawRows = await tx`SELECT id, review_status, extracted_value FROM evidence WHERE id = ${evidenceId} FOR UPDATE`;
        const rows = rawRows as unknown as { id: string; review_status: string; extracted_value: unknown }[];
        const current = rows[0];
        if (!current) throw new ApiError(404, "EVIDENCE_NOT_FOUND", "Evidence record not found.");
        const expected = typeof body.expectedStatus === "string" ? body.expectedStatus : "pending";
        if (current.review_status !== expected) throw new ApiError(409, "REVIEW_CONFLICT", "Evidence was already changed by another reviewer.");
        const nextStatus = decision === "approve" ? "approved" : decision === "amend" ? "amended" : decision === "reject" ? "rejected" : "escalated";
        const nextValue = decision === "amend" ? body.amendedValue : current.extracted_value;
        await tx`UPDATE evidence SET review_status = ${nextStatus}, extracted_value = ${tx.json(nextValue as never)},
          reviewer_id = ${principal.userId}, reviewed_at = now() WHERE id = ${evidenceId}`;
        await tx`INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, before_state, after_state, reason, correlation_id)
          VALUES (${principal.userId}, ${`review.${decision}`}, 'evidence', ${evidenceId},
            ${tx.json({ reviewStatus: current.review_status, extractedValue: current.extracted_value } as never)},
            ${tx.json({ reviewStatus: nextStatus, extractedValue: nextValue } as never)}, ${reason || "Evidence matched the proposed value."}, ${crypto.randomUUID()})`;
        return { evidenceId, reviewStatus: nextStatus, published: false };
      });
      return Response.json({ data: result });
    } finally { await sql.end(); }
  } catch (error) { return apiErrorResponse(error); }
}
