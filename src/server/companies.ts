import { Prisma } from "@prisma/client";
import type { AppLocale } from "@prisma/client";

import { isValidBrazilianTaxId, onlyDigits } from "@/lib/cnpj";
import { currencyForCountry, gatewayForCountry } from "@/lib/countries";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/server/audit";
import { hashPassword } from "@/server/passwords";
import { companySchema, passwordSchema } from "@/server/validation";

export type RegisterCompanyInput = {
  name: unknown;
  taxId: unknown;
  country: unknown;
  currency: unknown;
  locale: unknown;
  ownerName: unknown;
  ownerEmail: unknown;
  password?: unknown;
};

export type RegisterCompanyResult =
  | { error: "invalid" | "email" | "tax_id" | "weak_password" | "email_taken" | "company_exists" }
  | { company: { id: string; name: string; locale: AppLocale }; owner: { id: string } | null; email: string; password?: string };

export async function registerCompany(input: RegisterCompanyInput, actorId?: string): Promise<RegisterCompanyResult> {
  const parsed = companySchema.safeParse({
    name: input.name,
    taxId: input.taxId,
    country: input.country,
    currency: input.currency || undefined,
    locale: input.locale,
    ownerName: input.ownerName,
    ownerEmail: input.ownerEmail,
  });
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    if (fields.ownerEmail?.length) {
      return { error: "email" as const };
    }
    if (fields.taxId?.length) {
      return { error: "tax_id" as const };
    }
    return { error: "invalid" as const };
  }

  const password = input.password === undefined ? null : passwordSchema.safeParse(input.password);
  if (input.password !== undefined && !password?.success) {
    return { error: "weak_password" as const };
  }

  const country = parsed.data.country.toUpperCase();
  const taxId = country === "BR" ? onlyDigits(parsed.data.taxId) : parsed.data.taxId.trim();
  if (country === "BR" && !isValidBrazilianTaxId(taxId)) {
    return { error: "tax_id" as const };
  }

  const email = parsed.data.ownerEmail;
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return { error: "email_taken" as const };
  }

  const gateway = gatewayForCountry(country);
  const currency = currencyForCountry(country, parsed.data.currency);
  const locale = parsed.data.locale as AppLocale;
  const passwordHash = password?.success ? await hashPassword(password.data) : null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: parsed.data.name,
          taxId,
          country,
          currency,
          locale,
          gateway,
        },
      });
      const owner = passwordHash
        ? await tx.user.create({
            data: {
              name: parsed.data.ownerName,
              email,
              passwordHash,
              platformRole: "CUSTOMER",
              companyId: company.id,
              companyRole: "OWNER",
              emailVerified: new Date(),
            },
          })
        : null;
      return { company, owner };
    });

    await writeAudit({
      actorId: actorId ?? result.owner?.id,
      companyId: result.company.id,
      action: "company.created",
      entityType: "Company",
      entityId: result.company.id,
    });

    return { company: result.company, owner: result.owner, email, password: password?.success ? password.data : undefined };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "company_exists" as const };
    }
    throw error;
  }
}