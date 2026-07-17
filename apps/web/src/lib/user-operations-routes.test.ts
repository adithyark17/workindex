import { beforeEach, describe, expect, it } from "vitest";
import { GET as listAlerts, POST as createAlert } from "../app/api/v1/alerts/route";
import { DELETE as deleteAlert, PATCH as patchAlert } from "../app/api/v1/alerts/[alertId]/route";
import { POST as saveCompany } from "../app/api/v1/saves/route";
import { POST as clerkWebhook } from "../app/api/webhooks/clerk/route";
import { POST as resendWebhook } from "../app/api/webhooks/resend/route";
import { configureAuthAdapter } from "./auth";
import { fixtureUserOperationsRepository } from "./user-operations";
import {
  configureWebhookVerifier,
  resetWebhookVerifiers,
  type WebhookProvider,
} from "./webhook-verification";

function authenticatedRequest(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("x-test-user", "user-1");
  if (init?.body) headers.set("content-type", "application/json");
  return new Request(`https://workindex.test${path}`, { ...init, headers });
}

function configureBodyVerifier(provider: WebhookProvider, eventId: string) {
  configureWebhookVerifier(provider, {
    async verify(request) {
      return { eventId, payload: await request.json() };
    },
  });
}

beforeEach(() => {
  fixtureUserOperationsRepository.saves.clear();
  fixtureUserOperationsRepository.alerts.clear();
  fixtureUserOperationsRepository.users.clear();
  fixtureUserOperationsRepository.consentEvents.clear();
  fixtureUserOperationsRepository.webhookReceipts.clear();
  fixtureUserOperationsRepository.deliveries.clear();
  resetWebhookVerifiers();
  configureAuthAdapter({
    async authenticate(request) {
      const userId = request.headers.get("x-test-user");
      return userId ? { userId, provider: "fixture" as const } : null;
    },
  });
});

describe("user operations API contracts", () => {
  it("requires authentication and makes save creation idempotent", async () => {
    const denied = await saveCompany(
      new Request("https://workindex.test/api/v1/saves", {
        method: "POST",
        body: JSON.stringify({ companyId: "company-1" }),
      }),
    );
    expect(denied.status).toBe(401);

    const request = () =>
      authenticatedRequest("/api/v1/saves", {
        method: "POST",
        body: JSON.stringify({ companyId: "company-1" }),
      });
    expect((await saveCompany(request())).status).toBe(201);
    const duplicate = await saveCompany(request());
    expect(duplicate.status).toBe(200);
    await expect(duplicate.json()).resolves.toMatchObject({ meta: { created: false } });
  });

  it("supports alert create, list, update, and delete", async () => {
    const created = await createAlert(
      authenticatedRequest("/api/v1/alerts", {
        method: "POST",
        body: JSON.stringify({
          name: "Northstar jobs",
          kind: "new_jobs",
          criteria: { companyId: "company-1" },
          frequency: "daily",
        }),
      }),
    );
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as { data: { id: string } };

    const listed = await listAlerts(authenticatedRequest("/api/v1/alerts"));
    await expect(listed.json()).resolves.toMatchObject({ meta: { count: 1 } });

    const patched = await patchAlert(
      authenticatedRequest(`/api/v1/alerts/${createdBody.data.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "paused" }),
      }),
      { params: Promise.resolve({ alertId: createdBody.data.id }) },
    );
    await expect(patched.json()).resolves.toMatchObject({ data: { status: "paused" } });

    const deleted = await deleteAlert(
      authenticatedRequest(`/api/v1/alerts/${createdBody.data.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ alertId: createdBody.data.id }) },
    );
    expect(deleted.status).toBe(204);
  });
});

describe("identity and delivery webhook contracts", () => {
  it("accepts a verified Clerk user sync event", async () => {
    configureBodyVerifier("clerk", "clerk-event-1");
    const response = await clerkWebhook(
      new Request("https://workindex.test/api/webhooks/clerk", {
        method: "POST",
        body: JSON.stringify({
          type: "user.created",
          data: { id: "user_clerk_1", first_name: "Asha", email_addresses: [] },
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await fixtureUserOperationsRepository.findIdentityUser("clerk", "user_clerk_1")).toMatchObject({
      displayName: "Asha",
      status: "active",
    });
  });

  it("accepts verified Resend status and reports unmatched deliveries", async () => {
    configureBodyVerifier("resend", "resend-event-1");
    const response = await resendWebhook(
      new Request("https://workindex.test/api/webhooks/resend", {
        method: "POST",
        body: JSON.stringify({ type: "email.delivered", data: { email_id: "email-unknown" } }),
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ received: true, matched: false });
  });
});
