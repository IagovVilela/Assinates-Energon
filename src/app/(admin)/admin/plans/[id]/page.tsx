export const instant = false;

import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PlanForm } from "@/components/admin-forms";
import { prisma } from "@/lib/prisma";
import { syncPlanAction } from "@/server/actions/admin-actions";

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations();
  const plan = await prisma.plan.findUnique({ where: { id }, include: { prices: true } });
  if (!plan) {
    notFound();
  }
  return (
    <div className="flex flex-col gap-4">
      <PlanForm plan={plan} />
      <form action={syncPlanAction}>
        <input type="hidden" name="planId" value={plan.id} />
        <button className="btn-secondary" type="submit">{t("admin.sync")}</button>
      </form>
      <p className="max-w-xl text-sm text-slate-600">{t("admin.syncHint")}</p>
    </div>
  );
}
