import { assertProductionConfig, runtimeConfig } from "@/lib/runtime-config";

export function GET() {
  try {
    assertProductionConfig();
    return Response.json({ status: "ok", service: "workindex-web", version: "0.2.0", environment: runtimeConfig.environment, dataMode: runtimeConfig.dataMode });
  } catch (error) {
    return Response.json({ status: "degraded", service: "workindex-web", version: "0.2.0", environment: runtimeConfig.environment,
      dataMode: runtimeConfig.dataMode, reason: error instanceof Error ? error.message : "Configuration is incomplete" }, { status: 503 });
  }
}
