import type {
  Alert,
  ConsentEvent,
  ConsentPurpose,
  Delivery,
  DeliveryStatus,
  IdentityUser,
  UserOperationsRepository,
  WebhookReceipt,
} from "./user-operations";

type SqlParameter = string | number | boolean | null;
type DatabaseRow = Record<string, unknown>;
export type UserOperationsSqlClient = {
  unsafe<T extends readonly DatabaseRow[] = readonly DatabaseRow[]>(
    query: string,
    parameters?: SqlParameter[],
  ): Promise<T>;
};

function iso(value: unknown) {
  return new Date(value as string | number | Date).toISOString();
}

function toAlert(row: DatabaseRow): Alert {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name),
    kind: row.kind as Alert["kind"],
    criteria: row.criteria as Alert["criteria"],
    frequency: row.frequency as Alert["frequency"],
    status: row.status as Alert["status"],
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function toConsent(row: DatabaseRow): ConsentEvent {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    purpose: row.purpose as ConsentEvent["purpose"],
    state: row.state as ConsentEvent["state"],
    policyVersion: String(row.policy_version),
    capturedVia: String(row.captured_via),
    idempotencyKey: String(row.idempotency_key),
    occurredAt: iso(row.occurred_at),
  };
}

function toDelivery(row: DatabaseRow): Delivery {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    alertId: row.alert_id ? String(row.alert_id) : undefined,
    messageKind: String(row.message_kind),
    provider: row.provider as Delivery["provider"],
    providerMessageId: row.provider_message_id ? String(row.provider_message_id) : undefined,
    idempotencyKey: String(row.idempotency_key),
    recipientHash: String(row.recipient_hash),
    attemptCount: Number(row.attempt_count),
    status: row.status as DeliveryStatus,
  };
}

export class PostgresUserOperationsRepository implements UserOperationsRepository {
  private clientPromise: Promise<UserOperationsSqlClient> | undefined;

  constructor(
    private readonly databaseUrl: string,
    client?: UserOperationsSqlClient,
  ) {
    if (!databaseUrl.trim()) throw new Error("DATABASE_URL is required for Postgres user operations.");
    if (client) this.clientPromise = Promise.resolve(client);
  }

  private client() {
    this.clientPromise ??= import("postgres").then(
      ({ default: postgres }) =>
        postgres(this.databaseUrl, { max: 4, idle_timeout: 20 }) as unknown as UserOperationsSqlClient,
    );
    return this.clientPromise;
  }

  async addSave(userId: string, companyId: string) {
    const sql = await this.client();
    const rows = await sql.unsafe<DatabaseRow[]>(
      `INSERT INTO company_saves (user_id, company_id)
       SELECT $1::uuid, c.id FROM companies c
       WHERE c.id::text = $2 OR c.slug = $2
       ON CONFLICT (user_id, company_id) DO NOTHING
       RETURNING company_id`,
      [userId, companyId],
    );
    return rows.length > 0;
  }

  async removeSave(userId: string, companyId: string) {
    const sql = await this.client();
    const rows = await sql.unsafe<DatabaseRow[]>(
      `DELETE FROM company_saves saved
       USING companies c
       WHERE saved.user_id = $1::uuid AND saved.company_id = c.id
         AND (c.id::text = $2 OR c.slug = $2)
       RETURNING saved.company_id`,
      [userId, companyId],
    );
    return rows.length > 0;
  }

  async createAlert(alert: Alert) {
    const sql = await this.client();
    const rows = await sql.unsafe<DatabaseRow[]>(
      `INSERT INTO alerts (id, user_id, name, kind, criteria, frequency, status, created_at, updated_at)
       VALUES ($1::uuid, $2::uuid, $3, $4::alert_kind, $5::jsonb, $6::alert_frequency,
         $7::alert_status, $8::timestamptz, $9::timestamptz)
       RETURNING *`,
      [
        alert.id,
        alert.userId,
        alert.name,
        alert.kind,
        JSON.stringify(alert.criteria),
        alert.frequency,
        alert.status,
        alert.createdAt,
        alert.updatedAt,
      ],
    );
    return toAlert(rows[0]!);
  }

  async listAlerts(userId: string) {
    const sql = await this.client();
    const rows = await sql.unsafe<DatabaseRow[]>(
      `SELECT * FROM alerts
       WHERE user_id = $1::uuid AND status <> 'deleted'
       ORDER BY created_at DESC`,
      [userId],
    );
    return rows.map(toAlert);
  }

  async findAlert(alertId: string) {
    const sql = await this.client();
    const rows = await sql.unsafe<DatabaseRow[]>(
      `SELECT * FROM alerts WHERE id = $1::uuid AND status <> 'deleted' LIMIT 1`,
      [alertId],
    );
    return rows[0] ? toAlert(rows[0]) : undefined;
  }

  async updateAlert(alert: Alert) {
    const sql = await this.client();
    const rows = await sql.unsafe<DatabaseRow[]>(
      `UPDATE alerts SET name = $2, kind = $3::alert_kind, criteria = $4::jsonb,
         frequency = $5::alert_frequency, status = $6::alert_status, updated_at = $7::timestamptz
       WHERE id = $1::uuid RETURNING *`,
      [
        alert.id,
        alert.name,
        alert.kind,
        JSON.stringify(alert.criteria),
        alert.frequency,
        alert.status,
        alert.updatedAt,
      ],
    );
    return toAlert(rows[0]!);
  }

  async deleteAlert(alertId: string) {
    const sql = await this.client();
    await sql.unsafe(
      `UPDATE alerts SET status = 'deleted', deleted_at = now(), updated_at = now()
       WHERE id = $1::uuid AND status <> 'deleted'`,
      [alertId],
    );
  }

  async upsertIdentityUser(user: IdentityUser) {
    const sql = await this.client();
    const rows = await sql.unsafe<DatabaseRow[]>(
      `WITH existing_identity AS (
         SELECT user_id FROM user_identities
         WHERE provider = $2::identity_provider AND provider_subject = $3
       ), selected_user AS (
         SELECT COALESCE((SELECT user_id FROM existing_identity), $1::uuid) AS id
       ), upserted_user AS (
         INSERT INTO users (id, primary_email, display_name, status, deleted_at)
         SELECT id, $4, $5, $6::user_account_status,
           CASE WHEN $6 = 'deleted' THEN now() ELSE NULL END
         FROM selected_user
         ON CONFLICT (id) DO UPDATE SET
           primary_email = EXCLUDED.primary_email,
           display_name = EXCLUDED.display_name,
           status = EXCLUDED.status,
           deleted_at = EXCLUDED.deleted_at,
           updated_at = now()
         RETURNING id, primary_email, display_name, status
       ), upserted_identity AS (
         INSERT INTO user_identities (user_id, provider, provider_subject, provider_email)
         SELECT id, $2::identity_provider, $3, $4 FROM upserted_user
         ON CONFLICT (provider, provider_subject) DO UPDATE SET
           provider_email = EXCLUDED.provider_email,
           updated_at = now()
         RETURNING user_id
       ), candidate_role AS (
         INSERT INTO user_roles (user_id, role, revoked_at)
         SELECT user_id, 'candidate', NULL FROM upserted_identity WHERE $6 <> 'deleted'
         ON CONFLICT (user_id, role) DO UPDATE SET revoked_at = NULL
       ), revoked_roles AS (
         UPDATE user_roles SET revoked_at = now()
         WHERE user_id IN (SELECT user_id FROM upserted_identity)
           AND $6 = 'deleted' AND revoked_at IS NULL
       )
       SELECT id, primary_email, display_name, status FROM upserted_user`,
      [
        user.id,
        user.provider,
        user.providerSubject,
        user.primaryEmail ?? null,
        user.displayName ?? null,
        user.status,
      ],
    );
    const row = rows[0]!;
    return {
      id: String(row.id),
      provider: user.provider,
      providerSubject: user.providerSubject,
      primaryEmail: row.primary_email ? String(row.primary_email) : undefined,
      displayName: row.display_name ? String(row.display_name) : undefined,
      status: row.status as IdentityUser["status"],
    };
  }

  async findIdentityUser(provider: IdentityUser["provider"], subject: string) {
    const sql = await this.client();
    const rows = await sql.unsafe<DatabaseRow[]>(
      `SELECT u.id, u.primary_email, u.display_name, u.status
       FROM user_identities identity
       JOIN users u ON u.id = identity.user_id
       WHERE identity.provider = $1::identity_provider AND identity.provider_subject = $2
       LIMIT 1`,
      [provider, subject],
    );
    const row = rows[0];
    return row
      ? {
          id: String(row.id),
          provider,
          providerSubject: subject,
          primaryEmail: row.primary_email ? String(row.primary_email) : undefined,
          displayName: row.display_name ? String(row.display_name) : undefined,
          status: (row.status === "deleted" ? "deleted" : "active") as IdentityUser["status"],
        }
      : undefined;
  }

  async recordConsent(event: ConsentEvent) {
    const sql = await this.client();
    const rows = await sql.unsafe<DatabaseRow[]>(
      `INSERT INTO consent_events
         (id, user_id, purpose, state, policy_version, captured_via, idempotency_key, occurred_at)
       VALUES ($1::uuid, $2::uuid, $3, $4::consent_state, $5, $6, $7, $8::timestamptz)
       ON CONFLICT (idempotency_key) DO NOTHING RETURNING *`,
      [
        event.id,
        event.userId,
        event.purpose,
        event.state,
        event.policyVersion,
        event.capturedVia,
        event.idempotencyKey,
        event.occurredAt,
      ],
    );
    if (rows[0]) return { event: toConsent(rows[0]), created: true };
    const existing = await sql.unsafe<DatabaseRow[]>(
      `SELECT * FROM consent_events WHERE idempotency_key = $1 LIMIT 1`,
      [event.idempotencyKey],
    );
    return { event: toConsent(existing[0]!), created: false };
  }

  async currentConsent(userId: string, purpose: ConsentPurpose) {
    const sql = await this.client();
    const rows = await sql.unsafe<DatabaseRow[]>(
      `SELECT * FROM consent_events
       WHERE user_id = $1::uuid AND purpose = $2
       ORDER BY occurred_at DESC LIMIT 1`,
      [userId, purpose],
    );
    return rows[0] ? toConsent(rows[0]) : undefined;
  }

  async queueDelivery(delivery: Delivery) {
    const sql = await this.client();
    const rows = await sql.unsafe<DatabaseRow[]>(
      `INSERT INTO notification_deliveries
         (id, user_id, alert_id, message_kind, provider, idempotency_key,
          status, recipient_hash, attempt_count)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7::notification_delivery_status, $8, $9)
       ON CONFLICT (idempotency_key) DO NOTHING RETURNING *`,
      [
        delivery.id,
        delivery.userId,
        delivery.alertId ?? null,
        delivery.messageKind,
        delivery.provider,
        delivery.idempotencyKey,
        delivery.status,
        delivery.recipientHash,
        delivery.attemptCount,
      ],
    );
    if (rows[0]) return { delivery: toDelivery(rows[0]), created: true };
    const existing = await sql.unsafe<DatabaseRow[]>(
      `SELECT * FROM notification_deliveries WHERE idempotency_key = $1 LIMIT 1`,
      [delivery.idempotencyKey],
    );
    return { delivery: toDelivery(existing[0]!), created: false };
  }

  async markDeliverySent(deliveryId: string, providerMessageId: string) {
    const sql = await this.client();
    const rows = await sql.unsafe<DatabaseRow[]>(
      `UPDATE notification_deliveries SET provider_message_id = $2, status = 'sent',
         attempt_count = attempt_count + 1, sent_at = now(), updated_at = now()
       WHERE id = $1::uuid RETURNING *`,
      [deliveryId, providerMessageId],
    );
    return rows[0] ? toDelivery(rows[0]) : undefined;
  }

  async createWebhookReceipt(receipt: WebhookReceipt) {
    const sql = await this.client();
    const rows = await sql.unsafe<DatabaseRow[]>(
      `INSERT INTO webhook_events
         (provider, provider_event_id, event_type, payload_hash, status)
       VALUES ($1, $2, $3, $4, $5::webhook_processing_status)
       ON CONFLICT (provider, provider_event_id) DO NOTHING RETURNING id`,
      [receipt.provider, receipt.eventId, receipt.eventType, receipt.payloadHash, receipt.status],
    );
    return rows.length > 0;
  }

  async finishWebhookReceipt(provider: WebhookReceipt["provider"], eventId: string) {
    const sql = await this.client();
    await sql.unsafe(
      `UPDATE webhook_events SET status = 'processed', processed_at = now(), error_code = NULL
       WHERE provider = $1 AND provider_event_id = $2`,
      [provider, eventId],
    );
  }

  async failWebhookReceipt(provider: WebhookReceipt["provider"], eventId: string) {
    const sql = await this.client();
    await sql.unsafe(
      `UPDATE webhook_events SET status = 'failed', processed_at = now(), error_code = 'PROCESSING_ERROR'
       WHERE provider = $1 AND provider_event_id = $2`,
      [provider, eventId],
    );
  }

  async updateDeliveryByProviderMessageId(messageId: string, status: DeliveryStatus) {
    const sql = await this.client();
    const terminalTime = status === "delivered" ? "delivered_at" :
      ["bounced", "complained", "failed", "suppressed"].includes(status) ? "failed_at" : undefined;
    const timeUpdate = terminalTime ? `, ${terminalTime} = now()` : "";
    const rows = await sql.unsafe<DatabaseRow[]>(
      `UPDATE notification_deliveries SET status = $2::notification_delivery_status,
         updated_at = now()${timeUpdate}
       WHERE provider = 'resend' AND provider_message_id = $1
       RETURNING id`,
      [messageId, status],
    );
    return rows.length > 0;
  }
}
