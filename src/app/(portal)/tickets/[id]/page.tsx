export const instant = false;

import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ReplyForm } from "@/components/portal-forms";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/server/current-user";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCustomer();
  const { id } = await params;
  const t = await getTranslations();
  const status = await getTranslations("status");
  const ticket = await prisma.ticket.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      messages: {
        where: { visibility: "PUBLIC" },
        include: { author: true, attachments: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!ticket) {
    notFound();
  }
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">{ticket.subject}</h1>
      <p className="mt-2"><span className="badge">{status(ticket.status)}</span></p>
      <ol className="mt-4 flex flex-col gap-3">
        {ticket.messages.map((message) => (
          <li key={message.id} className="card">
            <p className="text-sm text-slate-600">{message.author.name}</p>
            <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
            <ul>
              {message.attachments.map((attachment) => (
                <li key={attachment.id}>
                  <a className="text-sm text-teal-800" href={`/api/attachments/${attachment.id}`}>{attachment.filename}</a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <ReplyForm ticketId={ticket.id} />
      <p className="sr-only">{t("tickets.reply")}</p>
    </div>
  );
}
