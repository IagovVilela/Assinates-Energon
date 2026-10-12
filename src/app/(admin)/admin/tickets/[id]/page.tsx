export const instant = false;

import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ReplyForm } from "@/components/portal-forms";
import { prisma } from "@/lib/prisma";

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations();
  const status = await getTranslations("status");
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      company: true,
      messages: { include: { author: true, attachments: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!ticket) {
    notFound();
  }
  return (
    <div className="max-w-3xl">
      <p className="text-sm text-slate-600">{ticket.company.name}</p>
      <h1 className="text-2xl font-semibold">{ticket.subject}</h1>
      <p className="mt-2"><span className="badge">{status(ticket.status)}</span></p>
      <ol className="mt-4 flex flex-col gap-3">
        {ticket.messages.map((message) => (
          <li key={message.id} className="card">
            <p className="text-sm text-slate-600">
              {message.author.name}
              {message.visibility === "INTERNAL" ? ` · ${t("tickets.internal")}` : ""}
            </p>
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
      <ReplyForm ticketId={ticket.id} admin currentStatus={ticket.status} />
    </div>
  );
}
