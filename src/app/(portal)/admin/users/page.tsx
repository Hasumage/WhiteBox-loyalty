"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  AlertTriangle,
  Ban,
  Copy,
  ExternalLink,
  Mail,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  UserCheck,
  UserCog,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import {
  adminCreateAccount,
  adminListUsers,
  type AdminRole,
  type AdminUserRow,
  type AdminUsersResponse,
} from "@/lib/api/admin-client";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { useI18n } from "@/lib/i18n/use-i18n";

type Role = AdminRole;
type RoleFilter = Role | "ALL";
type UserSort = "name" | "email" | "role" | "status" | "createdAt";

const USER_NAME_MAX_LENGTH = 80;
const USER_EMAIL_MAX_LENGTH = 120;
const TEMP_PASSWORD_MAX_LENGTH = 128;

const initialMeta: AdminUsersResponse = {
  items: [],
  total: 0,
  summary: {
    totalUsers: 0,
    activeUsers: 0,
    adminUsers: 0,
    blockedUsers: 0,
  },
  page: 1,
  limit: 10,
  totalPages: 0,
  sortBy: "createdAt",
  sortDir: "desc",
};

function compactEmail(email: string, max = 34) {
  const [localPart, domain] = email.split("@");
  if (!domain || email.length <= max) return email;
  const compactLocal = localPart.length > 16 ? `${localPart.slice(0, 12)}...${localPart.slice(-2)}` : localPart;
  const compactDomain = domain.length > 18 ? `${domain.slice(0, 14)}...` : domain;
  return `${compactLocal}@${compactDomain}`;
}

function formatDate(value: string, locale: string) {
  return new Date(value).toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function roleTone(role: AdminRole) {
  if (role === "SUPER_ADMIN") return "border-cyan-300/40 bg-cyan-300/10 text-cyan-100";
  if (role === "ADMIN" || role === "MANAGER") return "border-amber-200/40 bg-amber-200/10 text-amber-100";
  if (role === "SUPPORT") return "border-sky-200/40 bg-sky-200/10 text-sky-100";
  if (role === "COMPANY") return "border-emerald-200/40 bg-emerald-200/10 text-emerald-100";
  return "border-white/10 bg-white/10 text-white";
}

const roleFilters: Array<{ value: RoleFilter; icon: typeof Users; labelKey: TranslationKey }> = [
  { value: "ALL", icon: Users, labelKey: "admin.users.roleFilterAll" },
  { value: "CLIENT", icon: Users, labelKey: "admin.users.roleFilterClients" },
  { value: "COMPANY", icon: UserCheck, labelKey: "admin.users.roleFilterCompanies" },
  { value: "SUPER_ADMIN", icon: ShieldCheck, labelKey: "admin.users.roleFilterSuperAdmins" },
  { value: "ADMIN", icon: ShieldCheck, labelKey: "admin.users.roleFilterAdmins" },
  { value: "MANAGER", icon: UserCog, labelKey: "admin.users.roleFilterManagers" },
  { value: "SUPPORT", icon: Mail, labelKey: "admin.users.roleFilterSupport" },
];

function StatCard({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: number; hint: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan-300/10 blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        <span className="rounded-2xl border border-white/10 bg-background/60 p-2.5 text-cyan-100">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function QuickActions({ user }: { user: AdminUserRow }) {
  async function copyUuid() {
    await navigator.clipboard?.writeText(user.uuid).catch(() => undefined);
  }

  return (
    <details className="group relative inline-block text-left">
      <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-medium transition hover:bg-white/[0.1]">
        <MoreHorizontal className="h-4 w-4" />
        <span className="hidden lg:inline">Actions</span>
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#111318] p-1.5 shadow-2xl shadow-black/40">
        <Link className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-white/10" href={`/admin/users/${user.uuid}`}>
          <ExternalLink className="h-4 w-4" /> Open profile
        </Link>
        <Link className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-white/10" href={`/admin/users/${user.uuid}/permissions`}>
          <UserCog className="h-4 w-4" /> Permissions
        </Link>
        <a className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-white/10" href={`mailto:${user.email}`}>
          <Mail className="h-4 w-4" /> Email user
        </a>
        <button type="button" onClick={copyUuid} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-white/10">
          <Copy className="h-4 w-4" /> Copy UUID
        </button>
      </div>
    </details>
  );
}

export default function AdminUsersPage() {
  const { locale, t } = useI18n("ru");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("CLIENT");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<AdminUsersResponse>(initialMeta);
  const [sortBy, setSortBy] = useState<UserSort>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const pendingScroll = useRef<{
    y: number;
    previousCount: number;
    shouldSmoothToFilters: boolean;
  } | null>(null);
  const recordsCardRef = useRef<HTMLDivElement | null>(null);

  const summary = meta.summary ?? initialMeta.summary!;
  const visibleActive = useMemo(() => users.filter((u) => u.accountStatus === "ACTIVE").length, [users]);

  async function load(opts?: {
    search?: string;
    nextPage?: number;
    nextSortBy?: UserSort;
    nextSortDir?: "asc" | "desc";
    nextRoleFilter?: RoleFilter;
    preserveScroll?: boolean;
  }) {
    if (opts?.preserveScroll) {
      pendingScroll.current = {
        y: window.scrollY,
        previousCount: users.length,
        shouldSmoothToFilters: false,
      };
    }
    setLoading(true);
    setLoadError(null);
    const nextPage = opts?.nextPage ?? page;
    const nextSortBy = opts?.nextSortBy ?? sortBy;
    const nextSortDir = opts?.nextSortDir ?? sortDir;
    const nextRoleFilter = opts?.nextRoleFilter ?? roleFilter;
    const data = await adminListUsers({
      role: nextRoleFilter === "ALL" ? undefined : nextRoleFilter,
      query: opts?.search ?? query,
      page: nextPage,
      limit: meta.limit,
      sortBy: nextSortBy,
      sortDir: nextSortDir,
    });
    if (!data) {
      setUsers([]);
      setLoadError(t("admin.users.loadFailed"));
      setMeta((prev) => ({ ...prev, items: [], page: 1 }));
      setLoading(false);
      return;
    }
    if (pendingScroll.current) {
      pendingScroll.current.shouldSmoothToFilters = pendingScroll.current.previousCount > data.items.length;
    }
    setUsers(data.items);
    setMeta(data);
    setPage(data.page);
    setSortBy(data.sortBy);
    setSortDir(data.sortDir);
    setRoleFilter(nextRoleFilter);
    setLoading(false);
  }

  useEffect(() => {
    void load({ nextPage: 1, nextSortBy: "createdAt", nextSortDir: "desc" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading || !pendingScroll.current) return;
    const request = pendingScroll.current;
    pendingScroll.current = null;

    requestAnimationFrame(() => {
      if (request.shouldSmoothToFilters) {
        recordsCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      window.scrollTo({ top: request.y, behavior: "auto" });
    });
  }, [loading, users.length]);

  function onSort(column: UserSort) {
    const nextDir: "asc" | "desc" = column === sortBy && sortDir === "asc" ? "desc" : "asc";
    void load({ nextPage: 1, nextSortBy: column, nextSortDir: nextDir, preserveScroll: true });
  }

  function onRoleFilter(nextRoleFilter: RoleFilter) {
    void load({ nextPage: 1, nextRoleFilter, preserveScroll: true });
  }

  async function onCreate() {
    setCreating(true);
    const res = await adminCreateAccount({ name, email, password, role });
    setCreating(false);
    if (!res.ok) return;
    setName("");
    setEmail("");
    setPassword("");
    setRole("CLIENT");
    await load({ nextPage: 1 });
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-cyan-100">
            <Users className="h-3.5 w-3.5" /> {t("admin.users.badge")}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{t("admin.users.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {t("admin.users.description")}
          </p>
        </div>
        <div className="hidden rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-muted-foreground lg:block">
          <span className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4 text-cyan-100" /> {t("admin.users.quickHint")}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label={t("admin.users.total")} value={summary.totalUsers} hint={t("admin.users.totalHint")} />
        <StatCard icon={UserCheck} label={t("admin.users.active")} value={summary.activeUsers} hint={`${visibleActive} ${t("admin.users.visibleOnPage")}`} />
        <StatCard icon={ShieldCheck} label={t("admin.users.staff")} value={summary.adminUsers} hint={t("admin.users.staffHint")} />
        <StatCard icon={Ban} label={t("admin.users.blocked")} value={summary.blockedUsers} hint={t("admin.users.blockedHint")} />
      </div>

      <Card className="glass border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-cyan-100" /> {t("admin.users.createTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(170px,1fr)_minmax(220px,1.15fr)_minmax(190px,1fr)_minmax(230px,0.9fr)]">
          <Input maxLength={USER_NAME_MAX_LENGTH} placeholder={t("admin.users.name")} value={name} onChange={(e) => setName(e.target.value)} />
          <Input maxLength={USER_EMAIL_MAX_LENGTH} placeholder={t("admin.users.email")} value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input maxLength={TEMP_PASSWORD_MAX_LENGTH} placeholder={t("admin.users.temporaryPassword")} value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <SelectField value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="CLIENT">CLIENT</option>
              <option value="COMPANY">COMPANY</option>
              <option value="ADMIN">ADMIN</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              <option value="MANAGER">MANAGER</option>
              <option value="SUPPORT">SUPPORT</option>
            </SelectField>
            <Button onClick={onCreate} disabled={creating || !name || !email || password.length < 8} className="sm:min-w-24">
              {t("admin.users.create")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card ref={recordsCardRef} className="glass overflow-visible border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Search className="h-5 w-5 text-cyan-100" /> {t("admin.users.searchTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 overflow-visible">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder={t("admin.users.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void load({ search: query, nextPage: 1 });
              }}
            />
            <Button variant="secondary" onClick={() => void load({ search: query, nextPage: 1 })} className="sm:min-w-28">
              <Search className="h-4 w-4" /> {t("admin.users.search")}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {roleFilters.map(({ value, icon: Icon, labelKey }) => {
              const active = roleFilter === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onRoleFilter(value)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "border-cyan-200/50 bg-cyan-200/15 text-cyan-50 shadow-[0_0_22px_rgba(103,232,249,0.14)]"
                      : "border-white/10 bg-white/[0.045] text-muted-foreground hover:border-white/20 hover:bg-white/[0.08] hover:text-foreground"
                  }`}
                  aria-pressed={active}
                >
                  <Icon className="h-4 w-4" />
                  {t(labelKey)}
                </button>
              );
            })}
          </div>

          {loading && users.length === 0 && <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-muted-foreground">{t("admin.users.loading")}</p>}

          {loadError && !loading && (
            <div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4 text-sm text-amber-100">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {loadError}
                </p>
                <Button variant="secondary" size="sm" onClick={() => void load({ search: query, nextPage: 1 })}>
                  <RefreshCcw className="h-4 w-4" /> {t("admin.users.retry")}
                </Button>
              </div>
            </div>
          )}

          {users.length > 0 && (
            <>
              {loading && (
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1.5 text-xs font-medium text-cyan-50">
                  <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                  {t("admin.users.loading")}
                </div>
              )}
              <div className="hidden overflow-visible rounded-2xl border border-white/10 md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-muted-foreground">
                      <th className="py-3 pl-4 pr-3">
                        <button type="button" onClick={() => onSort("name")} className="inline-flex items-center gap-1 hover:text-foreground">
                          {t("admin.users.name")} <ArrowUpDown className="h-3.5 w-3.5" />
                        </button>
                      </th>
                      <th className="px-3">
                        <button type="button" onClick={() => onSort("email")} className="inline-flex items-center gap-1 hover:text-foreground">
                          {t("admin.users.email")} <ArrowUpDown className="h-3.5 w-3.5" />
                        </button>
                      </th>
                      <th className="w-[140px] px-3">
                        <span className="inline-flex items-center gap-1">{t("admin.users.role")}</span>
                      </th>
                      <th className="w-[150px] px-3">
                        <button type="button" onClick={() => onSort("createdAt")} className="inline-flex items-center gap-1 hover:text-foreground">
                          {t("admin.users.created")} <ArrowUpDown className="h-3.5 w-3.5" />
                        </button>
                      </th>
                      <th className="w-[150px] py-3 pl-3 pr-4 text-right">Quick actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.uuid} className="border-b border-white/10 last:border-0 hover:bg-white/[0.035]">
                        <td className="py-4 pl-4 pr-3 align-middle">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-sm font-semibold">
                              {u.name.trim().slice(0, 1).toUpperCase() || "U"}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold" title={u.name}>{u.name}</p>
                              <p className="font-mono text-[11px] text-muted-foreground">{u.uuid.slice(0, 8)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 align-middle">
                          <a href={`mailto:${u.email}`} title={u.email} className="block max-w-[320px] truncate text-foreground/90 underline-offset-4 hover:text-foreground hover:underline">
                            {compactEmail(u.email, 42)}
                          </a>
                        </td>
                        <td className="px-3 align-middle">
                          <Badge variant="outline" className={`text-xs ${roleTone(u.role)}`}>{u.role}</Badge>
                        </td>
                        <td className="px-3 align-middle text-xs text-muted-foreground">{formatDate(u.createdAt, locale)}</td>
                        <td className="py-3 pl-3 pr-4 text-right align-middle">
                          <div className="flex items-center justify-end gap-2">
                            <Button asChild variant="secondary" size="sm">
                              <Link href={`/admin/users/${u.uuid}`}>Open</Link>
                            </Button>
                            <QuickActions user={u} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 md:hidden">
                {users.map((u) => (
                  <div key={u.uuid} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-semibold">{u.name}</p>
                        <a href={`mailto:${u.email}`} className="mt-1 block max-w-full truncate text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                          {compactEmail(u.email, 30)}
                        </a>
                      </div>
                      <Badge variant="outline" className={`shrink-0 text-xs ${roleTone(u.role)}`}>{u.role}</Badge>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>{formatDate(u.createdAt, locale)}</span>
                      <span className="font-mono">{u.uuid.slice(0, 8)}</span>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button asChild variant="secondary" size="sm" className="flex-1">
                        <Link href={`/admin/users/${u.uuid}`}>Open profile</Link>
                      </Button>
                      <QuickActions user={u} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {!loading && users.length === 0 && (
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-sm text-muted-foreground">{t("admin.users.empty")}</p>
          )}

          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {t("admin.users.showing")} {users.length} {t("admin.categories.of")} {meta.total} {t("admin.users.users")} · {t("admin.users.page")} {meta.page} / {Math.max(1, meta.totalPages)}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <Button variant="secondary" size="sm" disabled={meta.page <= 1} onClick={() => void load({ nextPage: meta.page - 1 })}>
                {t("admin.common.prev")}
              </Button>
              <Button variant="secondary" size="sm" disabled={meta.page >= Math.max(1, meta.totalPages)} onClick={() => void load({ nextPage: meta.page + 1 })}>
                {t("admin.common.next")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


