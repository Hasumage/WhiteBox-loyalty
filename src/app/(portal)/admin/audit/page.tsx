"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  FileClock,
  Filter,
  Github,
  Search,
  ShieldCheck,
  User,
  Wallet,
  Database,
  Shield,
  PlusCircle,
  CircleCheck,
  CircleX,
  Archive,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { adminListAuditEvents, type AdminAuditRow } from "@/lib/api/admin-client";
import { useI18n } from "@/lib/i18n/use-i18n";

type AuditLevel = "INFO" | "WARN" | "CRITICAL";
type AuditCategory = "SECURITY" | "USER" | "SUBSCRIPTION" | "BILLING" | "SYSTEM";
type AuditWorkspace = "MANAGER" | "DEVELOPER";

const TAG_OPTIONS = ["GIT", "SECURITY", "USER", "BILLING"] as const;

const CATEGORY_ICON: Record<AuditCategory, typeof Shield> = {
  SECURITY: Shield,
  USER: User,
  SUBSCRIPTION: FileClock,
  BILLING: Wallet,
  SYSTEM: Database,
};

const LEVEL_STYLE: Record<AuditLevel, string> = {
  INFO: "bg-emerald-500/10 text-emerald-300 border border-emerald-400/25",
  WARN: "bg-amber-500/10 text-amber-300 border border-amber-400/25",
  CRITICAL: "bg-rose-500/10 text-rose-300 border border-rose-400/25",
};

export default function AdminAuditPage() {
  const { locale, t } = useI18n();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"ALL" | AuditCategory>("ALL");
  const [level, setLevel] = useState<"ALL" | AuditLevel>("ALL");
  const [workspace, setWorkspace] = useState<AuditWorkspace>("MANAGER");
  const [tag, setTag] = useState<"ALL" | (typeof TAG_OPTIONS)[number]>("ALL");
  const [rows, setRows] = useState<AdminAuditRow[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 0, limit: 40 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(opts?: { nextPage?: number; nextQuery?: string; nextTag?: string; nextWorkspace?: AuditWorkspace }) {
    setLoading(true);
    const nextPage = opts?.nextPage ?? page;
    const nextWorkspace = opts?.nextWorkspace ?? workspace;
    const res = await adminListAuditEvents({
      workspace: nextWorkspace,
      query: opts?.nextQuery ?? query,
      tag: opts?.nextTag ?? (tag === "ALL" ? undefined : tag),
      page: nextPage,
      limit: meta.limit,
    });
    if (!res.ok) {
      setRows([]);
      setError(String(res.message));
      setLoading(false);
      return;
    }
    setRows(res.data.items);
    setMeta({ total: res.data.total, totalPages: res.data.totalPages, limit: res.data.limit });
    setPage(res.data.page);
    setError(null);
    setLoading(false);
  }

  useEffect(() => {
    void load({ nextPage: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace]);

  const filtered = useMemo(() => {
    return rows.filter((entry) => {
      const inCategory = category === "ALL" || entry.category === category;
      const inLevel = level === "ALL" || entry.level === level;
      return inCategory && inLevel;
    });
  }, [category, level, rows]);

  const criticalCount = filtered.filter((entry) => entry.level === "CRITICAL").length;
  const blockedCount = filtered.filter((entry) => entry.result === "BLOCKED").length;
  const categoryLabel = (entryCategory: AuditCategory) => {
    const keys = {
      SECURITY: "admin.audit.security",
      USER: "admin.audit.users",
      SUBSCRIPTION: "admin.audit.subscriptions",
      BILLING: "admin.audit.billing",
      SYSTEM: "admin.audit.system",
    } as const;
    return t(keys[entryCategory]);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("admin.audit.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("admin.audit.description")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/audit/backups">
              <Archive className="h-4 w-4" />
              {t("admin.audit.backups")}
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/audit/new">
              <PlusCircle className="h-4 w-4" />
              {t("admin.audit.addEvent")}
            </Link>
          </Button>
        </div>
      </div>

      <Card className="glass border-white/10">
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <button
            type="button"
            onClick={() => setWorkspace("MANAGER")}
            className={cn(
              "rounded-lg px-3 py-2 text-sm transition-colors",
              workspace === "MANAGER"
                ? "bg-primary/15 text-primary"
                : "bg-muted/20 text-muted-foreground hover:bg-muted/30",
            )}
          >
            {t("admin.audit.manager")}
          </button>
          <button
            type="button"
            onClick={() => setWorkspace("DEVELOPER")}
            className={cn(
              "rounded-lg px-3 py-2 text-sm transition-colors",
              workspace === "DEVELOPER"
                ? "bg-primary/15 text-primary"
                : "bg-muted/20 text-muted-foreground hover:bg-muted/30",
            )}
          >
            {t("admin.audit.developer")}
          </button>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="glass border-white/10">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-primary/15 p-2 text-primary"><FileClock className="h-4 w-4" /></div>
            <div><p className="text-xs text-muted-foreground">{t("admin.audit.eventsInView")}</p><p className="text-xl font-semibold">{filtered.length}</p></div>
          </CardContent>
        </Card>
        <Card className="glass border-white/10">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-amber-500/10 p-2 text-amber-300"><AlertTriangle className="h-4 w-4" /></div>
            <div><p className="text-xs text-muted-foreground">{t("admin.audit.criticalAlerts")}</p><p className="text-xl font-semibold">{criticalCount}</p></div>
          </CardContent>
        </Card>
        <Card className="glass border-white/10">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-rose-500/10 p-2 text-rose-300"><ShieldCheck className="h-4 w-4" /></div>
            <div><p className="text-xs text-muted-foreground">{t("admin.audit.blockedActions")}</p><p className="text-xl font-semibold">{blockedCount}</p></div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Filter className="h-4 w-4 text-muted-foreground" />{t("admin.audit.filterTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_170px_170px_170px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("admin.audit.searchPlaceholder")} className="pl-9" />
          </div>
          <SelectField value={category} onChange={(event) => setCategory(event.target.value as "ALL" | AuditCategory)}>
            <option value="ALL">{t("admin.audit.allCategories")}</option>
            <option value="SECURITY">{t("admin.audit.security")}</option>
            <option value="USER">{t("admin.audit.users")}</option>
            <option value="SUBSCRIPTION">{t("admin.audit.subscriptions")}</option>
            <option value="BILLING">{t("admin.audit.billing")}</option>
            <option value="SYSTEM">{t("admin.audit.system")}</option>
          </SelectField>
          <SelectField value={level} onChange={(event) => setLevel(event.target.value as "ALL" | AuditLevel)}>
            <option value="ALL">{t("admin.audit.allLevels")}</option>
            <option value="INFO">{t("admin.audit.info")}</option>
            <option value="WARN">{t("admin.audit.warn")}</option>
            <option value="CRITICAL">{t("admin.audit.critical")}</option>
          </SelectField>
          <SelectField value={tag} onChange={(event) => setTag(event.target.value as "ALL" | (typeof TAG_OPTIONS)[number])}>
            <option value="ALL">{t("admin.audit.allTags")}</option>
            {TAG_OPTIONS.map((item) => <option key={item} value={item}>#{item}</option>)}
          </SelectField>
          <div className="md:col-span-4 flex justify-end">
            <Button variant="secondary" onClick={() => void load({ nextPage: 1, nextQuery: query, nextTag: tag === "ALL" ? undefined : tag })}>{t("admin.audit.applyFilters")}</Button>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-3">
        {loading && <p className="text-sm text-muted-foreground">{t("admin.audit.loading")}</p>}
        {!loading && filtered.map((entry) => {
          const CategoryIcon = CATEGORY_ICON[entry.category];
          return (
            <details key={entry.id} className="group rounded-2xl border border-white/10 bg-card/40 p-4 transition hover:border-white/20">
              <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <CategoryIcon className="h-4 w-4 text-primary" />
                    {entry.action}
                  </p>
                  <p className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US")} | {entry.actorLabel}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {entry.tags?.includes("GIT") && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold text-cyan-200">
                      <Github className="h-3.5 w-3.5" />
                      #GIT
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-muted/25 px-2 py-1 text-[11px]">
                    <CategoryIcon className="h-3.5 w-3.5" />
                    {categoryLabel(entry.category)}
                  </span>
                  <span className={cn("rounded-md px-2 py-1 text-[11px] uppercase", LEVEL_STYLE[entry.level])}>{entry.level}</span>
                  <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px]", entry.result === "BLOCKED" ? "border-rose-400/25 bg-rose-500/10 text-rose-300" : "border-emerald-400/25 bg-emerald-500/10 text-emerald-300")}>
                    {entry.result === "BLOCKED" ? <CircleX className="h-3.5 w-3.5" /> : <CircleCheck className="h-3.5 w-3.5" />}
                    {entry.result}
                  </span>
                </div>
              </summary>

              <div className="mt-4 grid gap-3 border-t border-white/10 pt-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div><p className="text-xs text-muted-foreground">{t("admin.audit.target")}</p><p className="font-medium">{entry.targetLabel ?? entry.targetUuid ?? entry.targetEmail ?? "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">{t("admin.audit.uuidEmail")}</p><p className="font-medium">{entry.targetUuid ?? entry.targetEmail ?? "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">{t("admin.audit.ipCountry")}</p><p className="font-medium">{(entry.ipAddress ?? "-")} | {(entry.countryCode ?? "-")}</p></div>
                <div><p className="text-xs text-muted-foreground">{t("admin.audit.eventId")}</p><p className="font-mono text-xs text-muted-foreground">{entry.id}</p></div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{entry.details ?? t("admin.common.noDetails")}</p>
              {entry.linkUrl && (
                <a href={entry.linkUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/80">
                  {entry.linkLabel ?? t("admin.common.openLink")}
                </a>
              )}
            </details>
          );
        })}
      </div>

      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {t("admin.audit.showing")} {filtered.length} {t("admin.audit.ofEvents")
            .replace("{total}", String(meta.total))
            .replace("{page}", String(page))
            .replace("{pages}", String(Math.max(1, meta.totalPages)))}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => void load({ nextPage: page - 1 })}>{t("admin.common.prev")}</Button>
          <Button variant="secondary" size="sm" disabled={page >= Math.max(1, meta.totalPages)} onClick={() => void load({ nextPage: page + 1 })}>{t("admin.common.next")}</Button>
        </div>
      </div>
    </div>
  );
}
