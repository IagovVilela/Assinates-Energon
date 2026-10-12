export type GatewayName = "ASAAS" | "STRIPE";

export type SubscriptionStatus = "INCOMPLETE" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";

export type InvoiceStatus = "DRAFT" | "OPEN" | "PAID" | "VOID" | "UNCOLLECTIBLE";

export type BillingInterval = "MONTH" | "YEAR";

export type NormalizedEvent =
  | {
      kind: "subscription";
      externalId: string;
      status: SubscriptionStatus;
      localSubscriptionId?: string;
      currentPeriodStart?: string;
      currentPeriodEnd?: string;
      cancelAt?: string | null;
      canceledAt?: string | null;
    }
  | {
      kind: "invoice";
      externalId: string;
      subscriptionExternalId?: string;
      localSubscriptionId?: string;
      companyId?: string;
      amountMinor: number;
      currency: string;
      status: InvoiceStatus;
      dueDate?: string;
      paymentUrl?: string;
      pdfUrl?: string;
      subscriptionStatus?: SubscriptionStatus;
    }
  | { kind: "ignored" };

export type VerifiedWebhook = {
  externalId: string;
  event: NormalizedEvent;
};

export type CreateCustomerInput = {
  companyId: string;
  name: string;
  email: string;
  taxId: string;
};

export type CreateSubscriptionInput = {
  localSubscriptionId: string;
  customerExternalId: string;
  amountMinor: number;
  currency: string;
  interval: BillingInterval;
  description: string;
  stripePriceId?: string;
  successUrl: string;
  cancelUrl: string;
};

export type CreateOneTimeInput = {
  localInvoiceId: string;
  customerExternalId: string;
  amountMinor: number;
  currency: string;
  description: string;
  stripePriceId?: string;
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutResult = {
  externalId: string | null;
  checkoutUrl: string;
};

export type ChangePlanInput = {
  externalId: string;
  currentPriceId?: string;
  nextPriceId?: string;
  amountMinor: number;
  currency: string;
  interval: BillingInterval;
  description: string;
  currentPeriodEnd: Date;
};

export type GatewayInvoice = {
  externalId: string;
  subscriptionExternalId?: string;
  amountMinor: number;
  currency: string;
  status: InvoiceStatus;
  dueDate?: string;
  paymentUrl?: string;
  pdfUrl?: string;
};

export type UpsertCatalogInput = {
  name: string;
  description: string;
  currency: string;
  amountMinor: number;
  interval: BillingInterval | null;
  stripeProductId?: string | null;
  stripePriceId?: string | null;
};

export type PaymentGateway = {
  createCustomer(input: CreateCustomerInput): Promise<{ externalId: string }>;
  createSubscription(input: CreateSubscriptionInput): Promise<CheckoutResult>;
  createOneTimeCharge(input: CreateOneTimeInput): Promise<CheckoutResult>;
  changePlan(input: ChangePlanInput): Promise<{ effectiveAt: Date }>;
  cancelSubscription(input: {
    externalId: string;
    currentPeriodEnd: Date | null;
  }): Promise<{ status: SubscriptionStatus; cancelAt: Date | null; canceledAt: Date | null }>;
  listInvoices(input: { customerExternalId: string }): Promise<GatewayInvoice[]>;
  createPaymentMethodUpdateLink(input: {
    customerExternalId: string;
    returnUrl: string;
  }): Promise<{ url: string }>;
  upsertCatalogItem(
    input: UpsertCatalogInput,
  ): Promise<{ productId?: string; priceId?: string }>;
  parseWebhook(headers: Headers, rawBody: string): VerifiedWebhook;
};
