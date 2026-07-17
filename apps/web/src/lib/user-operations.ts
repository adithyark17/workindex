import { runtimeConfig } from "./runtime-config";
import { PostgresUserOperationsRepository } from "./user-operations-postgres";

export const alertKinds = [
  "company_updates",
  "new_jobs",
  "gcc_launches",
  "gcc_expansions",
] as const;
export const alertFrequencies = ["instant", "daily", "weekly"] as const;

export type AlertKind = (typeof alertKinds)[number];
export type AlertFrequency = (typeof alertFrequencies)[number];
export type AlertStatus = "active" | "paused";
export type AlertCriteria = {
  companyId?: string;
  city?: string;
  capability?: string;
};

export type Alert = {
  id: string;
  userId: string;
  name: string;
  kind: AlertKind;
  criteria: AlertCriteria;
  frequency: AlertFrequency;
  status: AlertStatus;
  createdAt: string;
  updatedAt: string;
};

export type IdentityUser = {
  id: string;
  provider: "clerk" | "fixture";
  providerSubject: string;
  primaryEmail?: string;
  displayName?: string;
  status: "active" | "deleted";
};

export type ConsentPurpose = "terms" | "privacy" | "alerts" | "newsletter" | "product_updates";
export type ConsentState = "granted" | "withdrawn";
export type ConsentEvent = {
  id: string;
  userId: string;
  purpose: ConsentPurpose;
  state: ConsentState;
  policyVersion: string;
  capturedVia: string;
  idempotencyKey: string;
  occurredAt: string;
};

export type DeliveryStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "delayed"
  | "bounced"
  | "complained"
  | "failed"
  | "suppressed";

export type Delivery = {
  id: string;
  userId: string;
  alertId?: string;
  messageKind: string;
  provider: "resend" | "fixture";
  providerMessageId?: string;
  idempotencyKey: string;
  recipientHash: string;
  attemptCount: number;
  status: DeliveryStatus;
};

export type WebhookReceipt = {
  provider: "clerk" | "resend";
  eventId: string;
  eventType: string;
  payloadHash: string;
  status: "processing" | "processed" | "failed";
};

export interface UserOperationsRepository {
  addSave(userId: string, companyId: string): Promise<boolean>;
  removeSave(userId: string, companyId: string): Promise<boolean>;
  createAlert(alert: Alert): Promise<Alert>;
  listAlerts(userId: string): Promise<Alert[]>;
  findAlert(alertId: string): Promise<Alert | undefined>;
  updateAlert(alert: Alert): Promise<Alert>;
  deleteAlert(alertId: string): Promise<void>;
  upsertIdentityUser(user: IdentityUser): Promise<IdentityUser>;
  findIdentityUser(provider: IdentityUser["provider"], subject: string): Promise<IdentityUser | undefined>;
  recordConsent(event: ConsentEvent): Promise<{ event: ConsentEvent; created: boolean }>;
  currentConsent(userId: string, purpose: ConsentPurpose): Promise<ConsentEvent | undefined>;
  queueDelivery(delivery: Delivery): Promise<{ delivery: Delivery; created: boolean }>;
  markDeliverySent(deliveryId: string, providerMessageId: string): Promise<Delivery | undefined>;
  createWebhookReceipt(receipt: WebhookReceipt): Promise<boolean>;
  finishWebhookReceipt(provider: WebhookReceipt["provider"], eventId: string): Promise<void>;
  failWebhookReceipt(provider: WebhookReceipt["provider"], eventId: string): Promise<void>;
  updateDeliveryByProviderMessageId(messageId: string, status: DeliveryStatus): Promise<boolean>;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryUserOperationsRepository implements UserOperationsRepository {
  readonly saves = new Set<string>();
  readonly alerts = new Map<string, Alert>();
  readonly users = new Map<string, IdentityUser>();
  readonly consentEvents = new Map<string, ConsentEvent>();
  readonly webhookReceipts = new Map<string, WebhookReceipt>();
  readonly deliveries = new Map<string, Delivery>();

  async addSave(userId: string, companyId: string) {
    const key = `${userId}:${companyId}`;
    const existed = this.saves.has(key);
    this.saves.add(key);
    return !existed;
  }

  async removeSave(userId: string, companyId: string) {
    return this.saves.delete(`${userId}:${companyId}`);
  }

  async createAlert(alert: Alert) {
    this.alerts.set(alert.id, clone(alert));
    return clone(alert);
  }

  async listAlerts(userId: string) {
    return [...this.alerts.values()]
      .filter((alert) => alert.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(clone);
  }

  async findAlert(alertId: string) {
    const alert = this.alerts.get(alertId);
    return alert ? clone(alert) : undefined;
  }

  async updateAlert(alert: Alert) {
    this.alerts.set(alert.id, clone(alert));
    return clone(alert);
  }

  async deleteAlert(alertId: string) {
    this.alerts.delete(alertId);
  }

  async upsertIdentityUser(user: IdentityUser) {
    this.users.set(`${user.provider}:${user.providerSubject}`, clone(user));
    return clone(user);
  }

  async findIdentityUser(provider: IdentityUser["provider"], subject: string) {
    const user = this.users.get(`${provider}:${subject}`);
    return user ? clone(user) : undefined;
  }

  async recordConsent(event: ConsentEvent) {
    const existing = this.consentEvents.get(event.idempotencyKey);
    if (existing) return { event: clone(existing), created: false };
    this.consentEvents.set(event.idempotencyKey, clone(event));
    return { event: clone(event), created: true };
  }

  async currentConsent(userId: string, purpose: ConsentPurpose) {
    const event = [...this.consentEvents.values()]
      .filter((candidate) => candidate.userId === userId && candidate.purpose === purpose)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
    return event ? clone(event) : undefined;
  }

  async queueDelivery(delivery: Delivery) {
    const existing = [...this.deliveries.values()].find(
      (candidate) => candidate.idempotencyKey === delivery.idempotencyKey,
    );
    if (existing) return { delivery: clone(existing), created: false };
    this.deliveries.set(delivery.id, clone(delivery));
    return { delivery: clone(delivery), created: true };
  }

  async markDeliverySent(deliveryId: string, providerMessageId: string) {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery) return undefined;
    delivery.providerMessageId = providerMessageId;
    delivery.status = "sent";
    delivery.attemptCount += 1;
    return clone(delivery);
  }

  async createWebhookReceipt(receipt: WebhookReceipt) {
    const key = `${receipt.provider}:${receipt.eventId}`;
    if (this.webhookReceipts.has(key)) return false;
    this.webhookReceipts.set(key, clone(receipt));
    return true;
  }

  async finishWebhookReceipt(provider: WebhookReceipt["provider"], eventId: string) {
    const receipt = this.webhookReceipts.get(`${provider}:${eventId}`);
    if (receipt) receipt.status = "processed";
  }

  async failWebhookReceipt(provider: WebhookReceipt["provider"], eventId: string) {
    const receipt = this.webhookReceipts.get(`${provider}:${eventId}`);
    if (receipt) receipt.status = "failed";
  }

  async updateDeliveryByProviderMessageId(messageId: string, status: DeliveryStatus) {
    const delivery = [...this.deliveries.values()].find(
      (candidate) => candidate.providerMessageId === messageId,
    );
    if (!delivery) return false;
    delivery.status = status;
    return true;
  }
}

export type CreateAlertInput = {
  name: string;
  kind: AlertKind;
  criteria: AlertCriteria;
  frequency: AlertFrequency;
};

export type UpdateAlertInput = Partial<CreateAlertInput> & { status?: AlertStatus };
export type RecordConsentInput = Omit<ConsentEvent, "id" | "userId" | "occurredAt">;
export type QueueDeliveryInput = Omit<
  Delivery,
  "id" | "userId" | "status" | "attemptCount" | "providerMessageId"
>;

export class UserOperationsError extends Error {
  constructor(readonly code: "NOT_FOUND" | "FORBIDDEN" | "INVALID_INPUT", message: string) {
    super(message);
  }
}

function assertAlertInput(input: CreateAlertInput) {
  if (!input.name.trim() || input.name.trim().length > 120) {
    throw new UserOperationsError("INVALID_INPUT", "Alert name must be 1–120 characters.");
  }
  if (!alertKinds.includes(input.kind)) {
    throw new UserOperationsError("INVALID_INPUT", "Unsupported alert kind.");
  }
  if (!alertFrequencies.includes(input.frequency)) {
    throw new UserOperationsError("INVALID_INPUT", "Unsupported alert frequency.");
  }
  const entries = Object.entries(input.criteria);
  const allowed = new Set(["companyId", "city", "capability"]);
  if (
    entries.length === 0 ||
    entries.some(([key, value]) => !allowed.has(key) || typeof value !== "string" || !value.trim())
  ) {
    throw new UserOperationsError("INVALID_INPUT", "Alert criteria are invalid.");
  }
  if ((input.kind === "company_updates" || input.kind === "new_jobs") && !input.criteria.companyId) {
    throw new UserOperationsError("INVALID_INPUT", "This alert requires a companyId criterion.");
  }
}

export class UserOperationsService {
  constructor(
    private readonly repository: UserOperationsRepository,
    private readonly now = () => new Date(),
    private readonly newId: () => string = () => crypto.randomUUID(),
  ) {}

  saveCompany(userId: string, companyId: string) {
    if (!companyId.trim()) {
      throw new UserOperationsError("INVALID_INPUT", "companyId is required.");
    }
    return this.repository.addSave(userId, companyId.trim());
  }

  removeSavedCompany(userId: string, companyId: string) {
    if (!companyId.trim()) {
      throw new UserOperationsError("INVALID_INPUT", "companyId is required.");
    }
    return this.repository.removeSave(userId, companyId.trim());
  }

  async createAlert(userId: string, input: CreateAlertInput) {
    assertAlertInput(input);
    const timestamp = this.now().toISOString();
    return this.repository.createAlert({
      id: this.newId(),
      userId,
      name: input.name.trim(),
      kind: input.kind,
      criteria: clone(input.criteria),
      frequency: input.frequency,
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  listAlerts(userId: string) {
    return this.repository.listAlerts(userId);
  }

  async updateAlert(userId: string, alertId: string, changes: UpdateAlertInput) {
    const existing = await this.ownedAlert(userId, alertId);
    const candidate = {
      name: changes.name ?? existing.name,
      kind: changes.kind ?? existing.kind,
      criteria: changes.criteria ?? existing.criteria,
      frequency: changes.frequency ?? existing.frequency,
    };
    assertAlertInput(candidate);
    if (changes.status && !["active", "paused"].includes(changes.status)) {
      throw new UserOperationsError("INVALID_INPUT", "Unsupported alert status.");
    }
    return this.repository.updateAlert({
      ...existing,
      ...candidate,
      status: changes.status ?? existing.status,
      updatedAt: this.now().toISOString(),
    });
  }

  async deleteAlert(userId: string, alertId: string) {
    await this.ownedAlert(userId, alertId);
    await this.repository.deleteAlert(alertId);
  }

  recordConsent(userId: string, input: RecordConsentInput) {
    const purposes: ConsentPurpose[] = ["terms", "privacy", "alerts", "newsletter", "product_updates"];
    if (
      !purposes.includes(input.purpose) ||
      !["granted", "withdrawn"].includes(input.state) ||
      !input.policyVersion.trim() ||
      !input.capturedVia.trim() ||
      !input.idempotencyKey.trim()
    ) {
      throw new UserOperationsError("INVALID_INPUT", "Consent event is invalid.");
    }
    return this.repository.recordConsent({
      ...input,
      id: this.newId(),
      userId,
      policyVersion: input.policyVersion.trim(),
      capturedVia: input.capturedVia.trim(),
      idempotencyKey: input.idempotencyKey.trim(),
      occurredAt: this.now().toISOString(),
    });
  }

  currentConsent(userId: string, purpose: ConsentPurpose) {
    return this.repository.currentConsent(userId, purpose);
  }

  findIdentityUser(provider: IdentityUser["provider"], subject: string) {
    return this.repository.findIdentityUser(provider, subject);
  }

  queueNotification(userId: string, input: QueueDeliveryInput) {
    if (
      !input.messageKind.trim() ||
      !input.idempotencyKey.trim() ||
      !/^[a-f0-9]{64}$/i.test(input.recipientHash)
    ) {
      throw new UserOperationsError("INVALID_INPUT", "Notification delivery is invalid.");
    }
    return this.repository.queueDelivery({
      ...input,
      id: this.newId(),
      userId,
      messageKind: input.messageKind.trim(),
      idempotencyKey: input.idempotencyKey.trim(),
      recipientHash: input.recipientHash.toLowerCase(),
      status: "queued",
      attemptCount: 0,
    });
  }

  async markNotificationSent(deliveryId: string, providerMessageId: string) {
    if (!providerMessageId.trim()) {
      throw new UserOperationsError("INVALID_INPUT", "Provider message id is required.");
    }
    const delivery = await this.repository.markDeliverySent(deliveryId, providerMessageId.trim());
    if (!delivery) throw new UserOperationsError("NOT_FOUND", "Notification delivery not found.");
    return delivery;
  }

  private async ownedAlert(userId: string, alertId: string) {
    const alert = await this.repository.findAlert(alertId);
    if (!alert) throw new UserOperationsError("NOT_FOUND", "Alert not found.");
    if (alert.userId !== userId) {
      throw new UserOperationsError("FORBIDDEN", "Alert belongs to another user.");
    }
    return alert;
  }

  async handleClerkWebhook(eventId: string, payload: unknown) {
    const event = parseClerkEvent(payload);
    const claimed = await this.repository.createWebhookReceipt({
      provider: "clerk",
      eventId,
      eventType: event.type,
      payloadHash: await sha256Json(payload),
      status: "processing",
    });
    if (!claimed) return { duplicate: true };

    try {
      const current = await this.repository.findIdentityUser("clerk", event.subject);
      await this.repository.upsertIdentityUser({
        id: current?.id ?? this.newId(),
        provider: "clerk",
        providerSubject: event.subject,
        primaryEmail: event.primaryEmail,
        displayName: event.displayName,
        status: event.deleted ? "deleted" : "active",
      });
      await this.repository.finishWebhookReceipt("clerk", eventId);
      return { duplicate: false };
    } catch (error) {
      await this.repository.failWebhookReceipt("clerk", eventId);
      throw error;
    }
  }

  async handleResendWebhook(eventId: string, payload: unknown) {
    const event = parseResendEvent(payload);
    const claimed = await this.repository.createWebhookReceipt({
      provider: "resend",
      eventId,
      eventType: event.type,
      payloadHash: await sha256Json(payload),
      status: "processing",
    });
    if (!claimed) return { duplicate: true, matched: false };

    try {
      const matched = await this.repository.updateDeliveryByProviderMessageId(
        event.messageId,
        event.status,
      );
      await this.repository.finishWebhookReceipt("resend", eventId);
      return { duplicate: false, matched };
    } catch (error) {
      await this.repository.failWebhookReceipt("resend", eventId);
      throw error;
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new UserOperationsError("INVALID_INPUT", "Webhook payload must be an object.");
  }
  return value as Record<string, unknown>;
}

async function sha256Json(payload: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseClerkEvent(payload: unknown) {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const type = typeof root.type === "string" ? root.type : "";
  if (!["user.created", "user.updated", "user.deleted"].includes(type)) {
    throw new UserOperationsError("INVALID_INPUT", "Unsupported Clerk event.");
  }
  if (typeof data.id !== "string" || !data.id) {
    throw new UserOperationsError("INVALID_INPUT", "Clerk user id is required.");
  }

  let primaryEmail: string | undefined;
  if (type !== "user.deleted" && Array.isArray(data.email_addresses)) {
    const primaryId = data.primary_email_address_id;
    const addresses = data.email_addresses.map(asRecord);
    const primary = addresses.find((email) => email.id === primaryId) ?? addresses[0];
    if (primary && typeof primary.email_address === "string") {
      primaryEmail = primary.email_address.toLowerCase();
    }
  }
  const names = [data.first_name, data.last_name].filter(
    (value): value is string => typeof value === "string" && Boolean(value.trim()),
  );
  return {
    type,
    subject: data.id,
    primaryEmail,
    displayName: names.length ? names.join(" ") : undefined,
    deleted: type === "user.deleted",
  };
}

function parseResendEvent(payload: unknown) {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const type = typeof root.type === "string" ? root.type : "";
  const statusByType: Record<string, DeliveryStatus> = {
    "email.sent": "sent",
    "email.delivered": "delivered",
    "email.delivery_delayed": "delayed",
    "email.bounced": "bounced",
    "email.complained": "complained",
    "email.failed": "failed",
    "email.suppressed": "suppressed",
  };
  const status = statusByType[type];
  if (!status) throw new UserOperationsError("INVALID_INPUT", "Unsupported Resend event.");
  if (typeof data.email_id !== "string" || !data.email_id) {
    throw new UserOperationsError("INVALID_INPUT", "Resend email id is required.");
  }
  return { type, messageId: data.email_id, status };
}

const memoryRepository = new MemoryUserOperationsRepository();
const fixtureService = new UserOperationsService(memoryRepository);
let configuredService: UserOperationsService | undefined;

export function configureUserOperationsRepository(repository: UserOperationsRepository) {
  configuredService = new UserOperationsService(repository);
}

export function resetUserOperationsRepository() {
  configuredService = undefined;
}

export function getUserOperationsService() {
  if (configuredService) return configuredService;
  if (runtimeConfig.dataMode === "database") {
    if (!runtimeConfig.databaseUrl) {
      throw new Error("DATABASE_URL is required in database mode.");
    }
    configuredService = new UserOperationsService(
      new PostgresUserOperationsRepository(runtimeConfig.databaseUrl),
    );
    return configuredService;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("A persistent user operations repository is required in production.");
  }
  return fixtureService;
}

export { memoryRepository as fixtureUserOperationsRepository };
