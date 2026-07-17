import { runtimeConfig } from "@/lib/runtime-config";
import { companies } from "@/lib/workindex";

export type PublicJob = {
  id: string; companySlug: string; companyName: string; city: string | null; title: string;
  roleFamily: string | null; workplaceType: string | null; applicationUrl: string;
  firstSeenAt: string; lastSeenAt: string; status: "active" | "closed";
};

export type PublicEvent = {
  id: string; companySlug: string; companyName: string; city: string | null; type: string;
  date: string | null; title: string; summary: string | null; confidence: string; lastVerifiedAt: string | null;
};

export type PublicEvidence = {
  id: string; fieldName: string; publisher: string; title: string | null; url: string;
  publicationDate: string | null; lastVerifiedAt: string | null; reviewStatus: string;
};

async function database() {
  if (!runtimeConfig.databaseUrl) throw new Error("DATABASE_URL is required in database mode");
  const { default: postgres } = await import("postgres");
  return postgres(runtimeConfig.databaseUrl, { max: 1, idle_timeout: 20 });
}

export async function listJobs(limit: number, includeClosed = false, companySlug?: string, city?: string, roleFamily?: string, offset = 0): Promise<PublicJob[]> {
  if (runtimeConfig.dataMode === "fixture") return [];
  const sql = await database();
  try {
    const rows = await sql`
      SELECT j.id, c.slug, c.canonical_name, city.canonical_name AS city, j.raw_title,
        j.role_family, j.workplace_type, j.application_url, j.first_seen_at, j.last_seen_at, j.closed_at
      FROM jobs j JOIN companies c ON c.id = j.company_id
      LEFT JOIN cities city ON city.id = j.city_id
      WHERE c.status = 'published' AND (${includeClosed} OR j.closed_at IS NULL)
        AND (${!companySlug} OR c.slug = ${companySlug ?? ""})
        AND (${!city} OR city.canonical_name = ${city ?? ""})
        AND (${!roleFamily} OR j.role_family = ${roleFamily ?? ""})
      ORDER BY j.last_seen_at DESC LIMIT ${limit} OFFSET ${offset}`;
    return rows.map((row) => ({
      id: String(row.id), companySlug: String(row.slug), companyName: String(row.canonical_name),
      city: row.city ? String(row.city) : null, title: String(row.raw_title),
      roleFamily: row.role_family ? String(row.role_family) : null,
      workplaceType: row.workplace_type ? String(row.workplace_type) : null,
      applicationUrl: String(row.application_url), firstSeenAt: new Date(row.first_seen_at).toISOString(),
      lastSeenAt: new Date(row.last_seen_at).toISOString(), status: row.closed_at ? "closed" : "active",
    }));
  } finally { await sql.end(); }
}

export async function listEvents(limit: number, filters: { company?: string; city?: string; type?: string; dateFrom?: string; offset?: number } = {}): Promise<PublicEvent[]> {
  if (runtimeConfig.dataMode === "fixture") {
    return companies.filter((company) => (!filters.company || company.slug === filters.company) && (!filters.city || company.city === filters.city))
      .slice(filters.offset ?? 0, (filters.offset ?? 0) + limit).map((company) => ({
      id: `demo-${company.slug}`, companySlug: company.slug, companyName: company.name, city: company.city,
      type: "other", date: company.updatedAt, title: company.latestEvent, summary: null,
      confidence: company.confidence, lastVerifiedAt: company.updatedAt,
    }));
  }
  const sql = await database();
  try {
    const rows = await sql`
      SELECT e.id, c.slug, c.canonical_name, city.canonical_name AS city, e.event_type,
        e.event_date, e.title, e.summary, e.confidence, e.last_verified_at
      FROM company_events e JOIN companies c ON c.id = e.company_id
      LEFT JOIN cities city ON city.id = e.city_id
      WHERE e.status = 'published' AND c.status = 'published'
        AND (${!filters.company} OR c.slug = ${filters.company ?? ""})
        AND (${!filters.city} OR city.canonical_name = ${filters.city ?? ""})
        AND (${!filters.type} OR e.event_type = ${filters.type ?? ""})
        AND (${!filters.dateFrom} OR e.event_date >= ${filters.dateFrom ?? "1970-01-01"}::date)
      ORDER BY e.event_date DESC NULLS LAST, e.created_at DESC LIMIT ${limit} OFFSET ${filters.offset ?? 0}`;
    return rows.map((row) => ({
      id: String(row.id), companySlug: String(row.slug), companyName: String(row.canonical_name),
      city: row.city ? String(row.city) : null, type: String(row.event_type),
      date: row.event_date ? new Date(row.event_date).toISOString().slice(0, 10) : null,
      title: String(row.title), summary: row.summary ? String(row.summary) : null,
      confidence: String(row.confidence),
      lastVerifiedAt: row.last_verified_at ? new Date(row.last_verified_at).toISOString() : null,
    }));
  } finally { await sql.end(); }
}

export async function listCompanyEvidence(companySlug: string, limit = 20): Promise<PublicEvidence[]> {
  if (runtimeConfig.dataMode === "fixture") return [];
  const sql = await database();
  try {
    const rows = await sql`
      SELECT DISTINCT ON (s.id, ev.field_name) ev.id, ev.field_name, s.publisher, s.title,
        s.canonical_url, s.publication_date, ev.last_verified_at, ev.review_status
      FROM companies c JOIN evidence ev ON (
        (ev.entity_type = 'company' AND ev.entity_id = c.id)
        OR (ev.entity_type = 'gcc_profile' AND ev.entity_id IN (SELECT id FROM gcc_profiles WHERE company_id = c.id))
        OR (ev.entity_type = 'company_event' AND ev.entity_id IN (SELECT id FROM company_events WHERE company_id = c.id AND status = 'published'))
        OR (ev.entity_type = 'job' AND ev.entity_id IN (SELECT id FROM jobs WHERE company_id = c.id))
      ) JOIN sources s ON s.id = ev.source_id
      WHERE c.slug = ${companySlug} AND ev.review_status IN ('approved', 'amended')
      ORDER BY s.id, ev.field_name, ev.last_verified_at DESC NULLS LAST LIMIT ${limit}`;
    return rows.map((row) => ({
      id: String(row.id), fieldName: String(row.field_name), publisher: String(row.publisher),
      title: row.title ? String(row.title) : null, url: String(row.canonical_url),
      publicationDate: row.publication_date ? new Date(row.publication_date).toISOString() : null,
      lastVerifiedAt: row.last_verified_at ? new Date(row.last_verified_at).toISOString() : null,
      reviewStatus: String(row.review_status),
    }));
  } finally { await sql.end(); }
}
