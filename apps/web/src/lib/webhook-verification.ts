export type WebhookProvider = "clerk" | "resend";

export type VerifiedWebhook = {
  eventId: string;
  payload: unknown;
};

export interface WebhookVerifier {
  verify(request: Request): Promise<VerifiedWebhook>;
}

const configured = new Map<WebhookProvider, WebhookVerifier>();

/**
 * Production should register Clerk's `verifyWebhook()` or Resend's webhook
 * verifier here. Both providers use Svix signatures; raw body verification
 * belongs in those SDK adapters, not in the domain service.
 */
export function configureWebhookVerifier(provider: WebhookProvider, verifier: WebhookVerifier) {
  configured.set(provider, verifier);
}

export function resetWebhookVerifiers() {
  configured.clear();
}

class FixtureWebhookVerifier implements WebhookVerifier {
  async verify(request: Request): Promise<VerifiedWebhook> {
    if (process.env.NODE_ENV === "production" || process.env.WORKINDEX_WEBHOOK_MODE !== "fixture") {
      throw new Error("Webhook verifier is not configured.");
    }
    const expectedSecret = process.env.WORKINDEX_FIXTURE_WEBHOOK_SECRET;
    const suppliedSecret = request.headers.get("x-workindex-fixture-secret");
    const eventId = request.headers.get("svix-id") ?? request.headers.get("x-workindex-event-id");
    if (!expectedSecret || suppliedSecret !== expectedSecret || !eventId) {
      throw new Error("Webhook signature verification failed.");
    }
    return { eventId, payload: await request.json() };
  }
}

class ClerkWebhookVerifier implements WebhookVerifier {
  async verify(request: Request): Promise<VerifiedWebhook> {
    const { verifyWebhook } = await import("@clerk/nextjs/webhooks");
    const payload = await verifyWebhook(request as Parameters<typeof verifyWebhook>[0], { signingSecret: process.env.CLERK_WEBHOOK_SIGNING_SECRET });
    const eventId = request.headers.get("svix-id");
    if (!eventId) throw new Error("Clerk webhook id is missing.");
    return { eventId, payload };
  }
}

class ResendWebhookVerifier implements WebhookVerifier {
  async verify(request: Request): Promise<VerifiedWebhook> {
    const { Resend } = await import("resend");
    const webhookSecret = process.env.RESEND_WEBHOOK_SIGNING_SECRET;
    const id = request.headers.get("svix-id");
    const timestamp = request.headers.get("svix-timestamp");
    const signature = request.headers.get("svix-signature");
    if (!webhookSecret || !id || !timestamp || !signature) throw new Error("Resend webhook signature headers are incomplete.");
    const payload = new Resend(process.env.RESEND_API_KEY).webhooks.verify({
      payload: await request.text(), headers: { id, timestamp, signature }, webhookSecret,
    });
    return { eventId: id, payload };
  }
}

export function webhookVerifier(provider: WebhookProvider) {
  const custom = configured.get(provider);
  if (custom) return custom;
  if (provider === "clerk" && process.env.CLERK_WEBHOOK_SIGNING_SECRET) return new ClerkWebhookVerifier();
  if (provider === "resend" && process.env.RESEND_WEBHOOK_SIGNING_SECRET) return new ResendWebhookVerifier();
  return new FixtureWebhookVerifier();
}
