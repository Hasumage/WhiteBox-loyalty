"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { computeSubscriptionProgress } from "@/services/subscriptions/subscription.progress";
import { SubscriptionProgressBar } from "@/components/subscriptions/SubscriptionProgressBar";
import type { ApiCategory } from "@/lib/api/categories-client";
import { getCachedFavoriteCategorySlugs, getFavoriteCategorySlugs } from "@/lib/api/categories-client";
import { getCachedTwaDashboard, getTwaDashboard, type TwaCompany, type TwaDashboard, type TwaUserSubscription } from "@/lib/api/twa-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, ChevronRight, Search, CircleDollarSign, Store } from "lucide-react";
import { CategoryChipStrip } from "@/components/twa/CategoryChipStrip";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { TwaLoadingScreen } from "@/components/twa/TwaLoadingScreen";
import { useI18n } from "@/lib/i18n/use-i18n";
import { interpolate } from "@/lib/i18n/format";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

const HOME_LOYALTY_CARDS_PREVIEW_LIMIT = 4;

function getRenewPeriodDays(subscription: TwaUserSubscription) {
  if (!subscription.expiresAt) return 30;
  const activated = new Date(subscription.activatedAt).getTime();
  const expires = new Date(subscription.expiresAt).getTime();
  const days = Math.ceil((expires - activated) / (24 * 60 * 60 * 1000));
  return Math.max(1, days);
}

function companyCategories(company: TwaCompany) {
  const bySlug = new Map([company.category, ...company.categories].filter(Boolean).map((category) => [category.slug, category]));
  return [...bySlug.values()];
}

export default function HomePage() {
  const { t } = useI18n("ru");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>([]);
  const [dashboard, setDashboard] = useState<TwaDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const totalBalance = dashboard?.wallet.totalBalance ?? 0;

  useEffect(() => {
    let ignore = false;
    const cachedFavorites = getCachedFavoriteCategorySlugs();
    const cachedDashboard = getCachedTwaDashboard();
    if (cachedFavorites.length > 0) setFavoriteSlugs(cachedFavorites);
    if (cachedDashboard.wallet.companies.length || cachedDashboard.activeSubscriptions.length || cachedDashboard.recommendedSubscriptions.length) {
      setDashboard(cachedDashboard);
      setLoading(false);
    }

    void (async () => {
      const [favorites, dashboardData] = await Promise.all([
        getFavoriteCategorySlugs(),
        getTwaDashboard(),
      ]);
      if (ignore) return;
      setFavoriteSlugs(favorites);
      setDashboard(dashboardData);
      setLoading(false);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const displayCategories = useMemo(() => {
    const source = new Map<string, ApiCategory>();
    for (const company of dashboard?.wallet.companies ?? []) {
      if (company.points.totalEarnedPoints <= 0) continue;
      for (const category of companyCategories(company)) {
        source.set(category.slug, category);
      }
    }
    const categories = [...source.values()];
    if (favoriteSlugs.length === 0) return categories;
    const order = new Map(favoriteSlugs.map((slug, idx) => [slug, idx]));
    return categories.sort((a, b) => {
      const ai = order.get(a.slug);
      const bi = order.get(b.slug);
      if (ai === undefined && bi === undefined) return a.name.localeCompare(b.name);
      if (ai === undefined) return 1;
      if (bi === undefined) return -1;
      return ai - bi;
    });
  }, [dashboard?.wallet.companies, favoriteSlugs]);

  const filteredCompanies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const loyaltyCompanies = dashboard?.wallet.companies.filter((company) => company.points.totalEarnedPoints > 0) ?? [];

    return loyaltyCompanies.filter((company) => {
      const categories = companyCategories(company);
      const matchesSearch =
        !query ||
        company.name.toLowerCase().includes(query) ||
        (company.description ?? "").toLowerCase().includes(query) ||
        categories.some((category) => category.name.toLowerCase().includes(query));

      if (!matchesSearch) return false;
      if (selectedCategory && !categories.some((category) => category.slug === selectedCategory)) return false;
      return true;
    });
  }, [dashboard?.wallet.companies, searchQuery, selectedCategory]);

  const displayedCompanies = useMemo(
    () => filteredCompanies.slice(0, HOME_LOYALTY_CARDS_PREVIEW_LIMIT),
    [filteredCompanies]
  );

  const activeSubscriptions = dashboard?.activeSubscriptions ?? [];

  if (loading && !dashboard) {
    return <TwaLoadingScreen />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="min-h-full px-4 pt-6 pb-4"
    >
      {/* Search bar */}
      <motion.section
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="mb-4"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("client.home.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="glass border-white/10 pl-9 h-10 rounded-xl"
          />
        </div>
      </motion.section>

      {/* Category selector — horizontal scroll; only filters company cards */}
      <motion.section
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.08 }}
        className="mb-4 min-w-0"
      >
        <CategoryChipStrip>
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              selectedCategory === null
                ? "bg-primary text-primary-foreground"
                : "glass border border-white/10 text-muted-foreground hover:text-foreground"
            )}
          >
            {t("client.common.all")}
          </button>
          {displayCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() =>
                setSelectedCategory((prev) => (prev === cat.slug ? null : cat.slug))
              }
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                selectedCategory === cat.slug
                  ? "bg-primary text-primary-foreground"
                  : "glass border border-white/10 text-muted-foreground hover:text-foreground"
              )}
            >
              {cat.name}
            </button>
          ))}
        </CategoryChipStrip>
      </motion.section>


      {/* Total Balance */}
      <motion.section
        variants={container}
        initial="hidden"
        animate="show"
        className="mb-6"
      >
        <motion.div variants={item} className="mb-1 text-sm text-muted-foreground">
          {t("client.home.totalBalance")}
        </motion.div>
        <motion.div
          variants={item}
          className="glass flex items-center gap-3 rounded-2xl border border-white/10 p-4"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight tabular-nums">
              {totalBalance.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">{t("client.home.pointsAcrossShops")}</p>
          </div>
        </motion.div>
      </motion.section>

      {/* Active Subscriptions */}
      <motion.section
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t("client.home.activeSubscriptions")}
          </h2>
          <div className="flex items-center gap-1">
            <Link href="/history">
              <Button variant="ghost" size="sm" className="text-muted-foreground text-xs h-8">
                {t("client.home.history")}
              </Button>
            </Link>
            <Link href="/marketplace">
              <Button variant="ghost" size="sm" className="text-primary text-xs h-8">
                {t("client.home.allSubscriptions")}
                <ChevronRight className="h-4 w-4 ml-0.5" />
              </Button>
            </Link>
          </div>
        </div>
        <div className="flex min-w-0 gap-2 overflow-x-auto overflow-y-hidden pb-2 touch-pan-x hide-scrollbar">
          {activeSubscriptions.slice(0, 3).map((activeSubscription) => {
            const plan = activeSubscription.subscription;
            const category = plan.category;
            return (
              <Link key={activeSubscription.id} href={`/marketplace/${plan.uuid}`}>
                <Card className="glass min-w-[160px] border-white/10 transition-all active:scale-[0.98] hover:border-white/20">
                  <CardContent className="p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20 mb-2">
                      {category ? (
                        <CategoryIcon iconName={category.icon ?? "Circle"} className="h-4 w-4 text-primary" />
                      ) : (
                        <CircleDollarSign className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <p className="text-sm font-semibold truncate">{plan.name}</p>
                    <SubscriptionProgressBar
                      progress={computeSubscriptionProgress({
                        expiresAt: activeSubscription.expiresAt ?? activeSubscription.updatedAt,
                        renewPeriodDays: getRenewPeriodDays(activeSubscription),
                      })}
                      className="mt-2"
                    />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </motion.section>

      {/* Loyalty Cards — preview only; category filter applies here only */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <motion.h2
            variants={item}
            className="text-sm font-semibold text-muted-foreground"
          >
            {t("client.home.loyaltyCards")}
          </motion.h2>
          <Link href="/loyalty-cards">
            <Button variant="ghost" size="sm" className="text-primary text-xs h-8">
              {t("client.home.viewAll")}
              <ChevronRight className="h-4 w-4 ml-0.5" />
            </Button>
          </Link>
        </div>
        <motion.div
          variants={container}
          initial={false}
          animate="show"
          className="grid gap-3 sm:grid-cols-2"
        >
          {displayedCompanies.map((company) => {
            const progressPercent = company.level.progressPercent;
            const categories = companyCategories(company).slice(0, 2);

            return (
              <motion.div key={company.id} variants={item}>
                <Link href={`/wallet/${company.id}`}>
                  <Card
                    className={cn(
                      "glass cursor-pointer border-white/10 transition-all active:scale-[0.98] hover:border-white/20"
                    )}
                  >
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 px-4 py-3 pb-1">
                      <div className="min-w-0">
                        <CardTitle className="text-base font-semibold truncate">
                          {company.name}
                        </CardTitle>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {categories.map((category) => (
                            <Badge
                              key={category.slug}
                              variant="secondary"
                              className="inline-flex items-center gap-1 text-[10px] font-normal"
                            >
                              <CategoryIcon iconName={category.icon ?? "Circle"} className="h-3 w-3" />
                              {category.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                      <p className="mb-2 text-xl font-bold tabular-nums text-primary">
                        {company.points.balance}
                        <span className="ml-1 text-sm font-normal text-muted-foreground">
                          {t("client.common.pointsShort")}
                        </span>
                      </p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{t("client.home.nextReward")}</span>
                          <span>
                            {company.level.next
                              ? `${company.level.next.pointsToNext} ${t("client.common.ptsLeft")}`
                              : t("client.common.topLevel")}
                          </span>
                        </div>
                        <Progress value={progressPercent} className="h-1.5" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
        {filteredCompanies.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            {t("client.home.noPartnersSearch")}
          </p>
        )}
        {filteredCompanies.length > 0 && filteredCompanies.length > HOME_LOYALTY_CARDS_PREVIEW_LIMIT && (
          <div className="mt-3 text-center">
            <Link href="/loyalty-cards">
              <Button variant="outline" size="sm" className="glass border-white/10">
                {interpolate(t("client.home.viewAllPartners"), { count: filteredCompanies.length })}
              </Button>
            </Link>
          </div>
        )}
      </section>

      <motion.section
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.16 }}
        className="mt-6"
      >
        <Link href="/companies">
          <Card className="glass border-white/10 bg-white/[0.02] transition-all active:scale-[0.98] hover:border-white/20">
            <CardContent className="flex items-center justify-between gap-3 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/20 text-muted-foreground">
                  <Store className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{t("client.home.explorePartners")}</p>
                  <p className="text-xs text-muted-foreground">{t("client.home.explorePartnersSubtitle")}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </motion.section>
    </motion.div>
  );
}
