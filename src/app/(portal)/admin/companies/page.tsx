"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  Building2,
  Copy,
  ExternalLink,
  Globe2,
  Mail,
  MapPin,
  MoreHorizontal,
  RefreshCcw,
  Search,
  ShieldCheck,
  Store,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { adminListCompanyUsers, type AdminCompanyUser } from "@/lib/api/admin-client";
import { useI18n } from "@/lib/i18n/use-i18n";

type CompanyFilter = "ALL" | "ACTIVE" | "ONLINE" | "LOCATIONS" | "UNCONFIGURED";
type CompanySort = "name" | "email" | "status" | "company" | "createdAt";

const companyFilters: Array<{ value: CompanyFilter; label: string; icon: typeof Building2 }> = [
  { value: "ALL", label: "Все", icon: Building2 },
  { value: "ACTIVE", label: "Активные", icon: ShieldCheck },
  { value: "ONLINE", label: "Онлайн", icon: Globe2 },
  { value: "LOCATIONS", label: "Точки", icon: MapPin },
  { value: "UNCONFIGURED", label: "Без профиля", icon: Store },
];

const COMPANY_NAME_PREVIEW_MAX_LENGTH = 34;

function compactText(value: string, max = COMPANY_NAME_PREVIEW_MAX_LENGTH) {
  const normalized = value.trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}...`;
}

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

function statusTone(status: AdminCompanyUser["accountStatus"]) {
  if (status === "ACTIVE") return "border-emerald-200/40 bg-emerald-200/10 text-emerald-100";
  if (status === "BLOCKED") return "border-red-200/40 bg-red-200/10 text-red-100";
  return "border-amber-200/40 bg-amber-200/10 text-amber-100";
}

function companyFilterCount(companies: AdminCompanyUser[], filter: CompanyFilter) {
  if (filter === "ALL") return companies.length;
  if (filter === "ACTIVE") return companies.filter((company) => company.accountStatus === "ACTIVE").length;
  if (filter === "ONLINE") return companies.filter((company) => company.managedCompany?.operatesOnline).length;
  if (filter === "LOCATIONS") return companies.filter((company) => company.managedCompany && !company.managedCompany.operatesOnline).length;
  return companies.filter((company) => !company.managedCompany).length;
}

function StatCard({ icon: Icon, label, value, hint }: { icon: typeof Building2; label: string; value: number; hint: string }) {
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

function QuickActions({ company }: { company: AdminCompanyUser }) {
  async function copyUuid() {
    await navigator.clipboard?.writeText(company.uuid).catch(() => undefined);
  }

  return (
    <details className="group relative inline-block text-left">
      <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-medium transition hover:bg-white/[0.1]">
        <MoreHorizontal className="h-4 w-4" />
        <span className="hidden lg:inline">Actions</span>
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#111318] p-1.5 shadow-2xl shadow-black/40">
        <Link className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-white/10" href={`/admin/companies/${company.uuid}`}>
          <ExternalLink className="h-4 w-4" /> Open profile
        </Link>
        <Link className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-white/10" href={`/admin/companies/${company.uuid}/payments`}>
          <WalletCards className="h-4 w-4" /> Payments
        </Link>
        <a className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-white/10" href={`mailto:${company.email}`}>
          <Mail className="h-4 w-4" /> Email owner
        </a>
        <button type="button" onClick={copyUuid} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-white/10">
          <Copy className="h-4 w-4" /> Copy UUID
        </button>
      </div>
    </details>
  );
}

export default function AdminCompaniesPage() {
  const { locale, t } = useI18n("ru");
  const [query, setQuery] = useState("");
  const [companies, setCompanies] = useState<AdminCompanyUser[]>([]);
  const [filter, setFilter] = useState<CompanyFilter>("ALL");
  const [sortBy, setSortBy] = useState<CompanySort>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);

  async function load(search = query) {
    setLoading(true);
    setCompanies(await adminListCompanyUsers(search));
    setLoading(false);
  }

  useEffect(() => {
    void load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => {
    const active = companies.filter((company) => company.accountStatus === "ACTIVE").length;
    const online = companies.filter((company) => company.managedCompany?.operatesOnline).length;
    const locations = companies.filter((company) => company.managedCompany && !company.managedCompany.operatesOnline).length;
    return { total: companies.length, active, online, locations };
  }, [companies]);

  const visibleCompanies = useMemo(() => {
    return companies
      .filter((company) => {
        if (filter === "ALL") return true;
        if (filter === "ACTIVE") return company.accountStatus === "ACTIVE";
        if (filter === "ONLINE") return Boolean(company.managedCompany?.operatesOnline);
        if (filter === "LOCATIONS") return Boolean(company.managedCompany && !company.managedCompany.operatesOnline);
        return !company.managedCompany;
      })
      .sort((left, right) => {
        const leftCompany = left.managedCompany?.name ?? "";
        const rightCompany = right.managedCompany?.name ?? "";
        const values: Record<CompanySort, [string, string]> = {
          name: [left.name, right.name],
          email: [left.email, right.email],
          status: [left.accountStatus, right.accountStatus],
          company: [leftCompany, rightCompany],
          createdAt: [left.createdAt, right.createdAt],
        };
        const [leftValue, rightValue] = values[sortBy];
        const result = leftValue.localeCompare(rightValue, "ru");
        return sortDir === "asc" ? result : -result;
      });
  }, [companies, filter, sortBy, sortDir]);

  function onSort(column: CompanySort) {
    setSortDir(column === sortBy && sortDir === "asc" ? "desc" : "asc");
    setSortBy(column);
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-cyan-100">
            <Building2 className="h-3.5 w-3.5" /> Управление компаниями
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{t("admin.companies.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Управляйте аккаунтами компаний, профилями партнёров и быстрыми действиями без перегруженной таблицы.
          </p>
        </div>
        <div className="hidden rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-muted-foreground lg:block">
          <span className="inline-flex items-center gap-2">
            <Search className="h-4 w-4 text-cyan-100" /> Поиск работает по имени, email и uuid.
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Building2} label="Всего" value={summary.total} hint="Аккаунты компаний в текущей выборке" />
        <StatCard icon={ShieldCheck} label="Активные" value={summary.active} hint={`${visibleCompanies.length} видно после фильтра`} />
        <StatCard icon={Globe2} label="Онлайн" value={summary.online} hint="Работают без физических точек" />
        <StatCard icon={MapPin} label="С точками" value={summary.locations} hint="Партнёры с офлайн-локациями" />
      </div>

      <Card className="glass overflow-visible border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Search className="h-5 w-5 text-cyan-100" /> {t("admin.companies.directoryTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 overflow-visible">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              void load(query);
            }}
          >
            <Input
              placeholder={t("admin.companies.searchPlaceholder")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Button type="submit" variant="secondary" className="sm:min-w-28">
              <Search className="h-4 w-4" /> {t("admin.companies.search")}
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            {companyFilters.map(({ value, label, icon: Icon }) => {
              const active = filter === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "border-cyan-200/50 bg-cyan-200/15 text-cyan-50 shadow-[0_0_22px_rgba(103,232,249,0.14)]"
                      : "border-white/10 bg-white/[0.045] text-muted-foreground hover:border-white/20 hover:bg-white/[0.08] hover:text-foreground"
                  }`}
                  aria-pressed={active}
                >
                  <Icon className="h-4 w-4" />
                  {label} {companyFilterCount(companies, value)}
                </button>
              );
            })}
          </div>

          {loading && companies.length === 0 && <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-muted-foreground">Загружаю компании...</p>}

          {visibleCompanies.length > 0 && (
            <>
              {loading && (
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1.5 text-xs font-medium text-cyan-50">
                  <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                  Обновляю
                </div>
              )}
              <div className="hidden overflow-visible rounded-2xl border border-white/10 md:block">
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    <col className="w-[26%]" />
                    <col className="w-[26%]" />
                    <col className="w-[10%]" />
                    <col className="w-[9%]" />
                    <col className="w-[12%]" />
                    <col className="w-[17%]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-white/10 text-left text-muted-foreground">
                      <th className="py-3 pl-4 pr-3">
                        <button type="button" onClick={() => onSort("company")} className="inline-flex items-center gap-1 hover:text-foreground">
                          {t("admin.companies.companyProfile")} <ArrowUpDown className="h-3.5 w-3.5" />
                        </button>
                      </th>
                      <th className="px-3">
                        <button type="button" onClick={() => onSort("email")} className="inline-flex items-center gap-1 hover:text-foreground">
                          {t("admin.companies.email")} <ArrowUpDown className="h-3.5 w-3.5" />
                        </button>
                      </th>
                      <th className="px-3">
                        <button type="button" onClick={() => onSort("status")} className="inline-flex items-center gap-1 hover:text-foreground">
                          {t("admin.companies.status")} <ArrowUpDown className="h-3.5 w-3.5" />
                        </button>
                      </th>
                      <th className="px-3">{t("admin.companies.workMode")}</th>
                      <th className="px-3">
                        <button type="button" onClick={() => onSort("createdAt")} className="inline-flex items-center gap-1 hover:text-foreground">
                          Создан <ArrowUpDown className="h-3.5 w-3.5" />
                        </button>
                      </th>
                      <th className="py-3 pl-3 pr-4 text-right">Quick actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCompanies.map((company) => (
                      <tr key={company.uuid} className="border-b border-white/10 last:border-0 hover:bg-white/[0.035]">
                        <td className="py-4 pl-4 pr-3 align-middle">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-sm font-semibold">
                              {(company.managedCompany?.name ?? company.name).trim().slice(0, 1).toUpperCase() || "C"}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold" title={company.managedCompany?.name ?? t("admin.companies.notConfigured")}>
                                {company.managedCompany?.name ? compactText(company.managedCompany.name) : t("admin.companies.notConfigured")}
                              </p>
                              <p className="font-mono text-[11px] text-muted-foreground">{company.uuid.slice(0, 8)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 align-middle">
                          <a href={`mailto:${company.email}`} title={company.email} className="block truncate text-foreground/90 underline-offset-4 hover:text-foreground hover:underline">
                            {compactEmail(company.email, 42)}
                          </a>
                        </td>
                        <td className="px-3 align-middle">
                          <Badge variant="outline" className={`text-xs ${statusTone(company.accountStatus)}`}>{company.accountStatus}</Badge>
                        </td>
                        <td className="px-3 align-middle">
                          {company.managedCompany?.operatesOnline ? (
                            <Badge variant="outline" className="gap-1 border-sky-200/40 bg-sky-200/10 text-sky-100">
                              <Globe2 className="h-3 w-3" />
                              {t("admin.companies.online")}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <MapPin className="h-3 w-3" />
                              {t("admin.companies.locations")}
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 align-middle text-xs text-muted-foreground">{formatDate(company.createdAt, locale)}</td>
                        <td className="py-3 pl-3 pr-4 text-right align-middle">
                          <div className="flex items-center justify-end gap-2">
                            <Button asChild variant="secondary" size="sm">
                              <Link href={`/admin/companies/${company.uuid}`}>Open</Link>
                            </Button>
                            <QuickActions company={company} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 md:hidden">
                {visibleCompanies.map((company) => (
                  <div key={company.uuid} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-semibold" title={company.managedCompany?.name ?? t("admin.companies.notConfigured")}>
                          {company.managedCompany?.name ? compactText(company.managedCompany.name) : t("admin.companies.notConfigured")}
                        </p>
                        <a href={`mailto:${company.email}`} className="mt-1 block max-w-full truncate text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                          {compactEmail(company.email, 30)}
                        </a>
                      </div>
                      <Badge variant="outline" className={`shrink-0 text-xs ${statusTone(company.accountStatus)}`}>{company.accountStatus}</Badge>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>{formatDate(company.createdAt, locale)}</span>
                      <span className="font-mono">{company.uuid.slice(0, 8)}</span>
                    </div>
                    <p className="mt-3 truncate text-sm text-muted-foreground" title={company.name}>Аккаунт: {compactText(company.name)}</p>
                    <div className="mt-4 flex gap-2">
                      <Button asChild variant="secondary" size="sm" className="flex-1">
                        <Link href={`/admin/companies/${company.uuid}`}>Open profile</Link>
                      </Button>
                      <QuickActions company={company} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {!loading && visibleCompanies.length === 0 && (
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-sm text-muted-foreground">{t("admin.companies.empty")}</p>
          )}

          <p className="text-xs text-muted-foreground">
            Показано {visibleCompanies.length} из {companies.length} компаний. UUID скрыт из таблицы, но поиск по нему работает.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
