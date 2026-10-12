import { describe, expect, it, vi } from "vitest";

import { createAsaasAdapter } from "@/server/payments/asaas-adapter";
import { createStripeAdapter } from "@/server/payments/stripe-adapter";

describe("stripe adapter", () => {
  it("schedules the next price without charging a proration now", async () => {
    const update = vi.fn(async () => ({}));
    const client = {
      customers: { create: vi.fn() },
      checkout: { sessions: { create: vi.fn() } },
      billingPortal: { sessions: { create: vi.fn() } },
      subscriptions: {
        retrieve: vi.fn(async () => ({
          id: "sub_1",
          schedule: null,
          items: { data: [{ current_period_start: 1_700_000_000, current_period_end: 1_702_592_000 }] },
        })),
        update: vi.fn(),
      },
      subscriptionSchedules: {
        create: vi.fn(async () => ({ id: "sched_1" })),
        update,
      },
      products: { create: vi.fn() },
      prices: { create: vi.fn() },
      invoices: { list: vi.fn() },
      webhooks: { constructEvent: vi.fn() },
    };
    const adapter = createStripeAdapter(client as never, "whsec");
    const result = await adapter.changePlan({
      externalId: "sub_1",
      currentPriceId: "price_old",
      nextPriceId: "price_new",
      amountMinor: 2000,
      currency: "USD",
      interval: "MONTH",
      description: "Pro",
      currentPeriodEnd: new Date(),
    });
    expect(result.effectiveAt.toISOString()).toBe(new Date(1_702_592_000 * 1000).toISOString());
    expect(update).toHaveBeenCalledWith(
      "sched_1",
      expect.objectContaining({
        phases: [
          expect.objectContaining({ items: [{ price: "price_old", quantity: 1 }] }),
          expect.objectContaining({ items: [{ price: "price_new", quantity: 1 }] }),
        ],
      }),
    );
  });

  it("cancels at period end", async () => {
    const update = vi.fn(async () => ({
      items: { data: [{ current_period_end: 1_702_592_000 }] },
    }));
    const adapter = createStripeAdapter(
      { subscriptions: { update } } as never,
      "whsec",
    );
    const result = await adapter.cancelSubscription({
      externalId: "sub_1",
      currentPeriodEnd: null,
    });
    expect(update).toHaveBeenCalledWith("sub_1", { cancel_at_period_end: true });
    expect(result.status).toBe("ACTIVE");
    expect(result.canceledAt).toBeNull();
  });
});

describe("asaas adapter", () => {
  it("creates a hosted subscription and does not invent a product id", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith("/subscriptions") && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        expect(body.billingType).toBe("UNDEFINED");
        expect(body.value).toBe(49.9);
        return Response.json({ id: "sub_asaas" });
      }
      return Response.json({ data: [{ id: "pay_1", invoiceUrl: "https://asaas.example/pay" }] });
    });
    const adapter = createAsaasAdapter({
      apiKey: "key",
      baseUrl: "https://api-sandbox.asaas.com/v3",
      webhookToken: "token",
      fetchImpl,
    });
    const checkout = await adapter.createSubscription({
      localSubscriptionId: "local",
      customerExternalId: "cus",
      amountMinor: 4990,
      currency: "BRL",
      interval: "MONTH",
      description: "Plano",
      successUrl: "https://app.example/ok",
      cancelUrl: "https://app.example/no",
    });
    expect(checkout.checkoutUrl).toBe("https://asaas.example/pay");
    await expect(
      adapter.upsertCatalogItem({
        name: "Plano",
        description: "Plano",
        currency: "BRL",
        amountMinor: 4990,
        interval: "MONTH",
      }),
    ).resolves.toEqual({});
  });

  it("rejects a webhook with the wrong token", () => {
    const adapter = createAsaasAdapter({
      apiKey: "key",
      baseUrl: "https://api-sandbox.asaas.com/v3",
      webhookToken: "expected",
      fetchImpl: vi.fn(),
    });
    const headers = new Headers({ "asaas-access-token": "wrong" });
    expect(() => adapter.parseWebhook(headers, "{}")).toThrow(/WEBHOOK_SIGNATURE/);
  });
});
