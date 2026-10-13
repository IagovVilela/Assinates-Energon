export const instant = false;

import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PlanForm, SyncPlanForm } from "@/components/admin-forms";
import { prisma } from "@/lib/prisma";

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
      <SyncPlanForm planId={plan.id} />
      <p className="max-w-xl text-sm text-slate-600">{t("admin.syncHint")}</p>
    </div>
  );
}
