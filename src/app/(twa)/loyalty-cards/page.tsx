"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import type { ApiCategory } from "@/lib/api/categories-client";
import { getCachedFavoriteCategorySlugs, getFavoriteCategorySlugs } from "@/lib/api/categories-client";
import { getCachedTwaDashboard, getTwaDashboard, type TwaCompany, type TwaDashboard } from "@/lib/api/twa-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { CategoryChipStrip } from "@/components/twa/CategoryChipStrip";
import { cn } from "@/lib/utils";
import { TwaLoadingScreen } from "@/components/twa/TwaLoadingScreen";
import { useI18n } from "@/lib/i18n/use-i18n";
import { categoryName } from "@/lib/i18n/categories";
import { companyLevelName } from "@/lib/i18n/company-levels";
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
  const { locale, t } = useI18n("ru");
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
    () => dashboard?.wallet.companies ?? [],
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

      <h1 className="mb-1 text-xl font-semibold">{t("client.cards.title")}</h1>
      <p className="mb-4 text-sm text-muted-foreground">{t("client.cards.subtitle")}</p>

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
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                selectedCategory
                  ? "bg-primary text-primary-foreground"
                  : "glass border border-white/10 text-muted-foreground hover:text-foreground",
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {t("client.common.filters")}
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[86%] max-w-sm overflow-y-auto p-0" showCloseButton>
            <SheetHeader className="border-b border-white/10">
              <SheetTitle>{t("client.partners.filterTitle")}</SheetTitle>
              <SheetDescription>{t("client.partners.filterDescription")}</SheetDescription>
            </SheetHeader>
            <div className="space-y-6 px-6 py-5">
              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-muted-foreground">{t("client.common.categories")}</h2>
                  {selectedCategory && (
                    <button
                      type="button"
                      onClick={() => setSelectedCategory(null)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                      {t("client.common.clear")}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((category) => (
                    <button
                      key={category.slug}
                      type="button"
                      onClick={() => setSelectedCategory((current) => (current === category.slug ? null : category.slug))}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-2xl border px-3 py-3 text-left text-sm font-medium transition-colors",
                        selectedCategory === category.slug
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <CategoryIcon iconName={category.icon ?? "Circle"} className="h-4 w-4 shrink-0" />
                      <span className="truncate">{categoryName(category, t)}</span>
                    </button>
                  ))}
                </div>
              </section>
              <Button variant="outline" className="w-full border-white/10" onClick={() => setSelectedCategory(null)}>
                {t("client.common.resetFilters")}
              </Button>
            </div>
          </SheetContent>
        </Sheet>

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
          const progressPercent = company.level.progressPercent;
          const visualProgressPercent = company.level.next ? Math.max(progressPercent, 6) : 100;
          const nextLevelName = company.level.next
            ? companyLevelName(company.level.next.levelName, locale, t("client.common.topLevel"))
            : t("client.common.topLevel");
          const currentLevelName = companyLevelName(company.level.current?.levelName, locale, t("client.common.member"));
          const isWarmAccent = index % 2 === 1;

          return (
            <motion.li
              key={company.id}
              variants={item}
              initial="hidden"
              animate="show"
              transition={{ delay: Math.min(index * 0.04, 0.24) }}
            >
              <Link href={`/wallet/${company.slug}`}>
                <Card
                  className={cn(
                    "glass group relative overflow-hidden rounded-[1.75rem] border-white/10 bg-[#070c13]/90 shadow-[0_18px_50px_rgba(0,0,0,0.28)] transition-all active:scale-[0.98] hover:border-white/20",
                    isWarmAccent ? "hover:shadow-amber-950/25" : "hover:shadow-sky-950/25",
                  )}
                >
                  <div
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute -left-16 -top-16 h-44 w-44 rounded-full opacity-25 blur-3xl transition-opacity group-hover:opacity-35",
                      isWarmAccent ? "bg-amber-500" : "bg-sky-500",
                    )}
                  />
                  <div aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                  <CardHeader className="relative flex flex-row items-start justify-between gap-3 space-y-0 px-4 pb-2 pt-4">
                    <div className="flex min-w-0 flex-1 items-start gap-3.5">
                      <div
                        className={cn(
                          "relative flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_24px_rgba(56,189,248,0.16)]",
                          isWarmAccent ? "border-amber-300/25" : "border-sky-300/25",
                        )}
                      >
                        {company.logoUrl ? (
                          <Image src={company.logoUrl} alt={company.name} fill sizes="72px" className="object-cover" />
                        ) : (
                          <CategoryIcon iconName={company.category?.icon ?? "Building2"} className="h-8 w-8 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
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
                    </div>
                    <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="relative px-4 pb-4 pt-0">
                    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/20 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                      <div className="min-w-0 rounded-xl bg-white/[0.035] px-3 py-2.5">
                        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          {locale === "ru" ? "Баланс" : "Balance"}
                        </p>
                        <p className={cn("mt-1 truncate text-2xl font-extrabold tabular-nums leading-none", isWarmAccent ? "text-amber-200" : "text-sky-200")}>
                          {company.points.balance}
                          <span className="ml-1 text-xs font-normal text-muted-foreground">{t("client.common.pointsShort")}</span>
                        </p>
                      </div>
                      <div className="min-w-0 rounded-xl bg-white/[0.035] px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="truncate text-muted-foreground">{currentLevelName}</span>
                          <b className={cn("shrink-0 font-semibold", isWarmAccent ? "text-amber-200" : "text-sky-200")}>
                            {nextLevelName}
                          </b>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className={cn(
                              "h-full rounded-full bg-gradient-to-r shadow-[0_0_14px_rgba(56,189,248,0.45)] transition-all",
                              isWarmAccent ? "from-amber-400 via-orange-400 to-yellow-200" : "from-sky-400 via-blue-400 to-cyan-200",
                            )}
                            style={{ width: `${visualProgressPercent}%` }}
                          />
                        </div>
                        <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
                          {company.level.next ? `${company.level.next.pointsToNext} ${t("client.common.ptsLeft")}` : t("client.common.topLevel")}
                        </p>
                      </div>
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

