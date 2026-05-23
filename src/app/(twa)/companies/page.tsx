"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import type { ApiCategory } from "@/lib/api/categories-client";
import { getCachedFavoriteCategorySlugs, getFavoriteCategorySlugs } from "@/lib/api/categories-client";
import { getCachedTwaCompanies, getTwaCompanies, type TwaCompany } from "@/lib/api/twa-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
  const { t } = useI18n("ru");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [companies, setCompanies] = useState<TwaCompany[]>([]);
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    const cachedCompanies = getCachedTwaCompanies();
    const cachedFavorites = getCachedFavoriteCategorySlugs();
    if (cachedCompanies.length) {
      setCompanies(cachedCompanies);
      setLoading(false);
    }
    if (cachedFavorites.length) setFavoriteSlugs(cachedFavorites);
    void Promise.all([getTwaCompanies(), getFavoriteCategorySlugs()]).then(([apiCompanies, favorites]) => {
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
      const categoryNames = uniqueCompanyCategories(company).map((category) => category.name.toLowerCase());
      const matchesSearch =
        !query ||
        company.name.toLowerCase().includes(query) ||
        (company.description ?? "").toLowerCase().includes(query) ||
        categoryNames.some((name) => name.includes(query));

      if (!matchesSearch) return false;
      if (selectedCategory && !companyMatchesCategory(company, selectedCategory)) return false;
      return true;
    });
  }, [companies, searchQuery, selectedCategory]);

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
        href="/"
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
                      <span className="truncate">{category.name}</span>
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
            {category.name}
          </button>
        ))}
      </CategoryChipStrip>

      <ul className="space-y-3">
        {filteredCompanies.map((company, index) => {
          const progressPercent = company.level.progressPercent;
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
                            {category.name}
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
                    <p className="mb-2 text-xl font-bold tabular-nums text-primary">
                      {company.points.balance}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">{t("client.common.pointsShort")}</span>
                    </p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{company.level.current?.levelName ?? t("client.common.member")}</span>
                        <span>
                          {company.level.next ? `${company.level.next.pointsToNext} ${t("client.common.ptsLeft")}` : t("client.common.topLevel")}
                        </span>
                      </div>
                      <Progress value={progressPercent} className="h-1.5" />
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
