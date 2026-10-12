import { minorToMajor } from "@/lib/money";
import { safeEqual } from "@/lib/tokens";
import type {
  GatewayInvoice,
  InvoiceStatus,
  PaymentGateway,
  SubscriptionStatus,
  VerifiedWebhook,
} from "@/server/payments/types";

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

type AsaasCustomer = { id: string };
type AsaasSubscription = { id: string; status?: string };
type AsaasPayment = {
  id: string;
  subscription?: string | null;
  value: number;
  status: string;
  dueDate?: string;
  invoiceUrl?: string | null;
  bankSlipUrl?: string | null;
  externalReference?: string | null;
};
type AsaasList<T> = { data: T[] };
type AsaasWebhook = {
  id?: string;
  event?: string;
  payment?: AsaasPayment;
  subscription?: AsaasSubscription & { externalReference?: string };
};

function cycle(interval: "MONTH" | "YEAR") {
  return interval === "YEAR" ? "YEARLY" : "MONTHLY";
}

function mapPaymentStatus(status: string): InvoiceStatus {
  switch (status) {
    case "RECEIVED":
    case "CONFIRMED":
    case "RECEIVED_IN_CASH":
      return "PAID";
    case "REFUNDED":
    case "REFUND_REQUESTED":
    case "CHARGEBACK_REQUESTED":
    case "CHARGEBACK_DISPUTE":
    case "AWAITING_CHARGEBACK_REVERSAL":
      return "VOID";
    case "DUNNING_REQUESTED":
    case "OVERDUE":
    case "PENDING":
    case "AWAITING_RISK_ANALYSIS":
      return "OPEN";
    default:
      return "OPEN";
  }
}

function mapSubscriptionStatus(status: string | undefined): SubscriptionStatus {
  switch (status) {
    case "ACTIVE":
      return "ACTIVE";
    case "EXPIRED":
    case "INACTIVE":
      return "CANCELED";
    default:
      return "ACTIVE";
  }
}

function majorToMinor(value: number) {
  return Math.round(value * 100);
}

export function createAsaasAdapter(options: {
  apiKey: string;
  baseUrl: string;
  webhookToken: string;
  fetchImpl?: FetchLike;
}): PaymentGateway {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/$/, "");

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        access_token: options.apiKey,
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      throw new Error(`ASAAS_${response.status}`);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  return {
    async createCustomer(input) {
      const customer = await request<AsaasCustomer>("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: input.name,
          cpfCnpj: input.taxId,
          email: input.email,
          externalReference: input.companyId,
        }),
      });
      return { externalId: customer.id };
    },

    async createSubscription(input) {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const subscription = await request<AsaasSubscription>("/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          customer: input.customerExternalId,
          billingType: "UNDEFINED",
          value: minorToMajor(input.amountMinor, input.currency),
          nextDueDate: tomorrow,
          cycle: cycle(input.interval),
          description: input.description,
          externalReference: input.localSubscriptionId,
        }),
      });
      const payments = await request<AsaasList<AsaasPayment>>(
        `/subscriptions/${subscription.id}/payments`,
      );
      const checkoutUrl = payments.data[0]?.invoiceUrl;
      if (!checkoutUrl) {
        throw new Error("CHECKOUT_URL_MISSING");
      }
      return { externalId: subscription.id, checkoutUrl };
    },

    async createOneTimeCharge(input) {
      const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const payment = await request<AsaasPayment>("/payments", {
        method: "POST",
        body: JSON.stringify({
          customer: input.customerExternalId,
          billingType: "UNDEFINED",
          value: minorToMajor(input.amountMinor, input.currency),
          dueDate,
          description: input.description,
          externalReference: input.localInvoiceId,
        }),
      });
      if (!payment.invoiceUrl) {
        throw new Error("CHECKOUT_URL_MISSING");
      }
      return { externalId: payment.id, checkoutUrl: payment.invoiceUrl };
    },

    async changePlan(input) {
      await request(`/subscriptions/${input.externalId}`, {
        method: "PUT",
        body: JSON.stringify({
          value: minorToMajor(input.amountMinor, input.currency),
          cycle: cycle(input.interval),
          updatePendingPayments: false,
          description: input.description,
        }),
      });
      return { effectiveAt: input.currentPeriodEnd };
    },

    async cancelSubscription(input) {
      await request(`/subscriptions/${input.externalId}`, { method: "DELETE" });
      return {
        status: "CANCELED" as const,
        cancelAt: null,
        canceledAt: new Date(),
      };
    },

    async listInvoices(input) {
      const list = await request<AsaasList<AsaasPayment>>(
        `/payments?customer=${encodeURIComponent(input.customerExternalId)}&limit=100`,
      );
      return list.data.map(toGatewayInvoice);
    },

    async createPaymentMethodUpdateLink(input) {
      const list = await request<AsaasList<AsaasPayment>>(
        `/payments?customer=${encodeURIComponent(input.customerExternalId)}&status=PENDING&limit=1`,
      );
      const url = list.data[0]?.invoiceUrl;
      if (!url) {
        throw new Error("NO_OPEN_INVOICE");
      }
      return { url };
    },

    async upsertCatalogItem() {
      return {};
    },

    parseWebhook(headers, rawBody): VerifiedWebhook {
      const token = headers.get("asaas-access-token") ?? "";
      if (!options.webhookToken || !safeEqual(token, options.webhookToken)) {
        throw new Error("WEBHOOK_SIGNATURE_MISSING");
      }
      const body = JSON.parse(rawBody) as AsaasWebhook;
      const externalId = body.id ?? `${body.event ?? "event"}:${body.payment?.id ?? body.subscription?.id ?? rawBody.length}`;
      return { externalId, event: normalizeAsaasEvent(body) };
    },
  };
}

function toGatewayInvoice(payment: AsaasPayment): GatewayInvoice {
  return {
    externalId: payment.id,
    subscriptionExternalId: payment.subscription ?? undefined,
    amountMinor: majorToMinor(payment.value),
    currency: "BRL",
    status: mapPaymentStatus(payment.status),
    dueDate: payment.dueDate ? new Date(payment.dueDate).toISOString() : undefined,
    paymentUrl: payment.invoiceUrl ?? undefined,
    pdfUrl: payment.bankSlipUrl ?? undefined,
  };
}

function normalizeAsaasEvent(body: AsaasWebhook): VerifiedWebhook["event"] {
  const eventName = body.event ?? "";
  if (eventName.startsWith("SUBSCRIPTION_") && body.subscription?.id) {
    const canceled = eventName === "SUBSCRIPTION_DELETED" || eventName === "SUBSCRIPTION_INACTIVATED";
    return {
      kind: "subscription",
      externalId: body.subscription.id,
      status: canceled ? "CANCELED" : mapSubscriptionStatus(body.subscription.status),
      localSubscriptionId: body.subscription.externalReference,
      canceledAt: canceled ? new Date().toISOString() : null,
    };
  }
  if (eventName.startsWith("PAYMENT_") && body.payment) {
    return {
      kind: "invoice",
      ...toGatewayInvoice(body.payment),
      subscriptionStatus: body.payment.status === "OVERDUE" ? "PAST_DUE" : undefined,
    };
  }
  return { kind: "ignored" };
}

export function asaasPaymentPastDue(status: string) {
  return status === "OVERDUE";
}
