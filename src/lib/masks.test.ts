import { describe, expect, it } from "vitest";

import { maskBrazilianTaxId, maskMoney, moneyToMinor } from "@/lib/masks";

describe("masks", () => {
  it("formats CPF then CNPJ as more digits are typed", () => {
    expect(maskBrazilianTaxId("39053344705")).toBe("390.533.447-05");
    expect(maskBrazilianTaxId("11444777000161")).toBe("11.444.777/0001-61");
  });

  it("keeps money in minor units from a masked value", () => {
    expect(maskMoney("9900")).toBe("99,00");
    expect(moneyToMinor("99,00")).toBe(9900);
  });
});