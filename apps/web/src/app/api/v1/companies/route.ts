import { listCompanies } from "@/lib/data/companies";
import { decodeCursor } from "@/lib/pagination";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50) || 50, 1), 100);
  const result = await listCompanies({
    query: searchParams.get("query") ?? undefined,
    city: searchParams.get("city") ?? undefined,
    capability: searchParams.get("capability") ?? undefined,
    momentum: searchParams.get("momentum") ?? undefined,
  }, limit, decodeCursor(searchParams.get("cursor")));
  return Response.json(result, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
}
