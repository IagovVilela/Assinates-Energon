import type { GatewayName, InvoiceStatus, NormalizedEvent, SubscriptionStatus } from "@/server/payments/types";

export type StoredWebhook = {
  id: string;
  gateway: GatewayName;
  externalId: string;
  payload: { event: NormalizedEvent };
  status: "PENDING" | "PROCESSED" | "FAILED";
  attempts: number;
};

export type SubscriptionRow = {
  id: string;
  companyId: string;
  gateway: GatewayName;
  externalId: string | null;
  planId: string;
  pendingPlanId: string | null;
  pendingPlanEffectiveAt: Date | null;
  status: SubscriptionStatus;
};

export type InvoiceRow = {
  id: string;
  companyId: string;
  gateway: GatewayName;
  externalId: string | null;
  subscriptionId: string | null;
  amountMinor: number;
  currency: string;
  status: InvoiceStatus;
};

export type WebhookStore = {
  create(input: {
    gateway: GatewayName;
    externalId: string;
    payload: { event: NormalizedEvent };
  }): Promise<{ id: string }>;
  find(gateway: GatewayName, externalId: string): Promise<{ id: string } | null>;
  isUnique(error: unknown): boolean;
  getEvent(id: string): Promise<StoredWebhook | null>;
  markProcessed(id: string): Promise<void>;
  markFailed(id: string, error: string, attempts: number): Promise<void>;
  findSubscriptionByExternal(gateway: GatewayName, externalId: string): Promise<SubscriptionRow | null>;
  findSubscriptionById(id: string): Promise<SubscriptionRow | null>;
  findInvoiceCompany(gateway: GatewayName, externalId: string): Promise<string | null>;
  updateSubscription(
    id: string,
    data: Partial<
      Pick<
        SubscriptionRow,
        "externalId" | "status" | "planId" | "pendingPlanId" | "pendingPlanEffectiveAt"
      >
    > & {
      currentPeriodStart?: Date | null;
      currentPeriodEnd?: Date | null;
      cancelAt?: Date | null;
      canceledAt?: Date | null;
    },
  ): Promise<void>;
  upsertInvoice(input: {
    companyId: string;
    gateway: GatewayName;
    externalId: string;
    subscriptionId: string | null;
    planId: string | null;
    amountMinor: number;
    currency: string;
    status: InvoiceStatus;
    dueDate?: Date | null;
    paymentUrl?: string;
    pdfUrl?: string;
  }): Promise<void>;
};

export async function acceptWebhookEvent(
  store: Pick<WebhookStore, "create" | "find" | "isUnique">,
  input: { gateway: GatewayName; externalId: string; payload: { event: NormalizedEvent } },
) {
  try {
    const created = await store.create(input);
    return { duplicate: false, id: created.id };
  } catch (error) {
    if (!store.isUnique(error)) {
      throw error;
    }
    const existing = await store.find(input.gateway, input.externalId);
    if (!existing) {
      throw error;
    }
    return { duplicate: true, id: existing.id };
  }
}

function dateOrNull(value: string | null | undefined) {
  if (!value) {
    return value === null ? null : undefined;
  }
  return new Date(value);
}

export async function applyNormalizedEvent(
  store: Pick<
    WebhookStore,
    | "findSubscriptionByExternal"
    | "findSubscriptionById"
    | "findInvoiceCompany"
    | "updateSubscription"
    | "upsertInvoice"
  >,
  gateway: GatewayName,
  event: NormalizedEvent,
) {
  if (event.kind === "ignored") {
    return;
  }

  if (event.kind === "subscription") {
    const subscription =
      (event.localSubscriptionId
        ? await store.findSubscriptionById(event.localSubscriptionId)
        : null) ?? (await store.findSubscriptionByExternal(gateway, event.externalId));
    if (!subscription || subscription.gateway !== gateway) {
      throw new Error("SUBSCRIPTION_NOT_FOUND");
    }
    await store.updateSubscription(subscription.id, {
      externalId: event.externalId,
      status: event.status,
      currentPeriodStart: dateOrNull(event.currentPeriodStart),
      currentPeriodEnd: dateOrNull(event.currentPeriodEnd),
      cancelAt: dateOrNull(event.cancelAt),
      canceledAt: dateOrNull(event.canceledAt),
    });
    return;
  }

  const subscription =
    (event.localSubscriptionId ? await store.findSubscriptionById(event.localSubscriptionId) : null) ??
    (event.subscriptionExternalId
      ? await store.findSubscriptionByExternal(gateway, event.subscriptionExternalId)
      : null);

  if (
    (event.subscriptionExternalId || event.localSubscriptionId) &&
    (!subscription || subscription.gateway !== gateway)
  ) {
    throw new Error("SUBSCRIPTION_NOT_FOUND");
  }

  let planId = subscription?.planId ?? null;
  if (
    subscription?.pendingPlanId &&
    subscription.pendingPlanEffectiveAt &&
    event.dueDate &&
    new Date(event.dueDate) >= subscription.pendingPlanEffectiveAt
  ) {
    planId = subscription.pendingPlanId;
    await store.updateSubscription(subscription.id, {
      planId: subscription.pendingPlanId,
      pendingPlanId: null,
      pendingPlanEffectiveAt: null,
    });
  }

  const companyId =
    subscription?.companyId ??
    event.companyId ??
    (await store.findInvoiceCompany(gateway, event.externalId));
  if (!companyId) {
    throw new Error("INVOICE_WITHOUT_COMPANY");
  }
  if (subscription && event.subscriptionStatus) {
    await store.updateSubscription(subscription.id, { status: event.subscriptionStatus });
  }

  await store.upsertInvoice({
    companyId,
    gateway,
    externalId: event.externalId,
    subscriptionId: subscription?.id ?? null,
    planId,
    amountMinor: event.amountMinor,
    currency: event.currency,
    status: event.status,
    dueDate: event.dueDate ? new Date(event.dueDate) : null,
    paymentUrl: event.paymentUrl,
    pdfUrl: event.pdfUrl,
  });
}

export async function processWebhookEvent(store: WebhookStore, id: string) {
  const stored = await store.getEvent(id);
  if (!stored || stored.status === "PROCESSED") {
    return;
  }
  try {
    await applyNormalizedEvent(store, stored.gateway, stored.payload.event);
    await store.markProcessed(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "WEBHOOK_FAILED";
    await store.markFailed(id, message, stored.attempts + 1);
    throw error;
  }
}
