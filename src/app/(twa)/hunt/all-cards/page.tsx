"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, CheckCircle2, ChevronDown, Gift, Lock, Search, SlidersHorizontal, Sparkles, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getHuntCardCatalogResult, type HuntCatalogSpecies, type HuntElement } from "@/lib/api/twa-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import { cn } from "@/lib/utils";
import { ElementBadge, elementMeta, huntInteractiveClass, huntStatEntries, rarityBadgeClass, rarityClass, StatAffinityBar } from "../_components/hunt-ui";

type SortMode = "rarity" | "owned" | "name";
type ElementFilter = "all" | HuntElement;

const rarityScore = {
  LEGENDARY: 5,
  EPIC: 4,
  RARE: 3,
  UNCOMMON: 2,
  COMMON: 1,
};

const sortOptions: Array<{ value: SortMode; labelKey: "client.hunt.allCards.sortRarity" | "client.hunt.allCards.sortOwned" | "client.hunt.allCards.sortName" }> = [
  { value: "rarity", labelKey: "client.hunt.allCards.sortRarity" },
  { value: "owned", labelKey: "client.hunt.allCards.sortOwned" },
  { value: "name", labelKey: "client.hunt.allCards.sortName" },
];

const elementOptions: ElementFilter[] = ["all", "FLAME", "WATER", "NATURE", "WIND", "MUSIC", "LIGHT", "SHADOW"];

function cardImageScale(slug: string) {
  if (slug === "map-tide") return "scale-[1.42] group-hover:scale-[1.48]";
  if (slug === "metro-breeze") return "scale-[1.5] group-hover:scale-[1.56]";
  return "scale-[1.28] group-hover:scale-[1.32]";
}

function revealImageScale(slug: string) {
  if (slug === "map-tide") return "scale-[1.12]";
  if (slug === "metro-breeze") return "scale-[1.18]";
  return "scale-[0.96]";
}

export default function HuntAllCardsPage() {
  const { t } = useI18n("ru");
  const [catalog, setCatalog] = useState<HuntCatalogSpecies[]>([]);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("owned");
  const [sortOpen, setSortOpen] = useState(false);
  const [elementFilter, setElementFilter] = useState<ElementFilter>("all");
  const [elementOpen, setElementOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<HuntCatalogSpecies | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getHuntCardCatalogResult(true)
      .then((result) => {
        if (!mounted) return;
        if (result.ok) {
          setCatalog(result.data);
          setError(null);
        } else {
          setCatalog([]);
          setError(result.message);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const elementRows = elementFilter === "all" ? catalog : catalog.filter((item) => item.element === elementFilter);
    const rows = needle ? elementRows.filter((item) => {
      const text = [item.name, item.description, item.element, item.baseRarity, item.category?.name ?? ""].join(" ").toLowerCase();
      return text.includes(needle);
    }) : [...elementRows];

    return rows.sort((left, right) => {
      const ownedFirst = Number(right.ownedCount > 0) - Number(left.ownedCount > 0);
      if (ownedFirst !== 0) return ownedFirst;
      if (sortMode === "owned") return right.ownedCount - left.ownedCount || left.name.localeCompare(right.name);
      if (sortMode === "name") return left.name.localeCompare(right.name);
      return rarityScore[right.baseRarity] - rarityScore[left.baseRarity] || left.name.localeCompare(right.name);
    });
  }, [catalog, elementFilter, query, sortMode]);

  const selectedElementMeta = elementFilter === "all" ? null : elementMeta[elementFilter];
  const SelectedElementIcon = selectedElementMeta?.icon ?? Sparkles;

  const ownedSpeciesCount = catalog.filter((item) => item.ownedCount > 0).length;
  const progress = catalog.length ? Math.round((ownedSpeciesCount / catalog.length) * 100) : 0;

  return (
    <main className="min-h-full px-4 pb-24 pt-5 text-white">
      <header className="mb-4 flex items-center justify-between">
        <Link href="/hunt" className={cn("flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/70", huntInteractiveClass)}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1 px-4">
          <div className="flex items-center justify-center gap-2 text-sm text-white/78">
            <BookOpen className="h-4 w-4 text-cyan-100" />
            <span>{t("client.hunt.allCards.title")}</span>
            <span className="font-semibold text-white">{ownedSpeciesCount}/{catalog.length}</span>
          </div>
          <div className="mx-auto mt-2 h-1 max-w-44 overflow-hidden rounded-full bg-white/10">
            <span className="block h-full rounded-full bg-[linear-gradient(90deg,#67e8f9,#a855f7)]" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <Button asChild variant="outline" className={cn("rounded-2xl border-white/10 bg-white/[0.04] px-3 text-white/74 hover:bg-white/[0.07]", huntInteractiveClass)}>
          <Link href="/hunt/cards">
            <WalletCards className="mr-2 h-4 w-4" />
            {t("client.hunt.collection")}
          </Link>
        </Button>
      </header>

      <section className="mb-4 grid gap-2">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
          <Search className="h-4 w-4 text-cyan-100" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("client.hunt.allCards.search")}
            className="h-9 border-0 bg-transparent px-0 text-white placeholder:text-white/38 focus-visible:ring-0"
          />
        </div>
        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setSortOpen((open) => !open);
                setElementOpen(false);
              }}
              className={cn("flex h-full min-h-[52px] w-full items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-sm text-white", huntInteractiveClass)}
              aria-expanded={sortOpen}
            >
              <SlidersHorizontal className="h-4 w-4 shrink-0 text-cyan-100" />
              <span className="min-w-0 flex-1 truncate">{t(sortOptions.find((option) => option.value === sortMode)?.labelKey ?? "client.hunt.allCards.sortOwned")}</span>
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-white/48 transition", sortOpen && "rotate-180")} />
            </button>
            {sortOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-2xl border border-cyan-200/18 bg-slate-950/96 p-1 shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur">
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setSortMode(option.value);
                      setSortOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm",
                      huntInteractiveClass,
                      option.value === sortMode ? "bg-cyan-200/14 text-cyan-50" : "text-white/68",
                    )}
                  >
                    <span>{t(option.labelKey)}</span>
                    {option.value === sortMode && <CheckCircle2 className="h-4 w-4 text-cyan-100" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setElementOpen((open) => !open);
                setSortOpen(false);
              }}
              className={cn(
                "flex h-full min-h-[52px] min-w-[52px] items-center justify-center rounded-2xl border px-3",
                huntInteractiveClass,
                selectedElementMeta ? selectedElementMeta.className : "border-cyan-200/20 bg-cyan-200/10 text-cyan-50",
              )}
              aria-expanded={elementOpen}
              aria-label={selectedElementMeta?.label ?? t("client.hunt.shop.filterAll")}
              title={selectedElementMeta?.label ?? t("client.hunt.shop.filterAll")}
            >
              <SelectedElementIcon className="h-4 w-4" />
            </button>
            {elementOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-52 overflow-hidden rounded-2xl border border-cyan-200/18 bg-slate-950/96 p-1 shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur">
                {elementOptions.map((option) => {
                  const meta = option === "all" ? null : elementMeta[option];
                  const Icon = meta?.icon ?? Sparkles;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setElementFilter(option);
                        setElementOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm",
                        huntInteractiveClass,
                        option === elementFilter ? "bg-cyan-200/14 text-cyan-50" : "text-white/68",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border", meta?.className ?? "border-cyan-200/20 bg-cyan-200/10 text-cyan-50")}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="truncate">{meta?.label ?? t("client.hunt.shop.filterAll")}</span>
                      </span>
                      {option === elementFilter && <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-100" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <Button asChild className={cn("rounded-2xl bg-cyan-200 px-4 text-slate-950 hover:bg-cyan-100", huntInteractiveClass)}>
            <Link href="/hunt/shop">
              <Gift className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2">
        {loading && <div className="rounded-3xl border border-dashed border-white/15 p-5 text-center text-sm text-white/54">{t("client.hunt.loading")}</div>}
        {!loading && error && <div className="col-span-3 rounded-3xl border border-red-300/20 bg-red-300/10 p-5 text-center text-sm text-red-50">{t("client.hunt.allCards.loadFailed")} {error}</div>}
        {!loading && !error && filtered.length === 0 && <div className="col-span-3 rounded-3xl border border-dashed border-white/15 p-5 text-center text-sm text-white/54">{t("client.hunt.allCards.empty")}</div>}
        {filtered.map((item, index) => {
          const owned = item.ownedCount > 0;
          return (
            <button
              key={item.uuid}
              type="button"
              onClick={() => setSelectedCard(item)}
              className={cn("group relative aspect-[3/4] overflow-hidden rounded-2xl border bg-slate-950 p-0 text-left shadow-[0_18px_42px_rgba(0,0,0,0.22)]", huntInteractiveClass, owned ? rarityClass[item.baseRarity] : "border-white/10 text-white/55")}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,rgba(103,232,249,0.12),rgba(2,6,12,0.25)_52%,rgba(2,6,12,0.62))]">
                <img src={item.imageUrl ?? "/hunt-assets/cards/compass-light.webp"} alt="" className={cn("absolute inset-0 h-full w-full object-contain object-center transition", cardImageScale(item.slug), owned ? "opacity-95" : "opacity-35 grayscale")} />
                <span className="absolute left-2 top-2 rounded-full border border-black/30 bg-black/44 px-2 py-1 text-[11px] font-semibold text-white/74 backdrop-blur">
                  #{String(index + 1).padStart(3, "0")}
                </span>
                <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/12 bg-black/44 text-cyan-100 backdrop-blur">
                  {owned ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                </span>
              </div>
              <div className="absolute inset-x-0 bottom-0 min-w-0 bg-gradient-to-t from-black/88 via-black/62 to-transparent p-2.5 pt-10">
                <h2 className="truncate text-[13px] font-semibold leading-4 text-white">{item.name}</h2>
                <div className="mt-1 flex items-center justify-between gap-1">
                  <Badge className={cn("max-w-full truncate px-1.5 py-0.5 text-[9px]", rarityBadgeClass[item.baseRarity])}>{item.baseRarity}</Badge>
                  {owned && item.ownedCount > 0 && <span className="shrink-0 text-[10px] font-semibold text-cyan-100">x{item.ownedCount}</span>}
                </div>
              </div>
            </button>
          );
        })}
        <Link href="/hunt/create" className={cn("col-span-3 flex items-center justify-center gap-2 rounded-3xl border border-cyan-200/20 bg-cyan-200/10 p-4 text-sm font-semibold text-cyan-50", huntInteractiveClass)}>
          <Sparkles className="h-4 w-4" />
          {t("client.hunt.createPost")}
        </Link>
      </section>

      <Dialog open={Boolean(selectedCard)} onOpenChange={(open) => !open && setSelectedCard(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-slate-950 p-4 text-white">
          {selectedCard && (
            <>
              <DialogHeader>
                <DialogTitle className="truncate">{selectedCard.name}</DialogTitle>
              </DialogHeader>
              <div className="mx-auto w-full max-w-[360px] overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_50%_46%,rgba(103,232,249,0.18),rgba(2,6,12,0.72)_58%,rgba(2,6,12,0.95))]">
                <div className="relative h-[min(48vh,360px)] min-h-[260px]">
                  <img src={selectedCard.imageUrl ?? "/hunt-assets/cards/compass-light.webp"} alt="" className={cn("absolute inset-0 h-full w-full object-contain object-center", revealImageScale(selectedCard.slug), selectedCard.ownedCount > 0 ? "opacity-100" : "opacity-38 grayscale")} />
                  <div className="absolute left-3 top-3">
                    <ElementBadge element={selectedCard.element} />
                  </div>
                  <div className="absolute bottom-3 left-3">
                    <Badge className={rarityBadgeClass[selectedCard.baseRarity]}>{selectedCard.baseRarity}</Badge>
                  </div>
                </div>
              </div>
              <p className="text-sm leading-6 text-white/62">{selectedCard.description}</p>
              <div className="grid grid-cols-2 gap-2">
                {huntStatEntries(selectedCard.baseStats).map(([key, value]) => <StatAffinityBar key={key} label={key} value={value} />)}
              </div>
              <Button asChild className={cn("rounded-2xl bg-cyan-200 text-slate-950 hover:bg-cyan-100", huntInteractiveClass)}>
                <Link href="/hunt/shop">
                  <Gift className="mr-2 h-4 w-4" />
                  {t("client.hunt.shop.title")}
                </Link>
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
