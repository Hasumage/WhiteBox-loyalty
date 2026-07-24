"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, Gift, Heart, Search, SlidersHorizontal, X } from "lucide-react";
import type { ApiCategory } from "@/lib/api/categories-client";
import { getCachedFavoriteCategorySlugs, getFavoriteCategorySlugs } from "@/lib/api/categories-client";
import { getCachedTwaCompanies, getTwaCompanies, type TwaCompany } from "@/lib/api/twa-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CategoryChipStrip } from "@/components/twa/CategoryChipStrip";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { TwaLoadingScreen } from "@/components/twa/TwaLoadingScreen";
import { useI18n } from "@/lib/i18n/use-i18n";
import { categoryName } from "@/lib/i18n/categories";
import { companyLevelName } from "@/lib/i18n/company-levels";

const POPULAR_CATEGORY_SLUGS = ["coffee", "books", "auto", "barber", "beauty", "food", "fitness", "retail"];

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

type DisplayCategory = ApiCategory & { isFavorite?: boolean };

function uniqueCompanyCategories(company: TwaCompany): ApiCategory[] {
  const categories = [company.category, ...company.categories].filter(Boolean);
  const bySlug = new Map(categories.map((category) => [category.slug, category]));
  return [...bySlug.values()];
}

function companyMatchesCategory(company: TwaCompany, categorySlug: string) {
  return uniqueCompanyCategories(company).some((category) => category.slug === categorySlug);
}

function buildCompanyCategories(companies: TwaCompany[], favoriteSlugs: string[]): DisplayCategory[] {
  const bySlug = new Map<string, DisplayCategory>();

  for (const company of companies) {
    for (const category of uniqueCompanyCategories(company)) {
      bySlug.set(category.slug, {
        ...category,
        isFavorite: favoriteSlugs.includes(category.slug),
      });
    }
  }

  return [...bySlug.values()].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export default function CompaniesPage() {
  const { locale, t } = useI18n("ru");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [companies, setCompanies] = useState<TwaCompany[]>([]);
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    const params = new URLSearchParams(window.location.search);
    setFavoritesOnly(params.get("favorite") === "1" || params.get("favorites") === "1");
    const cachedCompanies = getCachedTwaCompanies();
    const cachedFavorites = getCachedFavoriteCategorySlugs();
    if (cachedCompanies.length) {
      setCompanies(cachedCompanies);
      setLoading(false);
    }
    if (cachedFavorites.length) setFavoriteSlugs(cachedFavorites);
    void Promise.all([getTwaCompanies(true), getFavoriteCategorySlugs()]).then(([apiCompanies, favorites]) => {
      if (ignore) return;
      setCompanies(apiCompanies);
      setFavoriteSlugs(favorites);
      setLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, []);

  const availableCategories = useMemo(
    () => buildCompanyCategories(companies, favoriteSlugs),
    [companies, favoriteSlugs],
  );

  const quickCategories = useMemo(() => {
    const favorites = availableCategories.filter((category) => category.isFavorite);
    const popular = POPULAR_CATEGORY_SLUGS
      .map((slug) => availableCategories.find((category) => category.slug === slug))
      .filter((category): category is DisplayCategory => Boolean(category));
    const unique = new Map([...favorites, ...popular].map((category) => [category.slug, category]));
    return [...unique.values()].slice(0, 10);
  }, [availableCategories]);

  const filteredCompanies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return companies.filter((company) => {
      const categoryNames = uniqueCompanyCategories(company).flatMap((category) => [
        category.name.toLowerCase(),
        categoryName(category, t).toLowerCase(),
      ]);
      const matchesSearch =
        !query ||
        company.name.toLowerCase().includes(query) ||
        (company.description ?? "").toLowerCase().includes(query) ||
        categoryNames.some((name) => name.includes(query));

      if (!matchesSearch) return false;
      if (favoritesOnly && !company.isFavorite) return false;
      if (selectedCategory && !companyMatchesCategory(company, selectedCategory)) return false;
      return true;
    });
  }, [companies, favoritesOnly, searchQuery, selectedCategory, t]);

  if (loading && companies.length === 0) {
    return <TwaLoadingScreen title={t("client.partners.loadingTitle")} subtitle={t("client.partners.loadingSubtitle")} />;
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

      <h1 className="mb-1 text-xl font-semibold">{t("client.partners.title")}</h1>
      <p className="mb-4 text-sm text-muted-foreground">{t("client.partners.subtitle")}</p>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("client.partners.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
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
                selectedCategory || favoritesOnly
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
                  {availableCategories.map((category) => (
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

              <Button variant="outline" className="w-full border-white/10" onClick={() => {
                setSelectedCategory(null);
                setFavoritesOnly(false);
              }}>
                {t("client.common.resetFilters")}
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        <button
          type="button"
          onClick={() => {
            setSelectedCategory(null);
            setFavoritesOnly(false);
          }}
          className={cn(
            "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
            selectedCategory === null && !favoritesOnly
              ? "bg-primary text-primary-foreground"
              : "glass border border-white/10 text-muted-foreground hover:text-foreground",
          )}
        >
          {t("client.common.all")}
        </button>
        <button
          type="button"
          onClick={() => setFavoritesOnly((current) => !current)}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
            favoritesOnly
              ? "bg-primary text-primary-foreground"
              : "glass border border-white/10 text-muted-foreground hover:text-foreground",
          )}
        >
          <Heart className={cn("h-3.5 w-3.5", favoritesOnly && "fill-current")} />
          {locale === "ru" ? "Любимые" : "Favorites"}
        </button>
        {quickCategories.map((category) => (
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
          const progressPercent = company.level.progressPercent;
          const visualProgressPercent = company.level.next ? Math.max(progressPercent, 6) : 100;
          const nextLevelName = company.level.next
            ? companyLevelName(company.level.next.levelName, locale, t("client.common.topLevel"))
            : t("client.common.topLevel");
          const isWarmAccent = index % 2 === 1;
          const companyCategories = uniqueCompanyCategories(company);
          const badges = companyCategories.slice(0, 3);
          const extraCount = Math.max(0, companyCategories.length - badges.length);

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
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
                  />
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
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                      <p className="mb-2 truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {locale === "ru" ? `Прогресс к уровню ${nextLevelName}` : `Progress to ${nextLevelName}`}
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div
                              className={cn(
                                "h-full rounded-full bg-gradient-to-r shadow-[0_0_14px_rgba(56,189,248,0.45)] transition-all",
                                isWarmAccent ? "from-amber-400 via-orange-400 to-yellow-200" : "from-sky-400 via-blue-400 to-cyan-200",
                              )}
                              style={{ width: `${visualProgressPercent}%` }}
                            />
                          </div>
                          <div className="mt-2 flex justify-between gap-3 text-xs">
                            <span className={cn("text-base tabular-nums", isWarmAccent ? "text-amber-200" : "text-sky-200")}>
                              <span className="font-extrabold">{company.level.totalSpentPoints}</span>{" "}
                              <span className="font-normal text-muted-foreground">{t("client.common.pointsShort")}</span>
                            </span>
                            <span className="shrink-0 text-muted-foreground">
                              {company.level.next
                                ? `${company.level.next.minTotalSpend} ${t("client.common.pointsShort")}`
                                : t("client.common.topLevel")}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 border-l border-white/10 pl-3">
                          <span
                            className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-full",
                              isWarmAccent ? "bg-amber-400/15 text-amber-200" : "bg-sky-400/15 text-sky-200",
                            )}
                          >
                            <Gift className="h-5 w-5" />
                          </span>
                          <span className="hidden min-[420px]:block text-xs text-muted-foreground">
                            {company.level.next ? (
                              <>
                                {locale === "ru" ? "До " : "To "}
                                <b className={cn("block font-semibold", isWarmAccent ? "text-amber-200" : "text-sky-200")}>
                                  {nextLevelName}
                                </b>
                              </>
                            ) : (
                              <b className="font-semibold text-foreground">{t("client.common.topLevel")}</b>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.li>
          );
        })}
      </ul>

      {loading && filteredCompanies.length > 0 && <p className="py-4 text-center text-xs text-muted-foreground">{t("client.partners.refreshing")}</p>}
      {!loading && filteredCompanies.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">{t("client.partners.empty")}</p>
      )}
    </motion.div>
  );
}

