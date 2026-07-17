import { describe, expect, it } from "vitest";
import {
  PostgresUserOperationsRepository,
  type UserOperationsSqlClient,
} from "./user-operations-postgres";

function fakeClient(
  respond: (query: string, parameters: (string | number | boolean | null)[]) => Record<string, unknown>[],
) {
  const calls: { query: string; parameters: (string | number | boolean | null)[] }[] = [];
  const client: UserOperationsSqlClient = {
    async unsafe(query, parameters = []) {
      calls.push({ query, parameters });
      return respond(query, parameters) as never;
    },
  };
  return { calls, client };
}

describe("PostgresUserOperationsRepository", () => {
  it("resolves a company UUID or slug while preserving idempotent save semantics", async () => {
    let invocation = 0;
    const { calls, client } = fakeClient(() => (invocation++ === 0 ? [{ company_id: "company-1" }] : []));
    const repository = new PostgresUserOperationsRepository("postgres://test", client);
    await expect(repository.addSave("00000000-0000-4000-8000-000000000001", "northstar")).resolves.toBe(true);
    await expect(repository.addSave("00000000-0000-4000-8000-000000000001", "northstar")).resolves.toBe(false);
    expect(calls[0]?.query).toContain("ON CONFLICT (user_id, company_id) DO NOTHING");
    expect(calls[0]?.parameters[1]).toBe("northstar");
  });

  it("atomically syncs identity, candidate role, and deletion role revocation", async () => {
    const { calls, client } = fakeClient(() => [
      {
        id: "00000000-0000-4000-8000-000000000001",
        primary_email: "asha@example.com",
        display_name: "Asha Rao",
        status: "active",
      },
    ]);
    const repository = new PostgresUserOperationsRepository("postgres://test", client);
    await expect(
      repository.upsertIdentityUser({
        id: "00000000-0000-4000-8000-000000000001",
        provider: "clerk",
        providerSubject: "user_clerk_1",
        primaryEmail: "asha@example.com",
        displayName: "Asha Rao",
        status: "active",
      }),
    ).resolves.toMatchObject({ id: "00000000-0000-4000-8000-000000000001", status: "active" });
    expect(calls[0]?.query).toContain("INSERT INTO user_roles");
    expect(calls[0]?.query).toContain("UPDATE user_roles SET revoked_at = now()");
  });

  it("sets delivery lifecycle timestamps from Resend status", async () => {
    const { calls, client } = fakeClient(() => [{ id: "delivery-1" }]);
    const repository = new PostgresUserOperationsRepository("postgres://test", client);
    await expect(repository.updateDeliveryByProviderMessageId("email-1", "delivered")).resolves.toBe(true);
    expect(calls[0]?.query).toContain("delivered_at = now()");
    expect(calls[0]?.parameters).toEqual(["email-1", "delivered"]);
  });
});
