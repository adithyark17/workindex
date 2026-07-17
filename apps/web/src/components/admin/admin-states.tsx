import type { ReactNode } from "react";
import styles from "./admin.module.css";

export function AdminEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className={styles.statePanel} aria-labelledby="empty-state-title">
      <span className={styles.stateIcon} aria-hidden="true">◇</span>
      <h2 id="empty-state-title">{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  );
}

export function AdminErrorState({ reset }: { reset?: () => void }) {
  return (
    <section className={styles.statePanel} role="alert" aria-labelledby="admin-error-title">
      <span className={`${styles.stateIcon} ${styles.criticalIcon}`} aria-hidden="true">!</span>
      <h2 id="admin-error-title">The operations view could not be loaded</h2>
      <p>The source data was not changed. Retry the read, or use the correlation ID from the server log.</p>
      {reset ? <button className={styles.primaryButton} type="button" onClick={reset}>Retry</button> : null}
    </section>
  );
}

export function AdminLoadingTable({ rows = 5 }: { rows?: number }) {
  return (
    <section className={styles.loadingPanel} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading operations data</span>
      <div className={styles.loadingHeader} />
      {Array.from({ length: rows }, (_, index) => (
        <div className={styles.loadingRow} key={index}>
          <span /><span /><span /><span />
        </div>
      ))}
    </section>
  );
}

