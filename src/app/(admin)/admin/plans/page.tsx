export const instant = false;

import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";

export default async function PlansPage() {
  const t = await getTranslations();
  const plans = await prisma.plan.findMany({ include: { prices: true }, orderBy: { name: "asc" } });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("admin.plans")}</h1>
        <a className="btn" href="/admin/plans/new">{t("admin.newPlan")}</a>
      </div>
      <ul className="card">
        {plans.map((plan) => (
          <li key={plan.id}>
            <a className="text-teal-800" href={`/admin/plans/${plan.id}`}>{plan.name}</a>
            <span className="ml-2 text-sm text-slate-600">{plan.active ? "" : "·"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
