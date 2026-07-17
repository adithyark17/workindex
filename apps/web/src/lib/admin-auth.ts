import postgres from "postgres";
import { authenticateRequest } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { runtimeConfig } from "@/lib/runtime-config";

export type AdminPrincipal = { subject: string; userId: string; role: "moderator" | "admin" };

export async function requireModerator(request: Request): Promise<AdminPrincipal> {
  const identity = await authenticateRequest(request);
  if (!identity) throw new ApiError(401, "UNAUTHENTICATED", "Authentication is required.");
  if (identity.provider === "fixture") {
    const role = request.headers.get("x-workindex-fixture-role");
    if (role !== "moderator" && role !== "admin") throw new ApiError(403, "FORBIDDEN", "Moderator access is required.");
    return { subject: identity.userId, userId: identity.userId, role };
  }
  if (!runtimeConfig.databaseUrl) throw new ApiError(503, "DATABASE_UNAVAILABLE", "Role lookup is unavailable.");
  const sql = postgres(runtimeConfig.databaseUrl, { max: 1 });
  try {
    const rows = await sql<{ user_id: string; role: "moderator" | "admin" }[]>`
      SELECT ui.user_id, ur.role FROM user_identities ui JOIN user_roles ur ON ur.user_id = ui.user_id
      WHERE ui.provider = 'clerk' AND ui.provider_subject = ${identity.userId}
        AND ur.role IN ('moderator', 'admin') AND ur.revoked_at IS NULL
      ORDER BY CASE ur.role WHEN 'admin' THEN 0 ELSE 1 END LIMIT 1`;
    if (!rows[0]) throw new ApiError(403, "FORBIDDEN", "Moderator access is required.");
    return { subject: identity.userId, userId: rows[0].user_id, role: rows[0].role };
  } finally { await sql.end(); }
}
