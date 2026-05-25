"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentType } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  PlayCircle,
  RefreshCcw,
  ShieldAlert,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminGetTask, adminUpdateTask, type AdminTaskPriority, type AdminTaskRow, type AdminTaskSource } from "@/lib/api/admin-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/shared";
import { cn } from "@/lib/utils";

const sourceIcons: Record<AdminTaskSource, ComponentType<{ className?: string }>> = {
  AUDIT: ShieldAlert,
  COMPANY_VERIFICATION: ClipboardCheck,
  FINANCE: WalletCards,
};

const sourceLabels: Record<AdminTaskSource, TranslationKey> = {
  AUDIT: "admin.dashboard.sourceAudit",
  COMPANY_VERIFICATION: "admin.dashboard.sourceVerification",
  FINANCE: "admin.dashboard.sourceFinance",
};

const statusLabels: Record<AdminTaskRow["status"], TranslationKey> = {
  OPEN: "admin.task.statusOpen",
  IN_PROGRESS: "admin.task.statusInProgress",
  RESOLVED: "admin.task.statusResolved",
  DISMISSED: "admin.task.statusDismissed",
};

const priorityLabels: Record<AdminTaskPriority, TranslationKey> = {
  NORMAL: "admin.dashboard.priorityNormal",
  HIGH: "admin.dashboard.priorityHigh",
  CRITICAL: "admin.dashboard.priorityCritical",
};

function formatDate(value: string | null, locale: Locale) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

function priorityTone(priority: AdminTaskPriority) {
  if (priority === "CRITICAL") return "border-red-300/25 bg-red-300/10 text-red-100";
  if (priority === "HIGH") return "border-amber-300/25 bg-amber-300/10 text-amber-100";
  return "border-cyan-300/25 bg-cyan-300/10 text-cyan-100";
}

export default function AdminTaskDetailPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const { locale, t } = useI18n("ru");
  const [task, setTask] = useState<AdminTaskRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const result = await adminGetTask(uuid);
    if (result.ok) setTask(result.data);
    else setError(result.message);
    setLoading(false);
  }

  async function update(action: "start" | "resolve" | "reopen") {
    setWorking(true);
    setError("");
    const result = await adminUpdateTask(uuid, action);
    if (result.ok) setTask(result.data);
    else setError(result.message);
    setWorking(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid]);

  if (loading) {
    return <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-8 text-muted-foreground">{t("admin.common.loading")}</div>;
  }

  if (!task) {
    return <div className="rounded-3xl border border-red-300/20 bg-red-300/10 p-6 text-red-100">{error || t("admin.task.notFound")}</div>;
  }

  const Icon = sourceIcons[task.source];
  const active = task.status === "OPEN" || task.status === "IN_PROGRESS";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="secondary">
          <Link href="/admin"><ArrowLeft className="h-4 w-4" /> {t("admin.task.back")}</Link>
        </Button>
        <Button variant="ghost" onClick={() => void load()} disabled={loading || working}>
          <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} /> {t("admin.dashboard.refresh")}
        </Button>
      </div>

      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.14),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.065),rgba(255,255,255,0.02))] p-6 lg:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-cyan-200/25 bg-cyan-300/10 text-cyan-100">
                <Icon className="h-3.5 w-3.5" /> {t(sourceLabels[task.source])}
              </Badge>
              <Badge variant="outline" className={priorityTone(task.priority)}>{t(priorityLabels[task.priority])}</Badge>
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{task.title}</h1>
            <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-6 text-muted-foreground">{task.description || t("admin.common.noDetails")}</p>
          </div>
          <Badge variant="outline" className="border-white/15 bg-white/[0.04] px-3 py-1 text-sm">
            {t(statusLabels[task.status])}
          </Badge>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-300/20 bg-red-300/10 p-4 text-sm text-red-100">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[1fr_0.78fr]">
        <Card className="border-white/10 bg-card/70">
          <CardHeader className="border-b border-white/10 bg-white/[0.025] px-6 py-5">
            <CardTitle className="flex items-center gap-3">
              <BellRing className="h-5 w-5 text-cyan-100" /> {t("admin.task.actionsTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <p className="text-sm leading-6 text-muted-foreground">{t("admin.task.actionsDescription")}</p>
            <div className="flex flex-wrap gap-3">
              {task.status === "OPEN" && (
                <Button onClick={() => void update("start")} disabled={working} variant="secondary">
                  <PlayCircle className="h-4 w-4" /> {t("admin.task.start")}
                </Button>
              )}
              {task.targetUrl && (
                <Button asChild className="bg-white text-black hover:bg-white/90">
                  <Link href={task.targetUrl}>
                    <ArrowRight className="h-4 w-4" /> {task.targetLabel || t("admin.task.openSource")}
                  </Link>
                </Button>
              )}
              {active && task.source === "AUDIT" && (
                <Button onClick={() => void update("resolve")} disabled={working} variant="outline">
                  <CheckCircle2 className="h-4 w-4" /> {t("admin.task.resolve")}
                </Button>
              )}
              {!active && task.source === "AUDIT" && (
                <Button onClick={() => void update("reopen")} disabled={working} variant="outline">
                  <RefreshCcw className="h-4 w-4" /> {t("admin.task.reopen")}
                </Button>
              )}
            </div>
            {task.source !== "AUDIT" && active && (
              <p className="rounded-2xl border border-cyan-200/15 bg-cyan-300/[0.06] p-4 text-sm text-cyan-50/85">
                {t("admin.task.workflowResolveHint")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-card/70">
          <CardHeader className="px-6 py-5">
            <CardTitle className="flex items-center gap-3">
              <Clock3 className="h-5 w-5 text-cyan-100" /> {t("admin.task.timelineTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-6 pb-6 text-sm">
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("admin.task.createdAt")}</p>
              <p className="mt-2 font-medium">{formatDate(task.createdAt, locale)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("admin.task.assignee")}</p>
              <p className="mt-2 font-medium">{task.assignedTo?.name || t("admin.task.unassigned")}</p>
            </div>
            {task.resolvedAt && (
              <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-100/70">{t("admin.task.resolvedAt")}</p>
                <p className="mt-2 font-medium text-emerald-50">{formatDate(task.resolvedAt, locale)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
