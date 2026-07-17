import type { Metadata } from "next";
import Link from "next/link";
import { CompanyCard } from "@/components/company-card";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { listCompanies } from "@/lib/data/companies";
import { capabilities, cities } from "@/lib/workindex";

export const metadata: Metadata = { title: "GCC launch and hiring tracker" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const value = (input: string | string[] | undefined) => Array.isArray(input) ? input[0] : input;

export default async function GccDirectory({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters = {
    query: value(params.query),
    city: value(params.city),
    capability: value(params.capability),
    momentum: value(params.momentum),
  };
  const { data: results, meta } = await listCompanies(filters);
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="directory-hero">
          <div className="shell">
            <span className="demo-flag">{meta.demo ? "Demo dataset · fictional records" : "Reviewed live-source records"}</span>
            <p className="eyebrow">GCC intelligence</p>
            <h1>Find the teams being built in India.</h1>
            <p>Filter launch, expansion, and current hiring signals. Every result keeps its evidence context attached.</p>
          </div>
        </section>
        <div className="shell directory-layout">
          <aside className="filters">
            <form action="/gcc">
              <div className="filter-heading"><h2>Filter the index</h2>{hasFilters && <Link href="/gcc">Clear all</Link>}</div>
              <label htmlFor="query">Search</label>
              <input id="query" name="query" defaultValue={filters.query} placeholder="Company, industry, capability" />
              <label htmlFor="city">City</label>
              <select id="city" name="city" defaultValue={filters.city ?? ""}><option value="">All cities</option>{cities.map((city) => <option key={city}>{city}</option>)}</select>
              <label htmlFor="capability">Capability</label>
              <select id="capability" name="capability" defaultValue={filters.capability ?? ""}><option value="">All capabilities</option>{capabilities.map((capability) => <option key={capability}>{capability}</option>)}</select>
              <label htmlFor="momentum">Hiring signal</label>
              <select id="momentum" name="momentum" defaultValue={filters.momentum ?? ""}><option value="">Any signal</option><option>Growing</option><option>Steady</option><option>Watch</option></select>
              <button type="submit">Apply filters</button>
            </form>
          </aside>
          <section className="results" aria-labelledby="results-title">
            <div className="results-heading"><div><p className="eyebrow">Directory</p><h2 id="results-title">{results.length} {results.length === 1 ? "result" : "results"}</h2></div><p>Sorted by evidence freshness</p></div>
            {results.length ? <div className="card-grid two-column">{results.map((company) => <CompanyCard key={company.slug} company={company} />)}</div> : <div className="empty-state"><h3>No matching GCCs</h3><p>Try removing a filter or searching a broader capability.</p><Link className="button-secondary" href="/gcc">Reset filters</Link></div>}
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
