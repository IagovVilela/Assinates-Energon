import { describe, expect, it } from "vitest";

import { assertCanSubscribe, BillingRuleError } from "@/server/payments/rules";

const plan = { type: "RECURRING" as const, interval: "MONTH" as const, active: true };

describe("billing rules", () => {
  it("keeps a Brazilian company on Asaas and BRL", () => {
    expect(() =>
      assertCanSubscribe(
        { country: "BR", currency: "BRL", gateway: "ASAAS" },
        plan,
        { currency: "BRL", amountMinor: 1000 },
      ),
    ).not.toThrow();
    expect(() =>
      assertCanSubscribe(
        { country: "BR", currency: "BRL", gateway: "STRIPE" },
        plan,
        { currency: "BRL", amountMinor: 1000 },
      ),
    ).toThrow(BillingRuleError);
  });

  it("requires a price in the company currency", () => {
    expect(() =>
      assertCanSubscribe(
        { country: "US", currency: "USD", gateway: "STRIPE" },
        plan,
        { currency: "EUR", amountMinor: 1000 },
      ),
    ).toThrow(BillingRuleError);
  });
});
