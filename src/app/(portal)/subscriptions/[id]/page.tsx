export const instant = false;

import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { CancelForm, ChangePlanForm } from "@/components/portal-forms";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/server/current-user";
import { can } from "@/server/permissions";

export default async function SubscriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCustomer();
  const { id } = await params;
  const t = await getTranslations();
  const status = await getTranslations("status");
  const subscription = await prisma.subscription.findFirst({
    where: { id, companyId: user.companyId },
    include: { plan: true, pendingPlan: true },
  });
  if (!subscription) {
    notFound();
  }
  const plans = await prisma.plan.findMany({
    where: {
      active: true,
      type: "RECURRING",
      id: { not: subscription.planId },
      prices: { some: { currency: user.company.currency } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">{subscription.plan.name}</h1>
      <p><span className="badge">{status(subscription.status)}</span></p>
      {subscription.checkoutUrl && subscription.status === "INCOMPLETE" ? (
        <a className="btn w-fit" href={subscription.checkoutUrl}>{t("subscriptions.checkout")}</a>
      ) : null}
      {subscription.pendingPlan ? (
        <p className="text-sm">{t("subscriptions.pending")}: {subscription.pendingPlan.name}</p>
      ) : null}
      {can(user, "subscription.change") && plans.length > 0 && subscription.externalId ? (
        <ChangePlanForm subscriptionId={subscription.id} plans={plans} />
      ) : null}
      {can(user, "subscription.cancel") && subscription.externalId && subscription.status !== "CANCELED" ? (
        <CancelForm subscriptionId={subscription.id} gateway={subscription.gateway} />
      ) : null}
    </div>
  );
}
