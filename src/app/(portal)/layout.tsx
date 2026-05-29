"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentType } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  ChevronDown,
  CreditCard,
  Database,
  FileCheck,
  FlaskConical,
  Gift,
  Handshake,
  Headphones,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  QrCode,
  Rocket,
  Settings2,
  Trophy,
  X,
  Send,
  ServerCrash,
  Shield,
  Tag,
  Users,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { WhiteBoxLogo } from "@/components/brand/WhiteBoxLogo";
import { PageTransition } from "@/components/PageTransition";
import { clearStoredSession, getStoredUser } from "@/lib/api/auth-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";

type PortalIcon = ComponentType<{ className?: string }>;
type AdminMenuItem = { href: string; labelKey: TranslationKey; icon: PortalIcon };
type AdminMenuSection = {
  groupKey: TranslationKey;
  defaultOpen?: boolean;
  items: AdminMenuItem[];
};
type NavItem = { href: string; label: string; icon: PortalIcon };

const adminMenu: AdminMenuSection[] = [
  {
    groupKey: "admin.nav.overview",
    defaultOpen: true,
    items: [{ href: "/admin", labelKey: "admin.nav.dashboard", icon: LayoutDashboard }],
  },
  {
    groupKey: "admin.nav.usersPartners",
    items: [
      { href: "/admin/users", labelKey: "admin.nav.users", icon: Users },
      { href: "/admin/profile-statuses", labelKey: "admin.nav.profileStatuses", icon: Trophy },
      { href: "/admin/companies", labelKey: "admin.nav.companies", icon: Building2 },
      { href: "/admin/categories", labelKey: "admin.nav.categories", icon: Tag },
      { href: "/admin/company-verifications", labelKey: "admin.nav.companyVerification", icon: FileCheck },
    ],
  },
  {
    groupKey: "admin.nav.subscriptions",
    items: [
      { href: "/admin/subscriptions", labelKey: "admin.nav.statistics", icon: LayoutDashboard },
      { href: "/admin/growth", labelKey: "admin.nav.growth", icon: Gift },
      { href: "/admin/test-screens", labelKey: "admin.nav.testScreens", icon: FlaskConical },
    ],
  },
  {
    groupKey: "admin.nav.operations",
    items: [
      { href: "/admin/payments", labelKey: "admin.nav.payments", icon: CreditCard },
      { href: "/admin/finance", labelKey: "admin.nav.finance", icon: CreditCard },
      { href: "/admin/compliance", labelKey: "admin.nav.compliance", icon: FileCheck },
      { href: "/admin/leads", labelKey: "admin.nav.leads", icon: Inbox },
      { href: "/admin/support", labelKey: "admin.nav.support", icon: Headphones },
    ],
  },
  {
    groupKey: "admin.nav.system",
    items: [
      { href: "/admin/system-health", labelKey: "admin.nav.systemHealth", icon: ServerCrash },
      { href: "/admin/telegram", labelKey: "admin.nav.telegram", icon: Send },
      { href: "/admin/audit", labelKey: "admin.nav.audit", icon: Shield },
      { href: "/admin/database", labelKey: "admin.nav.database", icon: Database },
    ],
  },
] satisfies AdminMenuSection[];

const companyMenu: NavItem[] = [
  { href: "/company", label: "Дашборд", icon: LayoutDashboard },
  { href: "/company/clients", label: "Касса и клиенты", icon: QrCode },
  { href: "/company/subscriptions", label: "Подписки", icon: Gift },
  { href: "/company/club", label: "Клуб партнёров", icon: Handshake },
  { href: "/company/loyalty", label: "Уровни и баллы", icon: Trophy },
  { href: "/company/team", label: "Команда", icon: Users },
  { href: "/company/payments", label: "Финансы", icon: CreditCard },
  { href: "/company/compliance", label: "Верификация", icon: FileCheck },
  { href: "/company/settings", label: "Настройки компании", icon: Settings2 },
  { href: "/company/getting-started", label: "Первый запуск", icon: Rocket },
];

const COMPANY_WORKSPACE_LABEL = "Кабинет компании";
const COMPANY_PARTNER_LABEL = "Кабинет партнёра";
const COMPANY_DESK_GROUP_LABEL = "Рабочий стол";
const COMPANY_MANAGEMENT_GROUP_LABEL = "Управление";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menu: NavItem[] = isAdmin
    ? adminMenu
        .flatMap((g) => g.items)
        .filter((item) => currentRole !== "SUPPORT" || item.href === "/admin/support")
        .map((item) => ({ ...item, label: t(item.labelKey) }))
    : companyMenu;
  const currentLabel = menuLabelForPath(pathname, menu, isAdmin ? t("admin.layout.workspace") : COMPANY_WORKSPACE_LABEL);

  const adminSections = useMemo(
    () =>
      adminMenu
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => currentRole !== "SUPPORT" || item.href === "/admin/support"),
        }))
        .filter((section) => section.items.length > 0),
    [currentRole],
  );

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;

    async function loadNotifications() {
      try {
        const res = await fetch("/api/admin/menu-notifications", { cache: "no-store" });
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

  function isItemActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function handleLogout() {
    clearStoredSession();
    setMobileMenuOpen(false);
    router.replace("/login");
  }

  const mobilePrimaryItems = isAdmin
    ? [
        { href: "/admin", label: t("admin.layout.mobileHome"), icon: LayoutDashboard },
        { href: "/admin/users", label: t("admin.nav.users"), icon: Users },
        { href: "/admin/companies", label: t("admin.nav.companies"), icon: Building2 },
        { href: "/admin/company-verifications", label: t("admin.layout.mobileVerify"), icon: FileCheck },
      ].filter((item) => currentRole !== "SUPPORT" || item.href === "/admin/support")
    : companyMenu.slice(0, 4);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="mx-auto grid w-full max-w-[1600px] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden border-b border-white/10 bg-muted/10 p-4 [scrollbar-width:none] lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r [&::-webkit-scrollbar]:hidden">
          <Link href={isAdmin ? "/admin" : "/company"} className="mb-5 flex items-center gap-3">
            <WhiteBoxLogo />
            <div>
              <p className="text-xl font-semibold tracking-tight">WhiteBox</p>
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
            <div className="space-y-5">
              <div>
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{COMPANY_DESK_GROUP_LABEL}</p>
                {menu.slice(0, 3).map(({ href, label, icon: Icon }) => {
                  const active = isItemActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors lg:flex",
                        active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/20",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Link>
                  );
                })}
              </div>
              <div>
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{COMPANY_MANAGEMENT_GROUP_LABEL}</p>
                {menu.slice(3).map(({ href, label, icon: Icon }) => {
                const active = isItemActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors lg:flex",
                      active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/20",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
                })}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="mt-auto inline-flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5 text-sm text-muted-foreground transition hover:border-white/20 hover:bg-white/[0.08] hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            {t("admin.layout.logout")}
          </button>
        </aside>

        <main className="min-w-0 px-4 pb-24 pt-20 sm:px-6 lg:px-8 lg:py-7">
          <div className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-background/88 px-4 py-3 backdrop-blur-xl lg:hidden">
            <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3">
              <Link href={isAdmin ? "/admin" : "/company"} className="flex min-w-0 items-center gap-3">
                <WhiteBoxLogo className="h-9 w-9 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">WhiteBox</p>
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
                <WhiteBoxLogo className="h-10 w-10" />
                <div>
                  <p className="font-semibold">WhiteBox</p>
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
              <div className="grid gap-2 pb-4">
                {companyMenu.map(({ href, label, icon: Icon }) => {
                  const active = isItemActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition",
                        active ? "bg-white text-black" : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Link>
                  );
                })}
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
    </div>
  );
}
