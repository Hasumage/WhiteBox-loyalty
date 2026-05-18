"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  CircleDollarSign,
  Crown,
  Gauge,
  Layers3,
  Repeat2,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  adminFindSubscriptionByUuid,
  adminSubscriptionStats,
  type AdminSubscriptionStats,
} from "@/lib/api/admin-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import { cn } from "@/lib/utils";

type ForecastScenario = "base" | "optimistic" | "risk";
type SlaState = "on_track" | "at_risk" | "off_track";

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function formatRevenue(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string | undefined, locale: string, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function slaBadgeClass(sla: SlaState) {
  if (sla === "on_track") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
  if (sla === "at_risk") return "bg-amber-500/15 text-amber-200 border-amber-500/40";
  return "bg-rose-500/15 text-rose-200 border-rose-500/40";
}

export default function AdminSubscriptionsPage() {
  const { locale, t } = useI18n("ru");
  const [stats, setStats] = useState<AdminSubscriptionStats | null>(null);
  const [uuid, setUuid] = useState("");
  const [result, setResult] = useState<{
    uuid: string;
    name: string;
    slug: string;
    description: string;
  } | null>(null);
  const [scenario, setScenario] = useState<ForecastScenario>("base");

  useEffect(() => {
    void (async () => setStats(await adminSubscriptionStats()))();
  }, []);

  async function onFind() {
    setResult(await adminFindSubscriptionByUuid(uuid));
  }

  const selectedForecast = useMemo(() => {
    if (!stats) {
      return { days30: 0, days90: 0 };
    }
    return stats.forecast[scenario];
  }, [scenario, stats]);

  const kpiCards = [
    {
      label: t("admin.subscriptions.totalSubscriptions"),
      value: formatNumber(stats?.total ?? 0, locale),
      hint: t("admin.subscriptions.totalHint"),
      icon: Layers3,
      accent: "from-sky-500/20 to-cyan-500/10",
    },
    {
      label: t("admin.subscriptions.activeNow"),
      value: formatNumber(stats?.active ?? 0, locale),
      hint: `${stats?.activeRatePercent ?? 0}${t("admin.subscriptions.ofTotal")}`,
      icon: Activity,
      accent: "from-emerald-500/20 to-lime-500/10",
    },
    {
      label: t("admin.subscriptions.monthlyRevenue"),
      value: formatRevenue(stats?.estimatedMonthlyRevenue ?? 0, locale),
      hint: t("admin.subscriptions.monthlyRevenueHint"),
      icon: CircleDollarSign,
      accent: "from-amber-500/20 to-orange-500/10",
    },
    {
      label: t("admin.subscriptions.avgRevenue"),
      value: formatRevenue(stats?.averageMonthlyRevenuePerActive ?? 0, locale),
      hint: t("admin.subscriptions.avgRevenueHint"),
      icon: TrendingUp,
      accent: "from-violet-500/20 to-fuchsia-500/10",
    },
  ] as const;

  return (
    <div className="space-y-5">
      <Card className="glass border-white/10 overflow-hidden">
        <CardContent className="relative p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.2),transparent_40%),radial-gradient(circle_at_85%_30%,rgba(16,185,129,0.16),transparent_35%)]" />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-muted-foreground">
                <Gauge className="h-3.5 w-3.5" />
                {t("admin.subscriptions.badge")}
              </p>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                {t("admin.subscriptions.title")}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("admin.subscriptions.description")}
              </p>
            </div>
            <Badge variant="outline" className="w-fit border-white/20 bg-white/5 text-xs">
              {t("admin.common.updated")}: {formatDateTime(stats?.generatedAt, locale, t("admin.common.notAvailable"))}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((item) => (
          <Card key={item.label} className="glass border-white/10 overflow-hidden">
            <CardContent className="relative py-5">
              <div className={cn("absolute inset-0 bg-gradient-to-br opacity-90", item.accent)} />
              <div className="relative">
                <div className="mb-3 inline-flex rounded-lg border border-white/20 bg-black/20 p-2">
                  <item.icon className="h-4 w-4 text-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-2xl font-semibold">{item.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <Card className="glass border-white/10 xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-primary" />
              {t("admin.subscriptions.kpiSla")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{t("admin.subscriptions.autoRenewRate")}</p>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[11px] border",
                    slaBadgeClass(stats?.kpi?.sla?.autoRenew ?? "off_track"),
                  )}
                >
                  {(stats?.kpi?.sla?.autoRenew ?? t("admin.common.notAvailable")).replace("_", " ")}
                </Badge>
              </div>
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {t("admin.subscriptions.actual")}: {stats?.kpi?.actual?.autoRenewRatePercent ?? 0}% / {t("admin.subscriptions.target")}:{" "}
                  {stats?.kpi?.targets?.autoRenewRatePercent ?? 0}%
                </span>
                <span>{stats?.kpi?.attainment?.autoRenewPercent ?? 0}% {t("admin.subscriptions.attainment")}</span>
              </div>
              <Progress
                value={Math.min(100, stats?.kpi?.attainment?.autoRenewPercent ?? 0)}
                className="h-2.5 bg-sky-500/20 [&>div]:bg-sky-400"
              />
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{t("admin.subscriptions.churnRate")}</p>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[11px] border",
                    slaBadgeClass(stats?.kpi?.sla?.churn ?? "off_track"),
                  )}
                >
                  {(stats?.kpi?.sla?.churn ?? t("admin.common.notAvailable")).replace("_", " ")}
                </Badge>
              </div>
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {t("admin.subscriptions.actual")}: {stats?.kpi?.actual?.churnRatePercent ?? 0}% / {t("admin.subscriptions.targetMax")}:{" "}
                  {stats?.kpi?.targets?.churnRatePercent ?? 0}%
                </span>
                <span>{stats?.kpi?.attainment?.churnPercent ?? 0}% {t("admin.subscriptions.attainment")}</span>
              </div>
              <Progress
                value={Math.min(100, stats?.kpi?.attainment?.churnPercent ?? 0)}
                className="h-2.5 bg-emerald-500/20 [&>div]:bg-emerald-400"
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-3 text-sm">
              <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                <p className="text-xs text-muted-foreground">{t("admin.subscriptions.autoRenewEnabled")}</p>
                <p className="mt-1 font-semibold">{formatNumber(stats?.autoRenewEnabled ?? 0, locale)}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                <p className="text-xs text-muted-foreground">{t("admin.subscriptions.expiring7")}</p>
                <p className="mt-1 font-semibold">{formatNumber(stats?.expiringIn7Days ?? 0, locale)}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                <p className="text-xs text-muted-foreground">{t("admin.subscriptions.churned30")}</p>
                <p className="mt-1 font-semibold">{formatNumber(stats?.churnedIn30Days ?? 0, locale)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4 text-primary" />
              {t("admin.subscriptions.concentrationRisk")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-black/25 p-3">
              <p className="text-xs text-muted-foreground">{t("admin.subscriptions.diversificationScore")}</p>
              <p className="mt-1 text-2xl font-semibold">{stats?.concentration?.score ?? 0}</p>
              <Progress
                value={stats?.concentration?.score ?? 0}
                className="mt-2 h-2.5 bg-violet-500/20 [&>div]:bg-violet-400"
              />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("admin.subscriptions.top3Share")}</span>
                <span className="font-semibold">
                  {stats?.concentration?.top3SubscriberSharePercent ?? 0}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("admin.subscriptions.top1RevenueShare")}</span>
                <span className="font-semibold">
                  {stats?.concentration?.top1RevenueSharePercent ?? 0}%
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("admin.subscriptions.riskHint")}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <Card className="glass border-white/10 xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              {t("admin.subscriptions.forecast")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: "base", label: t("admin.subscriptions.base"), icon: Gauge },
                  { key: "optimistic", label: t("admin.subscriptions.optimistic"), icon: ArrowUpRight },
                  { key: "risk", label: t("admin.subscriptions.risk"), icon: AlertTriangle },
                ] as const
              ).map((option) => (
                <Button
                  key={option.key}
                  type="button"
                  size="sm"
                  variant={scenario === option.key ? "default" : "outline"}
                  className={cn(
                    "gap-1.5",
                    scenario === option.key ? "" : "border-white/20 bg-white/5"
                  )}
                  onClick={() => setScenario(option.key)}
                >
                  <option.icon className="h-3.5 w-3.5" />
                  {option.label}
                </Button>
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs text-muted-foreground">{t("admin.subscriptions.projected30")}</p>
                <p className="mt-1 text-2xl font-semibold">{formatRevenue(selectedForecast.days30, locale)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs text-muted-foreground">{t("admin.subscriptions.projected90")}</p>
                <p className="mt-1 text-2xl font-semibold">{formatRevenue(selectedForecast.days90, locale)}</p>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-muted-foreground">
              {t("admin.subscriptions.assumptions")}: {t("admin.subscriptions.growthSignal")} {stats?.forecast?.assumptions?.startedGrowthPercent ?? 0}
              %, {t("admin.subscriptions.churn")} {stats?.forecast?.assumptions?.churnRatePercent ?? 0}%.
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-primary" />
              {t("admin.subscriptions.growthPulse")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-muted-foreground">{t("admin.subscriptions.started30")}</p>
              <p className="mt-1 text-xl font-semibold">{formatNumber(stats?.startedIn30Days ?? 0, locale)}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-muted-foreground">{t("admin.subscriptions.previousPeriod")}</p>
              <p className="mt-1 text-xl font-semibold">
                {formatNumber(stats?.startedInPrevious30Days ?? 0, locale)}
              </p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3">
              <span className="text-muted-foreground">{t("admin.subscriptions.growthDelta")}</span>
              <span
                className={cn(
                  "font-semibold",
                  (stats?.startedGrowthPercent ?? 0) >= 0 ? "text-emerald-300" : "text-rose-300"
                )}
              >
                {(stats?.startedGrowthPercent ?? 0) >= 0 ? "+" : ""}
                {stats?.startedGrowthPercent ?? 0}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass border-white/10">
        <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className="h-4 w-4 text-primary" />
              {t("admin.subscriptions.topActive")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.topSubscriptions?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 pr-3">{t("admin.subscriptions.plan")}</th>
                    <th className="pb-2 pr-3">{t("admin.common.company")}</th>
                    <th className="pb-2 pr-3">{t("admin.subscriptions.slug")}</th>
                    <th className="pb-2 pr-3 text-right">{t("admin.subscriptions.activeSubscribers")}</th>
                    <th className="pb-2 text-right">{t("admin.subscriptions.monthlyRevenue")}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topSubscriptions.map((row, index) => (
                    <tr key={row.uuid} className="border-t border-white/10 hover:bg-white/5 transition-colors">
                      <td className="py-2 pr-3">
                        <div className="inline-flex items-center gap-2 font-medium">
                          {index === 0 && <BadgeCheck className="h-4 w-4 text-emerald-300" />}
                          {row.name}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {row.companyName ?? t("admin.subscriptions.globalCatalog")}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">
                        {row.slug}
                      </td>
                      <td className="py-2 pr-3 text-right">{formatNumber(row.activeSubscribers, locale)}</td>
                      <td className="py-2 text-right">{formatRevenue(row.estimatedMonthlyRevenue, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("admin.subscriptions.noActive")}</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card className="glass border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              {t("admin.subscriptions.catalogSnapshot")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 text-sm">
            <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
              <p className="text-xs text-muted-foreground">{t("admin.subscriptions.totalPlans")}</p>
              <p className="mt-1 font-semibold">{formatNumber(stats?.catalog?.totalPlans ?? 0, locale)}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
              <p className="text-xs text-muted-foreground">{t("admin.subscriptions.activePlans")}</p>
              <p className="mt-1 font-semibold">{formatNumber(stats?.catalog?.activePlans ?? 0, locale)}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
              <p className="text-xs text-muted-foreground">{t("admin.subscriptions.companyLinked")}</p>
              <p className="mt-1 font-semibold">
                {formatNumber(stats?.catalog?.companyLinkedPlans ?? 0, locale)}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
              <p className="text-xs text-muted-foreground">{t("admin.subscriptions.categoryLinked")}</p>
              <p className="mt-1 font-semibold">
                {formatNumber(stats?.catalog?.categoryLinkedPlans ?? 0, locale)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-primary" />
              {t("admin.subscriptions.findByUuid")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder={t("admin.subscriptions.uuidPlaceholder")}
                value={uuid}
                onChange={(e) => setUuid(e.target.value)}
              />
              <Button variant="secondary" onClick={onFind} className="sm:min-w-24">
                <Repeat2 className="mr-1 h-4 w-4" />
                {t("admin.common.find")}
              </Button>
            </div>
            {result && (
              <div className="rounded-lg border border-white/10 bg-muted/10 p-3 text-sm">
                <p className="font-semibold">{result.name}</p>
                <p className="text-muted-foreground">{t("admin.subscriptions.slug")}: {result.slug}</p>
                <p className="font-mono text-xs">{result.uuid}</p>
                <p className="mt-1 text-muted-foreground">{result.description}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
