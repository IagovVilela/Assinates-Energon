export type CompanyBilling = {
  country: string;
  currency: string;
  gateway: "ASAAS" | "STRIPE";
};

export type PlanBilling = {
  type: "RECURRING" | "ONE_TIME";
  interval: "MONTH" | "YEAR" | null;
  active: boolean;
};

export type PriceBilling = {
  currency: string;
  amountMinor: number;
} | null;

export class BillingRuleError extends Error {
  constructor(readonly code: "GATEWAY" | "CURRENCY" | "PRICE" | "INTERVAL" | "INACTIVE") {
    super(code);
  }
}

export function assertCanSubscribe(company: CompanyBilling, plan: PlanBilling, price: PriceBilling) {
  const expectedGateway = company.country === "BR" ? "ASAAS" : "STRIPE";
  if (company.gateway !== expectedGateway) {
    throw new BillingRuleError("GATEWAY");
  }
  if (company.gateway === "ASAAS" && company.currency !== "BRL") {
    throw new BillingRuleError("CURRENCY");
  }
  if (company.gateway === "STRIPE" && company.currency === "BRL") {
    throw new BillingRuleError("CURRENCY");
  }
  if (!plan.active) {
    throw new BillingRuleError("INACTIVE");
  }
  if (plan.type === "RECURRING" && !plan.interval) {
    throw new BillingRuleError("INTERVAL");
  }
  if (!price || price.currency !== company.currency || price.amountMinor <= 0) {
    throw new BillingRuleError("PRICE");
  }
}
