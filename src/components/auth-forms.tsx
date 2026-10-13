"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { CompanyFields } from "@/components/admin-forms";
import {
  acceptInviteAction,
  forgotPasswordAction,
  loginAction,
  registerCompanyAction,
  resetPasswordAction,
} from "@/server/actions/auth-actions";

function ErrorLine({ code }: { code?: string }) {
  const t = useTranslations();
  if (!code || code === "sent") {
    return null;
  }
  const key = code === "rate_limited" ? "login.rate_limited" : code === "invalid" ? "errors.invalid" : `errors.${code}`;
  return <p className="text-sm text-red-700">{t(key)}</p>;
}

export function LoginForm() {
  const t = useTranslations("login");
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <label>
        {t("email")}
        <input name="email" type="email" autoComplete="email" inputMode="email" required />
      </label>
      <label>
        {t("password")}
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <ErrorLine code={state?.error} />
      <button type="submit" disabled={pending}>{t("submit")}</button>
      <p className="text-sm">
        <a className="font-semibold text-teal-800" href="/register">{t("createAccount")}</a>
      </p>
      <a className="text-sm text-teal-800" href="/forgot-password">{t("forgot")}</a>
    </form>
  );
}

export function SignupForm() {
  const t = useTranslations("signup");
  const [state, action, pending] = useActionState(registerCompanyAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="text-sm text-slate-600">{t("hint")}</p>
      <CompanyFields withPassword />
      <ErrorLine code={state?.error} />
      <button type="submit" disabled={pending}>{t("submit")}</button>
      <a className="text-sm text-teal-800" href="/login">{t("back")}</a>
    </form>
  );
}

export function ForgotForm() {
  const t = useTranslations("forgot");
  const errors = useTranslations("errors");
  const [state, action, pending] = useActionState(forgotPasswordAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <input name="email" type="email" autoComplete="email" inputMode="email" required />
      {state?.error === "sent" ? <p className="text-sm">{t("sent")}</p> : null}
      {state?.error && state.error !== "sent" ? <p className="text-sm text-red-700">{errors("invalid")}</p> : null}
      <button type="submit" disabled={pending}>{t("submit")}</button>
      <a className="text-sm text-teal-800" href="/login">{t("back")}</a>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const t = useTranslations("reset");
  const [state, action, pending] = useActionState(resetPasswordAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <input type="hidden" name="token" value={token} />
      <input name="password" type="password" autoComplete="new-password" required />
      {state?.error ? <p className="text-sm text-red-700">{t("invalid")}</p> : null}
      <button type="submit" disabled={pending}>{t("submit")}</button>
    </form>
  );
}

export function InviteForm({ token }: { token: string }) {
  const t = useTranslations("invite");
  const [state, action, pending] = useActionState(acceptInviteAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <input type="hidden" name="token" value={token} />
      <label>
        {t("name")}
        <input name="name" required />
      </label>
      <input name="password" type="password" autoComplete="new-password" required />
      {state?.error ? <p className="text-sm text-red-700">{t("invalid")}</p> : null}
      <button type="submit" disabled={pending}>{t("submit")}</button>
    </form>
  );
}
