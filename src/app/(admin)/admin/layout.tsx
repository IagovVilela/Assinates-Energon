import { io } from "next/cache";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { AppShell } from "@/components/shell";
import { requireAdmin } from "@/server/current-user";

export const instant = false;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="p-8 text-sm">...</p>}>
      <AdminFrame>{children}</AdminFrame>
    </Suspense>
  );
}

async function AdminFrame({ children }: { children: React.ReactNode }) {
  await io();
  await requireAdmin();
  const t = await getTranslations();
  return (
    <AppShell
      title={t("nav.admin")}
      logoutLabel={t("logout")}
      links={[
        { href: "/admin", label: t("nav.insights") },
        { href: "/admin/companies", label: t("nav.companies") },
        { href: "/admin/plans", label: t("nav.plans") },
        { href: "/admin/tickets", label: t("nav.tickets") },
        { href: "/admin/audit", label: t("nav.audit") },
      ]}
    >
      {children}
    </AppShell>
  );
}
