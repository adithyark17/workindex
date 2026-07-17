import postgres from "postgres";
import { apiErrorResponse, ApiError, readJsonObject } from "@/lib/api";
import { requireModerator } from "@/lib/admin-auth";
import { runtimeConfig } from "@/lib/runtime-config";

export async function PATCH(request: Request, { params }: { params: Promise<{ sourceId: string }> }) {
  try {
    const principal = await requireModerator(request);
    const body = await readJsonObject(request);
    const status = body.status;
    if (status !== "active" && status !== "blocked" && status !== "manual_only") {
      throw new ApiError(400, "INVALID_SOURCE_STATUS", "status must be active, blocked, or manual_only.");
    }
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (reason.length < 10) throw new ApiError(400, "INVALID_REASON", "A 10-character audit reason is required.");
    if (runtimeConfig.dataMode === "fixture") return Response.json({ data: { id: (await params).sourceId, status, staged: true } }, { status: 202 });
    if (!runtimeConfig.databaseUrl) throw new ApiError(503, "DATABASE_UNAVAILABLE", "Source registry is unavailable.");
    const sql = postgres(runtimeConfig.databaseUrl, { max: 1 });
    try {
      const id = (await params).sourceId;
      const rows = await sql<{ id: string; status: string }[]>`UPDATE source_registry SET status = ${status},
        compliance_version = compliance_version + 1, updated_at = now() WHERE id = ${id} RETURNING id, status`;
      if (!rows[0]) throw new ApiError(404, "SOURCE_NOT_FOUND", "Source registry record not found.");
      await sql`INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, after_state, reason, correlation_id)
        VALUES (${principal.userId}, 'source.status_changed', 'source_registry', ${id}, ${sql.json({ status } as never)}, ${reason}, ${crypto.randomUUID()})`;
      return Response.json({ data: rows[0] });
    } finally { await sql.end(); }
  } catch (error) { return apiErrorResponse(error); }
}
