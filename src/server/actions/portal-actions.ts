"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { log } from "@/lib/log";

import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/server/audit";
import {
  cancelCompanySubscription,
  paymentMethodLink,
  schedulePlanChange,
  startCheckout,
  syncCompanyInvoices,
} from "@/server/billing";
import { requireAdmin, requireCustomer } from "@/server/current-user";
import { createInvitation } from "@/server/invitations";
import { can } from "@/server/permissions";
import { assertAttachment, putObject } from "@/server/storage";
import { inviteSchema, replySchema, ticketSchema } from "@/server/validation";
import type { FormState } from "@/server/actions/auth-actions";
import type { TicketStatus } from "@prisma/client";

export async function contractAction(formData: FormData) {
  const user = await requireCustomer();
  if (!can(user, "subscription.contract")) {
    return;
  }
  let url: string;
  try {
    url = await startCheckout({
      company: user.company,
      planId: String(formData.get("planId") ?? ""),
      actorId: user.id,
    });
  } catch (error) {
    log("error", "checkout.failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    redirect("/subscriptions?error=gateway");
  }
  redirect(url);
}

export async function changePlanAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireCustomer();
  if (!can(user, "subscription.change")) {
    return { error: "forbidden" };
  }
  if (formData.get("confirm") !== "on") {
    return { error: "confirm" };
  }
  try {
    await schedulePlanChange({
      company: user.company,
      subscriptionId: String(formData.get("subscriptionId") ?? ""),
      nextPlanId: String(formData.get("planId") ?? ""),
      actorId: user.id,
    });
  } catch (error) {
    if (error instanceof Error) {
      return { error: "gateway" };
    }
    throw error;
  }
  revalidatePath("/subscriptions");
  return undefined;
}

export async function cancelSubscriptionAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireCustomer();
  if (!can(user, "subscription.cancel")) {
    return { error: "forbidden" };
  }
  if (formData.get("confirm") !== "on") {
    return { error: "confirm" };
  }
  try {
    await cancelCompanySubscription({
      company: user.company,
      subscriptionId: String(formData.get("subscriptionId") ?? ""),
      actorId: user.id,
    });
  } catch (error) {
    if (error instanceof Error) {
      return { error: "gateway" };
    }
    throw error;
  }
  revalidatePath("/subscriptions");
  return undefined;
}

export async function syncInvoicesAction() {
  const user = await requireCustomer();
  if (!can(user, "invoice.view")) {
    return;
  }
  await syncCompanyInvoices(user.company);
  revalidatePath("/invoices");
}

export async function paymentMethodAction() {
  const user = await requireCustomer();
  if (!can(user, "invoice.pay")) {
    return;
  }
  let url: string;
  try {
    url = await paymentMethodLink(user.company);
  } catch {
    redirect("/invoices?error=gateway");
  }
  redirect(url);
}

export async function inviteTeammateAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireCustomer();
  if (!can(user, "team.invite")) {
    return { error: "forbidden" };
  }
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    companyRole: formData.get("companyRole"),
  });
  if (!parsed.success) {
    return { error: "invalid" };
  }
  try {
    const invite = await createInvitation({
      companyId: user.companyId,
      email: parsed.data.email,
      companyRole: parsed.data.companyRole,
      invitedById: user.id,
      locale: user.company.locale,
      companyName: user.company.name,
    });
    redirect(`/team?invite=${encodeURIComponent(invite.link)}`);
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_TAKEN") {
      return { error: "email_taken" };
    }
    throw error;
  }
}

export async function createTicketAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireCustomer();
  if (!can(user, "ticket.create")) {
    return { error: "forbidden" };
  }
  const parsed = ticketSchema.safeParse({
    subject: formData.get("subject"),
    body: formData.get("body"),
    priority: formData.get("priority"),
  });
  if (!parsed.success) {
    return { error: "invalid" };
  }
  const ticket = await prisma.ticket.create({
    data: {
      companyId: user.companyId,
      subject: parsed.data.subject,
      priority: parsed.data.priority,
      createdById: user.id,
      messages: {
        create: { authorId: user.id, body: parsed.data.body, visibility: "PUBLIC" },
      },
    },
  });
  await writeAudit({
    actorId: user.id,
    companyId: user.companyId,
    action: "ticket.created",
    entityType: "Ticket",
    entityId: ticket.id,
  });
  redirect(`/tickets/${ticket.id}`);
}

async function saveReply(input: {
  ticketId: string;
  companyId: string;
  authorId: string;
  body: string;
  visibility: "PUBLIC" | "INTERNAL";
  status?: TicketStatus;
}) {
  const message = await prisma.ticketMessage.create({
    data: {
      ticketId: input.ticketId,
      authorId: input.authorId,
      body: input.body,
      visibility: input.visibility,
    },
  });
  if (input.status) {
    await prisma.ticket.update({ where: { id: input.ticketId }, data: { status: input.status } });
  }
  return message;
}

export async function replyTicketAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireCustomer();
  if (!can(user, "ticket.reply")) {
    return { error: "forbidden" };
  }
  const parsed = replySchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) {
    return { error: "invalid" };
  }
  const ticketId = String(formData.get("ticketId") ?? "");
  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, companyId: user.companyId } });
  if (!ticket) {
    return { error: "not_found" };
  }
  const message = await saveReply({
    ticketId,
    companyId: user.companyId,
    authorId: user.id,
    body: parsed.data.body,
    visibility: "PUBLIC",
    status: ticket.status === "WAITING_CUSTOMER" ? "OPEN" : ticket.status,
  });
  await attachFile(formData.get("file"), message.id);
  await writeAudit({
    actorId: user.id,
    companyId: user.companyId,
    action: "ticket.replied",
    entityType: "Ticket",
    entityId: ticketId,
  });
  revalidatePath(`/tickets/${ticketId}`);
  return undefined;
}

export async function adminReplyTicketAction(_state: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = replySchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) {
    return { error: "invalid" };
  }
  const ticketId = String(formData.get("ticketId") ?? "");
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    return { error: "not_found" };
  }
  const internal = formData.get("internal") === "on";
  const requested = String(formData.get("status") ?? "");
  const status = isTicketStatus(requested) ? requested : internal ? ticket.status : "WAITING_CUSTOMER";
  const message = await saveReply({
    ticketId,
    companyId: ticket.companyId,
    authorId: admin.id,
    body: parsed.data.body,
    visibility: internal ? "INTERNAL" : "PUBLIC",
    status,
  });
  await attachFile(formData.get("file"), message.id);
  await writeAudit({
    actorId: admin.id,
    companyId: ticket.companyId,
    action: "ticket.replied",
    entityType: "Ticket",
    entityId: ticketId,
    metadata: { internal },
  });
  revalidatePath(`/admin/tickets/${ticketId}`);
  return undefined;
}

function isTicketStatus(value: string): value is TicketStatus {
  return value === "OPEN" || value === "IN_PROGRESS" || value === "WAITING_CUSTOMER" || value === "RESOLVED";
}

async function attachFile(value: FormDataEntryValue | null, messageId: string) {
  if (!(value instanceof File) || value.size === 0) {
    return;
  }
  assertAttachment(value);
  const extension = value.name.split(".").pop()?.toLowerCase() ?? "bin";
  const key = `tickets/${messageId}/${crypto.randomUUID()}.${extension}`;
  const bytes = Buffer.from(await value.arrayBuffer());
  await putObject(key, bytes, value.type);
  await prisma.attachment.create({
    data: {
      ticketMessageId: messageId,
      storageKey: key,
      filename: value.name,
      contentType: value.type,
      size: value.size,
    },
  });
}
