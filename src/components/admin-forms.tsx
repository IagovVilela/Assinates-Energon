"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";

import { createCompanyAction, inviteUserAction, savePlanAction, syncPlanAction } from "@/server/actions/admin-actions";
import { COUNTRIES } from "@/lib/countries";
import {
  maskBrazilianTaxId,
  maskInternationalTaxId,
  maskMoney,
  moneyToMinor,
  onlyDigits,
} from "@/lib/masks";
import { MaskedInput } from "@/components/masked-input";

function FormError({ code }: { code?: string }) {
  const t = useTranslations("errors");
  if (!code) {
    return null;
  }
  return <p className="text-sm text-red-700">{t(code)}</p>;
}

export function CompanyFields({ withPassword = false }: { withPassword?: boolean }) {
  const fields = useTranslations("fields");
  const signup = useTranslations("signup");
  const [country, setCountry] = useState("BR");
  const [currency, setCurrency] = useState("BRL");
  const [taxId, setTaxId] = useState("");
  const national = country === "BR";

  function changeCountry(next: string) {
    setCountry(next);
    if (next === "BR") {
      setCurrency("BRL");
      return;
    }
    setCurrency((current) => (current === "BRL" ? "USD" : current));
  }

  return (
    <>
      <label>{fields("name")}<input name="name" required autoComplete="organization" /></label>
      <label>
        {national ? "CPF ou CNPJ" : fields("taxId")}
        <MaskedInput
          name="taxId"
          required
          inputMode={national ? "numeric" : "text"}
          placeholder={national ? "000.000.000-00" : "Tax id"}
          display={taxId}
          onDisplay={(next) => setTaxId(national ? maskBrazilianTaxId(next) : maskInternationalTaxId(next))}
          hiddenValue={national ? onlyDigits(taxId) : taxId}
        />
      </label>
      <label>
        {fields("country")}
        <select name="country" value={country} onChange={(event) => changeCountry(event.target.value)}>
          {COUNTRIES.map((item) => (
            <option key={item.code} value={item.code}>{item.name}</option>
          ))}
        </select>
      </label>
      <label>
        {fields("currency")}
        <select
          name="currency"
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
        >
          {national ? <option value="BRL">BRL</option> : null}
          {national ? null : <option value="USD">USD</option>}
          {national ? null : <option value="EUR">EUR</option>}
        </select>
      </label>
      <label>
        {fields("locale")}
        <select name="locale" defaultValue="PT_BR">
          <option value="PT_BR">pt-BR</option>
          <option value="EN">en</option>
        </select>
      </label>
      <label>{withPassword ? signup("yourName") : fields("ownerName")}<input name="ownerName" required autoComplete="name" /></label>
      <label>{withPassword ? signup("email") : fields("ownerEmail")}<input name="ownerEmail" type="text" required autoComplete="email" inputMode="email" placeholder="dono@empresa.com" /></label>
      {withPassword ? (
        <label>
          {signup("password")}
          <input name="password" type="password" required autoComplete="new-password" minLength={8} />
          <span className="mt-1 block text-xs text-slate-600">{signup("passwordHint")}</span>
        </label>
      ) : null}
    </>
  );
}

export function CompanyForm() {
  const t = useTranslations("admin");
  const [state, action, pending] = useActionState(createCompanyAction, undefined);
  return (
    <form action={action} className="card flex max-w-xl flex-col gap-3">
      <h1 className="text-xl font-semibold">{t("newCompany")}</h1>
      <CompanyFields />
      <FormError code={state?.error} />
      <button type="submit" disabled={pending}>{t("newCompany")}</button>
    </form>
  );
}

export function InviteUserForm({ companyId }: { companyId: string }) {
  const fields = useTranslations("fields");
  const roles = useTranslations("roles");
  const team = useTranslations("team");
  const [state, action, pending] = useActionState(inviteUserAction, undefined);
  return (
    <form action={action} className="card flex flex-col gap-3">
      <h2 className="font-semibold">{team("invite")}</h2>
      <input type="hidden" name="companyId" value={companyId} />
      <label>{fields("name")}<input name="name" required autoComplete="name" /></label>
      <label>{fields("ownerEmail")}<input name="email" type="email" required autoComplete="email" inputMode="email" /></label>
      <select name="companyRole" defaultValue="TECHNICAL">
        <option value="OWNER">{roles("OWNER")}</option>
        <option value="FINANCE">{roles("FINANCE")}</option>
        <option value="TECHNICAL">{roles("TECHNICAL")}</option>
      </select>
      <FormError code={state?.error} />
      <button type="submit" disabled={pending}>{team("invite")}</button>
    </form>
  );
}

export function PlanForm({
  plan,
}: {
  plan?: {
    id: string;
    name: string;
    description: string;
    type: "RECURRING" | "ONE_TIME";
    interval: "MONTH" | "YEAR" | null;
    active: boolean;
    prices: { currency: string; amountMinor: number }[];
  };
}) {
  const t = useTranslations("admin");
  const fields = useTranslations("fields");
  const planType = useTranslations("planType");
  const interval = useTranslations("interval");
  const [state, action, pending] = useActionState(savePlanAction, undefined);
  const amount = (code: string) => plan?.prices.find((price) => price.currency === code)?.amountMinor ?? 0;
  const [brl, setBrl] = useState(amount("BRL") ? maskMoney(String(amount("BRL"))) : "");
  const [usd, setUsd] = useState(amount("USD") ? maskMoney(String(amount("USD"))) : "");
  const [eur, setEur] = useState(amount("EUR") ? maskMoney(String(amount("EUR"))) : "");
  return (
    <form action={action} className="card flex max-w-xl flex-col gap-3">
      <h1 className="text-xl font-semibold">{plan ? plan.name : t("newPlan")}</h1>
      {plan ? <input type="hidden" name="planId" value={plan.id} /> : null}
      <label>{fields("name")}<input name="name" defaultValue={plan?.name} required /></label>
      <label>{fields("description")}<textarea name="description" defaultValue={plan?.description} required /></label>
      <label>
        {fields("type")}
        <select name="type" defaultValue={plan?.type ?? "RECURRING"}>
          <option value="RECURRING">{planType("RECURRING")}</option>
          <option value="ONE_TIME">{planType("ONE_TIME")}</option>
        </select>
      </label>
      <label>
        {fields("interval")}
        <select name="interval" defaultValue={plan?.interval ?? "MONTH"}>
          <option value="MONTH">{interval("MONTH")}</option>
          <option value="YEAR">{interval("YEAR")}</option>
        </select>
      </label>
      <label>
        BRL
        <MaskedInput
          name="brl"
          inputMode="decimal"
          placeholder="0,00"
          display={brl}
          onDisplay={(next) => setBrl(maskMoney(next))}
          hiddenValue={String(moneyToMinor(brl))}
        />
      </label>
      <label>
        USD
        <MaskedInput
          name="usd"
          inputMode="decimal"
          placeholder="0.00"
          display={usd}
          onDisplay={(next) => setUsd(maskMoney(next))}
          hiddenValue={String(moneyToMinor(usd))}
        />
      </label>
      <label>
        EUR
        <MaskedInput
          name="eur"
          inputMode="decimal"
          placeholder="0.00"
          display={eur}
          onDisplay={(next) => setEur(maskMoney(next))}
          hiddenValue={String(moneyToMinor(eur))}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input className="w-auto" type="checkbox" name="active" defaultChecked={plan?.active ?? true} />
        {fields("active")}
      </label>
      <p className="text-sm text-slate-600">{t("syncHint")}</p>
      <FormError code={state?.error} />
      <button type="submit" disabled={pending}>{t("newPlan")}</button>
    </form>
  );
}

export function SyncPlanForm({ planId }: { planId: string }) {
  const t = useTranslations("admin");
  const [state, action, pending] = useActionState(syncPlanAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="planId" value={planId} />
      <FormError code={state?.error} />
      <button className="btn-secondary" type="submit" disabled={pending}>{t("sync")}</button>
    </form>
  );
}
