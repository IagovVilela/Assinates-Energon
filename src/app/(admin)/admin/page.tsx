export const instant = false;

import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";

export default async function AdminHomePage() {
  const t = await getTranslations();
  const [companies, openTickets, pastDue] = await Promise.all([
    prisma.company.count(),
    prisma.ticket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER"] } } }),
    prisma.subscription.count({ where: { status: "PAST_DUE" } }),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("admin.title")}</h1>
      <div className="grid gap-3 md:grid-cols-3">
        <article className="card"><p className="text-sm text-slate-600">{t("admin.companies")}</p><p className="text-2xl font-semibold">{companies}</p></article>
        <article className="card"><p className="text-sm text-slate-600">{t("admin.tickets")}</p><p className="text-2xl font-semibold">{openTickets}</p></article>
        <article className="card"><p className="text-sm text-slate-600">{t("status.PAST_DUE")}</p><p className="text-2xl font-semibold">{pastDue}</p></article>
      </div>
    </div>
  );
}
