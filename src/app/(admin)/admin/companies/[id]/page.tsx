export const instant = false;

import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { InviteUserForm } from "@/components/admin-forms";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { adminCheckoutAction } from "@/server/actions/admin-actions";

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invite?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const t = await getTranslations();
  const status = await getTranslations("status");
  const roles = await getTranslations("roles");
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      users: true,
      subscriptions: { include: { plan: true } },
      invoices: { orderBy: { createdAt: "desc" }, take: 20 },
      tickets: { orderBy: { updatedAt: "desc" }, take: 20 },
    },
  });
  if (!company) {
    notFound();
  }
  const plans = await prisma.plan.findMany({
    where: { active: true, prices: { some: { currency: company.currency } } },
    orderBy: { name: "asc" },
  });
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{company.name}</h1>
      <p className="text-sm text-slate-600">{company.taxId} · {company.country} · {company.gateway} · {company.currency}</p>
      {query.invite ? <p className="card break-all text-sm">{t("team.link")}: {query.invite}</p> : null}
      {query.error === "gateway" ? <p className="text-sm text-red-700">{t("errors.gateway")}</p> : null}
      <section className="card">
        <h2 className="font-semibold">{t("team.title")}</h2>
        <ul>
          {company.users.map((user) => (
            <li key={user.id}>{user.name} · {user.email} · {user.companyRole ? roles(user.companyRole) : ""}</li>
          ))}
        </ul>
      </section>
      <InviteUserForm companyId={company.id} />
      <section className="card">
        <h2 className="font-semibold">{t("subscriptions.title")}</h2>
        <ul>
          {company.subscriptions.map((subscription) => (
            <li key={subscription.id}>{subscription.plan.name} · {status(subscription.status)}</li>
          ))}
        </ul>
        <form action={adminCheckoutAction} className="mt-3 flex flex-col gap-2">
          <input type="hidden" name="companyId" value={company.id} />
          <select name="planId">
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>{plan.name}</option>
            ))}
          </select>
          <button type="submit">{t("admin.manual")}</button>
        </form>
      </section>
      <section className="card">
        <h2 className="font-semibold">{t("invoices.title")}</h2>
        <ul>
          {company.invoices.map((invoice) => (
            <li key={invoice.id}>{formatMoney(invoice.amountMinor, invoice.currency, "pt-BR")} · {status(invoice.status)}</li>
          ))}
        </ul>
      </section>
      <section className="card">
        <h2 className="font-semibold">{t("tickets.title")}</h2>
        <ul>
          {company.tickets.map((ticket) => (
            <li key={ticket.id}><a className="text-teal-800" href={`/admin/tickets/${ticket.id}`}>{ticket.subject}</a></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
