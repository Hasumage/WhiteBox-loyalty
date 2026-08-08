"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Gift,
  Handshake,
  Heart,
  LockKeyhole,
  LogOut,
  MessageSquareText,
  PanelTop,
  Shield,
  ShieldCheck,
  Sparkles,
  Store,
  Ticket,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TwaLoadingScreen } from "@/components/twa/TwaLoadingScreen";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { clearStoredSession, getStoredUser, type StoredUser } from "@/lib/api/auth-client";
import { getCachedFavoriteCategorySlugs, getCachedRegisteredCategories, getFavoriteCategorySlugs, getRegisteredCategories } from "@/lib/api/categories-client";
import {
  getCachedTwaDashboard,
  getCachedTwaProfile,
  getTwaDashboard,
  getTwaProfile,
  getUserProfileStatuses,
  type UserProfileStatusState,
  type TwaProfile,
} from "@/lib/api/twa-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import { interpolate } from "@/lib/i18n/format";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/features/subscriptions";

const SHOW_LAUNCH_REFERRALS = false;
const SHOW_LAUNCH_REVIEWS = false;

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

const fallbackProfile: TwaProfile = {
  user: { uuid: "", name: "", email: "", birthDate: null, birthDateChangedAt: null, birthDateNextChangeAt: null, createdAt: "" },
  preferences: {
    onboardingCompletedAt: null,
    onboardingSkippedAt: null,
    geolocationPromptedAt: null,
    profileVisibility: "PRIVATE",
    marketingOptIn: false,
    showActivityStats: true,
    browserNotificationsEnabled: false,
    geoNotificationsEnabled: false,
  },
  stats: {
    totalBalance: 0,
    partnerCount: 0,
    activeSubscriptions: 0,
    favoriteCategories: 0,
    activityScore: 0,
  },
  favoriteCategories: [],
  referral: {
    code: "",
    title: "Invite a friend",
    inviterBonusPoints: 0,
    invitedBonusPoints: 0,
    isActive: false,
  },
};

export default function SettingsPage() {
  const { locale, setLocale, t } = useI18n("ru");
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [profile, setProfile] = useState<TwaProfile>(fallbackProfile);
  const [loading, setLoading] = useState(true);
  const [profileStatusState, setProfileStatusState] = useState<UserProfileStatusState | null>(null);

  useEffect(() => {
    let ignore = false;
    setUser(getStoredUser());
    const cachedFavoriteSet = new Set(getCachedFavoriteCategorySlugs());
    const cachedFavoriteList = getCachedRegisteredCategories()
      .filter((category) => cachedFavoriteSet.has(category.slug))
      .map((category) => ({ slug: category.slug, name: category.name, icon: category.icon }));
    const cachedProfile = getCachedTwaProfile();
    const cachedDashboard = getCachedTwaDashboard();
    if (cachedProfile.user.uuid || cachedDashboard.wallet.companies.length || (SUBSCRIPTIONS_ENABLED && cachedDashboard.activeSubscriptions.length)) {
      setProfile({
        ...cachedProfile,
        stats: {
          ...cachedProfile.stats,
          totalBalance: cachedProfile.stats.totalBalance || cachedDashboard.wallet.totalBalance,
          partnerCount: cachedProfile.stats.partnerCount || cachedDashboard.wallet.companies.length,
          activeSubscriptions: SUBSCRIPTIONS_ENABLED ? cachedProfile.stats.activeSubscriptions || cachedDashboard.activeSubscriptions.length : 0,
          favoriteCategories: cachedProfile.stats.favoriteCategories || cachedFavoriteList.length,
        },
      });
      setLoading(false);
    }

    void (async () => {
      const [allCategories, favoriteSlugs, dashboard, freshProfile] = await Promise.all([
        getRegisteredCategories(),
        getFavoriteCategorySlugs(),
        getTwaDashboard(),
        getTwaProfile(),
      ]);
      if (ignore) return;
      const favoriteSet = new Set(favoriteSlugs);
      const favoriteList = allCategories
        .filter((c) => favoriteSet.has(c.slug))
        .map((c) => ({ slug: c.slug, name: c.name, icon: c.icon }));
      setProfile({
        ...freshProfile,
        stats: {
          ...freshProfile.stats,
          totalBalance: freshProfile.stats.totalBalance || dashboard.wallet.totalBalance,
          partnerCount: freshProfile.stats.partnerCount || dashboard.wallet.companies.length,
          activeSubscriptions: SUBSCRIPTIONS_ENABLED ? freshProfile.stats.activeSubscriptions || dashboard.activeSubscriptions.length : 0,
          favoriteCategories: freshProfile.stats.favoriteCategories || favoriteList.length,
          activityScore: freshProfile.stats.activityScore || Math.min(100, Math.round((dashboard.wallet.totalBalance / 5000) * 55 + dashboard.wallet.companies.length * 8 + (SUBSCRIPTIONS_ENABLED ? dashboard.activeSubscriptions.length * 12 : 0))),
        },
      });
      setLoading(false);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    void (async () => {
      const response = await getUserProfileStatuses();
      if (!ignore && response.ok) setProfileStatusState(response.data);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  function handleLogout() {
    clearStoredSession();
    router.push("/login");
  }


  if (loading) {
    return <TwaLoadingScreen title={t("client.profile.loadingTitle")} subtitle={t("client.profile.loadingSubtitle")} />;
  }

  const displayName = user?.name ?? profile.user.name ?? t("client.profile.guest");
  const newStatusCount = profileStatusState?.summary.new ?? 0;
  const metrics = [
    { label: t("client.profile.partners"), value: profile.stats.partnerCount, icon: Store },
    // #SubNearloyCode: client subscription metrics are hidden until launch.
    ...(SUBSCRIPTIONS_ENABLED ? [{ label: t("client.profile.subs"), value: profile.stats.activeSubscriptions, icon: WalletCards }] : []),
    { label: t("client.profile.favorites"), value: profile.stats.favoriteCategories, icon: Heart },
  ];
  const quickLinks = [
    {
      href: "/settings/account",
      label: t("client.profile.accountSettings"),
      detail: t("client.profile.accountSettingsSubtitle"),
      icon: LockKeyhole,
      accent: "from-cyan-300/[0.24] via-sky-400/[0.10] to-white/[0.03]",
      glow: "bg-cyan-300/[0.18]",
      iconTone: "border-cyan-200/30 bg-cyan-300/[0.14] text-cyan-50",
      line: "from-transparent via-cyan-200/70 to-transparent",
    },
    {
      href: "/settings/personalization",
      label: t("client.profile.personalization"),
      detail: locale === "ru" ? "Статусы, категории и любимые компании." : "Statuses, categories and favorite companies.",
      icon: Sparkles,
      accent: "from-violet-300/[0.24] via-fuchsia-400/[0.10] to-white/[0.03]",
      glow: "bg-violet-300/[0.18]",
      iconTone: "border-violet-200/30 bg-violet-300/[0.14] text-violet-50",
      line: "from-transparent via-violet-200/70 to-transparent",
      badge: newStatusCount ? interpolate(t("client.profile.newStatuses"), { count: newStatusCount }) : null,
    },
    {
      href: "/companies",
      label: t("client.profile.visitPartners"),
      detail: t("client.profile.startEarning"),
      icon: Store,
      accent: "from-emerald-300/[0.20] via-teal-400/[0.10] to-white/[0.03]",
      glow: "bg-emerald-300/[0.16]",
      iconTone: "border-emerald-200/30 bg-emerald-300/[0.13] text-emerald-50",
      line: "from-transparent via-emerald-200/70 to-transparent",
    },
    {
      href: "/settings/rewards",
      label: t("client.profile.rewardsCenter"),
      detail: t("client.profile.rewardsCenterSubtitle"),
      icon: Gift,
      accent: "from-amber-300/[0.22] via-orange-400/[0.10] to-white/[0.03]",
      glow: "bg-amber-300/[0.16]",
      iconTone: "border-amber-200/30 bg-amber-300/[0.13] text-amber-50",
      line: "from-transparent via-amber-200/70 to-transparent",
    },
  ];
  const moreLinks = [
    ...(SHOW_LAUNCH_REVIEWS ? [["/settings/reviews", MessageSquareText, t("client.profile.myReviews"), t("client.profile.myReviewsSubtitle")] as const] : []),
    ["/settings/partnership", ShieldCheck, t("client.profile.partnership"), t("client.profile.partnershipSubtitle")],
    ["/help/privacy?section=settings-access", Shield, t("client.account.privacyPolicy"), t("client.profile.accountSettingsSubtitle")],
    ...(SHOW_LAUNCH_REFERRALS ? [["/settings/company-referrals", Handshake, t("client.profile.companyReferrals"), t("client.profile.companyReferralsSubtitle")] as const] : []),
    // #SubNearloyCode: marketplace link is hidden until client subscriptions launch.
    ...(SUBSCRIPTIONS_ENABLED ? [["/marketplace", Ticket, t("client.profile.trySubscriptions"), t("client.profile.unlockPerks")] as const] : []),
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="min-h-full space-y-4 px-4 pb-6 pt-5"
    >
      <section
        id="section-profile-header"
        className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/80 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(103,232,249,0.18),transparent_34%),radial-gradient(circle_at_100%_8%,rgba(255,255,255,0.12),transparent_28%)]" />
        <div className="relative space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Badge variant="secondary" className="mb-3 gap-1.5 border-cyan-200/20 bg-cyan-300/10 text-cyan-100">
                <PanelTop className="h-3 w-3" />
                {t("client.profile.profileControls")}
              </Badge>
              <h1 className="text-3xl font-semibold tracking-tight">{t("client.profile.settingsHub")}</h1>
            </div>
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl border border-cyan-200/20 bg-cyan-300/10 text-xl font-bold text-cyan-50 shadow-[0_0_35px_rgba(103,232,249,0.12)]">
              {user?.name ? initials(user.name) : "?"}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{profile.user.email || profile.user.uuid || t("client.profile.guest")}</p>
              </div>
              <LanguageSwitcher locale={locale} onChange={(nextLocale) => void setLocale(nextLocale)} className="shrink-0" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {metrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/[0.04] px-2.5 py-3 text-center">
                    <Icon className="mx-auto mb-1 h-4 w-4 text-primary" />
                    <p className="text-lg font-bold tabular-nums">{metric.value}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{metric.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{t("client.profile.quickActions")}</h2>
            <p className="text-xs text-muted-foreground">{t("client.profile.quickActionsSubtitle")}</p>
          </div>
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            const cardClassName = cn(
              "group relative min-h-[9.5rem] overflow-hidden rounded-[1.6rem] border border-white/25 bg-white/[0.07] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-36px_60px_rgba(255,255,255,0.035),0_18px_46px_rgba(0,0,0,0.26)] backdrop-blur-xl transition duration-500 hover:-translate-y-0.5 hover:border-cyan-100/40 hover:bg-white/[0.10]",
              "bg-gradient-to-br",
              item.accent,
            );
            return (
              <Link key={item.href} href={item.href} id={item.href === "/settings/account" ? "settings-block" : undefined} className={cardClassName}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.34),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.18),transparent_36%,rgba(255,255,255,0.07)_66%,transparent)] opacity-80" />
                <div className="absolute -left-16 top-8 h-28 w-36 rounded-full bg-black/[0.22] blur-3xl transition-transform duration-700 ease-out group-hover:translate-x-24 group-hover:-translate-y-5" />
                <div className="absolute -inset-y-10 -left-24 w-16 rotate-12 bg-white/[0.20] blur-xl transition-transform duration-700 ease-out group-hover:translate-x-80" />
                <div className="absolute inset-[1px] rounded-[1.55rem] border border-white/[0.08]" />
                <div className={cn("absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl transition-transform duration-700 ease-out group-hover:-translate-x-4 group-hover:translate-y-3", item.glow)} />
                <div className={cn("absolute inset-x-8 bottom-0 h-px bg-gradient-to-r opacity-80", item.line)} />
                <div className="relative flex h-full flex-col justify-between gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className={cn("flex h-10 w-10 items-center justify-center rounded-2xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_10px_30px_rgba(0,0,0,0.20)] backdrop-blur-md", item.iconTone)}>
                      <Icon className="h-5 w-5" />
                    </span>
                    {item.badge ? (
                      <span className="rounded-full bg-cyan-200 px-2 py-0.5 text-[10px] font-bold text-black">{item.badge}</span>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight">{item.label}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/68">{item.detail}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs font-semibold text-cyan-50/95">
                    <span>{t("client.profile.open")}</span>
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>


      <section id="settings-access" className="space-y-3 scroll-mt-6">
        <div>
          <h2 className="text-lg font-semibold">{t("client.profile.accountAndMore")}</h2>
          <p className="text-xs text-muted-foreground">{t("client.profile.accountAndMoreSubtitle")}</p>
        </div>
        <div className="grid gap-2">
          {moreLinks.map(([href, Icon, title, description]) => (
            <Link key={href} href={href} className="flex items-center justify-between rounded-[1.5rem] border border-white/10 bg-card px-4 py-3 transition-colors hover:bg-muted/10">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{title}</p>
                  <p className="truncate text-xs text-muted-foreground">{description}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
          <Button
            type="button"
            variant="secondary"
            className="h-auto justify-between rounded-[1.5rem] border border-rose-200/15 bg-rose-300/[0.07] px-4 py-3 text-left text-rose-50 hover:border-rose-200/25 hover:bg-rose-300/[0.11]"
            onClick={handleLogout}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-rose-200/20 bg-rose-200/10 text-rose-100">
                <LogOut className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{t("client.account.logout")}</span>
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-rose-100/55" />
          </Button>
        </div>
      </section>
    </motion.div>
  );
}
