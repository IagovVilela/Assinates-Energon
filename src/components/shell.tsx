import Link from "next/link";

import { CompanyContacts, CompanyLogo } from "@/components/company-brand";
import { RouteTransition } from "@/components/route-transition";
import { WelcomeMotion } from "@/components/welcome-motion";
import { logoutAction } from "@/server/actions/auth-actions";

export function AppShell({
  title,
  links,
  logoutLabel,
  children,
}: {
  title: string;
  links: { href: string; label: string }[];
  logoutLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="flex flex-col gap-6 bg-slate-900 p-5 text-slate-100">
        <div className="flex items-center gap-3">
          <CompanyLogo size={48} />
          <div>
            <p className="text-sm font-semibold tracking-wide">Energon</p>
            <p className="text-xs text-slate-400">{title}</p>
          </div>
        </div>
        <nav className="flex flex-col gap-2 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              transitionTypes={["nav-forward"]}
              className="rounded px-2 py-1 hover:bg-slate-800"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-4">
          <CompanyContacts dark />
          <form action={logoutAction}>
            <button className="btn-secondary w-full" type="submit">
              {logoutLabel}
            </button>
          </form>
        </div>
      </aside>
      <main className="p-6">
        <WelcomeMotion />
        <RouteTransition>{children}</RouteTransition>
      </main>
    </div>
  );
}
