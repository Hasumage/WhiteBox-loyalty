"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Compass, Copy, Flame, Gift, Heart, Store, Target, Ticket, Trophy, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TwaLoadingScreen } from "@/components/twa/TwaLoadingScreen";
import { getCachedFavoriteCategorySlugs, getCachedRegisteredCategories, getFavoriteCategorySlugs, getRegisteredCategories } from "@/lib/api/categories-client";
import {
  getCachedTwaDashboard,
  getCachedTwaProfile,
  getTwaDashboard,
  getTwaProfile,
  redeemTwaPromoCode,
  redeemTwaReferralCode,
  type TwaProfile,
} from "@/lib/api/twa-client";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/features/subscriptions";
import { interpolate } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/use-i18n";
import { cn } from "@/lib/utils";

const SHOW_LAUNCH_REFERRALS = false;

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

export default function RewardsPage() {
  const { t } = useI18n("ru");
  const [profile, setProfile] = useState<TwaProfile>(fallbackProfile);
  const [promoCode, setPromoCode] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    const cachedFavoriteSet = new Set(getCachedFavoriteCategorySlugs());
    const cachedFavoriteList = getCachedRegisteredCategories().filter((category) => cachedFavoriteSet.has(category.slug));
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
      const favoriteCount = allCategories.filter((category) => favoriteSet.has(category.slug)).length;
      setProfile({
        ...freshProfile,
        stats: {
          ...freshProfile.stats,
          totalBalance: freshProfile.stats.totalBalance || dashboard.wallet.totalBalance,
          partnerCount: freshProfile.stats.partnerCount || dashboard.wallet.companies.length,
          activeSubscriptions: SUBSCRIPTIONS_ENABLED ? freshProfile.stats.activeSubscriptions || dashboard.activeSubscriptions.length : 0,
          favoriteCategories: freshProfile.stats.favoriteCategories || favoriteCount,
          activityScore: freshProfile.stats.activityScore || Math.min(100, Math.round((dashboard.wallet.totalBalance / 5000) * 55 + dashboard.wallet.companies.length * 8 + (SUBSCRIPTIONS_ENABLED ? dashboard.activeSubscriptions.length * 12 : 0))),
        },
      });
      setLoading(false);
    })();

    return () => {
      ignore = true;
    };
  }, []);

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="min-h-full space-y-4 px-4 pb-6 pt-5"
    >
      <section className="relative overflow-hidden rounded-[2rem] border border-amber-200/20 bg-slate-950/80 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(251,191,36,0.20),transparent_34%),radial-gradient(circle_at_100%_10%,rgba(103,232,249,0.14),transparent_30%)]" />
        <div className="relative space-y-4">
          <Badge variant="secondary" className="gap-1.5 border-amber-200/25 bg-amber-300/10 text-amber-100">
            <Gift className="h-3.5 w-3.5" />
            {t("client.profile.rewardsCenter")}
          </Badge>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{t("client.profile.rewardsCenter")}</h1>
              <p className="mt-2 max-w-[24rem] text-sm leading-relaxed text-muted-foreground">{t("client.profile.rewardsCenterSubtitle")}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/25 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">{t("client.profile.pulse")}</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{profile.stats.activityScore}</p>
            </div>
          </div>
        </div>
      </section>

      {message && <div className="rounded-2xl border border-cyan-200/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-50">{message}</div>}

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

      <Card className="glass border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gift className="h-4 w-4 text-primary" />
            {t("client.profile.promoCodes")}
          </CardTitle>
          <CardDescription>{t("client.profile.promoCodesSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 pb-4">
          <Input className="glass h-11 min-w-0 border-white/10 uppercase" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder={t("client.profile.promoPlaceholder")} />
          <Button type="button" className="h-11 w-full" disabled={busy || !promoCode.trim()} onClick={redeemPromo}>
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
            <div className="grid gap-2">
              <Input className="glass h-11 min-w-0 border-white/10 uppercase" value={referralCode} onChange={(e) => setReferralCode(e.target.value)} placeholder={t("client.profile.referralPlaceholder")} />
              <Button type="button" variant="secondary" className="glass h-11 w-full border-white/10" disabled={busy || !referralCode.trim()} onClick={redeemReferral}>
                {t("client.profile.redeem")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </motion.div>
  );
}
