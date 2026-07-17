import styles from "./admin.module.css";

const labels: Record<string, string> = {
  active: "Active",
  blocked: "Blocked",
  approved: "Approved",
  review_due: "Review due",
  healthy: "Healthy",
  degraded: "Degraded",
  not_run: "Not run",
  succeeded: "Succeeded",
  running: "Running",
  failed: "Failed",
  partial: "Partial",
  pending: "Pending",
  escalated: "Escalated",
  high: "High confidence",
  medium: "Medium confidence",
  limited: "Limited confidence",
};

const tones: Record<string, string> = {
  active: styles.positive,
  approved: styles.positive,
  healthy: styles.positive,
  succeeded: styles.positive,
  high: styles.positive,
  running: styles.information,
  pending: styles.information,
  review_due: styles.warning,
  degraded: styles.warning,
  partial: styles.warning,
  medium: styles.warning,
  blocked: styles.critical,
  failed: styles.critical,
  escalated: styles.critical,
  limited: styles.critical,
  not_run: styles.neutral,
};

export function AdminStatus({ value }: { value: string }) {
  return (
    <span className={`${styles.status} ${tones[value] ?? styles.neutral}`}>
      <span aria-hidden="true" className={styles.statusDot} />
      {labels[value] ?? value}
    </span>
  );
}

