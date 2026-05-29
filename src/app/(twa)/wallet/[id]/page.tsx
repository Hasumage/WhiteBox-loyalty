"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, Award, ChevronRight, CircleDollarSign, Clock3, MapPin, Navigation, Sparkles } from "lucide-react";
import { getCachedTwaCompanies, getCachedTwaMarketplace, getTwaCompanies, getTwaMarketplace, type TwaCompany, type TwaSubscriptionPlan } from "@/lib/api/twa-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { cn } from "@/lib/utils";
import { TwaLoadingScreen } from "@/components/twa/TwaLoadingScreen";
import { useI18n } from "@/lib/i18n/use-i18n";
import { formatPlanPrice as formatLocalizedPlanPrice, interpolate } from "@/lib/i18n/format";
import { categoryName } from "@/lib/i18n/categories";
import type { TranslateFn } from "@/lib/i18n/format";

const DEFAULT_WORKING_DAYS = [0, 1, 2, 3, 4, 5, 6];

function isExpiringSoon(date: string | null) {
  if (!date) return false;
  const diff = new Date(date).getTime() - Date.now();
  return diff > 0 && diff <= 14 * 24 * 60 * 60 * 1000;
}

function formatPlanPrice(plan: TwaSubscriptionPlan, t: TranslateFn) {
  return formatLocalizedPlanPrice(plan.price, plan.renewalUnit, t);
}

function companyCategorySlugs(company: TwaCompany) {
  return new Set([company.category, ...company.categories].filter(Boolean).map((category) => category.slug));
}

function planBelongsToCompany(plan: TwaSubscriptionPlan, company: TwaCompany) {
  if (plan.company?.id === company.id) return true;
  if (!plan.company && plan.category?.slug) return companyCategorySlugs(company).has(plan.category.slug);
  return false;
}

function mapLocationHref(company: TwaCompany, locationUuid: string) {
  return `/map?company=${encodeURIComponent(String(company.id))}&location=${encodeURIComponent(locationUuid)}`;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function isLocationOpenNow(location: TwaCompany["locations"][number], now = new Date()) {
  const day = now.getDay();
  const workingDays = Array.isArray(location.workingDays) ? location.workingDays : DEFAULT_WORKING_DAYS;
  if (!workingDays.includes(day)) return false;
  const open = timeToMinutes(location.openTime ?? "09:00");
  const close = timeToMinutes(location.closeTime ?? "21:00");
  if (open == null || close == null) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  if (open === close) return true;
  if (open < close) return current >= open && current < close;
  return current >= open || current < close;
}

function routeHref(location: TwaCompany["locations"][number]) {
  return `https://yandex.ru/maps/?rtext=~${location.latitude},${location.longitude}&rtt=auto`;
}

export default function WalletPage() {
  const { locale, t } = useI18n("ru");
  const params = useParams();
  const id = String(params.id ?? "");
  const [companies, setCompanies] = useState<TwaCompany[]>([]);
  const [plans, setPlans] = useState<TwaSubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    const cachedCompanies = getCachedTwaCompanies();
    const cachedMarketplace = getCachedTwaMarketplace();
    if (cachedCompanies.length) {
      setCompanies(cachedCompanies);
      setPlans(cachedMarketplace.subscriptions);
      setLoading(false);
    }
    void Promise.all([getTwaCompanies(), getTwaMarketplace()]).then(([apiCompanies, marketplace]) => {
      if (ignore) return;
      setCompanies(apiCompanies);
      setPlans(marketplace.subscriptions);
      setLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, []);

  const company = useMemo(
    () => companies.find((item) => String(item.id) === id || item.slug === id) ?? null,
    [companies, id],
  );

  const partnerSubscriptions = useMemo(
    () => (company ? plans.filter((plan) => planBelongsToCompany(plan, company)) : []),
    [company, plans],
  );

  if (loading && companies.length === 0) {
    return <TwaLoadingScreen title={t("client.wallet.loadingTitle")} subtitle={t("client.wallet.loadingSubtitle")} />;
  }

  if (!company) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex min-h-full flex-col items-center justify-center px-6"
      >
        <p className="mb-4 text-muted-foreground">{t("client.wallet.notFound")}</p>
        <Button asChild variant="secondary">
          <Link href="/">{t("client.common.backHome")}</Link>
        </Button>
      </motion.div>
    );
  }

  const progressPercent = company.level.progressPercent;
  const showExpiring =
    company.points.expiringPoints != null &&
    company.points.expiringPoints > 0 &&
    isExpiringSoon(company.points.expiringDate);
  const categories = [company.category, ...company.categories].filter(Boolean);
  const mainLocation = company.locations.find((location) => location.isMain) ?? company.locations[0] ?? null;
  const branchLocations = company.locations.filter((location) => location.uuid !== mainLocation?.uuid);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="min-h-full px-4 pb-6 pt-4"
    >
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("client.common.back")}
      </Link>

      <motion.section
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="mb-6"
      >
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">{company.name}</p>
          {categories.slice(0, 3).map((category) => (
            <Badge key={category.slug} variant="secondary" className="inline-flex items-center gap-1 text-[10px] font-normal">
              <CategoryIcon iconName={category.icon ?? "Circle"} className="h-3 w-3" />
              {categoryName(category, t)}
            </Badge>
          ))}
        </div>
        <p className="text-4xl font-bold tracking-tight tabular-nums text-primary">
          {company.points.balance}
          <span className="ml-2 text-lg font-normal text-muted-foreground">{t("client.common.pointsShort")}</span>
        </p>
        <div className="mt-3 space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{company.level.current?.levelName ?? t("client.common.member")}</span>
            <span>{company.level.next ? `${company.level.next.pointsToNext} ${t("client.common.ptsLeft")}` : t("client.common.topLevel")}</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      </motion.section>

      {mainLocation && (
        <motion.section
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.07 }}
          className="mb-6"
        >
          <Card className="glass overflow-hidden border-white/10">
            <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <CardTitle className="text-sm font-semibold">{t("client.wallet.locations")}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">{t("client.wallet.locationsSubtitle")}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="rounded-2xl border border-primary/25 bg-primary/10 p-3">
                <div className="mb-1 flex items-center gap-2">
                  <Badge className="h-5 px-1.5 text-[10px]">{t("client.wallet.main")}</Badge>
                  {mainLocation.precision && (
                    <span className="text-[10px] text-muted-foreground">{t("client.wallet.precision")}: {mainLocation.precision}</span>
                  )}
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{mainLocation.title ?? company.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{mainLocation.address}</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock3 className="h-3 w-3" />
                      {mainLocation.openTime ?? "09:00"}-{mainLocation.closeTime ?? "21:00"}
                      <span className={cn("font-medium", isLocationOpenNow(mainLocation) ? "text-emerald-300" : "text-muted-foreground")}>
                        {isLocationOpenNow(mainLocation) ? t("client.wallet.openNow") : t("client.wallet.closedNow")}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <Button asChild size="sm" variant="secondary" className="h-8">
                      <Link href={mapLocationHref(company, mainLocation.uuid)}>{t("client.wallet.map")}</Link>
                    </Button>
                    <Button asChild size="sm" className="h-8">
                      <a href={routeHref(mainLocation)} target="_blank" rel="noreferrer">
                        <Navigation className="mr-1 h-3.5 w-3.5" />
                        {t("client.wallet.route")}
                      </a>
                    </Button>
                  </div>
                </div>
              </div>

              {branchLocations.slice(0, 3).map((location) => (
                <div key={location.uuid} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{location.title ?? t("client.common.branch")}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{location.address}</p>
                      <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock3 className="h-3 w-3" />
                        {location.openTime ?? "09:00"}-{location.closeTime ?? "21:00"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <Button asChild size="sm" variant="secondary" className="h-8">
                        <Link href={mapLocationHref(company, location.uuid)}>{t("client.wallet.map")}</Link>
                      </Button>
                      <Button asChild size="sm" className="h-8">
                        <a href={routeHref(location)} target="_blank" rel="noreferrer">
                          <Navigation className="mr-1 h-3.5 w-3.5" />
                          {t("client.wallet.route")}
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {branchLocations.length > 3 && (
                <p className="text-center text-xs text-muted-foreground">
                  {branchLocations.length - 3 === 1
                    ? t("client.wallet.moreLocation")
                    : interpolate(t("client.wallet.moreLocations"), { count: branchLocations.length - 3 })}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.section>
      )}

      <motion.section
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.08 }}
        className="mb-6"
      >
        <Card className="glass overflow-hidden border-white/10">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Award className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-sm font-semibold">{t("client.wallet.companyLevel")}</CardTitle>
              <p className="text-xs text-muted-foreground">{interpolate(t("client.wallet.spendStatus"), { company: company.name })}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">{t("client.wallet.current")}</p>
                  <p className="text-lg font-semibold">{company.level.current?.levelName ?? t("client.common.member")}</p>
                </div>
                <Badge className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  {company.level.current?.cashbackPercent ?? 0}% {t("client.wallet.cashback")}
                </Badge>
              </div>
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{company.level.totalSpentPoints} {t("client.wallet.levelPts")}</span>
                  <span>{company.level.next ? `${company.level.next.minTotalSpend} ${t("client.wallet.next")}` : t("client.wallet.maxed")}</span>
                </div>
                <Progress value={company.level.progressPercent} className="h-2" />
              </div>
            </div>

            <div className="grid gap-2">
              {company.level.ladder.map((rule) => {
                const reached = company.level.totalSpentPoints >= rule.minTotalSpend;
                const active = company.level.current?.id === rule.id;
                return (
                  <div
                    key={rule.id}
                    className={cn(
                      "flex items-center justify-between rounded-xl border px-3 py-2 text-sm",
                      active
                        ? "border-primary/50 bg-primary/10"
                        : reached
                          ? "border-emerald-400/30 bg-emerald-500/5"
                          : "border-white/10 bg-white/[0.02]",
                    )}
                  >
                    <div>
                      <p className="font-medium">{rule.levelName}</p>
                      <p className="text-xs text-muted-foreground">{interpolate(t("client.wallet.fromLevelPts"), { count: rule.minTotalSpend })}</p>
                    </div>
                    <span className="text-xs font-medium text-primary">{rule.cashbackPercent}%</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.section>

      {partnerSubscriptions.length > 0 && (
        <motion.section
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.12 }}
          className="mb-6"
        >
          <Card className="glass overflow-hidden border-white/10">
            <CardHeader className="border-b border-white/10 bg-white/[0.03] pb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <CircleDollarSign className="h-5 w-5 text-primary" />
                    {t("client.wallet.partnerSubscriptions")}
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {interpolate(t("client.wallet.partnerSubscriptionsSubtitle"), { company: company.name })}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {partnerSubscriptions.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 p-3">
              {partnerSubscriptions.map((sub) => (
                <Link key={sub.uuid} href={`/marketplace/${sub.uuid}`} className="block">
                  <div className="group rounded-2xl border border-white/10 bg-background/45 p-3 transition-all hover:border-primary/35 hover:bg-primary/5 active:scale-[0.99]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                        {sub.category ? (
                          <CategoryIcon iconName={sub.category.icon ?? "Circle"} className="h-5 w-5" />
                        ) : (
                          <CircleDollarSign className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold">{sub.name}</p>
                          {sub.isOwned && <Badge className="h-5 shrink-0 px-1.5 text-[10px]">{t("client.common.active")}</Badge>}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            {formatPlanPrice(sub, t)}
                          </Badge>
                          {sub.category && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                              <CategoryIcon iconName={sub.category.icon ?? "Circle"} className="h-3 w-3" />
                              {categoryName(sub.category, t)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </motion.section>
      )}

      {showExpiring && (
        <motion.section initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
          <Card className={cn("glass border-amber-500/30 bg-amber-500/5")}>
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <AlertCircle className="h-5 w-5 text-amber-400" />
              <h2 className="text-sm font-semibold text-amber-200">{t("client.wallet.expiringSoon")}</h2>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {interpolate(t("client.wallet.expiringCopy"), {
                  points: company.points.expiringPoints ?? 0,
                  date: company.points.expiringDate ? new Date(company.points.expiringDate).toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US") : "",
                })}
              </p>
            </CardContent>
          </Card>
        </motion.section>
      )}
    </motion.div>
  );
}
