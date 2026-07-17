export type DataMode = "fixture" | "database";

function optional(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export const runtimeConfig = {
  environment: optional("APP_ENV") ?? process.env.NODE_ENV ?? "development",
  dataMode: (optional("WORKINDEX_DATA_MODE") ?? "fixture") as DataMode,
  databaseUrl: optional("DATABASE_URL"),
  appBaseUrl: optional("APP_BASE_URL") ?? "http://localhost:3000",
  supabaseUrl: optional("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseServiceRoleKey: optional("SUPABASE_SERVICE_ROLE_KEY"),
  snapshotBucket: optional("SUPABASE_SNAPSHOT_BUCKET") ?? "raw-source-snapshots",
  clerkSecretKey: optional("CLERK_SECRET_KEY"),
  inngestEventKey: optional("INNGEST_EVENT_KEY"),
  inngestSigningKey: optional("INNGEST_SIGNING_KEY"),
  resendApiKey: optional("RESEND_API_KEY"),
  posthogKey: optional("NEXT_PUBLIC_POSTHOG_KEY"),
  posthogHost: optional("NEXT_PUBLIC_POSTHOG_HOST") ?? "https://app.posthog.com",
} as const;

export function assertProductionConfig() {
  if (runtimeConfig.dataMode !== "database") return;

  const missing = [
    ["DATABASE_URL", runtimeConfig.databaseUrl],
    ["NEXT_PUBLIC_SUPABASE_URL", runtimeConfig.supabaseUrl],
    ["SUPABASE_SERVICE_ROLE_KEY", runtimeConfig.supabaseServiceRoleKey],
    ["CLERK_SECRET_KEY", runtimeConfig.clerkSecretKey],
    ["RESEND_API_KEY", runtimeConfig.resendApiKey],
    ["INNGEST_EVENT_KEY", runtimeConfig.inngestEventKey],
    ["INNGEST_SIGNING_KEY", runtimeConfig.inngestSigningKey],
  ].filter(([, value]) => !value).map(([name]) => name);

  if (missing.length) {
    throw new Error(`Database mode is missing required configuration: ${missing.join(", ")}`);
  }
}
