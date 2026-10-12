import { io } from "next/cache";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { AppShell } from "@/components/shell";
import { requireCustomer } from "@/server/current-user";

export const instant = false;

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="p-8 text-sm">...</p>}>
      <PortalFrame>{children}</PortalFrame>
    </Suspense>
  );
}

async function PortalFrame({ children }: { children: React.ReactNode }) {
  await io();
  await requireCustomer();
  const t = await getTranslations();
  return (
    <AppShell
      title={t("appName")}
      logoutLabel={t("logout")}
      links={[
        { href: "/", label: t("nav.overview") },
        { href: "/subscriptions", label: t("nav.subscriptions") },
        { href: "/invoices", label: t("nav.invoices") },
        { href: "/tickets", label: t("nav.tickets") },
        { href: "/team", label: t("nav.team") },
      ]}
    >
      {children}
    </AppShell>
  );
}
