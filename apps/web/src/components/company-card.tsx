import Link from "next/link";
import type { Confidence, GccCompany } from "@/lib/workindex";

const confidenceLabel: Record<Confidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  limited: "Limited confidence",
  unknown: "Unknown confidence",
};

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return <span className={`confidence confidence-${confidence}`}>{confidenceLabel[confidence]}</span>;
}

export function CompanyCard({ company }: { company: GccCompany }) {
  return (
    <article className="company-card">
      <div className="card-topline">
        <span className="vertical-pill">GCC</span>
        <ConfidenceBadge confidence={company.confidence} />
      </div>
      <div>
        <p className="meta">{company.city} · {company.industry}</p>
        <h3><Link href={`/companies/${company.slug}`}>{company.name}</Link></h3>
        <p className="card-summary">{company.summary}</p>
      </div>
      <dl className="signal-grid">
        <div><dt>Hiring signal</dt><dd>{company.hiringMomentum}</dd></div>
        <div><dt>Active roles</dt><dd>{company.activeJobs}</dd></div>
        <div><dt>Work model</dt><dd>{company.workplaceModel}</dd></div>
      </dl>
      <p className="latest-event"><strong>Latest signal:</strong> {company.latestEvent}</p>
      <div className="evidence-row">
        <span>{company.sourceCount} sources</span>
        <span>Updated {formatDate(company.updatedAt)}</span>
      </div>
    </article>
  );
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}
