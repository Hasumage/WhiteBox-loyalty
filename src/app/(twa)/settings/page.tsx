"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BriefcaseBusiness,
  Compass,
  Copy,
  Flame,
  Gift,
  Handshake,
  Heart,
  LockKeyhole,
  MessageSquareText,
  PanelTop,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Target,
  Ticket,
  Trophy,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { TwaLoadingScreen } from "@/components/twa/TwaLoadingScreen";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { getStoredUser, type StoredUser } from "@/lib/api/auth-client";
import { getCachedFavoriteCategorySlugs, getCachedRegisteredCategories, getFavoriteCategorySlugs, getRegisteredCategories } from "@/lib/api/categories-client";
import {
  getCachedTwaDashboard,
  getCachedTwaProfile,
  getTwaDashboard,
  getTwaProfile,
  getUserProfileStatuses,
  redeemTwaPromoCode,
  redeemTwaReferralCode,
  type UserProfileStatusState,
  type TwaProfile,
} from "@/lib/api/twa-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import { interpolate } from "@/lib/i18n/format";
import { categoryName } from "@/lib/i18n/categories";
import { ProfileStatusBadge } from "@/components/profile-status/profile-status-view";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/features/subscriptions";

const SHOW_LAUNCH_REFERRALS = false;
const SHOW_LAUNCH_REVIEWS = false;

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

type FavoriteCategoryChip = {
  slug: string;
  name: string;
  icon: string;
};


const fallbackProfile: TwaProfile = {
  user: { uuid: "", name: "", email: "", createdAt: "" },
  preferences: {
    onboardingCompletedAt: null,
    onboardingSkippedAt: null,
    geolocationPromptedAt: null,
    profileVisibility: "PRIVATE",
    marketingOptIn: false,
    showActivityStats: true,
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
  const pathname = usePathname();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [favoriteCategories, setFavoriteCategories] = useState<FavoriteCategoryChip[]>([]);
  const [profile, setProfile] = useState<TwaProfile>(fallbackProfile);
  const [promoCode, setPromoCode] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
    if (cachedFavoriteList.length) setFavoriteCategories(cachedFavoriteList);
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
      setFavoriteCategories(favoriteList);
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

  useEffect(() => {
    function scrollToHash() {
      const raw = window.location.hash.replace(/^#/, "");
      if (!raw) return;
      const id = decodeURIComponent(raw);
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, [pathname]);

  const favoriteSummary = useMemo(
    () =>
      favoriteCategories.length === 0
        ? t("client.profile.noFavorites")
        : interpolate(t("client.profile.categoriesSelected"), { count: favoriteCategories.length }),
    [favoriteCategories.length, t],
  );

  const activityLabel =
    profile.stats.activityScore >= 75
      ? t("client.profile.goldRhythm")
      : profile.stats.activityScore >= 40
        ? t("client.profile.silverRhythm")
        : t("client.profile.starterRhythm");
  const activityTone =
    profile.stats.activityScore >= 75
      ? t("client.profile.loyaltyPro")
      : profile.stats.activityScore >= 40
        ? t("client.profile.momentum")
        : t("client.profile.firstSteps");
  const scoreProgress = Math.max(4, Math.min(100, profile.stats.activityScore));
  const nextActions = useMemo(() => {
    const actions: Array<{ href: string; label: string; detail: string; icon: typeof Heart; done: boolean }> = [
      {
        href: "/settings/favorites",
        label: t("client.profile.chooseFavorites"),
        detail: t("client.profile.tuneRecommendations"),
        icon: Heart,
        done: profile.stats.favoriteCategories > 0,
      },
      {
        href: "/companies",
        label: t("client.profile.visitPartners"),
        detail: t("client.profile.startEarning"),
        icon: Store,
        done: profile.stats.partnerCount > 0,
      },
      ...(SUBSCRIPTIONS_ENABLED
        ? [{
            href: "/marketplace",
            label: t("client.profile.trySubscriptions"),
            detail: t("client.profile.unlockPerks"),
            icon: Ticket,
            done: profile.stats.activeSubscriptions > 0,
          }]
        : []),
    ];
    return actions.sort((a, b) => Number(a.done) - Number(b.done));
  }, [profile.stats.activeSubscriptions, profile.stats.favoriteCategories, profile.stats.partnerCount, t]);
  const primaryAction = nextActions.find((action) => !action.done) ?? nextActions[0];

  async function redeemPromo() {
    if (!promoCode.trim()) return;
    setBusy(true);
    setMessage(null);
    const res = await redeemTwaPromoCode(promoCode);
    setBusy(false);
    if (!res.ok) {
      setMessage(res.message);
      return;
    }
    setPromoCode("");
    setMessage(res.data.message);
    setProfile(await getTwaProfile());
  }

  async function redeemReferral() {
    if (!referralCode.trim()) return;
    setBusy(true);
    setMessage(null);
    const res = await redeemTwaReferralCode(referralCode);
    setBusy(false);
    if (!res.ok) {
      setMessage(res.message);
      return;
    }
    setReferralCode("");
    setMessage(res.data.message);
    setProfile(await getTwaProfile());
  }

  async function copyReferralCode() {
    if (!profile.referral.code) return;
    await navigator.clipboard?.writeText(profile.referral.code).catch(() => undefined);
    setMessage(t("client.profile.referralCopied"));
  }

  if (loading) {
    return <TwaLoadingScreen title={t("client.profile.loadingTitle")} subtitle={t("client.profile.loadingSubtitle")} />;
  }

  const displayName = user?.name ?? profile.user.name ?? t("client.profile.guest");
  const selectedStatus = profileStatusState?.selectedStatus;
  const newStatusCount = profileStatusState?.summary.new ?? 0;
  const metrics = [
    { label: t("client.profile.partners"), value: profile.stats.partnerCount, icon: Store },
    ...(SUBSCRIPTIONS_ENABLED ? [{ label: t("client.profile.subs"), value: profile.stats.activeSubscriptions, icon: WalletCards }] : []),
    { label: t("client.profile.favorites"), value: profile.stats.favoriteCategories, icon: Heart },
  ];
  const quickLinks = [
    {
      href: "/settings/account",
      label: t("client.profile.accountSettings"),
      detail: t("client.profile.accountSettingsSubtitle"),
      icon: LockKeyhole,
      accent: "from-cyan-300/18 to-white/[0.04]",
    },
    {
      href: "/settings/statuses",
      label: t("client.profile.profileStatus"),
      detail: t("client.profile.profileStatusDescription"),
      icon: Trophy,
      accent: "from-amber-300/18 to-white/[0.04]",
      badge: newStatusCount ? interpolate(t("client.profile.newStatuses"), { count: newStatusCount }) : null,
    },
    {
      href: "/settings/favorites",
      label: t("client.profile.favoriteCategories"),
      detail: favoriteSummary,
      icon: Heart,
      accent: "from-rose-300/16 to-white/[0.04]",
    },
    {
      href: "/companies",
      label: t("client.profile.visitPartners"),
      detail: t("client.profile.startEarning"),
      icon: Store,
      accent: "from-emerald-300/14 to-white/[0.04]",
    },
  ];
  const moreLinks = [
    ...(SHOW_LAUNCH_REVIEWS ? [["/settings/reviews", MessageSquareText, t("client.profile.myReviews"), t("client.profile.myReviewsSubtitle")] as const] : []),
    ["/settings/partnership", ShieldCheck, t("client.profile.partnership"), t("client.profile.partnershipSubtitle")],
    ["/settings/business", BriefcaseBusiness, t("client.profile.forBusiness"), t("client.profile.forBusinessSubtitle")],
    ...(SHOW_LAUNCH_REFERRALS ? [["/settings/company-referrals", Handshake, t("client.profile.companyReferrals"), t("client.profile.companyReferralsSubtitle")] as const] : []),
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
              <p className="mt-2 max-w-[22rem] text-sm leading-relaxed text-muted-foreground">
                {t("client.profile.settingsHubSubtitle")}
              </p>
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

      {message && (
        <div className="rounded-2xl border border-cyan-200/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-50">
          {message}
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{t("client.profile.quickActions")}</h2>
            <p className="text-xs text-muted-foreground">{t("client.profile.quickActionsSubtitle")}</p>
          </div>
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                id={item.href === "/settings/account" ? "settings-block" : undefined}
                className={cn(
                  "group relative min-h-[9.5rem] overflow-hidden rounded-[1.6rem] border border-white/10 bg-slate-950/70 p-3 transition hover:-translate-y-0.5 hover:border-white/20",
                  "bg-gradient-to-br",
                  item.accent,
                )}
              >
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
                <div className="relative flex h-full flex-col justify-between gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-cyan-100">
                      <Icon className="h-5 w-5" />
                    </span>
                    {item.badge ? (
                      <span className="rounded-full bg-cyan-200 px-2 py-0.5 text-[10px] font-bold text-black">{item.badge}</span>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight">{item.label}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs font-semibold text-cyan-100">
                    <span>{t("client.profile.open")}</span>
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <Card className="glass overflow-hidden border-white/10 bg-slate-950/70 p-0">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                <Flame className="h-3.5 w-3.5" />
                {t("client.profile.nearloyPulse")}
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">{activityTone}</h2>
              <p className="mt-1 max-w-[15rem] text-xs leading-relaxed text-muted-foreground">
                {profile.stats.activityScore > 0 ? t("client.profile.nextStepsSubtitle") : t("client.profile.chooseCategories")}
              </p>
            </div>
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl" />
              <div
                className="relative flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-[conic-gradient(var(--primary)_var(--score),rgba(255,255,255,0.1)_0)] p-1 shadow-[0_18px_42px_rgba(0,0,0,0.35)]"
                style={{ "--score": `${scoreProgress}%` } as React.CSSProperties}
              >
                <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-slate-950 text-center">
                  <span className="text-2xl font-bold tabular-nums">{profile.stats.activityScore}</span>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{t("client.profile.pulse")}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{t("client.profile.nextSteps")}</p>
                <p className="text-xs text-muted-foreground">{t("client.profile.nextStepsSubtitle")}</p>
              </div>
              <Badge variant="secondary" className="shrink-0 gap-1 bg-primary/15 text-primary">
                <Trophy className="h-3 w-3" />
                {activityLabel}
              </Badge>
            </div>
            <div className="grid gap-2">
              {nextActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className={cn(
                      "group flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors",
                      action.done
                        ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
                        : "border-white/10 bg-slate-950/40 hover:border-white/20 hover:bg-white/[0.06]",
                    )}
                  >
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", action.done ? "bg-emerald-400/15 text-emerald-200" : "bg-primary/15 text-primary")}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{action.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{action.done ? t("client.profile.done") : action.detail}</span>
                    </span>
                    {action.done ? <Target className="h-4 w-4 shrink-0 text-emerald-200" /> : <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />}
                  </Link>
                );
              })}
            </div>
          </div>

          <Button asChild className="w-full rounded-2xl">
            <Link href={primaryAction.href}>
              <Compass className="mr-2 h-4 w-4" />
              {t("client.profile.boostProfile")}
            </Link>
          </Button>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{t("client.profile.personalization")}</h2>
          <p className="text-xs text-muted-foreground">{t("client.profile.personalizationSubtitle")}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="glass flex min-w-0 flex-col border-cyan-200/20 bg-cyan-300/[0.04]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-cyan-100" />
                {t("client.profile.profileStatus")}
              </CardTitle>
              <CardDescription>{t("client.profile.profileStatusDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3 pb-4">
              {selectedStatus ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("client.profile.currentStatus")}</p>
                  <ProfileStatusBadge rarity={selectedStatus.rarity} icon={selectedStatus.icon} title={selectedStatus.title} className="max-w-full" />
                </div>
              ) : (
                <p className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-muted-foreground">
                  {t("client.profile.noStatusSelected")}
                </p>
              )}
              <Button asChild variant="secondary" className="mt-auto h-auto w-full min-w-0 overflow-hidden rounded-2xl px-3 py-3 !whitespace-normal">
                <Link href="/settings/statuses" className="min-w-0 text-center text-sm leading-snug">
                  <Trophy className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 max-w-full break-words">{t("client.profile.openStatusCollection")}</span>
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="glass flex min-w-0 flex-col border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Heart className="h-4 w-4 text-primary" />
                {t("client.profile.favoriteCategories")}
              </CardTitle>
              <CardDescription>{favoriteSummary}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3 pb-4">
              <div className="flex flex-wrap gap-2">
                {favoriteCategories.length === 0 ? (
                  <span className="max-w-full rounded-2xl border border-dashed border-white/20 px-3 py-2 text-xs leading-5 text-muted-foreground">
                    {t("client.profile.chooseCategories")}
                  </span>
                ) : (
                  favoriteCategories.slice(0, 8).map((cat) => (
                    <span
                      key={cat.slug}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-white px-3 py-1 text-xs font-semibold text-black shadow-[0_0_16px_rgba(255,255,255,0.08)]"
                    >
                      <CategoryIcon iconName={cat.icon} className="h-3.5 w-3.5 text-black" />
                      {categoryName(cat, t)}
                    </span>
                  ))
                )}
              </div>
              <Button asChild variant="secondary" className="mt-auto h-auto w-full min-w-0 overflow-hidden rounded-2xl px-3 py-3 !whitespace-normal">
                <Link href="/settings/favorites" className="min-w-0 text-center text-sm leading-snug">
                  <Heart className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 max-w-full break-words">{t("client.profile.selectFavoriteCategories")}</span>
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="section-payments" className="space-y-3 scroll-mt-6">
        <div>
          <h2 className="text-lg font-semibold">{t("client.profile.rewardsCenter")}</h2>
          <p className="text-xs text-muted-foreground">{t("client.profile.rewardsCenterSubtitle")}</p>
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          <Card className="glass border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Gift className="h-4 w-4 text-primary" />
                {t("client.profile.promoCodes")}
              </CardTitle>
              <CardDescription>{t("client.profile.promoCodesSubtitle")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 pb-4 min-[460px]:grid-cols-[1fr_auto]">
              <Input className="glass border-white/10 uppercase" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder={t("client.profile.promoPlaceholder")} />
              <Button type="button" className="min-[460px]:px-5" disabled={busy || !promoCode.trim()} onClick={redeemPromo}>
                {t("client.profile.apply")}
              </Button>
            </CardContent>
          </Card>

          {SHOW_LAUNCH_REFERRALS ? (
          <Card className="glass border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <UsersRound className="h-4 w-4 text-primary" />
                {t("client.profile.inviteFriends")}
              </CardTitle>
              <CardDescription>
                {profile.referral.isActive
                  ? interpolate(t("client.profile.referralActive"), {
                      inviter: profile.referral.inviterBonusPoints,
                      invited: profile.referral.invitedBonusPoints,
                    })
                  : t("client.profile.inviteFriendsSubtitle")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              <button type="button" onClick={copyReferralCode} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-muted/10 px-3 py-3 text-left">
                <div>
                  <p className="text-xs text-muted-foreground">{t("client.profile.yourReferralCode")}</p>
                  <p className="break-all font-semibold tracking-[0.18em]">{profile.referral.code || "..."}</p>
                </div>
                <Copy className="h-4 w-4 shrink-0 text-primary" />
              </button>
              <div className="grid gap-2 min-[460px]:grid-cols-[1fr_auto]">
                <Input className="glass border-white/10 uppercase" value={referralCode} onChange={(e) => setReferralCode(e.target.value)} placeholder={t("client.profile.referralPlaceholder")} />
                <Button type="button" variant="secondary" className="glass border-white/10 min-[460px]:px-5" disabled={busy || !referralCode.trim()} onClick={redeemReferral}>
                  {t("client.profile.redeem")}
                </Button>
              </div>
            </CardContent>
          </Card>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{t("client.profile.accountAndMore")}</h2>
          <p className="text-xs text-muted-foreground">{t("client.profile.accountAndMoreSubtitle")}</p>
        </div>
        <div className="grid gap-2">
          <Link href="/settings/account" className="flex items-center justify-between rounded-[1.5rem] border border-white/10 bg-card px-4 py-3 transition-colors hover:bg-muted/10">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-primary">
                <Settings className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{t("client.profile.accountSettings")}</p>
                <p className="truncate text-xs text-muted-foreground">{t("client.profile.openAccountPreferences")}</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>

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
        </div>
      </section>
    </motion.div>
  );
}
