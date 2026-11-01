import { describe, expect, it } from "vitest";

import { installmentAmountMinor } from "@/lib/money";

describe("installmentAmountMinor", () => {
  it("splits the total across installments", () => {
    expect(installmentAmountMinor(300_000, 10)).toBe(30_000);
    expect(installmentAmountMinor(30_000, 3)).toBe(10_000);
  });

  it("rounds up leftover cents", () => {
    expect(installmentAmountMinor(1000, 3)).toBe(334);
  });
});
