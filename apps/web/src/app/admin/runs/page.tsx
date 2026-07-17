import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { AdminEmptyState } from "@/components/admin/admin-states";
import { AdminStatus } from "@/components/admin/admin-status";
import { AdminTable } from "@/components/admin/admin-table";
import styles from "@/components/admin/admin.module.css";
import { filterRuns, formatAdminDateTime, ingestionRunFixtures, readSearchParam } from "@/lib/admin";

export const metadata: Metadata = { title: "Ingestion runs" };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function RunsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = readSearchParam(params.query);
  const status = readSearchParam(params.status) || "all";
  const runs = filterRuns(query, status);
  const reviewTotal = ingestionRunFixtures.reduce((sum, run) => sum + run.reviewItems, 0);

  return (
    <>
      <AdminPageHeader
        eyebrow="Pipeline observability"
        title="Ingestion runs"
        description="Inspect adapter outcomes, parser versions, record counts, policy rejections, and correlation IDs without losing the source context."
        meta={<span>Times shown in IST</span>}
      />

      <dl className={styles.metrics}>
        <div className={styles.metric}><dt>Runs shown</dt><dd>{ingestionRunFixtures.length}</dd><small>Fixture history</small></div>
        <div className={styles.metric}><dt>Successful</dt><dd>{ingestionRunFixtures.filter((run) => run.status === "succeeded").length}</dd><small>Completed without errors</small></div>
        <div className={styles.metric}><dt>Needs attention</dt><dd>{ingestionRunFixtures.filter((run) => ["failed", "partial", "blocked"].includes(run.status)).length}</dd><small>Failure, partial, or policy block</small></div>
        <div className={styles.metric}><dt>Review items</dt><dd>{reviewTotal}</dd><small>Proposed facts awaiting people</small></div>
      </dl>

      <form className={styles.toolbar} action="/admin/runs" role="search">
        <label className={styles.field}>
          <span>Find a run</span>
          <input defaultValue={query} name="query" placeholder="Run ID, source, adapter, or correlation ID" type="search" />
        </label>
        <label className={`${styles.field} ${styles.compactField}`}>
          <span>Run status</span>
          <select defaultValue={status} name="status">
            <option value="all">All statuses</option>
            <option value="succeeded">Succeeded</option>
            <option value="running">Running</option>
            <option value="partial">Partial</option>
            <option value="failed">Failed</option>
            <option value="blocked">Blocked</option>
          </select>
        </label>
        <button className={styles.primaryButton} type="submit">Apply filters</button>
        {(query || status !== "all") ? <Link className={styles.secondaryButton} href="/admin/runs">Clear</Link> : null}
      </form>

      <div className={styles.resultsSummary} aria-live="polite">
        <strong>{runs.length} {runs.length === 1 ? "run" : "runs"}</strong>
        <span>Newest first · fixture-backed</span>
      </div>

      {runs.length ? (
        <AdminTable
          caption="Ingestion run history"
          headings={[
            { label: "Run" }, { label: "Source / adapter" }, { label: "Status" },
            { label: "Fetched", className: styles.numeric }, { label: "Snapshots", className: styles.numeric },
            { label: "Proposals", className: styles.numeric }, { label: "Review", className: styles.numeric }, { label: "Timing" },
          ]}
        >
          {runs.map((run) => (
            <tr key={run.id}>
              <td><span className={`${styles.tablePrimary} ${styles.mono}`}>{run.id}</span><span className={`${styles.tableSecondary} ${styles.mono}`}>{run.correlationId}</span></td>
              <td><span className={styles.tablePrimary}>{run.sourceLabel}</span><span className={styles.tableSecondary}>{run.adapter} · {run.parserVersion}</span></td>
              <td><AdminStatus value={run.status} />{run.errorSummary ? <div className={styles.runError}><strong>{run.errorCategory?.replace("_", " ")}</strong><br />{run.errorSummary}</div> : null}</td>
              <td className={styles.numeric}>{run.fetchedRecords}</td>
              <td className={styles.numeric}>{run.newSnapshots}</td>
              <td className={styles.numeric}>{run.proposedFacts}</td>
              <td className={styles.numeric}>{run.reviewItems}</td>
              <td><span className={styles.tablePrimary}>{formatAdminDateTime(run.startedAt)}</span><span className={styles.tableSecondary}>{run.completedAt ? `Completed ${formatAdminDateTime(run.completedAt)}` : "In progress"}</span></td>
            </tr>
          ))}
        </AdminTable>
      ) : (
        <AdminEmptyState title="No runs match these filters" description="Try a different run status or search term. The underlying run history has not changed." action={<Link className={styles.secondaryButton} href="/admin/runs">Clear filters</Link>} />
      )}
    </>
  );
}

