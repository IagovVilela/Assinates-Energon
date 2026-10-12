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
        <p className="text-sm font-semibold tracking-wide">{title}</p>
        <nav className="flex flex-col gap-2 text-sm">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="rounded px-2 py-1 hover:bg-slate-800">
              {link.label}
            </a>
          ))}
        </nav>
        <form action={logoutAction} className="mt-auto">
          <button className="btn-secondary w-full" type="submit">
            {logoutLabel}
          </button>
        </form>
      </aside>
      <main className="p-6">{children}</main>
    </div>
  );
}
