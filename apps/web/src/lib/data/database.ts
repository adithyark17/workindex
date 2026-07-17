import type { GccCompany } from "@/lib/workindex";
import { runtimeConfig } from "@/lib/runtime-config";

type SqlValue = string | number | boolean | null;
type SqlRow = Record<string, SqlValue | Date | string[]>;

type SqlClient = {
  <T extends readonly SqlRow[] = readonly SqlRow[]>(strings: TemplateStringsArray, ...values: SqlValue[]): Promise<T>;
  unsafe<T extends readonly SqlRow[] = readonly SqlRow[]>(query: string, params?: SqlValue[]): Promise<T>;
};

let clientPromise: Promise<SqlClient> | undefined;

async function getClient(): Promise<SqlClient> {
  if (!runtimeConfig.databaseUrl) throw new Error("DATABASE_URL is required in database mode");
  clientPromise ??= import("postgres").then(({ default: postgres }) =>
    postgres(runtimeConfig.databaseUrl!, { max: 1, idle_timeout: 20 }) as unknown as SqlClient,
  );
  return clientPromise;
}

function confidence(value: unknown): GccCompany["confidence"] {
  return value === "high" || value === "medium" || value === "limited" ? value : "unknown";
}

function city(value: unknown): GccCompany["city"] {
  if (value === "Bengaluru" || value === "Hyderabad" || value === "Pune") return value;
  throw new Error(`Unsupported launch city: ${String(value)}`);
}

function rowToCompany(row: SqlRow): GccCompany {
  return {
    slug: String(row.slug),
    name: String(row.canonical_name),
    city: city(row.city),
    industry: String(row.industry ?? "Unknown"),
    capabilities: Array.isArray(row.capabilities) ? row.capabilities.map(String) : [],
    hiringMomentum: row.hiring_momentum === "Growing" || row.hiring_momentum === "Steady" ? row.hiring_momentum : "Watch",
    workplaceModel: row.workplace_model === "hybrid" ? "Hybrid" : row.workplace_model === "on_site" ? "On-site" : "Flexible",
    headcountBand: row.headcount_band ? String(row.headcount_band) : "Unknown",
    launchedAt: row.launch_date ? new Date(row.launch_date as string | Date).toISOString().slice(0, 10) : "Unknown",
    summary: String(row.mandate_summary ?? "India mandate under review."),
    latestEvent: String(row.latest_event ?? "No reviewed event is currently published."),
    activeJobs: Number(row.active_jobs ?? 0),
    confidence: confidence(row.confidence),
    confidenceReason: String(row.confidence_reason ?? "Published evidence is still being evaluated."),
    updatedAt: new Date(row.updated_at as string | Date).toISOString().slice(0, 10),
    sourceCount: Number(row.source_count ?? 0),
    isDemo: false,
  };
}

const companySelect = `
  SELECT c.slug, c.canonical_name, c.industry, city.canonical_name AS city,
    COALESCE(g.mandate_summary, 'India mandate under review.') AS mandate_summary,
    g.launch_date, g.workplace_model, c.updated_at,
    CASE WHEN g.headcount_min IS NULL THEN 'Unknown'
      WHEN g.headcount_max IS NULL THEN g.headcount_min::text || '+'
      ELSE g.headcount_min::text || '–' || g.headcount_max::text END AS headcount_band,
    COALESCE((SELECT array_agg(DISTINCT j.role_family) FILTER (WHERE j.role_family IS NOT NULL)
      FROM jobs j WHERE j.company_id = c.id AND j.closed_at IS NULL), '{}') AS capabilities,
    COALESCE((SELECT count(*) FROM jobs j WHERE j.company_id = c.id AND j.closed_at IS NULL), 0) AS active_jobs,
    COALESCE((SELECT e.title FROM company_events e WHERE e.company_id = c.id AND e.status = 'published'
      ORDER BY e.event_date DESC NULLS LAST, e.created_at DESC LIMIT 1), 'No reviewed event is currently published.') AS latest_event,
    COALESCE((SELECT e.confidence::text FROM company_events e WHERE e.company_id = c.id AND e.status = 'published'
      ORDER BY e.event_date DESC NULLS LAST, e.created_at DESC LIMIT 1), 'unknown') AS confidence,
    COALESCE((SELECT e.confidence_reason FROM company_events e WHERE e.company_id = c.id AND e.status = 'published'
      ORDER BY e.event_date DESC NULLS LAST LIMIT 1), 'Published evidence is still being evaluated.') AS confidence_reason,
    COALESCE((SELECT count(DISTINCT ev.source_id) FROM evidence ev WHERE
      (ev.entity_type = 'company' AND ev.entity_id = c.id)
      OR (ev.entity_type = 'gcc_profile' AND ev.entity_id = g.id)
      OR (ev.entity_type = 'company_event' AND ev.entity_id IN (SELECT id FROM company_events WHERE company_id = c.id AND status = 'published'))
      OR (ev.entity_type = 'job' AND ev.entity_id IN (SELECT id FROM jobs WHERE company_id = c.id))), 0) AS source_count,
    CASE WHEN (SELECT count(*) FROM jobs j WHERE j.company_id = c.id AND j.closed_at IS NULL AND j.first_seen_at >= now() - interval '30 days') >= 10
      THEN 'Growing' WHEN (SELECT count(*) FROM jobs j WHERE j.company_id = c.id AND j.closed_at IS NULL) >= 5 THEN 'Steady' ELSE 'Watch' END AS hiring_momentum
  FROM companies c
  JOIN gcc_profiles g ON g.company_id = c.id AND g.status = 'published'
  JOIN offices o ON o.gcc_profile_id = g.id AND o.status = 'published' AND o.closed_on IS NULL
  JOIN cities city ON city.id = o.city_id
  WHERE c.status = 'published'`;

export async function listPublishedCompanies(): Promise<GccCompany[]> {
  const sql = await getClient();
  const rows = await sql.unsafe<SqlRow[]>(`${companySelect} ORDER BY c.canonical_name ASC`);
  return rows.map(rowToCompany);
}

export async function findPublishedCompany(slug: string): Promise<GccCompany | undefined> {
  const sql = await getClient();
  const rows = await sql.unsafe<SqlRow[]>(`${companySelect} AND c.slug = $1 LIMIT 1`, [slug]);
  return rows[0] ? rowToCompany(rows[0]) : undefined;
}
