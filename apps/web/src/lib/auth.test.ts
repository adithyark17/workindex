import { afterEach, describe, expect, it } from "vitest";
import {
  authenticateRequest,
  ClerkCompatibleAuthAdapter,
  configureAuthAdapter,
  resetAuthAdapter,
} from "./auth";

afterEach(() => {
  resetAuthAdapter();
  delete process.env.WORKINDEX_AUTH_MODE;
  delete process.env.WORKINDEX_FIXTURE_AUTH_SECRET;
});

describe("authentication adapters", () => {
  it("uses a Clerk-compatible resolver without importing the SDK", async () => {
    configureAuthAdapter(
      new ClerkCompatibleAuthAdapter(
        async () => ({ subject: "user_clerk_1", sessionId: "session-1" }),
        async () => "00000000-0000-4000-8000-000000000001",
      ),
    );
    await expect(authenticateRequest(new Request("https://workindex.test"))).resolves.toEqual({
      userId: "00000000-0000-4000-8000-000000000001",
      provider: "clerk",
      providerSubject: "user_clerk_1",
      sessionId: "session-1",
    });
  });

  it("requires an explicit secret for fixture auth", async () => {
    process.env.WORKINDEX_AUTH_MODE = "fixture";
    process.env.WORKINDEX_FIXTURE_AUTH_SECRET = "test-secret";
    const denied = new Request("https://workindex.test", {
      headers: { "x-workindex-fixture-user": "user-1" },
    });
    await expect(authenticateRequest(denied)).resolves.toBeNull();

    const allowed = new Request("https://workindex.test", {
      headers: {
        "x-workindex-fixture-user": "user-1",
        "x-workindex-fixture-secret": "test-secret",
      },
    });
    await expect(authenticateRequest(allowed)).resolves.toMatchObject({ userId: "user-1" });
  });
});
