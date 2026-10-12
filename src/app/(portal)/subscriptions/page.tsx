export const instant = false;

import { getTranslations } from "next-intl/server";

import { formatMoney } from "@/lib/money";
import { localeTag } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { contractAction } from "@/server/actions/portal-actions";
import { requireCustomer } from "@/server/current-user";
import { can } from "@/server/permissions";

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireCustomer();
  const query = await searchParams;
  const t = await getTranslations();
  const status = await getTranslations("status");
  const locale = localeTag(user.company.locale);
  const [subscriptions, plans] = await Promise.all([
    prisma.subscription.findMany({
      where: { companyId: user.companyId },
      include: { plan: true, pendingPlan: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.plan.findMany({
      where: { active: true, prices: { some: { currency: user.company.currency } } },
      include: { prices: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t("subscriptions.title")}</h1>
      {query.error === "gateway" ? <p className="text-sm text-red-700">{t("errors.gateway")}</p> : null}
      <section className="card overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>{t("fields.name")}</th>
              <th>{t("tickets.status")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((subscription) => (
              <tr key={subscription.id}>
                <td>{subscription.plan.name}</td>
                <td><span className="badge">{status(subscription.status)}</span></td>
                <td>
                  <a className="text-teal-800" href={`/subscriptions/${subscription.id}`}>{t("subscriptions.checkout")}</a>
                  {subscription.pendingPlan ? (
                    <p className="text-xs text-slate-600">
                      {t("subscriptions.pending")}: {subscription.pendingPlan.name}
                    </p>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("subscriptions.available")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {plans.map((plan) => {
            const price = plan.prices.find((item) => item.currency === user.company.currency);
            if (!price) {
              return null;
            }
            return (
              <article key={plan.id} className="card">
                <h3 className="font-semibold">{plan.name}</h3>
                <p className="mt-1 text-sm text-slate-600">{plan.description}</p>
                <p className="mt-2">{formatMoney(price.amountMinor, price.currency, locale)}</p>
                {can(user, "subscription.contract") ? (
                  <form action={contractAction} className="mt-3">
                    <input type="hidden" name="planId" value={plan.id} />
                    <button type="submit">{t("subscriptions.contract")}</button>
                  </form>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
