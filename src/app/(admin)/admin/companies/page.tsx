export const instant = false;

import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";

export default async function CompaniesPage() {
  const t = await getTranslations();
  const companies = await prisma.company.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("admin.companies")}</h1>
        <a className="btn" href="/admin/companies/new">{t("admin.newCompany")}</a>
      </div>
      <ul className="card">
        {companies.map((company) => (
          <li key={company.id}>
            <a className="text-teal-800" href={`/admin/companies/${company.id}`}>{company.name}</a>
            <span className="ml-2 text-sm text-slate-600">{company.country} · {company.gateway} · {company.currency}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
