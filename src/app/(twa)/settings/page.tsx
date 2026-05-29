"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  BriefcaseBusiness,
  ChevronDown,
  Compass,
  Copy,
  Flame,
  Heart,
  MessageSquareText,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
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
    if (cachedProfile.user.uuid || cachedDashboard.wallet.companies.length || cachedDashboard.activeSubscriptions.length) {
      setProfile({
        ...cachedProfile,
        stats: {
          ...cachedProfile.stats,
          totalBalance: cachedProfile.stats.totalBalance || cachedDashboard.wallet.totalBalance,
          partnerCount: cachedProfile.stats.partnerCount || cachedDashboard.wallet.companies.length,
          activeSubscriptions: cachedProfile.stats.activeSubscriptions || cachedDashboard.activeSubscriptions.length,
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
          activeSubscriptions: freshProfile.stats.activeSubscriptions || dashboard.activeSubscriptions.length,
          favoriteCategories: freshProfile.stats.favoriteCategories || favoriteList.length,
          activityScore: freshProfile.stats.activityScore || Math.min(100, Math.round((dashboard.wallet.totalBalance / 5000) * 55 + dashboard.wallet.companies.length * 8 + dashboard.activeSubscriptions.length * 12)),
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
      {
        href: "/marketplace",
        label: t("client.profile.trySubscriptions"),
        detail: t("client.profile.unlockPerks"),
        icon: Ticket,
        done: profile.stats.activeSubscriptions > 0,
      },
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="min-h-full px-4 pb-4 pt-6"
    >
      <header id="section-profile-header" className="mb-6 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-primary/20 text-2xl font-bold text-primary ring-2 ring-primary/30" aria-hidden>
          {user?.name ? initials(user.name) : "?"}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{t("client.profile.title")}</h1>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{user?.name ?? profile.user.name ?? t("client.profile.guest")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="secondary" className="bg-primary/15 text-primary"><Star className="h-3 w-3" /> {activityLabel}</Badge>
            <Badge variant="secondary"><WalletCards className="h-3 w-3" /> {profile.stats.totalBalance} {t("client.common.pointsShort")}</Badge>
          </div>
        </div>
      </header>

      {message && <div className="mb-3 rounded-2xl border border-white/10 bg-muted/10 px-4 py-3 text-sm">{message}</div>}

      <div className="grid gap-3">
        <Card className="glass border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("client.profile.languageTitle")}</CardTitle>
            <CardDescription>{t("client.profile.languageDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <LanguageSwitcher locale={locale} onChange={(nextLocale) => void setLocale(nextLocale)} />
          </CardContent>
        </Card>

        <Card className="glass relative overflow-hidden border-cyan-200/20 bg-cyan-300/[0.04]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(103,232,249,0.18),transparent_30%),radial-gradient(circle_at_90%_15%,rgba(251,146,60,0.12),transparent_26%)]" />
          <CardHeader className="relative pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-cyan-100" /> Статус профиля
            </CardTitle>
            <CardDescription>
              Выберите редкий, эпический или легендарный статус под настроение аккаунта.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative space-y-3">
            {profileStatusState?.selectedStatus ? (
              <ProfileStatusBadge
                rarity={profileStatusState.selectedStatus.rarity}
                icon={profileStatusState.selectedStatus.icon}
                title={profileStatusState.selectedStatus.title}
                className="max-w-full"
              />
            ) : (
              <p className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-muted-foreground">
                Статус ещё не выбран. Открытые статусы уже ждут в коллекции.
              </p>
            )}
            <Button asChild variant="secondary" className="w-full rounded-2xl">
              <Link href="/settings/statuses">
                <Trophy className="h-4 w-4" />
                Открыть коллекцию статусов
                {profileStatusState?.summary.new ? (
                  <span className="ml-auto rounded-full bg-cyan-200 px-2 py-0.5 text-xs font-bold text-black">
                    +{profileStatusState.summary.new}
                  </span>
                ) : null}
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="glass relative overflow-hidden border-white/10 bg-slate-950/70">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(255,255,255,0.12),transparent_30%),radial-gradient(circle_at_88%_0%,rgba(34,211,238,0.11),transparent_34%)]" />
          <CardContent className="relative space-y-4 px-4 pb-4 pt-1.5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                  <Flame className="h-3.5 w-3.5" />
                  {t("client.profile.whiteboxPulse")}
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">{activityTone}</h2>
                <p className="mt-1 max-w-[13rem] text-xs leading-relaxed text-muted-foreground">
                  {profile.stats.activityScore > 0
                    ? t("client.profile.nextStepsSubtitle")
                    : t("client.profile.chooseCategories")}
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

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: t("client.profile.partners"), value: profile.stats.partnerCount, icon: Store },
                { label: t("client.profile.subs"), value: profile.stats.activeSubscriptions, icon: WalletCards },
                { label: t("client.profile.favorites"), value: profile.stats.favoriteCategories, icon: Heart },
              ].map((metric) => {
                const Icon = metric.icon;
                return (
                  <div key={metric.label} className="rounded-2xl border border-white/10 bg-black/20 px-2.5 py-3 text-center">
                    <Icon className="mx-auto mb-1 h-4 w-4 text-primary" />
                    <p className="text-lg font-bold tabular-nums">{metric.value}</p>
                    <p className="text-[10px] text-muted-foreground">{metric.label}</p>
                  </div>
                );
              })}
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
                      {action.done ? <Target className="h-4 w-4 shrink-0 text-emerald-200" /> : <ChevronDown className="h-4 w-4 shrink-0 -rotate-90 text-muted-foreground transition-transform group-hover:translate-x-0.5" />}
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

        <Card className="glass border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("client.profile.favoriteCategories")}</CardTitle>
            <CardDescription>{favoriteSummary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {favoriteCategories.length === 0 ? (
                <span className="rounded-full border border-dashed border-white/20 px-3 py-1 text-xs text-muted-foreground">{t("client.profile.chooseCategories")}</span>
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
            <Link href="/settings/favorites" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-muted/10 px-3 py-2 text-sm transition-colors hover:bg-muted/20">
              <Heart className="h-4 w-4 text-primary" /> {t("client.profile.selectFavoriteCategories")}
            </Link>
          </CardContent>
        </Card>

        <Card className="glass border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Ticket className="h-4 w-4 text-primary" /> {t("client.profile.promoCodes")}</CardTitle>
            <CardDescription>{t("client.profile.promoCodesSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input className="glass border-white/10 uppercase" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="PROMO CODE" />
              <Button type="button" disabled={busy || !promoCode.trim()} onClick={redeemPromo}>{t("client.profile.apply")}</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><UsersRound className="h-4 w-4 text-primary" /> {t("client.profile.inviteFriends")}</CardTitle>
            <CardDescription>
              {profile.referral.isActive
                ? interpolate(t("client.profile.referralActive"), {
                    inviter: profile.referral.inviterBonusPoints,
                    invited: profile.referral.invitedBonusPoints,
                  })
                : t("client.profile.inviteFriendsSubtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <button type="button" onClick={copyReferralCode} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-muted/10 px-3 py-3 text-left">
              <div><p className="text-xs text-muted-foreground">{t("client.profile.yourReferralCode")}</p><p className="font-semibold tracking-[0.18em]">{profile.referral.code || "..."}</p></div>
              <Copy className="h-4 w-4 text-primary" />
            </button>
            <div className="flex gap-2">
              <Input className="glass border-white/10 uppercase" value={referralCode} onChange={(e) => setReferralCode(e.target.value)} placeholder="FRIEND CODE" />
              <Button type="button" variant="secondary" className="glass border-white/10" disabled={busy || !referralCode.trim()} onClick={redeemReferral}>{t("client.profile.redeem")}</Button>
            </div>
          </CardContent>
        </Card>

        <Link href="/settings/account" id="settings-block">
          <Card className="glass border-white/10 transition-colors hover:bg-muted/10">
            <CardHeader className="pb-2"><CardTitle className="text-base">{t("client.profile.accountSettings")}</CardTitle><CardDescription>{t("client.profile.accountSettingsSubtitle")}</CardDescription></CardHeader>
            <CardContent><div className="flex items-center gap-2 text-sm text-muted-foreground"><Settings className="h-4 w-4" /> {t("client.profile.openAccountPreferences")}</div></CardContent>
          </Card>
        </Link>

        <Card className="glass border-white/10">
          <CardHeader className="pb-2"><CardTitle className="text-base">{t("client.profile.more")}</CardTitle><CardDescription>{t("client.profile.moreSubtitle")}</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {[
              ["/settings/reviews", MessageSquareText, t("client.profile.myReviews"), t("client.profile.myReviewsSubtitle")],
              ["/settings/partnership", ShieldCheck, t("client.profile.partnership"), t("client.profile.partnershipSubtitle")],
              ["/settings/business", BriefcaseBusiness, t("client.profile.forBusiness"), t("client.profile.forBusinessSubtitle")],
            ].map(([href, Icon, title, description]) => (
              <Link key={href as string} href={href as string} className="flex items-center justify-between rounded-xl border border-white/10 bg-muted/10 px-3 py-3 transition-colors hover:bg-muted/20">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <div><p className="text-sm font-medium">{title as string}</p><p className="text-xs text-muted-foreground">{description as string}</p></div>
                </div>
                <ChevronDown className="h-4 w-4 -rotate-90 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Link href="/companies" className="rounded-xl border border-white/10 bg-muted/10 px-3 py-3 transition-colors hover:bg-muted/20">
          <div className="flex items-center gap-2"><Store className="h-4 w-4 text-primary" /><div><p className="text-sm font-medium">{t("client.home.explorePartners")}</p><p className="text-xs text-muted-foreground">{t("client.home.explorePartnersSubtitle")}</p></div></div>
        </Link>
      </div>
    </motion.div>
  );
}
