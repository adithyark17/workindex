import { companies, filterCompanies, findCompany, type CompanyFilters, type GccCompany } from "@/lib/workindex";
import { runtimeConfig } from "@/lib/runtime-config";
import { encodeCursor } from "@/lib/pagination";

export type CompanyPage = {
  data: GccCompany[];
  meta: {
    count: number;
    demo: boolean;
    environment: string;
    nextCursor: string | null;
  };
};

function applyFilters(records: GccCompany[], filters: CompanyFilters) {
  const query = filters.query?.trim().toLowerCase();
  return records.filter((company) => {
    const matchesQuery = !query || [company.name, company.city, company.industry, company.summary, ...company.capabilities]
      .some((value) => value.toLowerCase().includes(query));
    return matchesQuery &&
      (!filters.city || company.city === filters.city) &&
      (!filters.capability || company.capabilities.includes(filters.capability)) &&
      (!filters.momentum || company.hiringMomentum === filters.momentum);
  });
}

export async function listCompanies(filters: CompanyFilters = {}, limit = 50, offset = 0): Promise<CompanyPage> {
  if (runtimeConfig.dataMode === "fixture") {
    const matches = filterCompanies(filters);
    const data = matches.slice(offset, offset + limit);
    return { data, meta: { count: data.length, demo: true, environment: runtimeConfig.environment, nextCursor: offset + data.length < matches.length ? encodeCursor(offset + data.length) : null } };
  }

  const { listPublishedCompanies } = await import("./database");
  const matches = applyFilters(await listPublishedCompanies(), filters);
  const data = matches.slice(offset, offset + limit);
  return { data, meta: { count: data.length, demo: false, environment: runtimeConfig.environment, nextCursor: offset + data.length < matches.length ? encodeCursor(offset + data.length) : null } };
}

export async function getCompany(slug: string): Promise<GccCompany | undefined> {
  if (runtimeConfig.dataMode === "fixture") return findCompany(slug);
  const { findPublishedCompany } = await import("./database");
  return findPublishedCompany(slug);
}

export function fixtureSlugs() {
  return runtimeConfig.dataMode === "fixture" ? companies.map(({ slug }) => ({ slug })) : [];
}
