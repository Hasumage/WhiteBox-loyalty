"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, Copy, Gift, Heart, Leaf, MoreHorizontal, Search, Share2, SlidersHorizontal, Sparkles, Star, TrendingUp, WalletCards, X, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { applyHuntCardUpgradeBonus, getCachedHuntOverview, getHuntOverview, upgradeHuntCard, type HuntCard, type HuntCardStatKey, type HuntCardUpgrade, type HuntOverview, type HuntRarity } from "@/lib/api/twa-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import { cn } from "@/lib/utils";
import { ElementBadge, elementMeta, huntInteractiveClass, huntStatEntries, huntStatMeta, rarityBadgeClass, rarityClass, StatValueBar } from "../_components/hunt-ui";

const rarityIndex: Record<HuntRarity, number> = {
  COMMON: 0,
  UNCOMMON: 1,
  RARE: 2,
  EPIC: 3,
  LEGENDARY: 4,
};

const elementOptions = ["all", "FLAME", "WATER", "NATURE", "WIND", "MUSIC", "LIGHT", "SHADOW"] as const;
const sortOptions = [
  { value: "rarity", label: "Редкость" },
  { value: "level", label: "Уровень" },
  { value: "name", label: "Имя" },
  { value: "element", label: "Стихия" },
  { value: "newest", label: "Новые" },
] as const;

type ElementFilter = (typeof elementOptions)[number];
type SortMode = (typeof sortOptions)[number]["value"];
type UpgradeView = { card: HuntCard; upgrade: HuntCardUpgrade; cost: number };

function mediaSrc(url?: string | null) {
  if (!url) return "/hunt-assets/cards/compass-light.webp";
  if (url.startsWith("/hunt/cards/")) return url.replace("/hunt/cards/", "/hunt-assets/cards/");
  return url;
}

function upgradeCost(card: HuntCard) {
  return card.level * 45 + rarityIndex[card.rarity] * 25;
}

function cardImageScale(slug: string) {
  if (slug === "map-tide") return "scale-[1.42] group-hover:scale-[1.48]";
  if (slug === "metro-breeze") return "scale-[1.5] group-hover:scale-[1.56]";
  return "scale-[1.28] group-hover:scale-[1.34]";
}

function revealImageScale(slug: string) {
  if (slug === "map-tide") return "scale-[1.12]";
  if (slug === "metro-breeze") return "scale-[1.18]";
  return "scale-[0.98]";
}

export default function HuntCardsPage() {
  const { t } = useI18n("ru");
  const [overview, setOverview] = useState<HuntOverview>(getCachedHuntOverview());
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("rarity");
  const [sortOpen, setSortOpen] = useState(false);
  const [elementFilter, setElementFilter] = useState<ElementFilter>("all");
  const [busyUuid, setBusyUuid] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const [upgradeView, setUpgradeView] = useState<UpgradeView | null>(null);

  async function refresh(force = false) {
    setOverview(await getHuntOverview(force));
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const duplicateCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const card of overview.cards) counts.set(card.species.slug, (counts.get(card.species.slug) ?? 0) + 1);
    return counts;
  }, [overview.cards]);

  const cards = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const elementRows = elementFilter === "all" ? overview.cards : overview.cards.filter((card) => card.element === elementFilter);
    const rows = needle
      ? elementRows.filter((card) => {
          const text = [card.species.name, card.species.description, card.trait, card.rarity, card.element, elementMeta[card.element].label].join(" ").toLowerCase();
          return text.includes(needle);
        })
      : [...elementRows];

    return rows.sort((left, right) => {
      if (sortMode === "name") return left.species.name.localeCompare(right.species.name, "ru") || rarityIndex[right.rarity] - rarityIndex[left.rarity];
      if (sortMode === "level") return right.level - left.level || rarityIndex[right.rarity] - rarityIndex[left.rarity] || left.species.name.localeCompare(right.species.name, "ru");
      if (sortMode === "element") return left.element.localeCompare(right.element, "en") || rarityIndex[right.rarity] - rarityIndex[left.rarity] || left.species.name.localeCompare(right.species.name, "ru");
      if (sortMode === "newest") return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      return rarityIndex[right.rarity] - rarityIndex[left.rarity] || right.level - left.level || left.species.name.localeCompare(right.species.name, "ru");
    });
  }, [elementFilter, overview.cards, query, sortMode]);

  const selectedCard = selectedUuid ? overview.cards.find((card) => card.uuid === selectedUuid) ?? null : null;
  const currentSort = sortOptions.find((option) => option.value === sortMode) ?? sortOptions[0];

  async function shareCard(card: HuntCard) {
    const url = `${window.location.origin}/hunt-share/card/${card.uuid}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${card.species.name} in Nearloy Hunt`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setNotice(t("client.hunt.shareCopied"));
    } catch {
      setNotice(t("client.hunt.shareCancelled"));
    }
  }

  async function upgradeCard(card: HuntCard) {
    if (busyUuid || card.level >= 30) return;
    setBusyUuid(card.uuid);
    const result = await upgradeHuntCard(card.uuid);
    if (result.ok) {
      if (result.data.upgrade) {
        setUpgradeView({ card: result.data.card, upgrade: result.data.upgrade, cost: result.data.cost });
        setSelectedUuid(null);
      }
      setNotice(`Улучшение применено за ${result.data.cost} NearCoin.`);
      await refresh(true);
    } else {
      setNotice(result.message);
    }
    setBusyUuid(null);
  }

  async function applyBonus(stat: HuntCardStatKey) {
    if (!upgradeView || busyUuid) return;
    setBusyUuid(upgradeView.card.uuid);
    const result = await applyHuntCardUpgradeBonus(upgradeView.upgrade.uuid, stat);
    if (result.ok) {
      setUpgradeView({ card: result.data.card, upgrade: result.data.upgrade, cost: upgradeView.cost });
      setNotice(`Дополнительная вкачка: +${result.data.upgrade.bonusDelta ?? 1} к ${huntStatMeta[stat].label}.`);
      await refresh(true);
    } else {
      setNotice(result.message);
    }
    setBusyUuid(null);
  }

  const selectedUpgradeCost = selectedCard ? upgradeCost(selectedCard) : 0;

  return (
    <main className="min-h-full px-4 pb-24 pt-5 text-white">
      <header className="mb-4 flex items-center justify-between">
        <Link href="/hunt" className={cn("flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/70", huntInteractiveClass)}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1 px-4">
          <div className="flex items-center justify-center gap-2 text-sm text-white/78">
            <WalletCards className="h-4 w-4 text-cyan-100" />
            <span>{t("client.hunt.collection")}</span>
            <span className="font-semibold text-white">{overview.cards.length}</span>
          </div>
          <div className="mx-auto mt-2 h-1 max-w-44 overflow-hidden rounded-full bg-white/10">
            <span className="block h-full rounded-full bg-[linear-gradient(90deg,#67e8f9,#a855f7)]" style={{ width: overview.cards.length ? "100%" : "0%" }} />
          </div>
        </div>
        <Button asChild variant="outline" className={cn("rounded-2xl border-white/10 bg-white/[0.04] px-3 text-white/74 hover:bg-white/[0.07]", huntInteractiveClass)}>
          <Link href="/hunt/shop">
            <Gift className="mr-2 h-4 w-4" />
            {t("client.hunt.shop.title")}
          </Link>
        </Button>
      </header>

      <section className="mb-4 grid gap-2">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
          <Search className="h-4 w-4 text-cyan-100" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по имени, стихии, редкости или трейту"
            className="h-9 border-0 bg-transparent px-0 text-white placeholder:text-white/38 focus-visible:ring-0"
          />
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setSortOpen((open) => !open)}
            className={cn("flex h-full min-h-[52px] w-full items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-sm text-white", huntInteractiveClass)}
            aria-expanded={sortOpen}
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0 text-cyan-100" />
            <span className="min-w-0 flex-1 truncate">Сортировка: {currentSort.label}</span>
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
                  className={cn("flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm", huntInteractiveClass, option.value === sortMode ? "bg-cyan-200/14 text-cyan-50" : "text-white/68")}
                >
                  <span>Сортировка: {option.label}</span>
                  {option.value === sortMode && <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-100" />}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {elementOptions.map((option) => {
            const meta = option === "all" ? null : elementMeta[option];
            const Icon = meta?.icon ?? Sparkles;
            const active = option === elementFilter;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setElementFilter(option)}
                className={cn(
                  "flex h-11 shrink-0 items-center gap-2 rounded-2xl border px-3 text-sm font-semibold transition",
                  huntInteractiveClass,
                  active
                    ? meta?.className ?? "border-cyan-200/35 bg-cyan-200/18 text-cyan-50"
                    : "border-white/10 bg-white/[0.04] text-white/66 hover:border-cyan-200/24 hover:bg-cyan-200/10 hover:text-cyan-50",
                )}
                aria-pressed={active}
                title={meta?.label ?? "Все стихии"}
              >
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border", active ? "border-current/35 bg-black/18" : meta?.className ?? "border-cyan-200/20 bg-cyan-200/10 text-cyan-50")}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span>{meta?.label ?? "Все"}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2">
        {overview.cards.length === 0 && (
          <div className="col-span-3 rounded-3xl border border-dashed border-white/15 p-5 text-center text-sm text-white/54">{t("client.hunt.cards.empty")}</div>
        )}
        {overview.cards.length > 0 && cards.length === 0 && (
          <div className="col-span-3 rounded-3xl border border-dashed border-white/15 p-5 text-center text-sm text-white/54">Карточки не найдены.</div>
        )}
        {cards.map((card, index) => {
          const ElementIcon = elementMeta[card.element].icon;
          const duplicateCount = duplicateCounts.get(card.species.slug) ?? 1;

          return (
            <button
              key={card.uuid}
              type="button"
              onClick={() => setSelectedUuid(card.uuid)}
              className={cn("group relative aspect-[3/4] overflow-hidden rounded-2xl border bg-slate-950 p-0 text-left shadow-[0_18px_42px_rgba(0,0,0,0.22)]", huntInteractiveClass, rarityClass[card.rarity])}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,rgba(103,232,249,0.12),rgba(2,6,12,0.25)_52%,rgba(2,6,12,0.62))]">
                <img src={mediaSrc(card.species.imageUrl)} alt="" className={cn("absolute inset-0 h-full w-full object-contain object-center transition", cardImageScale(card.species.slug))} />
                <span className="absolute left-2 top-2 rounded-full border border-black/30 bg-black/44 px-2 py-1 text-[11px] font-semibold text-white/74 backdrop-blur">
                  #{String(index + 1).padStart(3, "0")}
                </span>
                <span className={cn("absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border backdrop-blur", elementMeta[card.element].className)} title={elementMeta[card.element].label}>
                  <ElementIcon className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="absolute inset-x-0 bottom-0 min-w-0 bg-gradient-to-t from-black/88 via-black/62 to-transparent p-2.5 pt-10">
                <h2 className="truncate text-[13px] font-semibold leading-4 text-white">{card.species.name}</h2>
                <div className="mt-1 flex items-center justify-between gap-1">
                  <Badge className={cn("max-w-full truncate px-1.5 py-0.5 text-[9px]", rarityBadgeClass[card.rarity])}>{card.rarity}</Badge>
                  <span className="shrink-0 text-[10px] font-semibold text-cyan-100">ур. {card.level}</span>
                </div>
                {duplicateCount > 1 && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-white/72">
                    <Copy className="h-3 w-3" />
                    x{duplicateCount}
                  </div>
                )}
              </div>
            </button>
          );
        })}
        <Link href="/hunt/create" className={cn("col-span-3 flex items-center justify-center gap-2 rounded-3xl border border-cyan-200/20 bg-cyan-200/10 p-4 text-sm font-semibold text-cyan-50", huntInteractiveClass)}>
          <Sparkles className="h-4 w-4" />
          {t("client.hunt.createPost")}
        </Link>
      </section>

      {notice && (
        <div className="fixed bottom-24 left-1/2 z-50 w-[min(520px,calc(100vw-2rem))] -translate-x-1/2">
          <Card className="border-cyan-200/25 bg-card/95 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
            <CardContent className="py-3 text-sm text-cyan-50">{notice}</CardContent>
          </Card>
        </div>
      )}

      <Dialog open={Boolean(selectedCard)} onOpenChange={(open) => !open && setSelectedUuid(null)}>
        <DialogContent showClose={false} className="hide-scrollbar max-h-[92dvh] w-[calc(100vw-1.25rem)] max-w-[760px] overflow-y-auto rounded-[24px] border-white/10 bg-[#030812] p-3 text-white shadow-[0_30px_90px_rgba(0,0,0,0.72)] sm:p-4 lg:max-w-4xl">
          {selectedCard && (
            <>
              <div className="absolute inset-0 rounded-[24px] bg-[radial-gradient(circle_at_15%_10%,rgba(52,211,153,0.16),transparent_32%),radial-gradient(circle_at_92%_5%,rgba(103,232,249,0.12),transparent_28%)] pointer-events-none" />
              <DialogTitle className="sr-only">{selectedCard.species.name}</DialogTitle>

              <div className="relative flex items-center justify-between gap-2">
                <button type="button" onClick={() => setSelectedUuid(null)} className={cn("flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/78", huntInteractiveClass)} aria-label="Назад">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-10 items-center gap-2 rounded-2xl border border-cyan-200/20 bg-white/[0.06] px-3">
                    <Zap className="h-4 w-4 text-cyan-100" />
                    <span className="truncate text-sm font-semibold text-cyan-50">{overview.profile.influenceBalance} NearCoin</span>
                  </div>
                  <button type="button" className={cn("flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/78", huntInteractiveClass)} aria-label="Меню">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="relative grid gap-4 sm:grid-cols-[minmax(220px,0.95fr)_minmax(250px,1fr)] lg:grid-cols-[minmax(260px,0.95fr)_minmax(300px,1fr)]">
                <div className={cn("overflow-hidden rounded-[24px] border bg-[radial-gradient(circle_at_50%_42%,rgba(103,232,249,0.18),rgba(2,6,12,0.72)_58%,rgba(2,6,12,0.96))]", rarityClass[selectedCard.rarity])}>
                  <div className="relative h-[260px] sm:h-[380px] lg:h-[500px]">
                    <img src={mediaSrc(selectedCard.species.imageUrl)} alt="" className={cn("absolute inset-0 h-full w-full object-contain object-center", revealImageScale(selectedCard.species.slug))} />
                    <div className="absolute left-3 top-3">
                      <ElementBadge element={selectedCard.element} />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 bg-gradient-to-t from-black/82 via-black/42 to-transparent p-4 pt-20">
                      <Badge className={cn("px-3 py-1.5 text-xs", rarityBadgeClass[selectedCard.rarity])}>{selectedCard.rarity}</Badge>
                      <div className="flex items-center gap-2">
                        <Badge className="border-white/10 bg-white/[0.08] px-3 py-1.5 text-xs text-white">
                          <Star className="mr-1 h-3.5 w-3.5 fill-amber-200 text-amber-200" />
                          {t("client.hunt.levelShort")} {selectedCard.level}
                        </Badge>
                        <Badge className="border-white/10 bg-white/[0.08] px-3 py-1.5 text-xs text-white">
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          x{duplicateCounts.get(selectedCard.species.slug) ?? 1}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:justify-center">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-2xl font-semibold leading-tight text-white lg:text-3xl">{selectedCard.species.name}</h2>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge className={cn("px-2.5 py-1 text-xs", rarityBadgeClass[selectedCard.rarity])}>{selectedCard.rarity}</Badge>
                        <ElementBadge element={selectedCard.element} />
                      </div>
                    </div>
                    <button type="button" className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-200/18 bg-white/[0.05] text-rose-200", huntInteractiveClass)} aria-label="Любимая карточка">
                      <Heart className="h-5 w-5" />
                    </button>
                  </div>

                  <p className="text-sm leading-6 text-white/62">{selectedCard.species.description}</p>

                  <div className="flex items-center gap-2">
                    <span className="h-px flex-1 bg-white/10" />
                    <span className="text-[11px] uppercase tracking-[0.18em] text-white/45">Характеристики</span>
                    <span className="h-px flex-1 bg-white/10" />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {huntStatEntries(selectedCard.stats).map(([key, value]) => <StatValueBar key={key} label={key} value={value} />)}
                  </div>

                  <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <Leaf className="absolute right-3 top-1/2 h-12 w-12 -translate-y-1/2 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-white/10" />
                    <div className="relative">
                      <p className="flex items-center gap-2 text-base font-semibold text-white">
                        <Sparkles className="h-4 w-4 text-cyan-100" />
                        О существе
                      </p>
                      <p className="mt-1 text-sm leading-5 text-white/62">{selectedCard.trait}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button disabled={busyUuid === selectedCard.uuid || selectedCard.level >= 30 || overview.profile.influenceBalance < selectedUpgradeCost} className={cn("h-11 rounded-2xl bg-cyan-200 text-sm font-semibold text-slate-950 hover:bg-cyan-100", huntInteractiveClass)} onClick={() => void upgradeCard(selectedCard)}>
                      <TrendingUp className="mr-2 h-4 w-4" />
                      {selectedCard.level >= 30 ? "Макс. уровень" : `${t("client.hunt.cards.upgrade")} · ${selectedCard.level >= 30 ? "Максимум" : `${selectedUpgradeCost} NC`}`}
                    </Button>
                    <Button variant="secondary" className={cn("h-11 rounded-2xl border-white/10 bg-white/[0.06] text-sm font-semibold", huntInteractiveClass)} onClick={() => void shareCard(selectedCard)}>
                      <Share2 className="mr-2 h-4 w-4" />
                      {t("client.hunt.cards.share")}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(upgradeView)} onOpenChange={(open) => !open && setUpgradeView(null)}>
        <DialogContent showClose={false} className="hide-scrollbar max-h-[92dvh] w-[calc(100vw-1.25rem)] max-w-[760px] overflow-y-auto rounded-[24px] border-emerald-300/20 bg-[#030812] p-3 text-white shadow-[0_30px_90px_rgba(0,0,0,0.72)] sm:p-4 lg:max-w-4xl">
          {upgradeView && (
            <>
              <div className="absolute inset-0 rounded-[24px] bg-[radial-gradient(circle_at_14%_10%,rgba(132,204,22,0.16),transparent_32%),radial-gradient(circle_at_90%_6%,rgba(103,232,249,0.12),transparent_28%)] pointer-events-none" />
              <DialogTitle className="sr-only">Улучшение персонажа</DialogTitle>

              <div className="relative flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-xl font-semibold text-white">
                    <Leaf className="h-5 w-5 text-lime-200" />
                    Улучшение персонажа
                  </p>
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-10 items-center gap-2 rounded-2xl border border-cyan-200/20 bg-white/[0.06] px-3">
                    <Zap className="h-4 w-4 text-cyan-100" />
                    <span className="truncate text-sm font-semibold text-cyan-50">{overview.profile.influenceBalance} NearCoin</span>
                  </div>
                  <button type="button" onClick={() => setUpgradeView(null)} className={cn("flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/78", huntInteractiveClass)} aria-label="Закрыть">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="relative grid gap-4 sm:grid-cols-[minmax(220px,0.95fr)_minmax(260px,1fr)]">
                <div className={cn("overflow-hidden rounded-[24px] border bg-[radial-gradient(circle_at_50%_42%,rgba(132,204,22,0.18),rgba(2,6,12,0.72)_58%,rgba(2,6,12,0.96))]", rarityClass[upgradeView.card.rarity])}>
                  <div className="relative h-[260px] sm:h-[380px]">
                    <img src={mediaSrc(upgradeView.card.species.imageUrl)} alt="" className={cn("absolute inset-0 h-full w-full object-contain object-center", revealImageScale(upgradeView.card.species.slug))} />
                    <div className="absolute left-3 top-3">
                      <Badge className={rarityBadgeClass[upgradeView.card.rarity]}>{upgradeView.card.rarity}</Badge>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/84 via-black/48 to-transparent p-4 pt-20 text-center">
                      <h2 className="text-2xl font-semibold text-white">{upgradeView.card.species.name}</h2>
                      <div className="mt-2 flex items-center justify-center gap-2">
                        <Badge className="border-white/10 bg-white/[0.08] px-3 py-1.5 text-xs text-white">
                          <Star className="mr-1 h-3.5 w-3.5 fill-amber-200 text-amber-200" />
                          Ур. {upgradeView.card.level}
                        </Badge>
                        <Badge className="border-white/10 bg-white/[0.08] px-3 py-1.5 text-xs text-white">
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          x{duplicateCounts.get(upgradeView.card.species.slug) ?? 1}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-lg font-semibold text-white">
                      <TrendingUp className="h-5 w-5 text-lime-200" />
                      Повышает характеристики
                    </p>
                  </div>
                  {upgradeView.upgrade.status === "PENDING_BONUS" ? (
                  <div className="flex items-center justify-between rounded-2xl border border-lime-200/20 bg-lime-300/10 px-3 py-2">
                    <span className="text-sm text-lime-50/80">Доступно бонусных вкачек</span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-lime-200/35 bg-lime-300/12 text-lg font-semibold text-lime-100">
                      {upgradeView.upgrade.status === "PENDING_BONUS" ? 1 : 0}
                    </span>
                  </div>
                  ) : (
                    <Button
                      type="button"
                      disabled={busyUuid === upgradeView.card.uuid || upgradeView.card.level >= 30 || overview.profile.influenceBalance < upgradeCost(upgradeView.card)}
                      className={cn("h-12 rounded-2xl bg-lime-300 text-sm font-semibold text-slate-950 hover:bg-lime-200", huntInteractiveClass)}
                      onClick={() => void upgradeCard(upgradeView.card)}
                    >
                      <TrendingUp className="mr-2 h-4 w-4" />
                      {upgradeView.card.level >= 30 ? "Максимальный уровень" : `Улучшить ещё · ${upgradeCost(upgradeView.card)} NC`}
                    </Button>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    {huntStatEntries(upgradeView.card.stats).map(([key, value]) => {
                      const meta = huntStatMeta[key];
                      const Icon = meta.icon;
                      const beforeValue = Number(upgradeView.upgrade.statsBefore[key] ?? 0);
                      const baseDelta = Number(upgradeView.upgrade.baseDeltas[key] ?? 0);
                      const bonusActive = upgradeView.upgrade.bonusStat === key;
                      const bonusDelta = bonusActive ? Number(upgradeView.upgrade.bonusDelta ?? 0) : 0;
                      const totalDelta = baseDelta + bonusDelta;
                      const finalValue = Number((upgradeView.upgrade.statsAfterBonus ?? upgradeView.upgrade.statsAfterBase)[key] ?? value);
                      const pending = upgradeView.upgrade.status === "PENDING_BONUS";
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={busyUuid === upgradeView.card.uuid || !pending}
                          onClick={() => void applyBonus(key)}
                          className={cn("min-h-[112px] rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left", pending && huntInteractiveClass, bonusActive && "border-lime-200/35 bg-lime-300/10")}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", meta.className)}>
                              <Icon className="h-5 w-5" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-white">{meta.label}</span>
                            </span>
                          </span>
                          {pending ? (
                            <span className="mt-3 flex items-end justify-between gap-2">
                              <span className={cn("text-2xl font-semibold", baseDelta > 0 ? "text-lime-100" : "text-white/42")}>+{baseDelta}</span>
                              <span className="rounded-full border border-amber-200/30 bg-amber-300/10 px-2 py-1 text-sm font-semibold text-amber-100">+1</span>
                            </span>
                          ) : (
                            <span className="mt-3 flex items-center justify-between gap-1">
                              <span className="text-lg font-semibold text-white/68">{beforeValue}</span>
                              <span className={cn("text-lg font-semibold", totalDelta > 0 ? "text-lime-100" : "text-white/42")}>+{totalDelta}</span>
                              <ArrowRight className="h-4 w-4 text-white/32" />
                              <span className="text-xl font-semibold text-white">{finalValue}</span>
                            </span>
                          )}
                          {!pending && bonusActive && (
                            <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-lime-200/25 bg-lime-300/10 px-2 py-1 text-[11px] font-semibold text-lime-100">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              выбран бонус
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
