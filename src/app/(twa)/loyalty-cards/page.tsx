"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, Search, Wallet } from "lucide-react";
import type { ApiCategory } from "@/lib/api/categories-client";
import { getCachedFavoriteCategorySlugs, getFavoriteCategorySlugs } from "@/lib/api/categories-client";
import { getCachedTwaDashboard, getTwaDashboard, type TwaCompany, type TwaDashboard } from "@/lib/api/twa-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { CategoryChipStrip } from "@/components/twa/CategoryChipStrip";
import { cn } from "@/lib/utils";
import { TwaLoadingScreen } from "@/components/twa/TwaLoadingScreen";
import { useI18n } from "@/lib/i18n/use-i18n";
import { categoryName } from "@/lib/i18n/categories";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/features/subscriptions";

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

function companyCategories(company: TwaCompany) {
  const bySlug = new Map([company.category, ...company.categories].filter(Boolean).map((category) => [category.slug, category]));
  return [...bySlug.values()];
}

export default function LoyaltyCardsPage() {
  const { t } = useI18n("ru");
  const [dashboard, setDashboard] = useState<TwaDashboard | null>(null);
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    const cachedDashboard = getCachedTwaDashboard();
    const cachedFavorites = getCachedFavoriteCategorySlugs();
    if (cachedDashboard.wallet.companies.length || (SUBSCRIPTIONS_ENABLED && cachedDashboard.activeSubscriptions.length)) {
      setDashboard(cachedDashboard);
      setLoading(false);
    }
    if (cachedFavorites.length) setFavoriteSlugs(cachedFavorites);
    void Promise.all([getTwaDashboard(), getFavoriteCategorySlugs()]).then(([dashboardData, favorites]) => {
      if (ignore) return;
      setDashboard(dashboardData);
      setFavoriteSlugs(favorites);
      setLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, []);

  const loyaltyCompanies = useMemo(
    () => dashboard?.wallet.companies.filter((company) => company.points.totalEarnedPoints > 0) ?? [],
    [dashboard?.wallet.companies],
  );

  const categories = useMemo(() => {
    const source = new Map<string, ApiCategory>();
    for (const company of loyaltyCompanies) {
      for (const category of companyCategories(company)) source.set(category.slug, category);
    }
    const values = [...source.values()];
    if (favoriteSlugs.length === 0) return values.sort((a, b) => a.name.localeCompare(b.name));
    const order = new Map(favoriteSlugs.map((slug, idx) => [slug, idx]));
    return values.sort((a, b) => {
      const ai = order.get(a.slug);
      const bi = order.get(b.slug);
      if (ai === undefined && bi === undefined) return a.name.localeCompare(b.name);
      if (ai === undefined) return 1;
      if (bi === undefined) return -1;
      return ai - bi;
    });
  }, [favoriteSlugs, loyaltyCompanies]);

  const filteredCompanies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return loyaltyCompanies.filter((company) => {
      const companyCategoryList = companyCategories(company);
      const matchesSearch =
        !query ||
        company.name.toLowerCase().includes(query) ||
        (company.description ?? "").toLowerCase().includes(query) ||
        companyCategoryList.some((category) =>
          `${category.name} ${categoryName(category, t)}`.toLowerCase().includes(query),
        );

      if (!matchesSearch) return false;
      if (selectedCategory && !companyCategoryList.some((category) => category.slug === selectedCategory)) return false;
      return true;
    });
  }, [loyaltyCompanies, searchQuery, selectedCategory, t]);

  if (loading && !dashboard) {
    return <TwaLoadingScreen title={t("client.cards.loadingTitle")} subtitle={t("client.cards.loadingSubtitle")} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="min-h-full px-4 pb-24 pt-6"
    >
      <Link
        href="/app"
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("client.common.back")}
      </Link>

      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Wallet className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">{t("client.cards.title")}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("client.cards.subtitle")}
          </p>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("client.cards.searchPlaceholder")}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="glass h-10 rounded-xl border-white/10 pl-9"
        />
      </div>

      <CategoryChipStrip className="mb-4">
        <button
          type="button"
          onClick={() => setSelectedCategory(null)}
          className={cn(
            "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
            selectedCategory === null
              ? "bg-primary text-primary-foreground"
              : "glass border border-white/10 text-muted-foreground hover:text-foreground",
          )}
        >
          {t("client.common.all")}
        </button>
        {categories.map((category) => (
          <button
            key={category.slug}
            type="button"
            onClick={() => setSelectedCategory((current) => (current === category.slug ? null : category.slug))}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              selectedCategory === category.slug
                ? "bg-primary text-primary-foreground"
                : "glass border border-white/10 text-muted-foreground hover:text-foreground",
            )}
          >
            <CategoryIcon iconName={category.icon ?? "Circle"} className="h-3.5 w-3.5" />
            {categoryName(category, t)}
          </button>
        ))}
      </CategoryChipStrip>

      <ul className="space-y-3">
        {filteredCompanies.map((company, index) => {
          const companyCategoryList = companyCategories(company);
          const badges = companyCategoryList.slice(0, 3);
          const extraCount = Math.max(0, companyCategoryList.length - badges.length);

          return (
            <motion.li
              key={company.id}
              variants={item}
              initial="hidden"
              animate="show"
              transition={{ delay: Math.min(index * 0.04, 0.24) }}
            >
              <Link href={`/wallet/${company.id}`}>
                <Card className="glass cursor-pointer border-white/10 transition-all active:scale-[0.98] hover:border-white/20">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 px-4 py-3 pb-1">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base font-semibold">{company.name}</CardTitle>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {badges.map((category) => (
                          <Badge
                            key={category.slug}
                            variant="secondary"
                            className="inline-flex items-center gap-1 text-[10px] font-normal"
                          >
                            <CategoryIcon iconName={category.icon ?? "Circle"} className="h-3 w-3" />
                            {categoryName(category, t)}
                          </Badge>
                        ))}
                        {extraCount > 0 && (
                          <Badge variant="outline" className="text-[10px] font-normal">
                            +{extraCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
                    <div className="mb-2 flex items-end justify-between gap-3">
                      <p className="text-xl font-bold tabular-nums text-primary">
                        {company.points.balance}
                        <span className="ml-1 text-sm font-normal text-muted-foreground">{t("client.common.pointsShort")}</span>
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {t("client.cards.earned")} {company.points.totalEarnedPoints}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{company.level.current?.levelName ?? t("client.common.member")}</span>
                        <span>{company.level.next ? `${company.level.next.pointsToNext} ${t("client.common.ptsLeft")}` : t("client.common.topLevel")}</span>
                      </div>
                      <Progress value={company.level.progressPercent} className="h-1.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.li>
          );
        })}
      </ul>

      {loading && filteredCompanies.length > 0 && <p className="py-4 text-center text-xs text-muted-foreground">{t("client.cards.refreshing")}</p>}
      {!loading && filteredCompanies.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">{t("client.cards.empty")}</p>
          <Button asChild variant="outline" size="sm" className="glass mt-4 border-white/10">
            <Link href="/companies">{t("client.cards.explorePartners")}</Link>
          </Button>
        </div>
      )}
    </motion.div>
  );
}

