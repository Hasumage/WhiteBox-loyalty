"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  Activity,
  ArrowRight,
  BellRing,
  Building2,
  ClipboardCheck,
  Clock3,
  ListChecks,
  RefreshCcw,
  ShieldAlert,
  TriangleAlert,
  Users,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminGetDashboard, type AdminDashboardResponse, type AdminTaskPriority, type AdminTaskRow, type AdminTaskSource } from "@/lib/api/admin-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/shared";
import { cn } from "@/lib/utils";

type DashboardIcon = ComponentType<{ className?: string }>;

const sourceIcons: Record<AdminTaskSource, DashboardIcon> = {
  AUDIT: ShieldAlert,
  COMPANY_VERIFICATION: ClipboardCheck,
  FINANCE: WalletCards,
};

const sourceLabels: Record<AdminTaskSource, TranslationKey> = {
  AUDIT: "admin.dashboard.sourceAudit",
  COMPANY_VERIFICATION: "admin.dashboard.sourceVerification",
  FINANCE: "admin.dashboard.sourceFinance",
};

const priorityLabels: Record<AdminTaskPriority, TranslationKey> = {
  NORMAL: "admin.dashboard.priorityNormal",
  HIGH: "admin.dashboard.priorityHigh",
  CRITICAL: "admin.dashboard.priorityCritical",
};

function dateTime(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function dayLabel(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", { weekday: "short" }).format(new Date(`${value}T12:00:00`));
}

function priorityTone(priority: AdminTaskPriority) {
  if (priority === "CRITICAL") return "border-red-300/25 bg-red-300/10 text-red-100";
  if (priority === "HIGH") return "border-amber-300/25 bg-amber-300/10 text-amber-100";
  return "border-cyan-300/25 bg-cyan-300/10 text-cyan-100";
}

function MetricCard({ icon: Icon, label, value, hint }: { icon: DashboardIcon; label: string; value: number; hint: string }) {
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

function TaskItem({ task, t }: { task: AdminTaskRow; t: (key: TranslationKey) => string }) {
  const Icon = sourceIcons[task.source];
  return (
    <Link
      href={`/admin/tasks/${task.uuid}`}
      className="group grid gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition hover:border-cyan-200/20 hover:bg-white/[0.06] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-cyan-100">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-semibold">{task.title}</p>
          <Badge variant="outline" className={priorityTone(task.priority)}>
            {t(priorityLabels[task.priority])}
          </Badge>
        </div>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {t(sourceLabels[task.source])}
          {task.assignedTo?.name ? ` · ${t("admin.dashboard.assignedTo")} ${task.assignedTo.name}` : ""}
        </p>
      </div>
      <span className="flex items-center gap-2 text-sm text-muted-foreground transition group-hover:text-cyan-100">
        {t("admin.dashboard.openTask")} <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}

export default function AdminPortalPage() {
  const { locale, t } = useI18n("ru");
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const result = await adminGetDashboard();
    if (result.ok) setDashboard(result.data);
    else setError(result.message);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const maxEvents = useMemo(() => Math.max(1, ...(dashboard?.trend.map((entry) => entry.events) ?? [1])), [dashboard]);
  const metrics = dashboard?.metrics;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_12%_10%,rgba(103,232,249,0.17),transparent_32%),radial-gradient(circle_at_90%_90%,rgba(52,211,153,0.12),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.075),rgba(255,255,255,0.025))] p-6 lg:p-8">
        <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <Badge variant="outline" className="border-cyan-200/25 bg-cyan-300/10 px-3 py-1 text-cyan-100">
              <BellRing className="h-3.5 w-3.5" /> {t("admin.dashboard.badge")}
            </Badge>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">{t("admin.dashboard.title")}</h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{t("admin.dashboard.description")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {dashboard?.generatedAt && (
              <p className="text-xs text-muted-foreground">
                {t("admin.dashboard.updated")}: {dateTime(dashboard.generatedAt, locale)}
              </p>
            )}
            <Button variant="secondary" onClick={() => void load()} disabled={loading}>
              <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} /> {t("admin.dashboard.refresh")}
            </Button>
          </div>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-300/25 bg-red-300/10 p-4 text-sm text-red-100">{error}</div>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Users} label={t("admin.dashboard.activeUsers")} value={metrics?.usersActive ?? 0} hint={`${metrics?.usersTotal ?? 0} ${t("admin.dashboard.totalAccounts")}`} />
        <MetricCard icon={Building2} label={t("admin.dashboard.activeCompanies")} value={metrics?.companiesActive ?? 0} hint={`${metrics?.subscriptionsActive ?? 0} ${t("admin.dashboard.activeSubscriptions")}`} />
        <MetricCard icon={ClipboardCheck} label={t("admin.dashboard.pendingVerifications")} value={metrics?.verificationOpen ?? 0} hint={t("admin.dashboard.pendingVerificationsHint")} />
        <MetricCard icon={ListChecks} label={t("admin.dashboard.openTasks")} value={metrics?.openTasks ?? 0} hint={`${metrics?.criticalTasks ?? 0} ${t("admin.dashboard.criticalTasks")}`} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.42fr_0.9fr]">
        <Card className="overflow-hidden border-white/10 bg-card/70">
          <CardHeader className="border-b border-white/10 bg-white/[0.025] px-6 py-5">
            <CardTitle className="flex items-center gap-3 text-lg">
              <ListChecks className="h-5 w-5 text-cyan-100" />
              {t("admin.dashboard.queueTitle")}
            </CardTitle>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("admin.dashboard.queueDescription")}</p>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 text-muted-foreground">{t("admin.common.loading")}</div>
            ) : dashboard?.tasks.length ? (
              dashboard.tasks.map((task) => <TaskItem key={task.uuid} task={task} t={t} />)
            ) : (
              <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/[0.07] p-6">
                <p className="flex items-center gap-2 font-semibold text-emerald-100">
                  <ClipboardCheck className="h-5 w-5" /> {t("admin.dashboard.noTasks")}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{t("admin.dashboard.noTasksHint")}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-white/10 bg-card/70">
            <CardHeader className="px-6 py-5">
              <CardTitle className="flex items-center gap-3 text-lg">
                <Activity className="h-5 w-5 text-cyan-100" />
                {t("admin.dashboard.weeklyTrend")}
              </CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">{t("admin.dashboard.weeklyTrendDescription")}</p>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="flex h-36 items-end gap-2">
                {(dashboard?.trend ?? Array.from({ length: 7 }, (_, index) => ({ date: String(index), events: 0 }))).map((entry) => (
                  <div key={entry.date} className="flex flex-1 flex-col items-center gap-2">
                    <span className="text-xs text-muted-foreground">{entry.events}</span>
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-cyan-500/65 to-emerald-300/80 transition-[height]"
                      style={{ height: `${Math.max(6, (entry.events / maxEvents) * 78)}px` }}
                    />
                    <span className="text-[11px] uppercase text-muted-foreground">{entry.date.includes("-") ? dayLabel(entry.date, locale) : "-"}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-card/70">
            <CardHeader className="px-6 py-5">
              <CardTitle className="flex items-center gap-3 text-lg">
                <TriangleAlert className="h-5 w-5 text-amber-100" />
                {t("admin.dashboard.controlCenter")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-6 pb-6">
              <Link href="/admin/system-health" className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition hover:bg-white/[0.06]">
                <span className="text-sm">{t("admin.dashboard.systemErrors")}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              {dashboard?.permittedSources.includes("FINANCE") && (
                <Link href="/admin/finance" className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition hover:bg-white/[0.06]">
                  <span className="text-sm">{t("admin.dashboard.pendingFinance")}: {metrics?.pendingFinance ?? 0}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              )}
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/15 p-4 text-xs text-muted-foreground">
                <Clock3 className="h-4 w-4 shrink-0 text-cyan-100" />
                {t("admin.dashboard.syncHint")}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
