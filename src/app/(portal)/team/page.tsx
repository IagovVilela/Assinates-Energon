export const instant = false;

import { getTranslations } from "next-intl/server";

import { InviteTeammateForm } from "@/components/portal-forms";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/server/current-user";
import { can } from "@/server/permissions";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const user = await requireCustomer();
  const params = await searchParams;
  const t = await getTranslations();
  const roles = await getTranslations("roles");
  const users = await prisma.user.findMany({
    where: { companyId: user.companyId },
    orderBy: { name: "asc" },
  });
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("team.title")}</h1>
      {params.invite ? (
        <p className="card text-sm">
          {t("team.link")}: <span className="break-all">{params.invite}</span>
        </p>
      ) : null}
      <ul className="card">
        {users.map((member) => (
          <li key={member.id}>
            {member.name} · {member.email} · {member.companyRole ? roles(member.companyRole) : ""}
          </li>
        ))}
      </ul>
      {can(user, "team.invite") ? <InviteTeammateForm /> : null}
    </div>
  );
}
