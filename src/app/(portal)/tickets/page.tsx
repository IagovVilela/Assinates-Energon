export const instant = false;

import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/server/current-user";

export default async function TicketsPage() {
  const user = await requireCustomer();
  const t = await getTranslations();
  const status = await getTranslations("status");
  const priority = await getTranslations("priority");
  const tickets = await prisma.ticket.findMany({
    where: { companyId: user.companyId },
    orderBy: { updatedAt: "desc" },
  });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("tickets.title")}</h1>
        <a className="btn" href="/tickets/new">{t("tickets.new")}</a>
      </div>
      <section className="card">
        {tickets.length === 0 ? <p className="text-sm text-slate-600">{t("empty")}</p> : null}
        <ul className="flex flex-col gap-2">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <a className="text-teal-800" href={`/tickets/${ticket.id}`}>{ticket.subject}</a>
              <span className="badge ml-2">{status(ticket.status)}</span>
              <span className="ml-2 text-sm text-slate-600">{priority(ticket.priority)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
