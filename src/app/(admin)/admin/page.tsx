export const instant = false;

import { getTranslations } from "next-intl/server";

import { BarChart, LineChart, StatBars } from "@/components/admin-charts";
import { formatMoney } from "@/lib/money";
import { loadAdminInsights } from "@/server/admin-insights";

export default async function AdminHomePage() {
  const t = await getTranslations();
  const insights = await loadAdminInsights();
  const locale = "pt-BR";
  const mrr = Object.entries(insights.kpis.mrrByCurrency);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("admin.insightsTitle")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">{t("admin.insightsHint")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={t("admin.companies")} value={insights.kpis.companies} />
        <Kpi label={t("admin.clientUsers")} value={insights.kpis.users} />
        <Kpi label={t("admin.activeSubs")} value={insights.kpis.activeSubs} />
        <Kpi label={t("status.PAST_DUE")} value={insights.kpis.pastDue} tone={insights.kpis.pastDue ? "warn" : undefined} />
        <Kpi label={t("admin.openTickets")} value={insights.kpis.openTickets} />
        <Kpi label={t("admin.failedWebhooks")} value={insights.kpis.failedWebhooks} tone={insights.kpis.failedWebhooks ? "warn" : undefined} />
        <Kpi label={t("admin.logins24h")} value={insights.kpis.logins24h} />
        <Kpi label={t("admin.paid14d")} value={formatMoney(insights.kpis.paidBrl14d, "BRL", locale)} />
      </div>

      <section className="card">
        <h2 className="mb-2 font-semibold">{t("admin.mrr")}</h2>
        {mrr.length === 0 ? (
          <p className="text-sm text-slate-600">{t("empty")}</p>
        ) : (
          <div className="flex flex-wrap gap-6">
            {mrr.map(([currency, amount]) => (
              <p key={currency} className="text-2xl font-semibold">
                {formatMoney(amount, currency, locale)}
                <span className="ml-2 text-sm font-normal text-slate-600">{currency}</span>
              </p>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="card">
          <h2 className="mb-2 font-semibold">{t("admin.chartCompanies")}</h2>
          <BarChart points={insights.series.companies} />
        </article>
        <article className="card">
          <h2 className="mb-2 font-semibold">{t("admin.chartTickets")}</h2>
          <LineChart points={insights.series.tickets} />
        </article>
        <article className="card lg:col-span-2">
          <h2 className="mb-2 font-semibold">{t("admin.chartRevenue")}</h2>
          <LineChart
            points={insights.series.revenueBrl}
            format={(value) => formatMoney(value, "BRL", locale)}
          />
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="card">
          <h2 className="mb-3 font-semibold">{t("admin.byStatus")}</h2>
          <StatBars
            slices={insights.breakdowns.subscriptions.map((slice) => ({
              label: t(`status.${slice.label}`),
              value: slice.value,
            }))}
          />
        </article>
        <article className="card">
          <h2 className="mb-3 font-semibold">{t("admin.byGateway")}</h2>
          <StatBars slices={insights.breakdowns.gateways} />
        </article>
        <article className="card">
          <h2 className="mb-3 font-semibold">{t("admin.byCountry")}</h2>
          <StatBars slices={insights.breakdowns.countries} />
        </article>
        <article className="card">
          <h2 className="mb-3 font-semibold">{t("admin.topPlans")}</h2>
          <StatBars slices={insights.breakdowns.plans} />
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="card">
          <h2 className="mb-3 font-semibold">{t("admin.webhooks24h")}</h2>
          <p className="mb-3 text-sm text-slate-600">
            {t("admin.eventsCount", { count: insights.telemetry.webhooks.total })}
          </p>
          <StatBars
            slices={Object.entries(insights.telemetry.webhooks.byStatus).map(([label, value]) => ({ label, value }))}
          />
        </article>
        <article className="card">
          <h2 className="mb-3 font-semibold">{t("admin.logins")}</h2>
          <StatBars
            slices={[
              { label: t("admin.loginOk"), value: insights.telemetry.logins.success },
              { label: t("admin.loginFail"), value: insights.telemetry.logins.failed },
            ]}
          />
        </article>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number | string; tone?: "warn" }) {
  return (
    <article className="card">
      <p className="text-sm text-slate-600">{label}</p>
      <p className={`text-2xl font-semibold ${tone === "warn" ? "text-red-700" : ""}`}>{value}</p>
    </article>
  );
}
