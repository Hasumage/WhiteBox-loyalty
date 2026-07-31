"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentType } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  ChevronDown,
  ClipboardList,
  CreditCard,
  Database,
  FileCheck,
  FlaskConical,
  Gift,
  Handshake,
  Headphones,
  Images,
  Inbox,
  LayoutDashboard,
  Link2,
  LogOut,
  MapPinned,
  Menu,
  Megaphone,
  MoreHorizontal,
  QrCode,
  Rocket,
  Settings2,
  Trophy,
  X,
  Send,
  ServerCrash,
  Shield,
  Sparkles,
  Tag,
  Users,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { NearLoyLogo } from "@/components/brand/NearLoyLogo";
import { PageTransition } from "@/components/PageTransition";
import { AuthRecoveryOverlay } from "@/components/auth/AuthRecoveryOverlay";
import type { AdminPermissionScope } from "@/lib/admin/access-control";
import { clearStoredSession, getStoredUser } from "@/lib/api/auth-client";
import { fetchWithAuthRecovery } from "@/lib/api/authenticated-fetch";
import { companyBilling, companyLocations, companyProfile, type CompanyBillingData, type CompanyMemberRole } from "@/lib/api/company-client";
import { getCompanyBillingWarning } from "@/lib/company-billing-warning";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/features/subscriptions";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";

type PortalIcon = ComponentType<{ className?: string }>;
type AdminWorkspace = "ADMIN" | "PR" | "SUPPORT";
type AdminNavigationProfile = {
  role: string;
  workspace: AdminWorkspace;
  permissions: Array<{ scope: AdminPermissionScope; canView: boolean }>;
  explicitPermissions?: Array<{ scope: AdminPermissionScope; canView: boolean }>;
};
type AdminMenuItem = {
  href: string;
  labelKey: TranslationKey;
  icon: PortalIcon;
  scope?: AdminPermissionScope;
  anyScopes?: AdminPermissionScope[];
  prWorkspace?: boolean;
  supportWorkspace?: boolean;
};
type AdminMenuSection = {
  groupKey: TranslationKey;
  defaultOpen?: boolean;
  items: AdminMenuItem[];
};
type NavItem = { href: string; label: string; icon: PortalIcon };
type CompanyMenuSection = {
  title: string;
  defaultOpen?: boolean;
  items: NavItem[];
};

const adminMenu: AdminMenuSection[] = [
  {
    groupKey: "admin.nav.overview",
    defaultOpen: true,
    items: [
      { href: "/admin", labelKey: "admin.nav.dashboard", icon: LayoutDashboard },
      { href: "/admin/tasks", labelKey: "admin.nav.tasks", icon: ClipboardList, scope: "AUDIT" },
      { href: "/admin/ai", labelKey: "admin.nav.aiAssistant", icon: Sparkles, scope: "AUDIT" },
    ],
  },
  {
    groupKey: "admin.nav.usersPartners",
    items: [
      { href: "/admin/users", labelKey: "admin.nav.users", icon: Users, scope: "USERS" },
      { href: "/admin/companies", labelKey: "admin.nav.companies", icon: Building2, scope: "COMPANIES" },
      { href: "/admin/profile-statuses", labelKey: "admin.nav.profileStatuses", icon: Trophy, scope: "USERS" },
      { href: "/admin/categories", labelKey: "admin.nav.categories", icon: Tag, scope: "COMPANIES" },
      {
        href: "/admin/company-verifications",
        labelKey: "admin.nav.companyVerification",
        icon: FileCheck,
        scope: "COMPANY_VERIFICATIONS",
        prWorkspace: true,
      },
    ],
  },
  {
    groupKey: "admin.nav.subscriptions",
    items: [
      { href: "/admin/subscriptions", labelKey: "admin.nav.statistics", icon: LayoutDashboard, scope: "COMPANIES" },
      { href: "/admin/growth", labelKey: "admin.nav.growth", icon: Gift, scope: "PR" },
      { href: "/admin/test-screens", labelKey: "admin.nav.testScreens", icon: FlaskConical, scope: "SETTINGS" },
    ],
  },
  {
    groupKey: "admin.nav.prWorkspace",
    items: [
      { href: "/admin/pr", labelKey: "admin.nav.prDesk", icon: Megaphone, scope: "PR", prWorkspace: true },
      { href: "/admin/pr/funnel", labelKey: "admin.nav.prFunnel", icon: ClipboardList, scope: "PR", prWorkspace: true },
      { href: "/admin/pr/companies", labelKey: "admin.nav.prCompanies", icon: Building2, scope: "PR", prWorkspace: true },
      { href: "/admin/pr/payouts", labelKey: "admin.nav.prPayouts", icon: CreditCard, scope: "PR", prWorkspace: true },
      { href: "/admin/company-billing-promos", labelKey: "admin.nav.companyBillingPromos", icon: Gift, scope: "PR", prWorkspace: true },
    ],
  },
  {
    groupKey: "admin.nav.account",
    items: [
      { href: "/admin/pr/settings", labelKey: "admin.nav.prSettings", icon: Settings2, scope: "PR", prWorkspace: true },
    ],
  },
  {
    groupKey: "admin.nav.operations",
    items: [
      { href: "/admin/payments", labelKey: "admin.nav.payments", icon: CreditCard, scope: "FINANCE" },
      { href: "/admin/finance", labelKey: "admin.nav.finance", icon: CreditCard, scope: "FINANCE" },
      { href: "/admin/compliance", labelKey: "admin.nav.compliance", icon: FileCheck, scope: "AUDIT" },
      {
        href: "/admin/leads",
        labelKey: "admin.nav.leads",
        icon: Inbox,
        anyScopes: ["SUPPORT", "PR"],
        prWorkspace: true,
        supportWorkspace: true,
      },
      { href: "/admin/support", labelKey: "admin.nav.support", icon: Headphones, scope: "SUPPORT", supportWorkspace: true },
    ],
  },
  {
    groupKey: "admin.nav.system",
    items: [
      { href: "/admin/system-health", labelKey: "admin.nav.systemHealth", icon: ServerCrash, scope: "AUDIT" },
      { href: "/admin/telegram", labelKey: "admin.nav.telegram", icon: Send, scope: "TELEGRAM" },
      { href: "/admin/audit", labelKey: "admin.nav.audit", icon: Shield, scope: "AUDIT" },
      { href: "/admin/database", labelKey: "admin.nav.database", icon: Database, scope: "DATABASE" },
    ],
  },
] satisfies AdminMenuSection[];

const companyMenuBase: NavItem[] = [
  { href: "/company", label: "Дашборд", icon: LayoutDashboard },
  { href: "/company/clients", label: "Касса и клиенты", icon: QrCode },
  { href: "/company/ai", label: "AI помощник", icon: Sparkles },
  { href: "/company/subscriptions", label: "Подписки", icon: Gift },
  { href: "/company/club", label: "Клуб партнёров", icon: Handshake },
  { href: "/company/loyalty", label: "Уровни и баллы", icon: Trophy },
  { href: "/company/team", label: "Команда", icon: Users },
  { href: "/company/payments", label: "Финансы", icon: CreditCard },
  { href: "/company/billing", label: "Подписка", icon: Gift },
  { href: "/company/compliance", label: "Верификация", icon: FileCheck },
  { href: "/company/settings", label: "Настройки компании", icon: Settings2 },
  { href: "/company/settings/media", label: "Мультимедиа", icon: Images },
  { href: "/company/settings/offers", label: "Акции", icon: Megaphone },
  { href: "/company/settings/socials", label: "Ссылки", icon: Link2 },
  { href: "/company/getting-started", label: "Первый запуск", icon: Rocket },
];

const companyQuickActionsBase: NavItem[] = [
  { href: "/company/settings", label: "Профиль", icon: Settings2 },
  { href: "/company/settings/locations", label: "Адреса", icon: MapPinned },
  { href: "/company/settings/media", label: "Медиа", icon: Images },
  { href: "/company/settings/offers", label: "Акции", icon: Megaphone },
  { href: "/company/settings/socials", label: "Ссылки", icon: Link2 },
];

const companyMenuSectionsBase: CompanyMenuSection[] = [
  {
    title: "Рабочий стол",
    defaultOpen: true,
    items: companyMenuBase.slice(0, 3),
  },
  {
    title: "Клиенты и команда",
    items: [
      { href: "/company/loyalty", label: "Уровни и баллы", icon: Trophy },
      { href: "/company/team", label: "Команда", icon: Users },
      { href: "/company/club", label: "Клуб партнёров", icon: Handshake },
    ],
  },
  {
    title: "Финансы",
    items: [
      { href: "/company/payments", label: "Финансы", icon: CreditCard },
      { href: "/company/billing", label: "Подписка NearLoy", icon: Gift },
      { href: "/company/subscriptions", label: "Клиентские подписки", icon: Gift },
    ],
  },
  {
    title: "Профиль компании",
    items: [
      { href: "/company/settings", label: "Настройки", icon: Settings2 },
      { href: "/company/settings/media", label: "Мультимедиа", icon: Images },
      { href: "/company/settings/offers", label: "Акции", icon: Megaphone },
      { href: "/company/settings/socials", label: "Ссылки", icon: Link2 },
      { href: "/company/compliance", label: "Верификация", icon: FileCheck },
      { href: "/company/getting-started", label: "Первый запуск", icon: Rocket },
    ],
  },
];

const companyMenuAvailable: NavItem[] = companyMenuBase.filter(
  // #SubNearloyCode: скрываем создание/управление клиентскими и парными подписками в кабинете компании.
  (item) => SUBSCRIPTIONS_ENABLED || (item.href !== "/company/subscriptions" && item.href !== "/company/club"),
);

const companyMenuLocalOnlyHrefs = new Set(["/company/club", "/company/payments"]);
const companyCashierMenuHrefs = ["/company", "/company/clients"];
const companyCashierMenuHrefSet = new Set(companyCashierMenuHrefs);

const COMPANY_WORKSPACE_LABEL = "Кабинет компании";
const COMPANY_PARTNER_LABEL = "Кабинет партнёра";
const COMPANY_QUICK_ACTIONS_LABEL = "Быстрые действия";

type MenuNotifications = {
  items: Record<string, number>;
  sections: Record<string, number>;
};

function NotificationBadge({ count }: { count?: number }) {
  if (!count || count <= 0) return null;
  return (
    <span className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full border border-cyan-200/35 bg-cyan-300/12 px-1.5 text-[10px] font-semibold leading-none text-cyan-100 shadow-[0_0_10px_rgba(103,232,249,0.12)]">
      {count > 20 ? "20+" : count}
    </span>
  );
}

function CompanyBillingSidebarWarning({ warning, onClick }: { warning: ReturnType<typeof getCompanyBillingWarning>; onClick?: () => void }) {
  if (!warning) return null;
  const danger = warning.tone === "danger";
  return (
    <Link
      href="/company/billing"
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 rounded-2xl border p-3 text-sm transition",
        danger
          ? "border-red-300/20 bg-red-400/10 text-red-50 hover:border-red-200/35 hover:bg-red-400/15"
          : "border-amber-300/20 bg-amber-300/10 text-amber-50 hover:border-amber-200/35 hover:bg-amber-300/15",
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
          danger ? "border-red-200/25 bg-red-300/10" : "border-amber-200/25 bg-amber-300/10",
        )}
      >
        <AlertTriangle className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{warning.shortLabel}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{"Перейти к продлению"}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 opacity-60 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
    </Link>
  );
}

function menuLabelForPath(
  pathname: string,
  items: Array<{ href: string; label: string }>,
  fallback: string,
) {
  const exact = items.find((item) => item.href === pathname);
  if (exact) return exact.label;
  return [...items]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname.startsWith(`${item.href}/`))?.label ?? fallback;
}

function isCompanyCashierPathAllowed(pathname: string) {
  return companyCashierMenuHrefs.some((href) => pathname === href || pathname.startsWith(`${href}/`));
}

const companyOnboardingAllowedHrefs = [
  "/company/getting-started",
  "/company/settings",
  "/company/settings/locations",
  "/company/settings/media",
  "/company/settings/offers",
  "/company/settings/socials",
  "/company/billing",
  "/company/compliance",
  "/company/team",
];

function isCompanyOnboardingPathAllowed(pathname: string) {
  return companyOnboardingAllowedHrefs.some((href) => pathname === href || pathname.startsWith(`${href}/`));
}

function fallbackAdminWorkspace(role?: string): AdminWorkspace {
  if (role === "SUPPORT") return "SUPPORT";
  if (role === "MANAGER") return "PR";
  return "ADMIN";
}

function hasAdminScope(profile: AdminNavigationProfile | null, scope: AdminPermissionScope, source: "effective" | "explicit" = "effective") {
  const permissions = source === "explicit" ? profile?.explicitPermissions : profile?.permissions;
  return permissions?.some((permission) => permission.scope === scope && permission.canView) === true;
}

function hasAdminMenuScope(
  item: AdminMenuItem,
  profile: AdminNavigationProfile | null,
  source: "effective" | "explicit" = "effective",
) {
  const scopes = item.anyScopes ?? (item.scope ? [item.scope] : []);
  if (scopes.length === 0) return true;
  return scopes.some((scope) => hasAdminScope(profile, scope, source));
}

function isAdminMenuItemVisible(item: AdminMenuItem, profile: AdminNavigationProfile | null, role?: string) {
  const workspace = profile?.workspace ?? fallbackAdminWorkspace(role);
  if (workspace === "PR") {
    if (item.prWorkspace !== true) return false;
    if (!profile) return role === "MANAGER" || role === "ADMIN" || role === "SUPER_ADMIN";
    return hasAdminMenuScope(item, profile, "explicit");
  }
  if (workspace === "SUPPORT") return item.supportWorkspace === true;
  if (!item.scope && !item.anyScopes) return true;
  if (!profile) return role === "SUPER_ADMIN" || role === "ADMIN";
  return hasAdminMenuScope(item, profile);
}

function adminWorkspaceHome(workspace: AdminWorkspace) {
  if (workspace === "PR") return "/admin/pr";
  if (workspace === "SUPPORT") return "/admin/support";
  return "/admin";
}

function isAdminPathAllowed(pathname: string, allowedHrefs: string[]) {
  return allowedHrefs.some((href) => pathname === href || pathname.startsWith(`${href}/`));
}

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { locale, setLocale, t } = useI18n("ru");
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = pathname.startsWith("/admin");
  const currentRole = typeof window === "undefined" ? undefined : getStoredUser()?.role;
  const [notifications, setNotifications] = useState<MenuNotifications>({ items: {}, sections: {} });
  const [adminNavigation, setAdminNavigation] = useState<AdminNavigationProfile | null>(null);
  const [companyBillingData, setCompanyBillingData] = useState<CompanyBillingData | null>(null);
  const [companyMemberRole, setCompanyMemberRole] = useState<CompanyMemberRole | null>(null);
  const [companyOnboardingRequired, setCompanyOnboardingRequired] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLocalCompanyItems, setShowLocalCompanyItems] = useState(false);
  const adminWorkspace = adminNavigation?.workspace ?? fallbackAdminWorkspace(currentRole);
  const adminHomeHref = adminWorkspaceHome(adminWorkspace);
  const companyMenuByRole =
    !isAdmin && pathname.startsWith("/company") && (companyMemberRole === null || companyMemberRole === "CASHIER")
      ? companyMenuAvailable.filter((item) => companyCashierMenuHrefSet.has(item.href))
      : companyMenuAvailable;
  const visibleCompanyMenu = companyMenuByRole.filter(
    (item) => showLocalCompanyItems || !companyMenuLocalOnlyHrefs.has(item.href),
  );
  const visibleCompanySections = useMemo(() => {
    const visibleHrefs = new Set(visibleCompanyMenu.map((item) => item.href));
    return companyMenuSectionsBase
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => visibleHrefs.has(item.href)),
      }))
      .filter((section) => section.items.length > 0);
  }, [visibleCompanyMenu]);
  const visibleCompanyQuickActions =
    !isAdmin && companyMemberRole !== null && companyMemberRole !== "CASHIER"
      ? companyQuickActionsBase.filter((item) => showLocalCompanyItems || !companyMenuLocalOnlyHrefs.has(item.href))
      : [];
  const adminSections = useMemo(
    () =>
      adminMenu
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => isAdminMenuItemVisible(item, adminNavigation, currentRole)),
        }))
        .filter((section) => section.items.length > 0),
    [adminNavigation, currentRole],
  );
  const menu: NavItem[] = isAdmin
    ? adminSections
        .flatMap((g) => g.items)
        .map((item) => ({ ...item, label: t(item.labelKey) }))
    : [...visibleCompanyMenu, ...visibleCompanyQuickActions];
  const adminAllowedHrefs = useMemo(() => adminSections.flatMap((section) => section.items.map((item) => item.href)), [adminSections]);
  const currentLabel = menuLabelForPath(pathname, menu, isAdmin ? t("admin.layout.workspace") : COMPANY_WORKSPACE_LABEL);
  const billingWarning = getCompanyBillingWarning(companyBillingData);
  const canManageCompanyBilling = !isAdmin && companyMemberRole !== null && companyMemberRole !== "CASHIER";

  useEffect(() => {
    const host = window.location.hostname;
    setShowLocalCompanyItems(host === "localhost" || host === "127.0.0.1" || host === "[::1]");
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setAdminNavigation(null);
      return;
    }

    let active = true;
    async function loadAdminNavigation() {
      try {
        const response = await fetchWithAuthRecovery("/api/admin/navigation", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as AdminNavigationProfile;
        if (active) setAdminNavigation(data);
      } catch {
        // Navigation falls back to a conservative role-based menu.
      }
    }

    void loadAdminNavigation();
    return () => {
      active = false;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || !adminNavigation) return;
    if (adminNavigation.workspace !== "ADMIN" && !isAdminPathAllowed(pathname, adminAllowedHrefs)) {
      router.replace(adminHomeHref);
    }
  }, [adminAllowedHrefs, adminHomeHref, adminNavigation, isAdmin, pathname, router]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;

    async function loadNotifications() {
      try {
        const res = await fetchWithAuthRecovery("/api/admin/menu-notifications", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as MenuNotifications;
        if (active) setNotifications({ items: data.items ?? {}, sections: data.sections ?? {} });
      } catch {
        // Menu counters are helpful, but navigation must never break because of them.
      }
    }

    void loadNotifications();
    const interval = window.setInterval(loadNotifications, 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin || !pathname.startsWith("/company")) {
      setCompanyMemberRole(null);
      setCompanyOnboardingRequired(false);
      return;
    }

    let active = true;

    async function loadCompanyAccess() {
      try {
        const profile = await companyProfile();
        if (!active) return;
        setCompanyMemberRole(profile.member.role);
        if (profile.member.role === "CASHIER") {
          setCompanyOnboardingRequired(false);
          return;
        }
        const locations = await companyLocations().catch(() => []);
        if (!active) return;
        const profileReady = Boolean(profile.company.name.trim() && profile.company.description?.trim() && profile.company.categories.length);
        const locationReady = Boolean(profile.company.operatesOnline || locations.some((location) => location.isActive));
        setCompanyOnboardingRequired(!profileReady || !locationReady);
      } catch {
        if (active) {
          setCompanyMemberRole(null);
          setCompanyOnboardingRequired(false);
        }
      }
    }

    void loadCompanyAccess();

    return () => {
      active = false;
    };
  }, [isAdmin, pathname]);

  useEffect(() => {
    if (isAdmin || companyMemberRole !== "CASHIER" || !pathname.startsWith("/company")) return;
    if (!isCompanyCashierPathAllowed(pathname)) {
      router.replace("/company/clients");
    }
  }, [companyMemberRole, isAdmin, pathname, router]);

  useEffect(() => {
    if (isAdmin || !pathname.startsWith("/company") || !companyOnboardingRequired || companyMemberRole === "CASHIER") return;
    if (!isCompanyOnboardingPathAllowed(pathname)) {
      router.replace("/company/getting-started");
    }
  }, [companyMemberRole, companyOnboardingRequired, isAdmin, pathname, router]);

  useEffect(() => {
    if (isAdmin || !pathname.startsWith("/company")) {
      setCompanyBillingData(null);
      return;
    }

    let active = true;
    companyBilling()
      .then((data) => {
        if (active) setCompanyBillingData(data);
      })
      .catch(() => {
        if (active) setCompanyBillingData(null);
      });

    return () => {
      active = false;
    };
  }, [isAdmin, pathname]);

  function isItemActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    if (href === "/company") return pathname === "/company";
    if (href === "/company/settings") return pathname === "/company/settings";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function handleLogout() {
    clearStoredSession();
    setMobileMenuOpen(false);
    router.replace("/login");
  }

  const mobilePrimaryItems = isAdmin
    ? menu.slice(0, 4)
    : visibleCompanyMenu.slice(0, 4);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="mx-auto grid w-full max-w-[1600px] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden border-b border-white/10 bg-muted/10 p-4 [scrollbar-width:none] lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r [&::-webkit-scrollbar]:hidden">
          <Link href={isAdmin ? adminHomeHref : "/company"} className="mb-5 flex items-center gap-3">
            <NearLoyLogo />
            <div>
              <p className="text-xl font-semibold tracking-tight">NearLoy</p>
              <p className="text-xs text-muted-foreground">{isAdmin ? t("admin.layout.workspace") : COMPANY_PARTNER_LABEL}</p>
            </div>
          </Link>
          {isAdmin && <LanguageSwitcher locale={locale} onChange={setLocale} className="mb-5" />}

          {isAdmin ? (
            <div className="space-y-2">
              {adminSections.map((section) => {
                const sectionActive = section.items.some((item) => isItemActive(item.href));
                return (
                  <details key={section.groupKey} open={Boolean(section.defaultOpen || sectionActive)} className="group rounded-2xl border border-white/0 open:border-white/10 open:bg-white/[0.03]">
                    <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-white/[0.04] [&::-webkit-details-marker]:hidden">
                      <span className="truncate">{t(section.groupKey)}</span>
                      <span className="flex h-[18px] min-w-[18px] items-center justify-center">
                        <NotificationBadge count={notifications.sections[section.groupKey]} />
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="space-y-1 px-2 pb-2">
                      {section.items.map(({ href, labelKey, icon: Icon }) => {
                        const active = isItemActive(href);
                        return (
                          <Link
                            key={href}
                            href={href}
                            className={cn(
                              "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
                              active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/20",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            <span className="truncate">{t(labelKey)}</span>
                            <NotificationBadge count={notifications.items[href]} />
                          </Link>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {visibleCompanyQuickActions.length > 0 && (
                <div className="rounded-3xl border border-cyan-200/15 bg-cyan-200/[0.035] p-3">
                  <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-cyan-100/80">{COMPANY_QUICK_ACTIONS_LABEL}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {visibleCompanyQuickActions.map(({ href, label, icon: Icon }) => {
                      const active = isItemActive(href);
                      return (
                        <Link
                          key={href}
                          href={href}
                          className={cn(
                            "flex flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2 text-center text-[11px] font-semibold transition",
                            active
                              ? "border-cyan-200/35 bg-cyan-200/12 text-cyan-50"
                              : "border-white/10 bg-black/18 text-muted-foreground hover:border-white/18 hover:bg-white/[0.06] hover:text-foreground",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="max-w-full truncate">{label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
              {visibleCompanySections.map((section) => {
                const sectionActive = section.items.some((item) => isItemActive(item.href));
                return (
                  <details key={section.title} open={Boolean(section.defaultOpen || sectionActive)} className="group rounded-2xl border border-white/0 open:border-white/10 open:bg-white/[0.03]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-white/[0.04] [&::-webkit-details-marker]:hidden">
                      <span className="truncate">{section.title}</span>
                      <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="space-y-1 px-2 pb-2">
                      {section.items.map(({ href, label, icon: Icon }) => {
                        const active = isItemActive(href);
                        return (
                          <Link
                            key={href}
                            href={href}
                            className={cn(
                              "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
                              active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/20",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            <span className="truncate">{label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
          <div className="mt-auto space-y-3">
            {canManageCompanyBilling && <CompanyBillingSidebarWarning warning={billingWarning} />}
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5 text-sm text-muted-foreground transition hover:border-white/20 hover:bg-white/[0.08] hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              {t("admin.layout.logout")}
            </button>
          </div>
        </aside>

        <main className="min-w-0 px-4 pb-24 pt-20 sm:px-6 lg:px-8 lg:py-7">
          <div className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-background/88 px-4 py-3 backdrop-blur-xl lg:hidden">
            <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3">
              <Link href={isAdmin ? adminHomeHref : "/company"} className="flex min-w-0 items-center gap-3">
                <NearLoyLogo className="h-9 w-9 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">NearLoy</p>
                  <p className="truncate text-xs text-muted-foreground">{currentLabel}</p>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold"
                aria-label="Open navigation menu"
              >
                <Menu className="h-4 w-4" />
                {t("admin.layout.mobileMenu")}
              </button>
            </div>
          </div>

          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-background/90 px-3 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] pt-2 backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
          {mobilePrimaryItems.map(({ href, label, icon: Icon }) => {
            const active = isItemActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] transition",
                  active ? "bg-white text-black" : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="max-w-full truncate px-1">{label}</span>
                <span className="absolute right-2 top-2">
                  <NotificationBadge count={notifications.items[href]} />
                </span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
          >
            <MoreHorizontal className="h-4 w-4" />
            <span>{t("admin.layout.mobileMore")}</span>
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[86dvh] overflow-y-auto rounded-t-[2rem] border border-white/10 bg-background p-4 shadow-[0_-24px_80px_rgba(0,0,0,0.55)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <NearLoyLogo className="h-10 w-10" />
                <div>
                  <p className="font-semibold">NearLoy</p>
                  <p className="text-xs text-muted-foreground">{isAdmin ? t("admin.layout.navigation") : COMPANY_PARTNER_LABEL}</p>
                </div>
              </div>
              {isAdmin && <LanguageSwitcher locale={locale} onChange={setLocale} />}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]"
                aria-label="Close navigation menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isAdmin ? (
              <div className="space-y-3 pb-4">
                {adminSections.map((section) => (
                  <section key={section.groupKey} className="rounded-3xl border border-white/10 bg-white/[0.035] p-3">
                    <div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <span className="truncate">{t(section.groupKey)}</span>
                      <NotificationBadge count={notifications.sections[section.groupKey]} />
                    </div>
                    <div className="grid gap-2">
                      {section.items.map(({ href, labelKey, icon: Icon }) => {
                        const active = isItemActive(href);
                        return (
                          <Link
                            key={href}
                            href={href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={cn(
                              "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-3 py-3 text-sm transition",
                              active ? "bg-white text-black" : "bg-black/18 text-muted-foreground hover:bg-white/[0.07] hover:text-foreground",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            <span className="truncate">{t(labelKey)}</span>
                            <NotificationBadge count={notifications.items[href]} />
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="space-y-3 pb-4">
                {visibleCompanyQuickActions.length > 0 && (
                  <section className="rounded-3xl border border-cyan-200/15 bg-cyan-200/[0.035] p-3">
                    <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-cyan-100/80">{COMPANY_QUICK_ACTIONS_LABEL}</div>
                    <div className="grid grid-cols-3 gap-2">
                      {visibleCompanyQuickActions.map(({ href, label, icon: Icon }) => {
                        const active = isItemActive(href);
                        return (
                          <Link
                            key={href}
                            href={href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={cn(
                              "flex flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-3 text-center text-xs font-semibold transition",
                              active ? "border-cyan-200/35 bg-cyan-200/12 text-cyan-50" : "border-white/10 bg-black/18 text-muted-foreground",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            <span className="max-w-full truncate">{label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                )}
                {visibleCompanySections.map((section) => (
                  <section key={section.title} className="rounded-3xl border border-white/10 bg-white/[0.035] p-3">
                    <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section.title}</div>
                    <div className="grid gap-2">
                      {section.items.map(({ href, label, icon: Icon }) => {
                        const active = isItemActive(href);
                        return (
                          <Link
                            key={href}
                            href={href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={cn(
                              "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition",
                              active ? "bg-white text-black" : "bg-black/18 text-muted-foreground hover:bg-white/[0.07] hover:text-foreground",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            <span className="truncate">{label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                ))}
                {canManageCompanyBilling && (
                  <CompanyBillingSidebarWarning warning={billingWarning} onClick={() => setMobileMenuOpen(false)} />
                )}
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-muted-foreground transition hover:bg-white/[0.08] hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              {t("admin.layout.logout")}
            </button>
          </div>
        </div>
      )}
      <AuthRecoveryOverlay />
    </div>
  );
}

