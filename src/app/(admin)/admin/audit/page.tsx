export const instant = false;

import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";

export default async function AuditPage() {
  const t = await getTranslations();
  const logs = await prisma.auditLog.findMany({
    include: { actor: true, company: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("admin.audit")}</h1>
      <div className="card overflow-x-auto">
        <table>
          <tbody>
            {logs.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                <td>{entry.action}</td>
                <td>{entry.company?.name ?? ""}</td>
                <td>{entry.actor?.email ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
