"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@prisma/client";

import { isValidBrazilianTaxId, onlyDigits } from "@/lib/cnpj";
import { currencyForCountry, gatewayForCountry } from "@/lib/countries";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/server/audit";
import { startCheckout, syncPlanCatalog } from "@/server/billing";
import { requireAdmin } from "@/server/current-user";
import { createInvitation } from "@/server/invitations";
import { can } from "@/server/permissions";
import { companySchema, inviteSchema, planSchema } from "@/server/validation";
import type { FormState } from "@/server/actions/auth-actions";

function pricesFrom(input: { brl: number; usd: number; eur: number }) {
  return [
    { currency: "BRL", amountMinor: input.brl },
    { currency: "USD", amountMinor: input.usd },
    { currency: "EUR", amountMinor: input.eur },
  ].filter((price) => price.amountMinor > 0);
}

export async function createCompanyAction(_state: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = companySchema.safeParse({
    name: formData.get("name"),
    taxId: formData.get("taxId"),
    country: formData.get("country"),
    currency: formData.get("currency") || undefined,
    locale: formData.get("locale"),
    ownerName: formData.get("ownerName"),
    ownerEmail: formData.get("ownerEmail"),
  });
  if (!parsed.success) {
    return { error: "invalid" };
  }
  const country = parsed.data.country.toUpperCase();
  const taxId = country === "BR" ? onlyDigits(parsed.data.taxId) : parsed.data.taxId.trim();
  if (country === "BR" && !isValidBrazilianTaxId(taxId)) {
    return { error: "tax_id" };
  }
  const gateway = gatewayForCountry(country);
  const currency = currencyForCountry(country, parsed.data.currency);
  try {
    const company = await prisma.company.create({
      data: {
        name: parsed.data.name,
        taxId,
        country,
        currency,
        locale: parsed.data.locale,
        gateway,
      },
    });
    await writeAudit({
      actorId: admin.id,
      companyId: company.id,
      action: "company.created",
      entityType: "Company",
      entityId: company.id,
    });
    const invite = await createInvitation({
      companyId: company.id,
      email: parsed.data.ownerEmail,
      companyRole: "OWNER",
      invitedById: admin.id,
      locale: company.locale,
      companyName: company.name,
    });
    redirect(`/admin/companies/${company.id}?invite=${encodeURIComponent(invite.link)}`);
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_TAKEN") {
      return { error: "email_taken" };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "company_exists" };
    }
    throw error;
  }
}

export async function inviteUserAction(_state: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const companyId = String(formData.get("companyId") ?? "");
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    companyRole: formData.get("companyRole"),
  });
  if (!parsed.success) {
    return { error: "invalid" };
  }
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    return { error: "not_found" };
  }
  try {
    const invite = await createInvitation({
      companyId: company.id,
      email: parsed.data.email,
      companyRole: parsed.data.companyRole,
      invitedById: admin.id,
      locale: company.locale,
      companyName: company.name,
    });
    redirect(`/admin/companies/${company.id}?invite=${encodeURIComponent(invite.link)}`);
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_TAKEN") {
      return { error: "email_taken" };
    }
    throw error;
  }
}

export async function savePlanAction(_state: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!can(admin, "plan.manage")) {
    return { error: "forbidden" };
  }
  const parsed = planSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    type: formData.get("type"),
    interval: formData.get("interval") || undefined,
    brl: formData.get("brl") || 0,
    usd: formData.get("usd") || 0,
    eur: formData.get("eur") || 0,
    active: formData.get("active") === "on",
  });
  if (!parsed.success) {
    return { error: "invalid" };
  }
  if (parsed.data.type === "RECURRING" && !parsed.data.interval) {
    return { error: "invalid" };
  }
  const prices = pricesFrom(parsed.data);
  if (prices.length === 0) {
    return { error: "invalid" };
  }
  const planId = String(formData.get("planId") ?? "");
  const data = {
    name: parsed.data.name,
    description: parsed.data.description,
    type: parsed.data.type,
    interval: parsed.data.type === "RECURRING" ? parsed.data.interval : null,
    active: parsed.data.active,
  };
  const plan = planId
    ? await prisma.plan.update({ where: { id: planId }, data })
    : await prisma.plan.create({ data });
  for (const price of prices) {
    await prisma.planPrice.upsert({
      where: { planId_currency: { planId: plan.id, currency: price.currency } },
      create: { planId: plan.id, currency: price.currency, amountMinor: price.amountMinor },
      update: { amountMinor: price.amountMinor },
    });
  }
  await writeAudit({
    actorId: admin.id,
    action: planId ? "plan.updated" : "plan.created",
    entityType: "Plan",
    entityId: plan.id,
  });
  revalidatePath("/admin/plans");
  redirect(`/admin/plans/${plan.id}`);
}

export async function syncPlanAction(formData: FormData) {
  const admin = await requireAdmin();
  const planId = String(formData.get("planId") ?? "");
  await syncPlanCatalog(planId, admin.id);
  revalidatePath(`/admin/plans/${planId}`);
}

export async function adminCheckoutAction(formData: FormData) {
  const admin = await requireAdmin();
  const companyId = String(formData.get("companyId") ?? "");
  const planId = String(formData.get("planId") ?? "");
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    return;
  }
  let url: string;
  try {
    url = await startCheckout({ company, planId, actorId: admin.id });
  } catch {
    redirect(`/admin/companies/${companyId}?error=gateway`);
  }
  redirect(url);
}
