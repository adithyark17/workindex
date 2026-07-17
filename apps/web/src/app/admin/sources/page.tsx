import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { AdminEmptyState } from "@/components/admin/admin-states";
import { AdminStatus } from "@/components/admin/admin-status";
import { AdminTable } from "@/components/admin/admin-table";
import { SourceRegistrationForm, SourceStatusControl } from "@/components/admin/source-controls";
import styles from "@/components/admin/admin.module.css";
import { filterSources, formatAdminDateTime, readSearchParam, sourceRegistryFixtures } from "@/lib/admin";

export const metadata: Metadata = { title: "Source registry" };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SourcesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = readSearchParam(params.query);
  const status = readSearchParam(params.status) || "all";
  const sources = filterSources(query, status);
  const active = sourceRegistryFixtures.filter((source) => source.status === "active").length;
  const blocked = sourceRegistryFixtures.filter((source) => source.status === "blocked").length;
  const due = sourceRegistryFixtures.filter((source) => source.termsReviewStatus === "review_due").length;

  return (
    <>
      <AdminPageHeader
        eyebrow="Compliance gate"
        title="Source registry"
        description="Review permitted retrieval methods, policy status, rate limits, and retention rules before a source can enter the ingestion pipeline."
        meta={<span>{sourceRegistryFixtures.length} demo registry records</span>}
      />

      <dl className={styles.metrics}>
        <div className={styles.metric}><dt>Active sources</dt><dd>{active}</dd><small>Eligible for scheduling</small></div>
        <div className={styles.metric}><dt>Blocked sources</dt><dd>{blocked}</dd><small>Rejected before network access</small></div>
        <div className={styles.metric}><dt>Legal review due</dt><dd>{due}</dd><small>Requires an administrator</small></div>
        <div className={styles.metric}><dt>Healthy adapters</dt><dd>{sourceRegistryFixtures.filter((source) => source.health === "healthy").length}</dd><small>Based on latest demo run</small></div>
      </dl>

      <form className={styles.toolbar} action="/admin/sources" role="search">
        <label className={styles.field}>
          <span>Search registry</span>
          <input defaultValue={query} name="query" placeholder="Domain, publisher, or source type" type="search" />
        </label>
        <label className={`${styles.field} ${styles.compactField}`}>
          <span>Pipeline status</span>
          <select defaultValue={status} name="status">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </select>
        </label>
        <button className={styles.primaryButton} type="submit">Apply filters</button>
        {(query || status !== "all") ? <Link className={styles.secondaryButton} href="/admin/sources">Clear</Link> : null}
      </form>

      <div className={styles.resultsSummary} aria-live="polite">
        <strong>{sources.length} {sources.length === 1 ? "source" : "sources"}</strong>
        <span>Fixture-backed · no live fetches</span>
      </div>

      {sources.length ? (
        <AdminTable
          caption="Registered ingestion sources"
          headings={[
            { label: "Source" }, { label: "Pipeline" }, { label: "Compliance" },
            { label: "Method" }, { label: "Rate limit", className: styles.numeric }, { label: "Last run" }, { label: "Actions" },
          ]}
        >
          {sources.map((source) => (
            <tr key={source.id}>
              <td><span className={styles.tablePrimary}>{source.publisher}</span><span className={styles.tableSecondary}>{source.domain} · {source.sourceType.replace("_", " ")}</span></td>
              <td><AdminStatus value={source.status} /><span className={styles.tableSecondary}>Adapter: <AdminStatus value={source.health} /></span></td>
              <td><AdminStatus value={source.termsReviewStatus} /><span className={styles.tableSecondary}>Robots: {source.robotsStatus.replace("_", " ")}<br />Reviewed {formatAdminDateTime(source.lastLegalReviewedAt)}</span></td>
              <td><span className={styles.tablePrimary}>{source.permittedMethod}</span><span className={styles.tableSecondary}>{source.allowedFields.length ? `${source.allowedFields.length} allowed fields` : "No fields allowed"}</span></td>
              <td className={styles.numeric}>{source.rateLimitPerMinute}/min</td>
              <td>{formatAdminDateTime(source.lastRunAt)}</td>
              <td><SourceStatusControl sourceId={source.id} currentStatus={source.status} /></td>
            </tr>
          ))}
        </AdminTable>
      ) : (
        <AdminEmptyState title="No sources match these filters" description="Clear the filters or search for a different publisher, domain, or source type." action={<Link className={styles.secondaryButton} href="/admin/sources">Clear filters</Link>} />
      )}

      <section className={styles.sourceFormPanel} aria-labelledby="register-source-title">
        <h2 id="register-source-title">Register a source</h2>
        <p>New retrievable sources are registered blocked and must pass an explicit activation decision. Research and social leads remain manual-only.</p>
        <SourceRegistrationForm />
      </section>
    </>
  );
}
