"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Handshake,
  Landmark,
  Megaphone,
  Rocket,
  Target,
  TrendingUp,
} from "lucide-react";
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

  return (
    <Card className="overflow-hidden border-cyan-300/15 bg-[radial-gradient(circle_at_10%_10%,rgba(103,232,249,0.12),transparent_32%),linear-gradient(135deg,rgba(8,47,73,0.42),rgba(255,255,255,0.035))]">
      <CardHeader className="border-b border-cyan-200/10 px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Badge variant="outline" className="border-cyan-200/25 bg-cyan-300/10 px-3 py-1 text-cyan-100">
              <Megaphone className="h-3.5 w-3.5" /> PR
            </Badge>
            <CardTitle className="mt-3 text-2xl">
              {locale === "ru" ? "PR-кабинет привлечения компаний" : "Company acquisition PR desk"}
            </CardTitle>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {locale === "ru"
                ? "Компании, закреплённые за PR-менеджером, стадия воронки и выплата из доли WhiteBox."
                : "Companies assigned to PR, funnel stage and payout paid from the WhiteBox share."}
            </p>
          </div>
          <Badge variant="secondary" className="w-fit">
            {dashboard.scope === "ALL"
              ? locale === "ru"
                ? "Общий обзор"
                : "All referrals"
              : locale === "ru"
                ? "Мои компании"
                : "My companies"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <PrMetricCard
            icon={Building2}
            label={locale === "ru" ? "Компании" : "Companies"}
            value={dashboard.totals.companies}
            hint={`${dashboard.totals.activeCompanies} ${locale === "ru" ? "активных партнёров" : "active partners"}`}
          />
          <PrMetricCard
            icon={Handshake}
            label={locale === "ru" ? "PR-выплата" : "PR payout"}
            value={money(dashboard.totals.referralCommission, locale)}
            hint={locale === "ru" ? "от оборота, из доли WhiteBox" : "from turnover, paid from WhiteBox share"}
          />
          <PrMetricCard
            icon={Landmark}
            label={locale === "ru" ? "WhiteBox после PR" : "WhiteBox after PR"}
            value={money(dashboard.totals.whiteBoxNetCommission, locale)}
            hint={locale === "ru" ? "чистая комиссия платформы" : "net platform commission"}
          />
          <PrMetricCard
            icon={TrendingUp}
            label={locale === "ru" ? "Оборот" : "Turnover"}
            value={money(dashboard.totals.recognizedGross, locale)}
            hint={`${money(dashboard.totals.futureGross, locale)} ${locale === "ru" ? "будущий оборот" : "future turnover"}`}
          />
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
          <div className="mb-4 flex items-center gap-2 font-semibold">
            <Target className="h-5 w-5 text-cyan-100" />
            {locale === "ru" ? "Воронка привлечения" : "Acquisition funnel"}
          </div>
          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            {activePipeline.map(([status, count]) => (
              <div key={status} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{pipelineLabel(status, locale)}</p>
                <p className="mt-2 text-2xl font-semibold">{count}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          {dashboard.companies.length ? (
            dashboard.companies.map((company) => (
              <div key={company.uuid} className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">{company.companyName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {company.referrer.name} · {company.referralPercent}% {locale === "ru" ? "от оборота, из доли WhiteBox" : "of turnover, paid from WhiteBox share"}
                    </p>
                  </div>
                  <Badge variant={company.pipelineStatus === "REVENUE_ACTIVE" ? "default" : "secondary"}>
                    {pipelineLabel(company.pipelineStatus, locale)}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">PR</p>
                    <p className="mt-1 font-semibold">{money(company.referralCommission, locale)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">WhiteBox</p>
                    <p className="mt-1 font-semibold">{money(company.whiteBoxNetCommission, locale)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      {locale === "ru" ? "Подписки" : "Subs"}
                    </p>
                    <p className="mt-1 font-semibold">{company.activeSubscriptions}</p>
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
            <p className="text-lg font-semibold">{locale === "ru" ? "PR-кабинет вынесен отдельно" : "PR desk moved to a separate page"}</p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              {locale === "ru"
                ? "На дашборде оставлены быстрые цифры, а детальная воронка, выплаты и закреплённые компании перенесены в отдельный рабочий экран."
                : "The dashboard keeps only quick numbers; the funnel, payouts and assigned companies now live on a dedicated workspace."}
            </p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[460px]">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{locale === "ru" ? "Компании" : "Companies"}</p>
            <p className="mt-1 text-2xl font-semibold">{dashboard.totals.companies}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">PR</p>
            <p className="mt-1 text-2xl font-semibold">{money(dashboard.totals.referralCommission, locale)}</p>
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
