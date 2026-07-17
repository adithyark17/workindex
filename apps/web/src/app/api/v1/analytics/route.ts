import { runtimeConfig } from "@/lib/runtime-config";

const allowedEvents = new Set(["profile_view", "directory_search", "source_click", "save_created", "alert_created", "digest_return"]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { event?: string; properties?: Record<string, unknown> } | null;
  if (!body?.event || !allowedEvents.has(body.event)) {
    return Response.json({ error: { code: "INVALID_ANALYTICS_EVENT", message: "Unsupported analytics event" } }, { status: 400 });
  }
  if (!runtimeConfig.posthogKey) return new Response(null, { status: 204 });
  const response = await fetch(`${runtimeConfig.posthogHost.replace(/\/$/, "")}/capture/`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: runtimeConfig.posthogKey, event: body.event, properties: { ...body.properties, distinct_id: "anonymous-consented" } }),
  });
  return new Response(null, { status: response.ok ? 204 : 502 });
}
