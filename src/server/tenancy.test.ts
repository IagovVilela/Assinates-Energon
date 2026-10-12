import { describe, expect, it } from "vitest";

import { companyData, type CompanyRecord, type CompanyScopedDb } from "@/server/tenancy";

function memoryDb(rows: CompanyRecord[]): CompanyScopedDb {
  const apply = (where: { companyId: string; id?: string }) =>
    rows.filter((row) => row.companyId === where.companyId && (where.id ? row.id === where.id : true));
  return {
    subscription: {
      findMany: async ({ where }) => apply(where),
      findFirst: async ({ where }) => apply(where)[0] ?? null,
    },
    invoice: {
      findMany: async ({ where }) => apply(where),
      findFirst: async ({ where }) => apply(where)[0] ?? null,
    },
    ticket: {
      findMany: async ({ where }) => apply(where),
      findFirst: async ({ where }) => apply(where)[0] ?? null,
    },
  };
}

describe("company isolation", () => {
  const rows: CompanyRecord[] = [
    { id: "a1", companyId: "company-a" },
    { id: "b1", companyId: "company-b" },
  ];

  it("never returns another company's rows", async () => {
    const store = companyData(memoryDb(rows), "company-a");
    const subscriptions = await store.listSubscriptions();
    const leaked = await store.getSubscription("b1");
    expect(subscriptions.map((row) => row.id)).toEqual(["a1"]);
    expect(leaked).toBeNull();
  });

  it("refuses an empty company id", () => {
    expect(() => companyData(memoryDb(rows), "")).toThrow(/companyId/);
  });
});
