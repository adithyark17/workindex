import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfidenceBadge, formatDate } from "@/components/company-card";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { fixtureSlugs, getCompany } from "@/lib/data/companies";
import { listCompanyEvidence, listJobs } from "@/lib/data/public-records";

export function generateStaticParams() { return fixtureSlugs(); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const company = await getCompany((await params).slug);
  return company ? { title: `${company.name} GCC profile`, description: company.summary } : {};
}

export default async function CompanyProfile({ params }: { params: Promise<{ slug: string }> }) {
  const company = await getCompany((await params).slug);
  if (!company) notFound();
  const [jobs, evidence] = await Promise.all([listJobs(20, false, company.slug), listCompanyEvidence(company.slug)]);

  return (
    <>
      <SiteHeader />
      <main id="main">
        <div className="shell profile-shell">
          <Link className="back-link" href="/gcc">← Back to GCC tracker</Link>
          <span className="demo-flag">{company.isDemo ? "Fictional demo profile" : "Reviewed live-source profile"}</span>
          <header className="profile-header">
            <div><p className="eyebrow">{company.city} · {company.industry}</p><h1>{company.name}</h1><p>{company.summary}</p></div>
            <div className="profile-confidence"><ConfidenceBadge confidence={company.confidence} /><p>{company.confidenceReason}</p><small>{company.sourceCount} sources · Updated {formatDate(company.updatedAt)}</small></div>
          </header>
          <dl className="profile-stats">
            <div><dt>Hiring signal</dt><dd>{company.hiringMomentum}</dd></div>
            <div><dt>Active role links</dt><dd>{company.activeJobs}</dd></div>
            <div><dt>Observed headcount</dt><dd>{company.headcountBand}</dd></div>
            <div><dt>Workplace model</dt><dd>{company.workplaceModel}</dd></div>
          </dl>
          <div className="profile-grid">
            <div>
              <section className="profile-section"><p className="eyebrow">India mandate</p><h2>What this team appears to own</h2><div className="capability-list">{company.capabilities.map((capability) => <span key={capability}>{capability}</span>)}</div><p>This summary is a demo of the evidence contract. Production claims will distinguish direct company statements, observed job demand, and WorkIndex inference.</p></section>
              <section className="profile-section"><p className="eyebrow">Latest evidence</p><h2>{company.latestEvent}</h2><p>The production event record will include event type, observed date, affected city, quoted evidence snippet, canonical source, publication date, and review status.</p></section>
              <section className="profile-section"><p className="eyebrow">Hiring</p><h2>{company.activeJobs} active role links</h2>{jobs.length ? <ol>{jobs.map((job) => <li key={job.id}><a href={job.applicationUrl} target="_blank" rel="noreferrer" data-analytics-event="source_click" data-analytics-label={job.companySlug}>{job.title}</a><span> · {job.city ?? "India"} · observed {formatDate(job.lastSeenAt)}</span></li>)}</ol> : <p>{company.isDemo ? "Role links in this demo are aggregate fixtures. Production jobs preserve first seen, last seen, canonical application URL, and closure state." : "No reviewed active job links are currently published."}</p>}</section>
            </div>
            <aside className="source-panel"><p className="eyebrow">Source trail</p><h2>Why this signal is shown</h2><ol>{evidence.length ? evidence.map((item) => <li key={item.id}><a href={item.url} target="_blank" rel="noreferrer" data-analytics-event="source_click" data-analytics-label={item.publisher}><strong>{item.title ?? item.publisher}</strong></a><span>{item.fieldName.replaceAll("_", " ")} · reviewed {formatDate(item.lastVerifiedAt ?? item.publicationDate ?? company.updatedAt)}</span></li>) : Array.from({ length: company.sourceCount }, (_, index) => <li key={index}><strong>{index === 0 ? "Primary company source" : index === 1 ? "Public career source" : "Corroborating source"}</strong><span>{company.isDemo ? `Demo source ${index + 1}` : "Reviewed source record"} · reviewed {formatDate(company.updatedAt)}</span></li>)}</ol><Link href="/methodology">How confidence works →</Link></aside>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
