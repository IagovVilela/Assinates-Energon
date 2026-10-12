import type { AppLocale, CompanyRole } from "@prisma/client";

import { appUrl, localeTag } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { newSecretToken } from "@/lib/tokens";
import { writeAudit } from "@/server/audit";
import { enqueueEmail } from "@/server/jobs/boss";

const INVITE_MS = 7 * 24 * 60 * 60 * 1000;

export async function createInvitation(input: {
  companyId: string;
  email: string;
  companyRole: CompanyRole;
  invitedById: string;
  locale: AppLocale;
  companyName: string;
}) {
  const email = input.email.trim().toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error("EMAIL_TAKEN");
  }
  const { raw, hash } = newSecretToken();
  const invitation = await prisma.invitation.create({
    data: {
      companyId: input.companyId,
      email,
      companyRole: input.companyRole,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + INVITE_MS),
      invitedById: input.invitedById,
    },
  });
  const link = `${appUrl()}/invite/${raw}`;
  const english = localeTag(input.locale) === "en";
  await enqueueEmail({
    to: email,
    subject: english ? `Invitation to ${input.companyName}` : `Convite para ${input.companyName}`,
    text: english
      ? `You were invited to ${input.companyName}. Open this link to set your password: ${link}`
      : `Você foi convidado para ${input.companyName}. Abra este link para definir sua senha: ${link}`,
  });
  await writeAudit({
    actorId: input.invitedById,
    companyId: input.companyId,
    action: "user.invited",
    entityType: "Invitation",
    entityId: invitation.id,
    metadata: { email, companyRole: input.companyRole },
  });
  return { invitation, link };
}
