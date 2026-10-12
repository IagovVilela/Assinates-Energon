import { describe, expect, it } from "vitest";

import type { NormalizedEvent } from "@/server/payments/types";
import {
  acceptWebhookEvent,
  applyNormalizedEvent,
  processWebhookEvent,
  type SubscriptionRow,
  type WebhookStore,
} from "@/server/payments/webhooks";

function memoryStore() {
  const events: {
    id: string;
    gateway: "STRIPE";
    externalId: string;
    payload: { event: NormalizedEvent };
    status: "PENDING" | "PROCESSED" | "FAILED";
    attempts: number;
  }[] = [];
  const subscriptions: SubscriptionRow[] = [
    {
      id: "sub-a",
      companyId: "company-a",
      gateway: "STRIPE",
      externalId: "stripe-sub",
      planId: "plan-1",
      pendingPlanId: "plan-2",
      pendingPlanEffectiveAt: new Date("2026-11-01T00:00:00.000Z"),
      status: "ACTIVE",
    },
  ];
  const invoices: { companyId: string; externalId: string }[] = [];
  const store: WebhookStore = {
    isUnique: (error) => error instanceof Error && error.message === "UNIQUE",
    async create(input) {
      if (events.some((event) => event.externalId === input.externalId && event.gateway === input.gateway)) {
        throw new Error("UNIQUE");
      }
      const row = {
        id: `evt-${events.length + 1}`,
        gateway: "STRIPE" as const,
        externalId: input.externalId,
        payload: input.payload,
        status: "PENDING" as const,
        attempts: 0,
      };
      events.push(row);
      return { id: row.id };
    },
    async find(gateway, externalId) {
      return events.find((event) => event.gateway === gateway && event.externalId === externalId) ?? null;
    },
    async getEvent(id) {
      return events.find((event) => event.id === id) ?? null;
    },
    async markProcessed(id) {
      const event = events.find((item) => item.id === id);
      if (event) {
        event.status = "PROCESSED";
      }
    },
    async markFailed(id, error, attempts) {
      const event = events.find((item) => item.id === id);
      if (event) {
        event.status = "FAILED";
        event.attempts = attempts;
        void error;
      }
    },
    async findSubscriptionByExternal(_gateway, externalId) {
      return subscriptions.find((subscription) => subscription.externalId === externalId) ?? null;
    },
    async findSubscriptionById(id) {
      return subscriptions.find((subscription) => subscription.id === id) ?? null;
    },
    async updateSubscription(id, data) {
      const subscription = subscriptions.find((item) => item.id === id);
      if (subscription) {
        Object.assign(subscription, data);
      }
    },
    async findInvoiceCompany() {
      return null;
    },
    async upsertInvoice(input) {
      invoices.push({ companyId: input.companyId, externalId: input.externalId });
    },
  };
  return { store, events, subscriptions, invoices };
}

describe("webhooks", () => {
  it("accepts the first event and ignores a duplicate", async () => {
    const { store } = memoryStore();
    const payload = { event: { kind: "ignored" as const } };
    const first = await acceptWebhookEvent(store, { gateway: "STRIPE", externalId: "evt_1", payload });
    const second = await acceptWebhookEvent(store, { gateway: "STRIPE", externalId: "evt_1", payload });
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.id).toBe(first.id);
  });

  it("does not apply a processed event twice", async () => {
    const { store, invoices } = memoryStore();
    const accepted = await acceptWebhookEvent(store, {
      gateway: "STRIPE",
      externalId: "evt_2",
      payload: {
        event: {
          kind: "invoice",
          externalId: "in_1",
          subscriptionExternalId: "stripe-sub",
          amountMinor: 1000,
          currency: "USD",
          status: "OPEN",
          dueDate: "2026-12-01T00:00:00.000Z",
        },
      },
    });
    await processWebhookEvent(store, accepted.id);
    await processWebhookEvent(store, accepted.id);
    expect(invoices).toHaveLength(1);
    expect(invoices[0]?.companyId).toBe("company-a");
  });

  it("keeps the invoice on the subscription company when a plan change is due", async () => {
    const { store, subscriptions } = memoryStore();
    await applyNormalizedEvent(store, "STRIPE", {
      kind: "invoice",
      externalId: "in_2",
      subscriptionExternalId: "stripe-sub",
      amountMinor: 2000,
      currency: "USD",
      status: "OPEN",
      dueDate: "2026-12-01T00:00:00.000Z",
    });
    expect(subscriptions[0]?.planId).toBe("plan-2");
    expect(subscriptions[0]?.pendingPlanId).toBeNull();
  });
});
