import { describe, expect, it } from "vitest";

import { isValidBrazilianTaxId, isValidCnpj, isValidCpf } from "@/lib/cnpj";

describe("cnpj", () => {
  it("accepts a valid document and rejects a repeated one", () => {
    expect(isValidCnpj("11.444.777/0001-61")).toBe(true);
    expect(isValidCnpj("11111111111111")).toBe(false);
    expect(isValidCpf("390.533.447-05")).toBe(true);
    expect(isValidCpf("000.000.000-00")).toBe(false);
    expect(isValidBrazilianTaxId("39053344705")).toBe(true);
  });
});
