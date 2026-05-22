"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import {
  AlertTriangle,
  BellRing,
  Bot,
  CheckCircle2,
  Clock3,
  Flame,
  RefreshCcw,
  RotateCw,
  Send,
  ServerCrash,
  ShieldAlert,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  adminGetSystemHealth,
  adminResolveSystemHealthIncident,
  adminRetryTelegramQueue,
  type AdminSystemHealthResponse,
} from "@/lib/api/admin-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { Locale } from "@/lib/i18n/shared";
import { cn } from "@/lib/utils";

type QueueRow = AdminSystemHealthResponse["telegram"]["queue"]["recent"][number];
type IncidentRow = AdminSystemHealthResponse["developerIncidents"][number];
type AdminIcon = ComponentType<{ className?: string }>;

function formatDate(value: string | null, locale: Locale) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusTone(status: QueueRow["status"]) {
  if (status === "SENT") return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
  if (status === "FAILED") return "border-red-300/25 bg-red-300/10 text-red-100";
  return "border-amber-300/25 bg-amber-300/10 text-amber-100";
}

function levelTone(level: IncidentRow["level"]) {
  if (level === "CRITICAL") return "border-red-300/25 bg-red-300/10 text-red-100";
  if (level === "WARN") return "border-amber-300/25 bg-amber-300/10 text-amber-100";
  return "border-cyan-300/25 bg-cyan-300/10 text-cyan-100";
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "cyan",
}: {
  icon: AdminIcon;
  label: string;
  value: number;
  hint: string;
  tone?: "cyan" | "red" | "amber" | "emerald";
}) {
  const glow =
    tone === "red"
      ? "bg-red-300/12 text-red-100"
      : tone === "amber"
        ? "bg-amber-300/12 text-amber-100"
        : tone === "emerald"
          ? "bg-emerald-300/12 text-emerald-100"
          : "bg-cyan-300/12 text-cyan-100";

  return (
    <Card className="overflow-hidden border-white/10 bg-white/[0.045]">
      <CardContent className="relative flex min-h-32 items-start justify-between gap-4 p-5">
        <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/5 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight">{value}</p>
          <p className="mt-2 max-w-[16rem] text-xs leading-5 text-muted-foreground">{hint}</p>
        </div>
        <span className={cn("relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10", glow)}>
          <Icon className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  );
}

function InfraRow({ label, active, activeLabel, inactiveLabel }: { label: string; active: boolean; activeLabel: string; inactiveLabel: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-2xl border",
            active ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" : "border-amber-300/25 bg-amber-300/10 text-amber-100",
          )}
        >
          {active ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
        </span>
        <p className="font-semibold">{label}</p>
      </div>
      <Badge
        variant="outline"
        className={active ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" : "border-white/10 bg-white/[0.04] text-muted-foreground"}
      >
        {active ? activeLabel : inactiveLabel}
      </Badge>
    </div>
  );
}

export default function AdminSystemHealthPage() {
  const { locale, t } = useI18n("ru");
  const [health, setHealth] = useState<AdminSystemHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const queue = health?.telegram.queue;
  const delivery = health?.telegram.landingLeadDelivery24h;
  const hasQueueFailures = (queue?.failed ?? 0) > 0;

  const stats = useMemo(
    () => [
      {
        label: t("admin.systemHealth.openIssues"),
        value: health?.summary.openIssues ?? 0,
        hint: t("admin.systemHealth.openIssuesHint"),
        icon: ServerCrash,
        tone: (health?.summary.openIssues ?? 0) > 0 ? "red" : "emerald",
      },
      {
        label: t("admin.systemHealth.criticalIncidents"),
        value: health?.summary.criticalIncidents ?? 0,
        hint: t("admin.systemHealth.criticalIncidentsHint"),
        icon: Flame,
        tone: (health?.summary.criticalIncidents ?? 0) > 0 ? "red" : "emerald",
      },
      {
        label: t("admin.systemHealth.queueFailed"),
        value: health?.summary.telegramQueueFailed ?? 0,
        hint: t("admin.systemHealth.queueFailedHint"),
        icon: BellRing,
        tone: hasQueueFailures ? "amber" : "emerald",
      },
      {
        label: t("admin.systemHealth.queueDue"),
        value: health?.summary.telegramQueueDue ?? 0,
        hint: t("admin.systemHealth.queueDueHint"),
        icon: Clock3,
        tone: (health?.summary.telegramQueueDue ?? 0) > 0 ? "cyan" : "emerald",
      },
    ],
    [hasQueueFailures, health?.summary, t],
  );

  async function load() {
    setLoading(true);
    setError("");
    const result = await adminGetSystemHealth();
    if (!result.ok) {
      setHealth(null);
      setError(result.message || t("admin.systemHealth.loadFailed"));
    } else {
      setHealth(result.data);
    }
    setLoading(false);
  }

  async function retryQueueNow() {
    setRetrying(true);
    setNotice("");
    setError("");
    const result = await adminRetryTelegramQueue();
    if (!result.ok) {
      setError(result.message);
      setRetrying(false);
      return;
    }
    setNotice(
      `${t("admin.systemHealth.retryComplete")}: ${result.data.result.processed} / ${result.data.result.sent} ${t("admin.systemHealth.sent")}, ${result.data.result.failed} ${t("admin.systemHealth.failed")}.`,
    );
    await load();
    setRetrying(false);
  }

  async function resolveIncident(id: string) {
    setResolvingId(id);
    setNotice("");
    setError("");
    const result = await adminResolveSystemHealthIncident(id);
    if (!result.ok) {
      setError(result.message);
      setResolvingId(null);
      return;
    }
    setNotice(t("admin.systemHealth.incidentResolved"));
    await load();
    setResolvingId(null);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(248,113,113,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(103,232,249,0.12),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025))] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-red-200/20 bg-red-300/10 px-3 py-1 text-sm text-red-50">
              <ShieldAlert className="h-4 w-4" /> {t("admin.systemHealth.badge")}
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t("admin.systemHealth.title")}</h1>
            <p className="mt-3 max-w-3xl text-muted-foreground">{t("admin.systemHealth.description")}</p>
            {health?.generatedAt && (
              <p className="mt-3 text-xs text-muted-foreground">
                {t("admin.systemHealth.generatedAt")}: {formatDate(health.generatedAt, locale)}
              </p>
            )}
          </div>
          <Button variant="secondary" onClick={load} disabled={loading}>
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} /> {t("admin.systemHealth.refresh")}
          </Button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} icon={stat.icon} label={stat.label} value={stat.value} hint={stat.hint} tone={stat.tone as "cyan" | "red" | "amber" | "emerald"} />
        ))}
      </div>

      {error && <div className="rounded-2xl border border-red-300/20 bg-red-300/10 p-4 text-sm text-red-100">{error}</div>}
      {notice && <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-100">{notice}</div>}

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.9fr]">
        <Card className="overflow-hidden border-white/10 bg-card/70">
          <CardHeader className="border-b border-white/10 bg-white/[0.03] px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-3">
                  <Send className="h-5 w-5 text-cyan-100" /> {t("admin.systemHealth.queueTitle")}
                </CardTitle>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t("admin.systemHealth.queueDescription")}</p>
              </div>
              <Button onClick={retryQueueNow} disabled={retrying || loading} className="bg-white text-black hover:bg-white/90">
                <RotateCw className={cn("h-4 w-4", retrying && "animate-spin")} />
                {retrying ? t("admin.systemHealth.retrying") : t("admin.systemHealth.retryNow")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                [t("admin.systemHealth.queueTotal"), queue?.total ?? 0],
                [t("admin.systemHealth.queueSent"), queue?.sent ?? 0],
                [t("admin.systemHealth.queueFailedShort"), queue?.failed ?? 0],
                [t("admin.systemHealth.queueDueShort"), queue?.due ?? 0],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                  <p className="mt-2 text-2xl font-semibold">{value}</p>
                </div>
              ))}
            </div>

            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-muted-foreground">{t("admin.common.loading")}</div>
            ) : queue?.recent.length ? (
              <div className="space-y-3">
                {queue.recent.map((row) => (
                  <details key={row.id} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] open:bg-white/[0.055]">
                    <summary className="grid cursor-pointer list-none gap-3 px-4 py-4 transition hover:bg-white/[0.03] sm:grid-cols-[auto_1fr_auto] sm:items-center [&::-webkit-details-marker]:hidden">
                      <Badge variant="outline" className={cn("w-fit", statusTone(row.status))}>{row.status}</Badge>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{row.recipientLabel || row.recipientRole || row.recipientChatId}</p>
                        <p className="truncate text-sm text-muted-foreground">{row.source || "telegram"} · {row.recipientChatId}</p>
                      </div>
                      <div className="text-left text-sm text-muted-foreground sm:text-right">
                        <p>{t("admin.systemHealth.attempts")}: {row.attempts}</p>
                        <p>{formatDate(row.updatedAt, locale)}</p>
                      </div>
                    </summary>
                    <div className="grid gap-3 border-t border-white/10 p-4 text-sm lg:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("admin.systemHealth.messagePreview")}</p>
                        <p className="mt-2 leading-6">{row.textPreview || "-"}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("admin.systemHealth.lastError")}</p>
                        <p className="mt-2 break-words leading-6 text-red-100/85">{row.lastError || "-"}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("admin.systemHealth.nextRetry")}</p>
                        <p className="mt-2">{formatDate(row.nextRetryAt, locale)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("admin.systemHealth.source")}</p>
                        <p className="mt-2">{row.source || "telegram"} {row.sourceId ? `· ${row.sourceId}` : ""}</p>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/[0.08] p-6 text-emerald-50">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5" />
                  <p className="font-semibold">{t("admin.systemHealth.queueEmpty")}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-white/10 bg-card/70">
            <CardHeader className="px-6 py-5">
              <CardTitle className="flex items-center gap-3">
                <Bot className="h-5 w-5 text-cyan-100" /> {t("admin.systemHealth.telegramInfra")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-6 pb-6">
              <InfraRow
                label={t("admin.systemHealth.botToken")}
                active={Boolean(health?.telegram.botConfigured)}
                activeLabel={t("admin.systemHealth.configured")}
                inactiveLabel={t("admin.systemHealth.notConfigured")}
              />
              <InfraRow
                label={t("admin.systemHealth.proxy")}
                active={Boolean(health?.telegram.proxyConfigured)}
                activeLabel={t("admin.systemHealth.configured")}
                inactiveLabel={t("admin.systemHealth.notConfigured")}
              />
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-card/70">
            <CardHeader className="px-6 py-5">
              <CardTitle className="flex items-center gap-3">
                <BellRing className="h-5 w-5 text-cyan-100" /> {t("admin.systemHealth.leadDelivery")}
              </CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">{t("admin.systemHealth.leadDeliveryDescription")}</p>
            </CardHeader>
            <CardContent className="space-y-4 px-6 pb-6">
              <div className="grid grid-cols-3 gap-3">
                {[
                  [t("admin.systemHealth.sent"), delivery?.sent ?? 0],
                  [t("admin.systemHealth.failed"), delivery?.failed ?? 0],
                  [t("admin.systemHealth.pending"), delivery?.pending ?? 0],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 text-xl font-semibold">{value}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold">{t("admin.systemHealth.recentLeadFailures")}</p>
                {delivery?.recentFailures.length ? (
                  delivery.recentFailures.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-red-300/15 bg-red-300/[0.06] p-3 text-sm">
                      <p className="font-semibold">{item.lead.name} · {item.lead.company || item.recipientLabel || item.recipientRole}</p>
                      <p className="mt-1 break-words text-red-100/80">{item.lastError || "-"}</p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-muted-foreground">{t("admin.systemHealth.noLeadFailures")}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden border-white/10 bg-card/70">
        <CardHeader className="border-b border-white/10 bg-white/[0.03] px-6 py-5">
          <CardTitle className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-100" /> {t("admin.systemHealth.developerIncidents")}
          </CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">{t("admin.systemHealth.developerIncidentsDescription")}</p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-muted-foreground">{t("admin.common.loading")}</div>
          ) : health?.developerIncidents.length ? (
            <div className="divide-y divide-white/10">
              {health.developerIncidents.map((event) => (
                <div key={event.id} className="grid gap-4 p-5 lg:grid-cols-[160px_1fr_240px] lg:items-start">
                  <div>
                    <Badge variant="outline" className={levelTone(event.level)}>{event.level}</Badge>
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">{event.category}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">{event.action}</p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">{event.details || "-"}</p>
                    {!!event.tags.length && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {event.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="border-white/10 bg-white/[0.04] text-muted-foreground">#{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-3 text-sm text-muted-foreground lg:text-right">
                    <p>{formatDate(event.createdAt, locale)}</p>
                    <p className="mt-1">{t("admin.systemHealth.actor")}: {event.actorLabel}</p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void resolveIncident(event.id)}
                      disabled={resolvingId === event.id}
                      className="w-full lg:w-auto"
                    >
                      <CheckCircle2 className={cn("h-4 w-4", resolvingId === event.id && "animate-pulse")} />
                      {resolvingId === event.id ? t("admin.systemHealth.resolving") : t("admin.systemHealth.resolveIncident")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-muted-foreground">{t("admin.systemHealth.noIncidents")}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
