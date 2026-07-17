import { createHash } from "node:crypto";
import postgres from "postgres";
import { Resend } from "resend";
import { runtimeConfig } from "@/lib/runtime-config";

function weekKey(now: Date) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export async function sendWeeklyDigests(now = new Date()) {
  if (!runtimeConfig.databaseUrl || !runtimeConfig.resendApiKey) throw new Error("Digest database and email configuration are required");
  const sql = postgres(runtimeConfig.databaseUrl, { max: 1 });
  const resend = new Resend(runtimeConfig.resendApiKey);
  const from = process.env.EMAIL_FROM ?? "signals@workindex.in";
  let sent = 0;
  try {
    const recipients = await sql<{ user_id: string; primary_email: string; alert_count: number }[]>`
      SELECT u.id AS user_id, u.primary_email, count(a.id)::int AS alert_count
      FROM users u JOIN alerts a ON a.user_id = u.id AND a.status = 'active' AND a.frequency = 'weekly'
      JOIN LATERAL (SELECT state FROM consent_events ce WHERE ce.user_id = u.id AND ce.purpose = 'alerts'
        ORDER BY ce.occurred_at DESC LIMIT 1) consent ON consent.state = 'granted'
      JOIN notification_preferences np ON np.user_id = u.id AND np.topic = 'alerts' AND np.channel = 'email' AND np.enabled
      WHERE u.status = 'active' AND u.primary_email IS NOT NULL GROUP BY u.id, u.primary_email`;
    for (const recipient of recipients) {
      const idempotencyKey = `weekly:${weekKey(now)}:${recipient.user_id}`;
      const recipientHash = createHash("sha256").update(recipient.primary_email).digest("hex");
      const queued = await sql<{ id: string }[]>`
        INSERT INTO notification_deliveries (user_id, message_kind, provider, idempotency_key, recipient_hash)
        VALUES (${recipient.user_id}, 'weekly_signal_digest', 'resend', ${idempotencyKey}, ${recipientHash})
        ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`;
      if (!queued[0]) continue;
      const result = await resend.emails.send({
        from, to: recipient.primary_email, subject: "Your weekly WorkIndex signal",
        html: `<h1>Your WorkIndex signal</h1><p>${recipient.alert_count} saved alert${recipient.alert_count === 1 ? " is" : "s are"} tracking reviewed GCC changes.</p><p><a href="${runtimeConfig.appBaseUrl}/gcc?utm_source=weekly_digest">Review current signals</a></p><p>Only reviewed records are included. Manage or unsubscribe from your WorkIndex alert preferences at any time.</p>`,
        headers: { "Idempotency-Key": idempotencyKey },
      });
      if (result.error || !result.data?.id) {
        await sql`UPDATE notification_deliveries SET status = 'failed', failed_at = now(), attempt_count = attempt_count + 1,
          metadata = ${sql.json({ error: result.error?.message ?? "Unknown Resend error" })}, updated_at = now() WHERE id = ${queued[0].id}`;
        continue;
      }
      await sql`UPDATE notification_deliveries SET status = 'sent', sent_at = now(), attempt_count = attempt_count + 1,
        provider_message_id = ${result.data.id}, updated_at = now() WHERE id = ${queued[0].id}`;
      sent += 1;
    }
    return { recipients: recipients.length, sent };
  } finally { await sql.end(); }
}
