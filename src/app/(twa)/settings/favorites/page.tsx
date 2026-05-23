"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Heart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import {
  type ApiCategory,
  getCachedFavoriteCategorySlugs,
  getCachedRegisteredCategories,
  getFavoriteCategorySlugs,
  getRegisteredCategories,
  saveFavoriteCategorySlugs,
} from "@/lib/api/categories-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import { interpolate } from "@/lib/i18n/format";

const MAX_FAVORITE_CATEGORIES = 10;

function FavoriteCategoriesContent() {
  const { t } = useI18n("ru");
  const router = useRouter();
  const searchParams = useSearchParams();
  const onboardingMode = searchParams.get("onboarding") === "1";
  const nextPath = searchParams.get("next") || "/";
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cachedCategories = getCachedRegisteredCategories();
    const cachedFavorites = getCachedFavoriteCategorySlugs();
    if (cachedCategories.length) setCategories(cachedCategories);
    if (cachedFavorites.length) setSelected(cachedFavorites);
    void (async () => {
      const [all, favorites] = await Promise.all([
        getRegisteredCategories(),
        getFavoriteCategorySlugs(),
      ]);
      setCategories(all);
      setSelected(favorites);
    })();
  }, []);

  const selectedCount = selected.length;
  const title = onboardingMode ? t("client.favorites.onboardingTitle") : t("client.favorites.title");
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  function toggle(slug: string) {
    setError(null);
    setSelected((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= MAX_FAVORITE_CATEGORIES) return prev;
      return [...prev, slug];
    });
  }

  const canSave = useMemo(() => selectedCount > 0 && !saving, [selectedCount, saving]);

  async function onSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const res = await saveFavoriteCategorySlugs(selected);
    setSaving(false);
    if (!res.ok) {
      setError(t("client.favorites.limitError"));
      return;
    }
    router.replace(nextPath);
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-4 pt-6">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground mb-4 text-sm">
        {t("client.favorites.subtitle")}
      </p>

      <Card className="glass border-white/10">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                {t("client.favorites.chooseCategories")}
              </CardTitle>
              <CardDescription className="mt-1">
                {t("client.favorites.chooseSubtitle")}
              </CardDescription>
            </div>
            <div className="min-w-[84px] shrink-0 whitespace-nowrap rounded-full border border-white/10 bg-white px-3 py-1 text-center text-xs font-semibold text-black">
              {interpolate(t("client.favorites.selected"), { count: selectedCount })}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {categories.map((category) => {
            const active = selectedSet.has(category.slug);
            const locked = !active && selectedCount >= MAX_FAVORITE_CATEGORIES;
            return (
              <button
                key={category.slug}
                type="button"
                aria-pressed={active}
                disabled={locked}
                onClick={() => toggle(category.slug)}
                className={`relative rounded-xl border px-3 py-3 text-left transition-colors ${
                  active
                    ? "border-white bg-white/[0.16] shadow-[0_0_0_1px_rgba(255,255,255,0.22)]"
                    : locked
                      ? "cursor-not-allowed border-white/5 bg-muted/5 opacity-35"
                    : "border-white/10 bg-muted/10 hover:bg-muted/20"
                }`}
              >
                <CategoryIcon iconName={category.icon} className="mb-2 h-4 w-4 text-primary" />
                <p className="text-sm font-medium">{category.name}</p>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {error && <p className="mt-2 text-sm text-muted-foreground">{error}</p>}

      <div className="mt-3 flex gap-2">
        <Button type="button" className="flex-1" disabled={!canSave} onClick={onSave}>
          <Heart className="mr-2 h-4 w-4" />
          {saving ? t("client.common.saving") : t("client.favorites.save")}
        </Button>
        {!onboardingMode && (
          <Button type="button" variant="secondary" className="glass border-white/10" onClick={() => router.replace("/settings")}>
            {t("client.common.cancel")}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function FavoriteCategoriesPage() {
  return (
    <Suspense fallback={<FavoriteCategoriesFallback />}>
      <FavoriteCategoriesContent />
    </Suspense>
  );
}

function FavoriteCategoriesFallback() {
  const { t } = useI18n("ru");
  return <div className="px-4 py-6 text-sm text-muted-foreground">{t("client.favorites.loading")}</div>;
}
