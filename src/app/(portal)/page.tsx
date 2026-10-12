export const instant = false;

import { getTranslations } from "next-intl/server";

import { formatMoney } from "@/lib/money";
import { localeTag } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/server/current-user";
import { can } from "@/server/permissions";

export default async function OverviewPage() {
  const user = await requireCustomer();
  const t = await getTranslations();
  const status = await getTranslations("status");
  const locale = localeTag(user.company.locale);
  const [subscriptions, invoices] = await Promise.all([
    prisma.subscription.findMany({
      where: { companyId: user.companyId, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE", "INCOMPLETE"] } },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    }),
    can(user, "invoice.view")
      ? prisma.invoice.findMany({
          where: { companyId: user.companyId, status: "OPEN" },
          orderBy: { dueDate: "asc" },
          take: 5,
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t("overview.title")}</h1>
      <section className="card">
        <h2 className="mb-3 font-semibold">{t("overview.services")}</h2>
        {subscriptions.length === 0 ? <p className="text-sm text-slate-600">{t("empty")}</p> : null}
        <ul className="flex flex-col gap-2">
          {subscriptions.map((subscription) => (
            <li key={subscription.id}>
              <a className="text-teal-800" href={`/subscriptions/${subscription.id}`}>
                {subscription.plan.name}
              </a>{" "}
              <span className="badge">{status(subscription.status)}</span>
            </li>
          ))}
        </ul>
      </section>
      {can(user, "invoice.view") ? (
        <section className="card">
          <h2 className="mb-3 font-semibold">{t("overview.nextCharges")}</h2>
          {invoices.length === 0 ? <p className="text-sm text-slate-600">{t("empty")}</p> : null}
          <ul>
            {invoices.map((invoice) => (
              <li key={invoice.id}>
                {formatMoney(invoice.amountMinor, invoice.currency, locale)} · {status(invoice.status)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
