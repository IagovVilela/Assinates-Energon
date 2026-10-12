export const instant = false;

import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import type { TicketPriority, TicketStatus } from "@prisma/client";

const STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED"];
const PRIORITIES: TicketPriority[] = ["LOW", "MEDIUM", "HIGH"];

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string }>;
}) {
  const query = await searchParams;
  const t = await getTranslations();
  const status = await getTranslations("status");
  const priority = await getTranslations("priority");
  const statusFilter = STATUSES.find((item) => item === query.status);
  const priorityFilter = PRIORITIES.find((item) => item === query.priority);
  const tickets = await prisma.ticket.findMany({
    where: {
      status: statusFilter,
      priority: priorityFilter,
    },
    include: { company: true },
    orderBy: { updatedAt: "desc" },
  });
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("admin.tickets")}</h1>
      <form className="flex flex-wrap gap-2" method="get">
        <select name="status" defaultValue={statusFilter ?? ""}>
          <option value="">{t("tickets.status")}</option>
          {STATUSES.map((item) => (
            <option key={item} value={item}>{status(item)}</option>
          ))}
        </select>
        <select name="priority" defaultValue={priorityFilter ?? ""}>
          <option value="">{t("tickets.priority")}</option>
          {PRIORITIES.map((item) => (
            <option key={item} value={item}>{priority(item)}</option>
          ))}
        </select>
        <button className="btn-secondary" type="submit">{t("save")}</button>
      </form>
      <ul className="card">
        {tickets.map((ticket) => (
          <li key={ticket.id}>
            <a className="text-teal-800" href={`/admin/tickets/${ticket.id}`}>{ticket.subject}</a>
            <span className="ml-2 text-sm text-slate-600">{ticket.company.name} · {status(ticket.status)} · {priority(ticket.priority)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
