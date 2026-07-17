import { describe, expect, it } from "vitest";
import {
  MemoryUserOperationsRepository,
  UserOperationsError,
  UserOperationsService,
} from "./user-operations";

function setup() {
  const repository = new MemoryUserOperationsRepository();
  let id = 0;
  const service = new UserOperationsService(
    repository,
    () => new Date("2026-07-17T00:00:00.000Z"),
    () => `id-${++id}`,
  );
  return { repository, service };
}

describe("UserOperationsService", () => {
  it("makes company saves and removals idempotent per user", async () => {
    const { service } = setup();
    await expect(service.saveCompany("user-1", "company-1")).resolves.toBe(true);
    await expect(service.saveCompany("user-1", "company-1")).resolves.toBe(false);
    await expect(service.removeSavedCompany("user-1", "company-1")).resolves.toBe(true);
    await expect(service.removeSavedCompany("user-1", "company-1")).resolves.toBe(false);
  });

  it("creates, updates, lists, and deletes alerts for their owner", async () => {
    const { service } = setup();
    const alert = await service.createAlert("user-1", {
      name: "Northstar jobs",
      kind: "new_jobs",
      criteria: { companyId: "company-1" },
      frequency: "daily",
    });
    expect(await service.listAlerts("user-1")).toEqual([alert]);
    const paused = await service.updateAlert("user-1", alert.id, { status: "paused" });
    expect(paused.status).toBe("paused");
    await expect(service.updateAlert("user-2", alert.id, { status: "active" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await service.deleteAlert("user-1", alert.id);
    expect(await service.listAlerts("user-1")).toEqual([]);
  });

  it("requires company criteria for company and job alerts", async () => {
    const { service } = setup();
    await expect(
      service.createAlert("user-1", {
        name: "Jobs",
        kind: "new_jobs",
        criteria: { city: "Hyderabad" },
        frequency: "weekly",
      }),
    ).rejects.toBeInstanceOf(UserOperationsError);
  });

  it("synchronises Clerk users and ignores duplicate webhook deliveries", async () => {
    const { repository, service } = setup();
    const payload = {
      type: "user.created",
      data: {
        id: "user_clerk_1",
        first_name: "Asha",
        last_name: "Rao",
        primary_email_address_id: "email-1",
        email_addresses: [{ id: "email-1", email_address: "ASHA@example.com" }],
      },
    };
    await expect(service.handleClerkWebhook("evt-1", payload)).resolves.toEqual({ duplicate: false });
    await expect(service.handleClerkWebhook("evt-1", payload)).resolves.toEqual({ duplicate: true });
    expect(await repository.findIdentityUser("clerk", "user_clerk_1")).toMatchObject({
      primaryEmail: "asha@example.com",
      displayName: "Asha Rao",
      status: "active",
    });
    expect(repository.webhookReceipts.get("clerk:evt-1")?.payloadHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("maps Resend delivery events and deduplicates by Svix event id", async () => {
    const { repository, service } = setup();
    repository.deliveries.set("delivery-1", {
      id: "delivery-1",
      userId: "user-1",
      messageKind: "alert_digest",
      provider: "resend",
      providerMessageId: "email-1",
      idempotencyKey: "digest:user-1:2026-07-17",
      recipientHash: "a".repeat(64),
      attemptCount: 1,
      status: "sent",
    });
    const payload = { type: "email.bounced", data: { email_id: "email-1" } };
    await expect(service.handleResendWebhook("evt-2", payload)).resolves.toEqual({
      duplicate: false,
      matched: true,
    });
    await expect(service.handleResendWebhook("evt-2", payload)).resolves.toEqual({
      duplicate: true,
      matched: false,
    });
    expect(repository.deliveries.get("delivery-1")?.status).toBe("bounced");
  });

  it("records append-only consent idempotently and returns the current state", async () => {
    const { service } = setup();
    const input = {
      purpose: "alerts" as const,
      state: "granted" as const,
      policyVersion: "2026-07-17",
      capturedVia: "alert_creation",
      idempotencyKey: "consent-1",
    };
    await expect(service.recordConsent("user-1", input)).resolves.toMatchObject({ created: true });
    await expect(service.recordConsent("user-1", input)).resolves.toMatchObject({ created: false });
    await expect(service.currentConsent("user-1", "alerts")).resolves.toMatchObject({
      state: "granted",
      policyVersion: "2026-07-17",
    });
  });

  it("queues notifications idempotently before attaching a provider message id", async () => {
    const { service } = setup();
    const input = {
      messageKind: "company_alert",
      provider: "resend" as const,
      alertId: "alert-1",
      idempotencyKey: "alert-1:event-1",
      recipientHash: "b".repeat(64),
    };
    const first = await service.queueNotification("user-1", input);
    expect(first).toMatchObject({ created: true, delivery: { status: "queued", attemptCount: 0 } });
    await expect(service.queueNotification("user-1", input)).resolves.toMatchObject({ created: false });
    await expect(service.markNotificationSent(first.delivery.id, "email-1")).resolves.toMatchObject({
      status: "sent",
      providerMessageId: "email-1",
      attemptCount: 1,
    });
  });
});
