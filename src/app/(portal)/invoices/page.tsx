export const instant = false;

import { getTranslations } from "next-intl/server";

import { formatMoney } from "@/lib/money";
import { localeTag } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { paymentMethodAction, syncInvoicesAction } from "@/server/actions/portal-actions";
import { requireCustomer } from "@/server/current-user";
import { can } from "@/server/permissions";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireCustomer();
  const query = await searchParams;
  const t = await getTranslations();
  const status = await getTranslations("status");
  if (!can(user, "invoice.view")) {
    return <p>{t("errors.forbidden")}</p>;
  }
  const invoices = await prisma.invoice.findMany({
    where: { companyId: user.companyId },
    orderBy: { createdAt: "desc" },
  });
  const locale = localeTag(user.company.locale);

  return (
    <div className="flex flex-col gap-4">
      {query.error === "gateway" ? <p className="text-sm text-red-700">{t("errors.gateway")}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("invoices.title")}</h1>
        <div className="flex gap-2">
          <form action={syncInvoicesAction}>
            <button className="btn-secondary" type="submit">{t("invoices.sync")}</button>
          </form>
          {can(user, "invoice.pay") ? (
            <form action={paymentMethodAction}>
              <button type="submit">{t("invoices.method")}</button>
            </form>
          ) : null}
        </div>
      </div>
      <section className="card overflow-x-auto">
        {invoices.length === 0 ? <p className="text-sm text-slate-600">{t("empty")}</p> : null}
        <table>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td>{formatMoney(invoice.amountMinor, invoice.currency, locale)}</td>
                <td><span className="badge">{status(invoice.status)}</span></td>
                <td>{invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : ""}</td>
                <td>
                  {can(user, "invoice.pay") && invoice.paymentUrl ? (
                    <a className="text-teal-800" href={invoice.paymentUrl}>{t("invoices.pay")}</a>
                  ) : null}
                </td>
                <td>
                  {invoice.pdfUrl ? <a className="text-teal-800" href={invoice.pdfUrl}>{t("invoices.pdf")}</a> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
