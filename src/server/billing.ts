import "server-only";

import type { Company, Plan, PlanPrice } from "@prisma/client";

import { appUrl } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/server/audit";
import { getGateway } from "@/server/payments/gateway";
import { assertCanSubscribe } from "@/server/payments/rules";

async function contactEmail(companyId: string) {
  const owner = await prisma.user.findFirst({
    where: { companyId, companyRole: "OWNER" },
    orderBy: { createdAt: "asc" },
  });
  if (owner) {
    return owner.email;
  }
  const invitation = await prisma.invitation.findFirst({
    where: { companyId, acceptedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!invitation) {
    throw new Error("NO_CONTACT_EMAIL");
  }
  return invitation.email;
}

export async function ensureGatewayCustomer(company: Company) {
  if (company.gateway === "STRIPE" && company.stripeCustomerId) {
    return company.stripeCustomerId;
  }
  if (company.gateway === "ASAAS" && company.asaasCustomerId) {
    return company.asaasCustomerId;
  }
  const email = await contactEmail(company.id);
  const gateway = getGateway(company.gateway);
  const created = await gateway.createCustomer({
    companyId: company.id,
    name: company.name,
    email,
    taxId: company.taxId,
  });
  await prisma.company.update({
    where: { id: company.id },
    data:
      company.gateway === "STRIPE"
        ? { stripeCustomerId: created.externalId }
        : { asaasCustomerId: created.externalId },
  });
  return created.externalId;
}

function priceFor(plan: Plan & { prices: PlanPrice[] }, currency: string) {
  return plan.prices.find((price) => price.currency === currency) ?? null;
}

export async function startCheckout(input: {
  company: Company;
  planId: string;
  actorId: string;
}) {
  const plan = await prisma.plan.findUnique({
    where: { id: input.planId },
    include: { prices: true },
  });
  if (!plan) {
    throw new Error("PLAN_NOT_FOUND");
  }
  const price = priceFor(plan, input.company.currency);
  assertCanSubscribe(input.company, plan, price);
  if (!price) {
    throw new Error("PRICE");
  }
  const customerExternalId = await ensureGatewayCustomer(input.company);
  const gateway = getGateway(input.company.gateway);
  const base = appUrl();

  if (plan.type === "ONE_TIME") {
    const invoice = await prisma.invoice.create({
      data: {
        companyId: input.company.id,
        planId: plan.id,
        gateway: input.company.gateway,
        amountMinor: price.amountMinor,
        currency: price.currency,
        status: "OPEN",
      },
    });
    try {
      const result = await gateway.createOneTimeCharge({
        localInvoiceId: invoice.id,
        customerExternalId,
        amountMinor: price.amountMinor,
        currency: price.currency,
        description: plan.name,
        stripePriceId: price.stripePriceId ?? undefined,
        successUrl: `${base}/invoices?paid=1`,
        cancelUrl: `${base}/invoices?canceled=1`,
      });
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { externalId: result.externalId, paymentUrl: result.checkoutUrl },
      });
      await writeAudit({
        actorId: input.actorId,
        companyId: input.company.id,
        action: "invoice.created",
        entityType: "Invoice",
        entityId: invoice.id,
        metadata: { planId: plan.id },
      });
      return result.checkoutUrl;
    } catch (error) {
      await prisma.invoice.delete({ where: { id: invoice.id } });
      throw error;
    }
  }

  if (!plan.interval) {
    throw new Error("INTERVAL");
  }
  const subscription = await prisma.subscription.create({
    data: {
      companyId: input.company.id,
      planId: plan.id,
      gateway: input.company.gateway,
      status: "INCOMPLETE",
    },
  });
  try {
    const result = await gateway.createSubscription({
      localSubscriptionId: subscription.id,
      customerExternalId,
      amountMinor: price.amountMinor,
      currency: price.currency,
      interval: plan.interval,
      description: plan.name,
      stripePriceId: price.stripePriceId ?? undefined,
      successUrl: `${base}/subscriptions?started=1`,
      cancelUrl: `${base}/subscriptions?canceled=1`,
    });
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { externalId: result.externalId, checkoutUrl: result.checkoutUrl },
    });
    await writeAudit({
      actorId: input.actorId,
      companyId: input.company.id,
      action: "subscription.created",
      entityType: "Subscription",
      entityId: subscription.id,
      metadata: { planId: plan.id, gateway: input.company.gateway },
    });
    return result.checkoutUrl;
  } catch (error) {
    await prisma.subscription.delete({ where: { id: subscription.id } });
    throw error;
  }
}

export async function schedulePlanChange(input: {
  company: Company;
  subscriptionId: string;
  nextPlanId: string;
  actorId: string;
}) {
  const subscription = await prisma.subscription.findFirst({
    where: { id: input.subscriptionId, companyId: input.company.id },
    include: { plan: { include: { prices: true } } },
  });
  if (!subscription?.externalId) {
    throw new Error("SUBSCRIPTION_NOT_FOUND");
  }
  if (subscription.status !== "ACTIVE" && subscription.status !== "TRIALING") {
    throw new Error("SUBSCRIPTION_NOT_ACTIVE");
  }
  const nextPlan = await prisma.plan.findUnique({
    where: { id: input.nextPlanId },
    include: { prices: true },
  });
  if (!nextPlan || nextPlan.type !== "RECURRING") {
    throw new Error("PLAN_NOT_FOUND");
  }
  const nextPrice = priceFor(nextPlan, input.company.currency);
  const currentPrice = priceFor(subscription.plan, input.company.currency);
  assertCanSubscribe(input.company, nextPlan, nextPrice);
  if (!nextPrice || !nextPlan.interval || !subscription.currentPeriodEnd) {
    throw new Error("PRICE");
  }
  const gateway = getGateway(input.company.gateway);
  const result = await gateway.changePlan({
    externalId: subscription.externalId,
    currentPriceId: currentPrice?.stripePriceId ?? undefined,
    nextPriceId: nextPrice.stripePriceId ?? undefined,
    amountMinor: nextPrice.amountMinor,
    currency: nextPrice.currency,
    interval: nextPlan.interval,
    description: nextPlan.name,
    currentPeriodEnd: subscription.currentPeriodEnd,
  });
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { pendingPlanId: nextPlan.id, pendingPlanEffectiveAt: result.effectiveAt },
  });
  await writeAudit({
    actorId: input.actorId,
    companyId: input.company.id,
    action: "subscription.changed",
    entityType: "Subscription",
    entityId: subscription.id,
    metadata: { nextPlanId: nextPlan.id, effectiveAt: result.effectiveAt.toISOString() },
  });
}

export async function cancelCompanySubscription(input: {
  company: Company;
  subscriptionId: string;
  actorId: string;
}) {
  const subscription = await prisma.subscription.findFirst({
    where: { id: input.subscriptionId, companyId: input.company.id },
  });
  if (!subscription?.externalId) {
    throw new Error("SUBSCRIPTION_NOT_FOUND");
  }
  const gateway = getGateway(input.company.gateway);
  const result = await gateway.cancelSubscription({
    externalId: subscription.externalId,
    currentPeriodEnd: subscription.currentPeriodEnd,
  });
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: result.status,
      cancelAt: result.cancelAt,
      canceledAt: result.canceledAt,
    },
  });
  await writeAudit({
    actorId: input.actorId,
    companyId: input.company.id,
    action: "subscription.canceled",
    entityType: "Subscription",
    entityId: subscription.id,
  });
}

export async function syncCompanyInvoices(company: Company) {
  const customerExternalId =
    company.gateway === "STRIPE" ? company.stripeCustomerId : company.asaasCustomerId;
  if (!customerExternalId) {
    return;
  }
  const gateway = getGateway(company.gateway);
  const invoices = await gateway.listInvoices({ customerExternalId });
  for (const invoice of invoices) {
    const subscription = invoice.subscriptionExternalId
      ? await prisma.subscription.findUnique({
          where: {
            gateway_externalId: {
              gateway: company.gateway,
              externalId: invoice.subscriptionExternalId,
            },
          },
        })
      : null;
    if (subscription && subscription.companyId !== company.id) {
      continue;
    }
    await prisma.invoice.upsert({
      where: {
        gateway_externalId: { gateway: company.gateway, externalId: invoice.externalId },
      },
      create: {
        companyId: company.id,
        subscriptionId: subscription?.id,
        planId: subscription?.planId,
        gateway: company.gateway,
        externalId: invoice.externalId,
        amountMinor: invoice.amountMinor,
        currency: invoice.currency,
        status: invoice.status,
        dueDate: invoice.dueDate ? new Date(invoice.dueDate) : null,
        paymentUrl: invoice.paymentUrl,
        pdfUrl: invoice.pdfUrl,
      },
      update: {
        status: invoice.status,
        amountMinor: invoice.amountMinor,
        paymentUrl: invoice.paymentUrl,
        pdfUrl: invoice.pdfUrl,
        dueDate: invoice.dueDate ? new Date(invoice.dueDate) : null,
      },
    });
  }
}

export async function paymentMethodLink(company: Company) {
  const customerExternalId = await ensureGatewayCustomer(company);
  const gateway = getGateway(company.gateway);
  const result = await gateway.createPaymentMethodUpdateLink({
    customerExternalId,
    returnUrl: `${appUrl()}/invoices`,
  });
  return result.url;
}

export async function syncPlanCatalog(planId: string, actorId: string) {
  const plan = await prisma.plan.findUnique({ where: { id: planId }, include: { prices: true } });
  if (!plan) {
    throw new Error("PLAN_NOT_FOUND");
  }
  const needsStripe = plan.prices.some((price) => price.currency !== "BRL");
  const stripe = needsStripe ? getGateway("STRIPE") : null;
  let productId = plan.stripeProductId;
  for (const price of plan.prices) {
    if (price.currency === "BRL" || !stripe) {
      continue;
    }
    const synced = await stripe.upsertCatalogItem({
      name: plan.name,
      description: plan.description,
      currency: price.currency,
      amountMinor: price.amountMinor,
      interval: plan.interval,
      stripeProductId: productId,
      stripePriceId: price.stripePriceId,
    });
    productId = synced.productId ?? productId;
    if (synced.priceId && synced.priceId !== price.stripePriceId) {
      await prisma.planPrice.update({
        where: { id: price.id },
        data: { stripePriceId: synced.priceId },
      });
    }
  }
  if (productId && productId !== plan.stripeProductId) {
    await prisma.plan.update({ where: { id: plan.id }, data: { stripeProductId: productId } });
  }
  await writeAudit({
    actorId,
    action: "plan.synced",
    entityType: "Plan",
    entityId: plan.id,
  });
}
