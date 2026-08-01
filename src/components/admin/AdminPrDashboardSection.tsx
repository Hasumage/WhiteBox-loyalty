"use client";

import Link from "next/link";
import { ArrowRight, Banknote, Building2, CalendarDays, Megaphone, Rocket, Target, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminDashboardResponse } from "@/lib/api/admin-client";
import type { Locale } from "@/lib/i18n/shared";

type PrDashboardData = NonNullable<AdminDashboardResponse["pr"]>;
type PrPipelineStatus = keyof PrDashboardData["pipeline"];

const pipelineMeta: Record<string, { ru: string; en: string }> = {
  LEAD: { ru: "Лид", en: "Lead" },
  NEGOTIATION: { ru: "Переговоры", en: "Negotiation" },
  TRIAL: { ru: "Тест", en: "Trial" },
  CONNECTED: { ru: "Подключена", en: "Connected" },
  REVENUE_ACTIVE: { ru: "Приносит доход", en: "Revenue active" },
  LOST: { ru: "Потеряна", en: "Lost" },
};

function money(value: number | undefined, locale: Locale) {
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function pipelineLabel(status: string, locale: Locale) {
  return pipelineMeta[status]?.[locale] ?? status;
}

function PrMetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Building2;
  label: string;
  value: number | string;
  hint: string;
}) {
  return (
    <Card className="overflow-hidden border-white/10 bg-white/[0.045]">
      <CardContent className="relative flex min-h-32 items-start justify-between gap-4 p-5">
        <div className="absolute -right-12 -top-12 h-28 w-28 rounded-full bg-cyan-300/[0.08] blur-3xl" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight">{value}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{hint}</p>
        </div>
        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/15 bg-cyan-300/[0.08] text-cyan-100">
          <Icon className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  );
}

export function AdminPrDashboardSection({ dashboard, locale }: { dashboard: PrDashboardData; locale: Locale }) {
  const pipelineEntries = Object.entries(dashboard.pipeline) as Array<[PrPipelineStatus, number]>;
  const activePipeline = pipelineEntries.filter(([status]) => status !== "LOST");
  const monthLabel = dashboard.month?.key ?? dashboard.monthly.period.key;
  const closingMonth = dashboard.monthlyClose?.agents?.length ? dashboard.monthlyClose : null;
  const agentRows = closingMonth?.agents ?? dashboard.monthly.agents ?? [];
  const agentPeriodLabel = closingMonth?.period.key ?? monthLabel;

  return (
    <Card className="overflow-hidden border-cyan-300/15 bg-[radial-gradient(circle_at_10%_10%,rgba(103,232,249,0.12),transparent_32%),linear-gradient(135deg,rgba(8,47,73,0.42),rgba(255,255,255,0.035))]">
      <CardHeader className="border-b border-cyan-200/10 px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Badge variant="outline" className="border-cyan-200/25 bg-cyan-300/10 px-3 py-1 text-cyan-100">
              <Megaphone className="h-3.5 w-3.5" /> PR · {monthLabel}
            </Badge>
            <CardTitle className="mt-3 text-2xl">
              {dashboard.scope === "ALL"
                ? locale === "ru" ? "Общий PR-дашборд" : "Global PR dashboard"
                : locale === "ru" ? "Мой PR-кабинет" : "My PR workspace"}
            </CardTitle>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {dashboard.scope === "ALL"
                ? locale === "ru"
                  ? "Сводка по всем PR-агентам: компании, оплаты NearLoy и начисления за месяц."
                  : "A monthly overview of all PR agents, companies, NearLoy payments and earnings."
                : locale === "ru"
                  ? "Ваши компании, оплаты NearLoy и начисления за текущий месяц."
                  : "Your companies, NearLoy payments and earnings for the current month."}
            </p>
          </div>
          <Button asChild variant="secondary" className="rounded-2xl">
            <Link href="/admin/pr/companies">
              {locale === "ru" ? "Компании" : "Companies"} <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <PrMetricCard
            icon={Users}
            label={locale === "ru" ? "PR-агенты" : "PR agents"}
            value={dashboard.monthly.totals.agents}
            hint={locale === "ru" ? "Агенты с PR-доступом" : "Agents with PR access"}
          />
          <PrMetricCard
            icon={Building2}
            label={locale === "ru" ? "Компании" : "Companies"}
            value={dashboard.monthly.totals.companies}
            hint={locale === "ru" ? `${dashboard.monthly.totals.activeCompanies} активных` : `${dashboard.monthly.totals.activeCompanies} active`}
          />
          <PrMetricCard
            icon={Banknote}
            label={locale === "ru" ? "Заработали за месяц" : "Earned this month"}
            value={money(dashboard.monthly.totals.monthlyReferralCommission, locale)}
            hint={locale === "ru" ? "30% от оплаченного NearLoy" : "30% of paid NearLoy invoices"}
          />
          <PrMetricCard
            icon={CalendarDays}
            label={locale === "ru" ? "К закрытию" : "To close"}
            value={money(dashboard.monthly.totals.availableToClose, locale)}
            hint={locale === "ru" ? "Ещё не перенесено в операции" : "Not yet moved to finance operations"}
          />
        </div>

        {dashboard.scope === "ALL" && (
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/20">
            <div className="border-b border-white/10 p-4">
              <p className="text-lg font-semibold">
                {locale === "ru" ? `PR-агенты за ${agentPeriodLabel}` : `PR agents for ${agentPeriodLabel}`}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {closingMonth
                  ? locale === "ru"
                    ? "Эти строки совпадают с суммой к закрытию месяца."
                    : "These rows match the month-close amount."
                  : locale === "ru"
                    ? "Компании и начисления по каждому агенту."
                    : "Companies and earnings by agent."}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-white/[0.035] text-left text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">{locale === "ru" ? "Агент" : "Agent"}</th>
                    <th className="px-4 py-3">{locale === "ru" ? "Компании" : "Companies"}</th>
                    <th className="px-4 py-3">{locale === "ru" ? "Оплаты NearLoy" : "NearLoy paid"}</th>
                    <th className="px-4 py-3">{locale === "ru" ? "Начислено" : "Earned"}</th>
                    <th className="px-4 py-3">{locale === "ru" ? "К закрытию" : "To close"}</th>
                  </tr>
                </thead>
                <tbody>
                  {agentRows.length ? (
                    agentRows.map((agent) => (
                      <tr key={agent.userId} className="border-t border-white/10">
                        <td className="px-4 py-4">
                          <p className="font-semibold">{agent.name}</p>
                          <p className="text-xs text-muted-foreground">{agent.email}</p>
                        </td>
                        <td className="px-4 py-4">
                          {agent.companies}
                          <span className="ml-2 text-xs text-muted-foreground">
                            / {agent.activeCompanies} {locale === "ru" ? "активных" : "active"}
                          </span>
                        </td>
                        <td className="px-4 py-4">{money(agent.monthlyGross, locale)}</td>
                        <td className="px-4 py-4 font-semibold text-cyan-100">{money(agent.monthlyReferralCommission, locale)}</td>
                        <td className="px-4 py-4 font-semibold text-amber-100">{money(agent.availableToClose, locale)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-6 text-muted-foreground" colSpan={5}>
                        {locale === "ru" ? "PR-агентов с начислениями за месяц пока нет." : "No PR agents with monthly earnings yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-200/15 bg-cyan-300/[0.08] text-cyan-100">
                <Target className="h-5 w-5" />
              </span>
              <div>
                <p className="text-lg font-semibold">{locale === "ru" ? "Воронка компаний" : "Company funnel"}</p>
                <p className="text-sm text-muted-foreground">{locale === "ru" ? "Текущий статус всех закреплений." : "Current status of assigned companies."}</p>
              </div>
            </div>
            <div className="space-y-3">
              {activePipeline.map(([status, count]) => (
                <div key={status} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{pipelineLabel(status, locale)}</span>
                    <span className="text-xl font-semibold">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">{locale === "ru" ? "Последние компании" : "Recent companies"}</p>
                <p className="text-sm text-muted-foreground">
                  {locale === "ru" ? "Оплаты и PR-начисления за выбранный месяц." : "Payments and PR earnings for the selected month."}
                </p>
              </div>
              <Button asChild variant="outline" className="rounded-2xl">
                <Link href="/admin/pr/companies">
                  {locale === "ru" ? "Все" : "All"} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="grid gap-3">
              {dashboard.companies.length ? (
                dashboard.companies.map((company) => (
                  <div key={company.uuid} className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold">{company.companyName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {company.referrer.name} · {locale === "ru" ? "30% от оплаты NearLoy" : "30% of NearLoy payment"}
                        </p>
                      </div>
                      <Badge variant={company.pipelineStatus === "REVENUE_ACTIVE" ? "default" : "secondary"}>
                        {pipelineLabel(company.pipelineStatus, locale)}
                      </Badge>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">PR</p>
                        <p className="mt-1 font-semibold">{money(company.referralCommission, locale)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          {locale === "ru" ? "Стадия" : "Stage"}
                        </p>
                        <p className="mt-1 font-semibold">{pipelineLabel(company.pipelineStatus, locale)}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.025] p-6 text-sm text-muted-foreground">
                  <Rocket className="mb-3 h-5 w-5 text-cyan-100" />
                  {locale === "ru" ? "Пока нет закреплённых компаний." : "No assigned companies yet."}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminPrCompactCard({ dashboard, locale }: { dashboard: PrDashboardData; locale: Locale }) {
  return (
    <Card className="overflow-hidden border-cyan-300/15 bg-[radial-gradient(circle_at_12%_0%,rgba(103,232,249,0.12),transparent_32%),rgba(255,255,255,0.035)]">
      <CardContent className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-100">
            <Megaphone className="h-5 w-5" />
          </span>
          <div>
            <p className="text-lg font-semibold">{locale === "ru" ? "PR-кабинет" : "PR desk"}</p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              {locale === "ru"
                ? `За ${dashboard.month.key}: ${dashboard.monthly.totals.agents} агентов, ${dashboard.monthly.totals.companies} компаний, ${money(dashboard.monthly.totals.monthlyReferralCommission, locale)} начислено.`
                : `${dashboard.month.key}: ${dashboard.monthly.totals.agents} agents, ${dashboard.monthly.totals.companies} companies, ${money(dashboard.monthly.totals.monthlyReferralCommission, locale)} earned.`}
            </p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[460px]">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{locale === "ru" ? "Компании" : "Companies"}</p>
            <p className="mt-1 text-2xl font-semibold">{dashboard.monthly.totals.companies}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">PR</p>
            <p className="mt-1 text-2xl font-semibold">{money(dashboard.monthly.totals.monthlyReferralCommission, locale)}</p>
          </div>
          <Button asChild className="h-full min-h-16 rounded-2xl">
            <Link href="/admin/pr">
              {locale === "ru" ? "Открыть PR-кабинет" : "Open PR desk"} <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
