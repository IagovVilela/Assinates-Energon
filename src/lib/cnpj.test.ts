import { describe, expect, it } from "vitest";

import { isValidCnpj } from "@/lib/cnpj";

describe("cnpj", () => {
  it("accepts a valid document and rejects a repeated one", () => {
    expect(isValidCnpj("11.444.777/0001-61")).toBe(true);
    expect(isValidCnpj("11111111111111")).toBe(false);
  });
});
