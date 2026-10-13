"use server";

import { AuthError } from "next-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth, signIn, signOut } from "@/auth";
import { hashToken, newSecretToken } from "@/lib/tokens";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/locale";
import { writeAudit } from "@/server/audit";
import { enqueueEmail } from "@/server/jobs/boss";
import { hashPassword } from "@/server/passwords";
import { isLoginRateLimited } from "@/server/rate-limit";
import { registerCompany } from "@/server/companies";
import { loginSchema, passwordSchema } from "@/server/validation";

export type FormState = { error?: string } | undefined;

export async function loginAction(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "invalid" };
  }
  const email = parsed.data.email.toLowerCase();
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const recent = await prisma.loginAttempt.findMany({
    where: { email, createdAt: { gte: since } },
    select: { email: true, success: true, createdAt: true },
  });
  if (isLoginRateLimited(recent, email)) {
    return { error: "rate_limited" };
  }
  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "invalid" };
    }
    throw error;
  }
  return undefined;
}

export async function logoutAction() {
  const session = await auth();
  if (session?.sessionToken) {
    await prisma.session.deleteMany({ where: { sessionToken: session.sessionToken } });
  }
  await signOut({ redirectTo: "/login" });
}

export async function forgotPasswordAction(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.pick({ email: true }).safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: "sent" };
  }
  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const { raw, hash } = newSecretToken();
    await prisma.passwordReset.create({
      data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    const link = `${appUrl()}/reset-password?token=${raw}`;
    await enqueueEmail({
      to: email,
      subject: "Password reset",
      text: link,
    });
  }
  return { error: "sent" };
}

export async function resetPasswordAction(_state: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const password = passwordSchema.safeParse(formData.get("password"));
  if (!token || !password.success) {
    return { error: "invalid" };
  }
  const reset = await prisma.passwordReset.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    return { error: "invalid" };
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: { passwordHash: await hashPassword(password.data) },
    }),
    prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: reset.userId } }),
  ]);
  redirect("/login");
}

export async function registerCompanyAction(_state: FormState, formData: FormData): Promise<FormState> {
  const registered = await registerCompany({
    name: formData.get("name"),
    taxId: formData.get("taxId"),
    country: formData.get("country"),
    currency: formData.get("currency"),
    locale: formData.get("locale"),
    ownerName: formData.get("ownerName"),
    ownerEmail: formData.get("ownerEmail"),
    password: formData.get("password"),
  });
  if ("error" in registered) {
    return { error: registered.error };
  }
  if (!registered.password) {
    return { error: "weak_password" };
  }
  const jar = await cookies();
  jar.set("locale", registered.company.locale === "EN" ? "en" : "pt-BR", {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
  });
  try {
    await signIn("credentials", {
      email: registered.email,
      password: registered.password,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "invalid" };
    }
    throw error;
  }
  return undefined;
}

export async function acceptInviteAction(_state: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const password = passwordSchema.safeParse(formData.get("password"));
  if (!token || name.length < 2 || !password.success) {
    return { error: "invalid" };
  }
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { company: true },
  });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
    return { error: "invalid" };
  }
  const passwordHash = await hashPassword(password.data);
  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        name,
        email: invitation.email,
        passwordHash,
        platformRole: "CUSTOMER",
        companyId: invitation.companyId,
        companyRole: invitation.companyRole,
        emailVerified: new Date(),
      },
    });
    await tx.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
  });
  const jar = await cookies();
  jar.set("locale", invitation.company.locale === "EN" ? "en" : "pt-BR", {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
  });
  await writeAudit({
    companyId: invitation.companyId,
    action: "user.accepted_invite",
    entityType: "Invitation",
    entityId: invitation.id,
  });
  try {
    await signIn("credentials", {
      email: invitation.email,
      password: password.data,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "invalid" };
    }
    throw error;
  }
  return undefined;
}
