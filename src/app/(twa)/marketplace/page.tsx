"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, CircleDollarSign, Loader2, SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { SubscriptionsComingSoon } from "@/components/subscriptions/SubscriptionsComingSoon";
import { CategoryChipStrip } from "@/components/twa/CategoryChipStrip";
import { cn } from "@/lib/utils";
import { getCachedTwaMarketplace, getTwaMarketplace, type TwaMarketplace, type TwaSubscriptionPlan } from "@/lib/api/twa-client";
import { TwaLoadingScreen } from "@/components/twa/TwaLoadingScreen";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/features/subscriptions";
import { useI18n } from "@/lib/i18n/use-i18n";
import { categoryName } from "@/lib/i18n/categories";
import { formatPlanPrice as formatLocalizedPlanPrice } from "@/lib/i18n/format";
import type { TranslateFn } from "@/lib/i18n/format";

const POPULAR_CATEGORY_SLUGS = ["coffee", "books", "auto", "barber", "beauty", "food", "fitness", "retail"];

function formatPlanPrice(plan: TwaSubscriptionPlan, t: TranslateFn) {
  return formatLocalizedPlanPrice(plan.price, plan.renewalUnit, t);
}

function planPrice(plan: TwaSubscriptionPlan) {
  const value = Number(plan.price);
  return Number.isFinite(value) ? value : 0;
}

export default function MarketplacePage() {
  if (!SUBSCRIPTIONS_ENABLED) {
    return <SubscriptionsComingSoon mode="client" backHref="/app" primaryHref="/map" />;
  }

  return <MarketplaceEnabledPage />;
}

function MarketplaceEnabledPage() {
  const { t } = useI18n("ru");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [marketplace, setMarketplace] = useState<TwaMarketplace>({ categories: [], subscriptions: [] });
  const [loading, setLoading] = useState(true);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  useEffect(() => {
    let ignore = false;
    const cached = getCachedTwaMarketplace();
    if (cached.categories.length || cached.subscriptions.length) {
      setMarketplace(cached);
      setLoading(false);
    }
    void getTwaMarketplace().then((data) => {
      if (ignore) return;
      setMarketplace(data);
      setLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, []);

  const visibleSubscriptions = useMemo(
    () => {
      const min = minPrice.trim() === "" ? null : Number(minPrice);
      const max = maxPrice.trim() === "" ? null : Number(maxPrice);

      return marketplace.subscriptions.filter((plan) => {
        const price = planPrice(plan);
        if (selectedCategory && plan.category?.slug !== selectedCategory) return false;
        if (min !== null && Number.isFinite(min) && price < min) return false;
        if (max !== null && Number.isFinite(max) && price > max) return false;
        return true;
      });
    },
    [marketplace.subscriptions, selectedCategory, minPrice, maxPrice],
  );

  const sortedCategories = useMemo(
    () =>
      [...marketplace.categories].sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [marketplace.categories],
  );

  const quickCategories = useMemo(() => {
    const favorites = sortedCategories.filter((category) => category.isFavorite);
    const popular = POPULAR_CATEGORY_SLUGS
      .map((slug) => sortedCategories.find((category) => category.slug === slug))
      .filter((category): category is (typeof sortedCategories)[number] => Boolean(category));
    const unique = new Map([...favorites, ...popular].map((category) => [category.slug, category]));
    return [...unique.values()].slice(0, 10);
  }, [sortedCategories]);

  const hasAdvancedFilters = Boolean(selectedCategory || minPrice.trim() || maxPrice.trim());

  function clearFilters() {
    setSelectedCategory(null);
    setMinPrice("");
    setMaxPrice("");
  }

  if (loading && marketplace.categories.length === 0 && marketplace.subscriptions.length === 0) {
    return <TwaLoadingScreen title={t("client.market.loadingTitle")} subtitle={t("client.market.loadingSubtitle")} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="min-h-full px-4 pb-4 pt-6"
    >
      <Link
        href="/app"
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("client.common.back")}
      </Link>

      <div className="mb-4">
        <h1 className="text-xl font-semibold">{t("client.market.title")}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t("client.market.subtitle")}
        </p>
      </div>

      <CategoryChipStrip className="mb-4">
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                hasAdvancedFilters
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
              <SheetTitle>{t("client.market.filterTitle")}</SheetTitle>
              <SheetDescription>{t("client.market.filterDescription")}</SheetDescription>
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
                  {sortedCategories.map((category) => (
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

              <section>
                <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{t("client.market.pricePerMonth")}</h2>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground">{t("client.market.min")}</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      placeholder="0"
                      value={minPrice}
                      onChange={(event) => setMinPrice(event.target.value)}
                      className="glass border-white/10"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground">{t("client.market.max")}</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      placeholder="50"
                      value={maxPrice}
                      onChange={(event) => setMaxPrice(event.target.value)}
                      className="glass border-white/10"
                    />
                  </label>
                </div>
              </section>

              <Button variant="outline" className="w-full border-white/10" onClick={clearFilters}>
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
            {categoryName(category, t)}
          </button>
        ))}
      </CategoryChipStrip>

      <ul className="space-y-2">
        {visibleSubscriptions.map((plan, index) => {
          const category = plan.category;
          return (
            <motion.li
              key={plan.uuid}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.04, 0.24) }}
            >
              <Link href={`/marketplace/${plan.uuid}`} className="group block">
                <Card className="glass border-white/10 transition-all active:scale-[0.98] hover:border-white/20">
                  <CardContent className="flex items-start gap-3 px-3 py-2.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20">
                      {category ? (
                        <CategoryIcon iconName={category.icon ?? "Circle"} className="h-5 w-5 text-primary" />
                      ) : (
                        <CircleDollarSign className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{plan.name}</p>
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                        {plan.description}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-primary">
                          {formatPlanPrice(plan, t)}
                        </span>
                        {category && (
                          <Badge variant="secondary" className="inline-flex items-center gap-1 text-[10px] font-normal">
                            <CategoryIcon iconName={category.icon ?? "Circle"} className="h-3 w-3" />
                            {categoryName(category, t)}
                          </Badge>
                        )}
                        {plan.company && (
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {plan.company.name}
                          </Badge>
                        )}
                        {plan.type === "bundle" && plan.partners && (
                          <Badge variant="outline" className="max-w-full text-[10px] font-normal">
                            <span className="truncate">{plan.partners}</span>
                          </Badge>
                        )}
                        {plan.isOwned && <Badge className="text-[10px] font-normal">{t("client.common.active")}</Badge>}
                      </div>
                    </div>
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 self-center items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-muted-foreground transition-colors group-hover:text-foreground"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            </motion.li>
          );
        })}
      </ul>

      {loading && visibleSubscriptions.length > 0 && (
        <div className="flex justify-center py-4 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}

      {!loading && visibleSubscriptions.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t("client.market.empty")}
        </p>
      )}
    </motion.div>
  );
}

