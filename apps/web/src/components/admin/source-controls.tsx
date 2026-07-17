"use client";

import { useState } from "react";
import styles from "./admin.module.css";

export function SourceStatusControl({ sourceId, currentStatus }: { sourceId: string; currentStatus: string }) {
  const [message, setMessage] = useState("");
  return (
    <form className={styles.formActions} onSubmit={async (event) => {
      event.preventDefault();
      const fields = new FormData(event.currentTarget);
      const response = await fetch(`/api/v1/admin/sources/${sourceId}`, {
        method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: fields.get("status"), reason: fields.get("reason") }),
      }).catch(() => null);
      setMessage(response?.ok ? (response.status === 202 ? "Validated in fixture mode." : "Status updated.") : "Status update requires moderator authentication.");
    }}>
      <select aria-label="New source status" defaultValue={currentStatus} name="status">
        <option value="active">Active</option><option value="blocked">Blocked</option><option value="manual_only">Manual only</option>
      </select>
      <input aria-label="Audit reason" name="reason" minLength={10} placeholder="Audit reason" required />
      <button className={styles.secondaryButton} type="submit">Update</button>
      <span className={styles.demoHint} role="status">{message}</span>
    </form>
  );
}

export function SourceRegistrationForm() {
  const [message, setMessage] = useState("");
  return (
    <form onSubmit={async (event) => {
      event.preventDefault();
      const fields = new FormData(event.currentTarget);
      const sourceType = String(fields.get("sourceType"));
      const method = sourceType === "greenhouse" ? "greenhouse_api" : sourceType === "rss" ? "rss_atom" : sourceType === "press_room" ? "configured_html" : "manual_reference";
      const response = await fetch("/api/v1/admin/sources", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: fields.get("domain"), sourceType, permittedMethod: method,
          robotsStatus: fields.get("robotsStatus"), termsReviewStatus: fields.get("termsReviewStatus"),
          retentionRule: fields.get("retentionRule"), rateLimitPerMinute: Number(fields.get("rateLimitPerMinute")),
          status: sourceType === "manual_reference" ? "manual_only" : "blocked",
          allowedFields: sourceType === "greenhouse" ? ["rawTitle", "rawLocation", "applicationUrl", "publishedAt"] : ["title", "summary", "url", "publishedAt"],
          adapterKey: method, parserVersion: "v1",
        }),
      }).catch(() => null);
      setMessage(response?.ok ? (response.status === 202 ? "Source validated in fixture mode." : "Source registered blocked pending activation.") : "Registration requires moderator authentication and valid compliance fields.");
    }}>
      <div className={styles.sourceFormGrid}>
        <label className={styles.field}><span>Domain</span><input name="domain" placeholder="careers.example.com" required /></label>
        <label className={styles.field}><span>Source type</span><select name="sourceType" required><option value="greenhouse">Greenhouse</option><option value="rss">RSS/Atom</option><option value="press_room">Configured press room</option><option value="manual_reference">Manual discovery lead</option></select></label>
        <label className={styles.field}><span>Robots review</span><select name="robotsStatus"><option value="approved">Approved</option><option value="review_due">Review due</option><option value="blocked">Blocked</option></select></label>
        <label className={styles.field}><span>Terms review</span><select name="termsReviewStatus"><option value="approved">Approved</option><option value="review_due">Review due</option><option value="blocked">Blocked</option></select></label>
        <label className={styles.field}><span>Rate limit per minute</span><input name="rateLimitPerMinute" type="number" min="1" max="60" defaultValue="6" /></label>
        <label className={styles.field}><span>Retention rule</span><input name="retentionRule" placeholder="Retain metadata and hashes for 12 months" required /></label>
      </div>
      <div className={styles.formActions}>
        <button className={styles.primaryButton} type="submit">Register source</button>
        <span className={styles.demoHint} role="status">{message}</span>
      </div>
    </form>
  );
}
