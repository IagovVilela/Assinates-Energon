import "server-only";

import { io } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function requireUser() {
  await io();
  const session = await auth();
  if (!session?.sessionToken) {
    redirect("/login");
  }
  const stored = await prisma.session.findUnique({
    where: { sessionToken: session.sessionToken },
    include: { user: { include: { company: true } } },
  });
  if (!stored || stored.expires < new Date()) {
    redirect("/login");
  }
  return stored.user;
}

export async function requireCustomer() {
  const user = await requireUser();
  if (user.platformRole === "ADMIN") {
    redirect("/admin");
  }
  if (!user.companyId || !user.company) {
    redirect("/login");
  }
  return { ...user, companyId: user.companyId, company: user.company };
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.platformRole !== "ADMIN") {
    redirect("/");
  }
  return user;
}
