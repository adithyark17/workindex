import Link from "next/link";
import { CompanyCard } from "@/components/company-card";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { listCompanies } from "@/lib/data/companies";
import { cities } from "@/lib/workindex";

export default async function Home() {
  const { data: companies, meta } = await listCompanies();
  const highlighted = companies.filter((company) => company.hiringMomentum === "Growing").slice(0, 3);
  const activeJobs = companies.reduce((sum, company) => sum + company.activeJobs, 0);

  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="hero">
          <div className="shell hero-grid">
            <div>
              <p className="eyebrow">India tech employment intelligence</p>
              <h1>See the work behind the opportunity.</h1>
              <p className="hero-copy">
                Track where global capability centres are launching, expanding, and hiring—with the
                source trail behind every signal.
              </p>
              <form action="/gcc" className="hero-search" role="search">
                <label className="sr-only" htmlFor="home-search">Search companies, cities, or capabilities</label>
                <input id="home-search" name="query" placeholder="Search a company, city, or capability" />
                <button type="submit">Search the index</button>
              </form>
              <div className="trust-line">
                <span>Source-linked</span><span>Freshness dated</span><span>Confidence explained</span>
              </div>
            </div>
            <aside className="hero-panel" aria-label="MVP coverage">
              <span className="demo-flag">{meta.demo ? "Demo dataset" : "Reviewed live dataset"}</span>
              <p className="panel-kicker">The first index</p>
              <strong>{companies.length}</strong>
              <p>{meta.demo ? "fictional GCC records proving the evidence model before real-source ingestion begins." : "reviewed GCC profiles with source-linked evidence."}</p>
              <dl>
                <div><dt>Launch cities</dt><dd>3</dd></div>
                <div><dt>Growing signals</dt><dd>{companies.filter((company) => company.hiringMomentum === "Growing").length}</dd></div>
                <div><dt>Active role links</dt><dd>{activeJobs}</dd></div>
              </dl>
            </aside>
          </div>
        </section>

        <section className="section shell">
          <div className="section-heading">
            <div><p className="eyebrow">Current signals</p><h2>GCCs showing hiring momentum</h2></div>
            <Link className="text-link" href="/gcc?momentum=Growing">View all growing signals →</Link>
          </div>
          <div className="card-grid">{highlighted.map((company) => <CompanyCard key={company.slug} company={company} />)}</div>
        </section>

        <section className="section city-section">
          <div className="shell">
            <div className="section-heading"><div><p className="eyebrow">City lenses</p><h2>Start with the markets that matter</h2></div></div>
            <div className="city-grid">
              {cities.map((city) => {
                const cityCompanies = companies.filter((company) => company.city === city);
                const jobs = cityCompanies.reduce((sum, company) => sum + company.activeJobs, 0);
                return (
                  <Link href={`/gcc?city=${encodeURIComponent(city)}`} className="city-card" key={city}>
                    <span>{city}</span><strong>{cityCompanies.length} GCCs</strong><small>{jobs} active role links</small>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="section shell methodology-preview">
          <div>
            <p className="eyebrow">Trust is a product feature</p>
            <h2>A signal is only useful when you can inspect it.</h2>
          </div>
          <div className="principles">
            <article><span>01</span><h3>Observation before inference</h3><p>We distinguish what a source states from what the data suggests.</p></article>
            <article><span>02</span><h3>Freshness in context</h3><p>Every material fact carries an observed or verified date.</p></article>
            <article><span>03</span><h3>Confidence explained</h3><p>A plain-language reason sits beside the tier—not behind a mystery score.</p></article>
          </div>
          <Link className="button-secondary" href="/methodology">Read the working methodology</Link>
        </section>

        <section id="signal" className="signal-cta">
          <div className="shell signal-inner">
            <div><p className="eyebrow">WorkIndex Signal</p><h2>Know when India&apos;s next technology teams take shape.</h2></div>
            <form><label htmlFor="email">Email address</label><div><input id="email" type="email" placeholder="you@example.com" /><button type="button">Join the early list</button></div><small>Demo interface—email delivery arrives in Sprint 2.</small></form>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
