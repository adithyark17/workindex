export type AuthenticatedUser = {
  userId: string;
  provider: "clerk" | "fixture";
  providerSubject?: string;
  sessionId?: string;
};

export interface AuthAdapter {
  authenticate(request: Request): Promise<AuthenticatedUser | null>;
}

export class ClerkCompatibleAuthAdapter implements AuthAdapter {
  constructor(
    private readonly resolve: (request: Request) => Promise<{
      subject: string | null;
      sessionId?: string | null;
    }>,
    private readonly resolveWorkIndexUserId: (subject: string) => Promise<string | null>,
  ) {}

  async authenticate(request: Request): Promise<AuthenticatedUser | null> {
    const identity = await this.resolve(request);
    if (!identity.subject) return null;
    const userId = await this.resolveWorkIndexUserId(identity.subject);
    if (!userId) return null;
    return {
      userId,
      provider: "clerk",
      providerSubject: identity.subject,
      sessionId: identity.sessionId ?? undefined,
    };
  }
}

class FixtureAuthAdapter implements AuthAdapter {
  async authenticate(request: Request): Promise<AuthenticatedUser | null> {
    if (process.env.NODE_ENV === "production" || process.env.WORKINDEX_AUTH_MODE !== "fixture") {
      return null;
    }

    const expectedSecret = process.env.WORKINDEX_FIXTURE_AUTH_SECRET;
    const suppliedSecret = request.headers.get("x-workindex-fixture-secret");
    const userId = request.headers.get("x-workindex-fixture-user");
    if (!expectedSecret || suppliedSecret !== expectedSecret || !userId?.trim()) return null;
    return { userId: userId.trim(), provider: "fixture" };
  }
}

let configuredAdapter: AuthAdapter | undefined;

/**
 * The Clerk composition root should pass a session resolver backed by
 * `auth()` from `@clerk/nextjs/server` and an identity resolver that maps the
 * Clerk subject to WorkIndex's canonical UUID. Keeping those imports and
 * queries outside this module lets the domain run before the SDK is installed.
 */
export function configureAuthAdapter(adapter: AuthAdapter) {
  configuredAdapter = adapter;
}

export function resetAuthAdapter() {
  configuredAdapter = undefined;
}

export async function authenticateRequest(request: Request) {
  return (configuredAdapter ?? new FixtureAuthAdapter()).authenticate(request);
}
