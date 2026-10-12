import type Stripe from "stripe";

import { minorDigits } from "@/lib/money";
import type {
  BillingInterval,
  ChangePlanInput,
  CreateCustomerInput,
  CreateOneTimeInput,
  CreateSubscriptionInput,
  GatewayInvoice,
  InvoiceStatus,
  PaymentGateway,
  SubscriptionStatus,
  UpsertCatalogInput,
  VerifiedWebhook,
} from "@/server/payments/types";

type StripeClient = {
  customers: {
    create(params: Stripe.CustomerCreateParams): Promise<Stripe.Customer>;
  };
  checkout: {
    sessions: {
      create(params: Stripe.Checkout.SessionCreateParams): Promise<Stripe.Checkout.Session>;
    };
  };
  billingPortal: {
    sessions: {
      create(params: Stripe.BillingPortal.SessionCreateParams): Promise<Stripe.BillingPortal.Session>;
    };
  };
  subscriptions: {
    retrieve(id: string): Promise<Stripe.Subscription>;
    update(id: string, params: Stripe.SubscriptionUpdateParams): Promise<Stripe.Subscription>;
  };
  subscriptionSchedules: {
    create(params: Stripe.SubscriptionScheduleCreateParams): Promise<Stripe.SubscriptionSchedule>;
    update(id: string, params: Stripe.SubscriptionScheduleUpdateParams): Promise<Stripe.SubscriptionSchedule>;
  };
  products: {
    create(params: Stripe.ProductCreateParams): Promise<Stripe.Product>;
  };
  prices: {
    create(params: Stripe.PriceCreateParams): Promise<Stripe.Price>;
  };
  invoices: {
    list(params: Stripe.InvoiceListParams): Promise<Stripe.ApiList<Stripe.Invoice>>;
  };
  webhooks: {
    constructEvent(payload: string, header: string, secret: string): Stripe.Event;
  };
};

function mapSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
    case "incomplete_expired":
    case "paused":
      return "CANCELED";
    case "incomplete":
      return "INCOMPLETE";
    default:
      return "CANCELED";
  }
}

function mapInvoiceStatus(status: Stripe.Invoice.Status | null): InvoiceStatus {
  switch (status) {
    case "draft":
      return "DRAFT";
    case "open":
      return "OPEN";
    case "paid":
      return "PAID";
    case "void":
      return "VOID";
    case "uncollectible":
      return "UNCOLLECTIBLE";
    case null:
      return "DRAFT";
    default:
      return "DRAFT";
  }
}

function periodEndUnix(subscription: Stripe.Subscription) {
  const itemEnd = subscription.items.data[0]?.current_period_end;
  if (itemEnd) {
    return itemEnd;
  }
  const legacy = subscription as Stripe.Subscription & { current_period_end?: number };
  return legacy.current_period_end ?? null;
}

function periodStartUnix(subscription: Stripe.Subscription) {
  const itemStart = subscription.items.data[0]?.current_period_start;
  if (itemStart) {
    return itemStart;
  }
  const legacy = subscription as Stripe.Subscription & { current_period_start?: number };
  return legacy.current_period_start ?? null;
}

function isoFromUnix(value: number | null | undefined) {
  if (!value) {
    return undefined;
  }
  return new Date(value * 1000).toISOString();
}

function amountToMinor(amount: number | null, currency: string) {
  const digits = minorDigits(currency.toUpperCase());
  if (amount === null) {
    return 0;
  }
  if (digits === 0) {
    return amount;
  }
  return amount;
}

export function createStripeAdapter(client: StripeClient, webhookSecret: string): PaymentGateway {
  return {
    async createCustomer(input: CreateCustomerInput) {
      const customer = await client.customers.create({
        name: input.name,
        email: input.email,
        metadata: { companyId: input.companyId, taxId: input.taxId },
      });
      return { externalId: customer.id };
    },

    async createSubscription(input: CreateSubscriptionInput) {
      if (!input.stripePriceId) {
        throw new Error("STRIPE_PRICE_MISSING");
      }
      const session = await client.checkout.sessions.create({
        mode: "subscription",
        customer: input.customerExternalId,
        line_items: [{ price: input.stripePriceId, quantity: 1 }],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: { localSubscriptionId: input.localSubscriptionId },
        subscription_data: {
          metadata: { localSubscriptionId: input.localSubscriptionId },
        },
      });
      if (!session.url) {
        throw new Error("CHECKOUT_URL_MISSING");
      }
      return { externalId: null, checkoutUrl: session.url };
    },

    async createOneTimeCharge(input: CreateOneTimeInput) {
      if (!input.stripePriceId) {
        throw new Error("STRIPE_PRICE_MISSING");
      }
      const session = await client.checkout.sessions.create({
        mode: "payment",
        customer: input.customerExternalId,
        line_items: [{ price: input.stripePriceId, quantity: 1 }],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: { localInvoiceId: input.localInvoiceId, companyId: input.customerExternalId },
      });
      if (!session.url) {
        throw new Error("CHECKOUT_URL_MISSING");
      }
      return { externalId: session.id, checkoutUrl: session.url };
    },

    async changePlan(input: ChangePlanInput) {
      if (!input.currentPriceId || !input.nextPriceId) {
        throw new Error("STRIPE_PRICE_MISSING");
      }
      const subscription = await client.subscriptions.retrieve(input.externalId);
      const start = periodStartUnix(subscription);
      const end = periodEndUnix(subscription);
      if (!start || !end) {
        throw new Error("PERIOD_MISSING");
      }
      const existingSchedule = subscription.schedule;
      const scheduleId =
        typeof existingSchedule === "string"
          ? existingSchedule
          : (
              await client.subscriptionSchedules.create({
                from_subscription: input.externalId,
              })
            ).id;
      await client.subscriptionSchedules.update(scheduleId, {
        end_behavior: "release",
        phases: [
          {
            items: [{ price: input.currentPriceId, quantity: 1 }],
            start_date: start,
            end_date: end,
          },
          {
            items: [{ price: input.nextPriceId, quantity: 1 }],
            start_date: end,
          },
        ],
      });
      return { effectiveAt: new Date(end * 1000) };
    },

    async cancelSubscription(input) {
      const updated = await client.subscriptions.update(input.externalId, {
        cancel_at_period_end: true,
      });
      const end = periodEndUnix(updated);
      return {
        status: "ACTIVE" as const,
        cancelAt: end ? new Date(end * 1000) : input.currentPeriodEnd,
        canceledAt: null,
      };
    },

    async listInvoices(input): Promise<GatewayInvoice[]> {
      const list = await client.invoices.list({ customer: input.customerExternalId, limit: 100 });
      return list.data.map((invoice) => ({
        externalId: invoice.id,
        subscriptionExternalId:
          typeof invoice.parent?.subscription_details?.subscription === "string"
            ? invoice.parent.subscription_details.subscription
            : undefined,
        amountMinor: amountToMinor(invoice.amount_due, invoice.currency),
        currency: invoice.currency.toUpperCase(),
        status: mapInvoiceStatus(invoice.status),
        dueDate: isoFromUnix(invoice.due_date),
        paymentUrl: invoice.hosted_invoice_url ?? undefined,
        pdfUrl: invoice.invoice_pdf ?? undefined,
      }));
    },

    async createPaymentMethodUpdateLink(input) {
      const session = await client.billingPortal.sessions.create({
        customer: input.customerExternalId,
        return_url: input.returnUrl,
      });
      return { url: session.url };
    },

    async upsertCatalogItem(input: UpsertCatalogInput) {
      if (input.stripePriceId && input.stripeProductId) {
        return { productId: input.stripeProductId, priceId: input.stripePriceId };
      }
      const productId =
        input.stripeProductId ??
        (
          await client.products.create({
            name: input.name,
            description: input.description,
          })
        ).id;
      const price = await client.prices.create({
        product: productId,
        currency: input.currency.toLowerCase(),
        unit_amount: input.amountMinor,
        recurring: input.interval
          ? { interval: input.interval === "YEAR" ? "year" : "month" }
          : undefined,
      });
      return { productId, priceId: price.id };
    },

    parseWebhook(headers: Headers, rawBody: string): VerifiedWebhook {
      const signature = headers.get("stripe-signature");
      if (!signature) {
        throw new Error("WEBHOOK_SIGNATURE_MISSING");
      }
      const event = client.webhooks.constructEvent(rawBody, signature, webhookSecret);
      return { externalId: event.id, event: normalizeStripeEvent(event) };
    },
  };
}

function normalizeStripeEvent(event: Stripe.Event): VerifiedWebhook["event"] {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const localSubscriptionId = subscription.metadata.localSubscriptionId || undefined;
      return {
        kind: "subscription",
        externalId: subscription.id,
        status: event.type === "customer.subscription.deleted" ? "CANCELED" : mapSubscriptionStatus(subscription.status),
        localSubscriptionId,
        currentPeriodStart: isoFromUnix(periodStartUnix(subscription)),
        currentPeriodEnd: isoFromUnix(periodEndUnix(subscription)),
        cancelAt: isoFromUnix(subscription.cancel_at) ?? null,
        canceledAt: isoFromUnix(subscription.canceled_at) ?? null,
      };
    }
    case "invoice.paid":
    case "invoice.finalized":
    case "invoice.payment_failed":
    case "invoice.voided": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscription = invoice.parent?.subscription_details?.subscription;
      return {
        kind: "invoice",
        externalId: invoice.id,
        subscriptionExternalId: typeof subscription === "string" ? subscription : undefined,
        localSubscriptionId: invoice.parent?.subscription_details?.metadata?.localSubscriptionId,
        amountMinor: amountToMinor(invoice.amount_due, invoice.currency),
        currency: invoice.currency.toUpperCase(),
        status: mapInvoiceStatus(invoice.status),
        dueDate: isoFromUnix(invoice.due_date),
        paymentUrl: invoice.hosted_invoice_url ?? undefined,
        pdfUrl: invoice.invoice_pdf ?? undefined,
      };
    }
    default:
      return { kind: "ignored" };
  }
}

export function stripeInterval(interval: BillingInterval) {
  return interval === "YEAR" ? "year" : "month";
}
