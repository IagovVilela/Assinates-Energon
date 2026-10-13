import "server-only";

import { connection } from "next/server";

import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function lastDays(count: number) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (count - 1));
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY_MS);
    return dayKey(date);
  });
}

function fillSeries(days: string[], rows: { day: string; value: number }[]) {
  const map = new Map(rows.map((row) => [row.day, row.value]));
  return days.map((day) => ({ day, value: map.get(day) ?? 0 }));
}

function monthlyMinor(amountMinor: number, interval: "MONTH" | "YEAR" | null) {
  if (interval === "YEAR") {
    return Math.round(amountMinor / 12);
  }
  return amountMinor;
}

export async function loadAdminInsights() {
  await connection();
  const days = lastDays(14);
  const since = new Date(`${days[0]}T00:00:00.000Z`);
  const dayAgo = new Date(Date.now() - DAY_MS);

  const [
    companies,
    users,
    openTickets,
    pastDue,
    activeSubs,
    failedWebhooks,
    loginWindow,
    subscriptionsByStatus,
    companiesByGateway,
    companiesByCountry,
    paidInvoices,
    newCompanies,
    newTickets,
    webhookRecent,
    loginRecent,
    activeForMrr,
    topPlans,
  ] = await Promise.all([
    prisma.company.count(),
    prisma.user.count({ where: { platformRole: "CUSTOMER" } }),
    prisma.ticket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER"] } } }),
    prisma.subscription.count({ where: { status: "PAST_DUE" } }),
    prisma.subscription.count({ where: { status: { in: ["ACTIVE", "TRIALING"] } } }),
    prisma.webhookEvent.count({ where: { status: "FAILED" } }),
    prisma.loginAttempt.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.subscription.groupBy({ by: ["status"], _count: true }),
    prisma.company.groupBy({ by: ["gateway"], _count: true }),
    prisma.company.groupBy({ by: ["country"], _count: true }),
    prisma.invoice.findMany({
      where: { status: "PAID", createdAt: { gte: since } },
      select: { amountMinor: true, currency: true, createdAt: true },
    }),
    prisma.company.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.ticket.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.webhookEvent.findMany({
      where: { createdAt: { gte: dayAgo } },
      select: { status: true, gateway: true },
    }),
    prisma.loginAttempt.findMany({
      where: { createdAt: { gte: dayAgo } },
      select: { success: true },
    }),
    prisma.subscription.findMany({
      where: { status: { in: ["ACTIVE", "TRIALING"] } },
      include: { company: true, plan: { include: { prices: true } } },
    }),
    prisma.subscription.groupBy({
      by: ["planId"],
      where: { status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } },
      _count: true,
      orderBy: { _count: { planId: "desc" } },
      take: 6,
    }),
  ]);

  const mrrByCurrency: Record<string, number> = {};
  for (const subscription of activeForMrr) {
    const price = subscription.plan.prices.find((item) => item.currency === subscription.company.currency);
    if (!price) {
      continue;
    }
    const amount = monthlyMinor(price.amountMinor, subscription.plan.interval);
    mrrByCurrency[price.currency] = (mrrByCurrency[price.currency] ?? 0) + amount;
  }

  const paidBrl = paidInvoices
    .filter((invoice) => invoice.currency === "BRL")
    .reduce((sum, invoice) => sum + invoice.amountMinor, 0);

  const planIds = topPlans.map((row) => row.planId);
  const plans = planIds.length
    ? await prisma.plan.findMany({ where: { id: { in: planIds } }, select: { id: true, name: true } })
    : [];
  const planName = new Map(plans.map((plan) => [plan.id, plan.name]));

  return {
    kpis: {
      companies,
      users,
      activeSubs,
      pastDue,
      openTickets,
      failedWebhooks,
      logins24h: loginWindow,
      paidBrl14d: paidBrl,
      mrrByCurrency,
    },
    series: {
      companies: fillSeries(
        days,
        Object.entries(
          newCompanies.reduce<Record<string, number>>((acc, row) => {
            const key = dayKey(row.createdAt);
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
          }, {}),
        ).map(([day, value]) => ({ day, value })),
      ),
      tickets: fillSeries(
        days,
        Object.entries(
          newTickets.reduce<Record<string, number>>((acc, row) => {
            const key = dayKey(row.createdAt);
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
          }, {}),
        ).map(([day, value]) => ({ day, value })),
      ),
      revenueBrl: fillSeries(
        days,
        Object.entries(
          paidInvoices
            .filter((invoice) => invoice.currency === "BRL")
            .reduce<Record<string, number>>((acc, row) => {
              const key = dayKey(row.createdAt);
              acc[key] = (acc[key] ?? 0) + row.amountMinor;
              return acc;
            }, {}),
        ).map(([day, value]) => ({ day, value })),
      ),
    },
    breakdowns: {
      subscriptions: subscriptionsByStatus.map((row) => ({ label: row.status, value: row._count })),
      gateways: companiesByGateway.map((row) => ({ label: row.gateway, value: row._count })),
      countries: companiesByCountry.map((row) => ({ label: row.country, value: row._count })),
      plans: topPlans.map((row) => ({ label: planName.get(row.planId) ?? row.planId, value: row._count })),
    },
    telemetry: {
      webhooks: webhookRecent.reduce(
        (acc, row) => {
          acc.total += 1;
          acc.byStatus[row.status] = (acc.byStatus[row.status] ?? 0) + 1;
          acc.byGateway[row.gateway] = (acc.byGateway[row.gateway] ?? 0) + 1;
          return acc;
        },
        { total: 0, byStatus: {} as Record<string, number>, byGateway: {} as Record<string, number> },
      ),
      logins: {
        total: loginRecent.length,
        success: loginRecent.filter((row) => row.success).length,
        failed: loginRecent.filter((row) => !row.success).length,
      },
    },
  };
}

export type AdminInsights = Awaited<ReturnType<typeof loadAdminInsights>>;
