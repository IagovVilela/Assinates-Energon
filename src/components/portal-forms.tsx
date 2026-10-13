"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import type { TicketStatus } from "@prisma/client";

import {
  adminReplyTicketAction,
  cancelSubscriptionAction,
  changePlanAction,
  createTicketAction,
  inviteTeammateAction,
  replyTicketAction,
} from "@/server/actions/portal-actions";

function FormError({ code }: { code?: string }) {
  const t = useTranslations("errors");
  if (!code) {
    return null;
  }
  return <p className="text-sm text-red-700">{t(code)}</p>;
}

export function ChangePlanForm({
  subscriptionId,
  plans,
}: {
  subscriptionId: string;
  plans: { id: string; name: string }[];
}) {
  const t = useTranslations("subscriptions");
  const [state, action, pending] = useActionState(changePlanAction, undefined);
  return (
    <form action={action} className="card flex flex-col gap-3">
      <h2 className="font-semibold">{t("change")}</h2>
      <p className="text-sm text-slate-600">{t("changeRule")}</p>
      <input type="hidden" name="subscriptionId" value={subscriptionId} />
      <select name="planId" required>
        {plans.map((plan) => (
          <option key={plan.id} value={plan.id}>{plan.name}</option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm">
        <input className="w-auto" type="checkbox" name="confirm" />
        {t("changeRule")}
      </label>
      <FormError code={state?.error} />
      <button type="submit" disabled={pending}>{t("change")}</button>
    </form>
  );
}

export function CancelForm({ subscriptionId, gateway }: { subscriptionId: string; gateway: "ASAAS" | "STRIPE" }) {
  const t = useTranslations("subscriptions");
  const [state, action, pending] = useActionState(cancelSubscriptionAction, undefined);
  return (
    <form action={action} className="card flex flex-col gap-3">
      <h2 className="font-semibold">{t("cancel")}</h2>
      <p className="text-sm text-slate-600">{gateway === "STRIPE" ? t("cancelStripe") : t("cancelAsaas")}</p>
      <input type="hidden" name="subscriptionId" value={subscriptionId} />
      <label className="flex items-center gap-2 text-sm">
        <input className="w-auto" type="checkbox" name="confirm" />
        {t("cancel")}
      </label>
      <FormError code={state?.error} />
      <button type="submit" disabled={pending}>{t("cancel")}</button>
    </form>
  );
}

export function TicketForm() {
  const t = useTranslations("tickets");
  const priority = useTranslations("priority");
  const [state, action, pending] = useActionState(createTicketAction, undefined);
  return (
    <form action={action} className="card flex max-w-xl flex-col gap-3">
      <h1 className="text-xl font-semibold">{t("new")}</h1>
      <label>{t("subject")}<input name="subject" required /></label>
      <label>
        {t("priority")}
        <select name="priority" defaultValue="MEDIUM">
          <option value="LOW">{priority("LOW")}</option>
          <option value="MEDIUM">{priority("MEDIUM")}</option>
          <option value="HIGH">{priority("HIGH")}</option>
        </select>
      </label>
      <label>{t("message")}<textarea name="body" rows={5} required /></label>
      <FormError code={state?.error} />
      <button type="submit" disabled={pending}>{t("new")}</button>
    </form>
  );
}

export function ReplyForm({
  ticketId,
  admin = false,
  currentStatus,
}: {
  ticketId: string;
  admin?: boolean;
  currentStatus?: TicketStatus;
}) {
  const t = useTranslations("tickets");
  const status = useTranslations("status");
  const actionFn = admin ? adminReplyTicketAction : replyTicketAction;
  const [state, formAction, pending] = useActionState(actionFn, undefined);
  return (
    <form action={formAction} className="card mt-4 flex flex-col gap-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <label>{t("message")}<textarea name="body" rows={4} required /></label>
      <label>{t("attachment")}<input name="file" type="file" /></label>
      {admin ? (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input className="w-auto" type="checkbox" name="internal" />
            {t("internal")}
          </label>
          <label>
            {t("status")}
            <select name="status" defaultValue={currentStatus ?? "OPEN"}>
              <option value="OPEN">{status("OPEN")}</option>
              <option value="IN_PROGRESS">{status("IN_PROGRESS")}</option>
              <option value="WAITING_CUSTOMER">{status("WAITING_CUSTOMER")}</option>
              <option value="RESOLVED">{status("RESOLVED")}</option>
            </select>
          </label>
        </>
      ) : null}
      <FormError code={state?.error} />
      <button type="submit" disabled={pending}>{t("reply")}</button>
    </form>
  );
}

export function InviteTeammateForm() {
  const t = useTranslations("team");
  const fields = useTranslations("fields");
  const roles = useTranslations("roles");
  const [state, action, pending] = useActionState(inviteTeammateAction, undefined);
  return (
    <form action={action} className="card flex max-w-xl flex-col gap-3">
      <h2 className="font-semibold">{t("invite")}</h2>
      <label>{fields("name")}<input name="name" required /></label>
      <label>{fields("email")}<input name="email" type="email" required autoComplete="email" inputMode="email" /></label>
      <label>
        {fields("role")}
        <select name="companyRole" defaultValue="TECHNICAL">
          <option value="OWNER">{roles("OWNER")}</option>
          <option value="FINANCE">{roles("FINANCE")}</option>
          <option value="TECHNICAL">{roles("TECHNICAL")}</option>
        </select>
      </label>
      <FormError code={state?.error} />
      <button type="submit" disabled={pending}>{t("invite")}</button>
    </form>
  );
}
