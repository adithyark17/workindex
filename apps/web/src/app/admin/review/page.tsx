import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { AdminEmptyState } from "@/components/admin/admin-states";
import { AdminStatus } from "@/components/admin/admin-status";
import { AdminTable } from "@/components/admin/admin-table";
import { ReviewDecisionForm } from "@/components/admin/review-decision-form";
import styles from "@/components/admin/admin.module.css";
import {
  evidenceReviewFixtures,
  filterReviewItems,
  formatAdminDateTime,
  readSearchParam,
} from "@/lib/admin";

export const metadata: Metadata = { title: "Evidence review" };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ReviewPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = readSearchParam(params.query);
  const status = readSearchParam(params.status) || "all";
  const selectedId = readSearchParam(params.item);
  const items = filterReviewItems(query, status);
  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  const pending = evidenceReviewFixtures.filter((item) => item.status === "pending").length;
  const escalated = evidenceReviewFixtures.filter((item) => item.status === "escalated").length;

  const selectionHref = (id: string) => {
    const next = new URLSearchParams();
    if (query) next.set("query", query);
    if (status !== "all") next.set("status", status);
    next.set("item", id);
    return `/admin/review?${next.toString()}`;
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="Human quality gate"
        title="Evidence review"
        description="Compare proposed facts with their exact source evidence, then approve, amend, reject, or escalate with an auditable reason."
        meta={<span>{pending} pending · {escalated} escalated</span>}
      />

      <form className={styles.toolbar} action="/admin/review" role="search">
        <label className={styles.field}>
          <span>Search queue</span>
          <input defaultValue={query} name="query" placeholder="Company, field, proposed value, or source" type="search" />
        </label>
        <label className={`${styles.field} ${styles.compactField}`}>
          <span>Review status</span>
          <select defaultValue={status} name="status">
            <option value="all">Pending and escalated</option>
            <option value="pending">Pending</option>
            <option value="escalated">Escalated</option>
          </select>
        </label>
        <button className={styles.primaryButton} type="submit">Apply filters</button>
        {(query || status !== "all") ? <Link className={styles.secondaryButton} href="/admin/review">Clear</Link> : null}
      </form>

      <div className={styles.resultsSummary} aria-live="polite">
        <strong>{items.length} {items.length === 1 ? "review item" : "review items"}</strong>
        <span>Oldest priority evidence should be reviewed first</span>
      </div>

      {items.length && selected ? (
        <div className={styles.reviewLayout}>
          <AdminTable
            caption="Evidence awaiting review"
            headings={[{ label: "Entity / field" }, { label: "Status" }, { label: "Confidence" }, { label: "Queued" }]}
          >
            {items.map((item) => (
              <tr key={item.id}>
                <td><Link className={styles.rowLink} href={selectionHref(item.id)} aria-current={selected.id === item.id ? "true" : undefined}>{item.entityLabel}</Link><span className={styles.tableSecondary}>{item.fieldName} · {item.entityType.replace("_", " ")}</span></td>
                <td><AdminStatus value={item.status} /></td>
                <td><AdminStatus value={item.confidence} /><span className={styles.tableSecondary}>{Math.round(item.extractionConfidence * 100)}% extraction confidence</span></td>
                <td>{formatAdminDateTime(item.queuedAt)}</td>
              </tr>
            ))}
          </AdminTable>

          <article className={styles.reviewPanel} aria-labelledby="selected-review-title">
            <div className={styles.reviewKicker}><AdminStatus value={selected.status} /><AdminStatus value={selected.confidence} /><span className={styles.environment}>Demo evidence</span></div>
            <h2 id="selected-review-title">{selected.entityLabel}</h2>
            <dl className={styles.reviewMeta}>
              <div><dt>Field</dt><dd>{selected.fieldName}</dd></div>
              <div><dt>Entity type</dt><dd>{selected.entityType.replace("_", " ")}</dd></div>
              <div><dt>Extraction</dt><dd>{selected.extractionMethod.replace("_", " ")} · {Math.round(selected.extractionConfidence * 100)}%</dd></div>
              <div><dt>Observed</dt><dd>{formatAdminDateTime(selected.observedAt)}</dd></div>
            </dl>
            {selected.escalationReason ? <p className={styles.escalation}><strong>Escalation reason:</strong> {selected.escalationReason}</p> : null}
            <div className={styles.diff}>
              <section><h3>Current value</h3><p className={!selected.currentValue ? styles.unknown : undefined}>{selected.currentValue ?? "No current value"}</p></section>
              <section><h3>Proposed value</h3><p>{selected.proposedValue}</p></section>
            </div>
            <section className={styles.evidenceBlock} aria-labelledby="evidence-title">
              <h3 id="evidence-title">Evidence from {selected.sourceLabel}</h3>
              <blockquote>“{selected.evidenceSnippet}”</blockquote>
              <a href={selected.sourceUrl} target="_blank" rel="noreferrer">Open canonical demo source ↗</a>
            </section>
            <ReviewDecisionForm itemId={selected.id} proposedValue={selected.proposedValue} expectedStatus={selected.status} />
          </article>
        </div>
      ) : (
        <AdminEmptyState title="No evidence needs review here" description="Clear the filters to inspect other pending or escalated fixture records. Production queue completion will appear as a successful empty state." action={<Link className={styles.secondaryButton} href="/admin/review">Clear filters</Link>} />
      )}
    </>
  );
}
