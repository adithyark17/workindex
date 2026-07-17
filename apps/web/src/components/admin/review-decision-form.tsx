"use client";

import { useState } from "react";
import styles from "./admin.module.css";

type Decision = "approve" | "amend" | "reject" | "escalate";

export function ReviewDecisionForm({ itemId, proposedValue, expectedStatus }: { itemId: string; proposedValue: string; expectedStatus: "pending" | "escalated" }) {
  const [decision, setDecision] = useState<Decision>("approve");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const needsReason = decision !== "approve";

  return (
    <form
      className={styles.decisionForm}
      onSubmit={async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setMessage("");
        const fields = new FormData(event.currentTarget);
        const response = await fetch("/api/v1/admin/review-decisions", {
          method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            evidenceId: itemId, decision, expectedStatus,
            reason: String(fields.get("reason") ?? ""),
            amendedValue: decision === "amend" ? String(fields.get("amendedValue") ?? "") : undefined,
          }),
        }).catch(() => null);
        if (!response) setMessage("The review service could not be reached.");
        else if (response.ok) setMessage(response.status === 202 ? "Decision validated in fixture mode; no production record changed." : "Decision recorded. Publication remains a separate operation.");
        else {
          const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
          setMessage(payload?.error?.message ?? "The decision could not be recorded.");
        }
        setSubmitting(false);
      }}
    >
      <fieldset>
        <legend>Review decision</legend>
        <div className={styles.radioGrid}>
          {(["approve", "amend", "reject", "escalate"] as const).map((value) => (
            <label key={value}>
              <input checked={decision === value} name={`decision-${itemId}`} onChange={() => { setDecision(value); setMessage(""); }} type="radio" value={value} />
              <span>{value[0].toUpperCase() + value.slice(1)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {decision === "amend" ? (
        <label className={styles.field}>
          <span>Amended value</span>
          <textarea defaultValue={proposedValue} name="amendedValue" required rows={3} />
        </label>
      ) : null}
      <label className={styles.field}>
        <span>Reviewer reason {needsReason ? <strong>(required)</strong> : <small>(optional)</small>}</span>
        <textarea name="reason" required={needsReason} rows={3} aria-describedby={`reason-help-${itemId}`} />
        <small id={`reason-help-${itemId}`}>Explain the evidence or policy basis. This becomes part of the audit record when persistence is connected.</small>
      </label>
      <div className={styles.formActions}>
        <button className={styles.primaryButton} disabled={submitting} type="submit">{submitting ? "Submitting…" : "Submit decision"}</button>
        <span className={styles.demoHint}>Approval does not publish automatically</span>
      </div>
      <p className={styles.formMessage} role="status" aria-live="polite">{message}</p>
    </form>
  );
}
