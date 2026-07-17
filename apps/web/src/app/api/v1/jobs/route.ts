import { listJobs } from "@/lib/data/public-records";
import { runtimeConfig } from "@/lib/runtime-config";
import { decodeCursor, encodeCursor } from "@/lib/pagination";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Math.max(Number(params.get("limit") ?? 50) || 50, 1), 100);
  const offset = decodeCursor(params.get("cursor"));
  const data = await listJobs(limit, params.get("status") === "closed", params.get("company") ?? undefined, params.get("city") ?? undefined, params.get("roleFamily") ?? undefined, offset);
  return Response.json({ data, meta: { count: data.length, demo: runtimeConfig.dataMode === "fixture", nextCursor: data.length === limit ? encodeCursor(offset + data.length) : null } }, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
}
