"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, Copy, Gift, Heart, Leaf, MoreHorizontal, Search, SlidersHorizontal, Sparkles, Star, TrendingUp, WalletCards, X, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { advanceHuntTutorial, applyHuntCardUpgradeBonus, getCachedHuntOverview, getHuntCollectionOverview, sellHuntCard, upgradeHuntCard, type HuntCard, type HuntCardStatKey, type HuntCardUpgrade, type HuntOverview, type HuntRarity } from "@/lib/api/twa-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import { cn } from "@/lib/utils";
import { ElementBadge, elementMeta, huntCreatureImageClass, huntInteractiveClass, huntRarityLabel, huntSpeciesDescription, huntSpeciesName, huntStatEntries, huntStatMeta, rarityBadgeClass, rarityClass, StatValueBar } from "../_components/hunt-ui";

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
type TutorialReward = {
  title: string;
  body: string;
  image: string;
};

function mediaSrc(url?: string | null) {
  if (!url) return "/hunt-assets/cards/compass-light.webp";
  if (url.startsWith("/hunt/cards/")) return url.replace("/hunt/cards/", "/hunt-assets/cards/");
  return url;
}

function upgradeCost(card: HuntCard) {
  return card.level * 45 + rarityIndex[card.rarity] * 25;
}

function sellValue(card: HuntCard) {
  const rarity = rarityIndex[card.rarity];
  const baseValue = 18 + rarity * 22;
  const levelValue = Math.max(0, card.level - 1) * (10 + rarity * 5);
  return Math.max(10, Math.floor(baseValue + levelValue));
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

function TutorialRewardDialog({ reward, onClose }: { reward: TutorialReward; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 px-4 pb-[calc(88px+env(safe-area-inset-bottom))] pt-5 backdrop-brightness-75">
      <div className="absolute inset-0" aria-hidden="true" />
      <section className="relative w-full max-w-[430px] overflow-hidden rounded-[30px] border border-cyan-300/25 bg-[radial-gradient(circle_at_72%_10%,rgba(103,232,249,0.18),transparent_38%),linear-gradient(150deg,rgba(8,13,22,0.98),rgba(3,7,18,0.99))] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.62),0_0_45px_rgba(103,232,249,0.14)]">
        <div className="pointer-events-none absolute -bottom-5 -left-9 h-[270px] w-[215px]">
          <img src={reward.image} alt="" className="h-full w-full object-contain object-bottom drop-shadow-[0_22px_42px_rgba(0,0,0,0.48)]" />
        </div>
        <div className="relative ml-[108px] flex min-h-[218px] flex-col">
          <div className="relative rounded-[24px] border border-white/14 bg-white/[0.07] px-4 py-4 shadow-[0_18px_46px_rgba(0,0,0,0.28)] backdrop-blur">
            <span className="absolute -left-3 bottom-10 h-6 w-6 rotate-45 border-b border-l border-white/14 bg-[#111827]/90" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/72">Лира Нокс</p>
            <h2 className="mt-1 text-[22px] font-semibold leading-tight text-white">{reward.title}</h2>
            <p className="mt-2 text-sm leading-6 text-white/70">{reward.body}</p>
          </div>
          <Button onClick={onClose} className={cn("mt-3 ml-auto h-12 rounded-2xl bg-cyan-200 px-5 text-slate-950 hover:bg-cyan-100", huntInteractiveClass)}>
            Продолжить
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>
    </div>
  );
}

export default function HuntCardsPage() {
  const { locale, t } = useI18n("ru");
  const router = useRouter();
  const [overview, setOverview] = useState<HuntOverview>(() => ({ ...getCachedHuntOverview(), cards: [] }));
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(getCachedHuntOverview().profile.cardsOwnedCount);
  const [duplicateCounts, setDuplicateCounts] = useState(new Map<string, number>());
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("rarity");
  const [sortOpen, setSortOpen] = useState(false);
  const [elementFilter, setElementFilter] = useState<ElementFilter>("all");
  const [busyUuid, setBusyUuid] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const [detailMenuOpen, setDetailMenuOpen] = useState(false);
  const [sellConfirmCard, setSellConfirmCard] = useState<HuntCard | null>(null);
  const [upgradeView, setUpgradeView] = useState<UpgradeView | null>(null);
  const [tutorialReward, setTutorialReward] = useState<TutorialReward | null>(null);

  const refresh = useCallback(async (force = false) => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const next = await getHuntCollectionOverview(force, { page, sort: sortMode, element: elementFilter, query, locale });
      if (id !== requestId.current) return;
      setOverview(next);
      setTotal(next.collection.total);
      setPages(next.collection.pages);
      setPage(next.collection.page);
      setDuplicateCounts(new Map(Object.entries(next.collection.speciesCounts)));
    } catch {
      if (id === requestId.current) setNotice("Не удалось загрузить коллекцию. Обновите страницу.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [page, sortMode, elementFilter, query, locale]);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 200);
    return () => { clearTimeout(timer); requestId.current++; };
  }, [refresh]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const cards = overview.cards;

  const selectedCard = selectedUuid ? overview.cards.find((card) => card.uuid === selectedUuid) ?? null : null;
  const currentSort = sortOptions.find((option) => option.value === sortMode) ?? sortOptions[0];
  const forceUpgradeTutorial = !overview.profile.tutorialCompletedAt && overview.profile.huntTutorialStep === "UPGRADE";
  const tutorialFirstCardUuid = forceUpgradeTutorial ? cards[0]?.uuid : null;

  useEffect(() => {
    if (!forceUpgradeTutorial) return;
    if (page !== 1) setPage(1);
    if (elementFilter !== "all") setElementFilter("all");
    if (query) setQuery("");
  }, [forceUpgradeTutorial, page, elementFilter, query]);

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
      if (!overview.profile.tutorialCompletedAt && overview.profile.huntTutorialStep === "UPGRADE") {
        const tutorial = await advanceHuntTutorial("upgrade_done");
        if (tutorial.ok) {
          setTutorialReward({
            image: "/hunt-assets/tutorial/lira-bloomy.png",
            title: "Смотри, какой милашка",
            body: "Я нашла Блуми в кусту. Он пытался выглядеть загадочно, но выдал себя тем, что радостно шуршал листьями. Теперь у нас три героя: огонь, вода и природа. Стихия влияет на урон по другим стихиям, так что команда уже начинает играть головой.",
          });
        } else {
          router.push("/hunt");
        }
        setUpgradeView(null);
      }
      await refresh(true);
    } else {
      setNotice(result.message);
    }
    setBusyUuid(null);
  }

  const selectedUpgradeCost = selectedCard ? upgradeCost(selectedCard) : 0;
  const selectedSellValue = selectedCard ? sellValue(selectedCard) : 0;

  useEffect(() => {
    setDetailMenuOpen(false);
  }, [selectedUuid]);

  async function sellCard(card: HuntCard) {
    if (busyUuid) return;
    setBusyUuid(card.uuid);
    const result = await sellHuntCard(card.uuid);
    if (result.ok) {
      setSellConfirmCard(null);
      setSelectedUuid(null);
      setOverview((current) => ({
        ...current,
        profile: result.data.profile,
        cards: current.cards.filter((item) => item.uuid !== result.data.soldCardUuid),
      }));
      setNotice(`Карта продана за ${result.data.reward} NearCoin.`);
      await refresh(true);
    } else {
      setNotice(result.message);
    }
    setBusyUuid(null);
  }

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
            <span className="font-semibold text-white">{total}</span>
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
            maxLength={100}
            onChange={(event) => { setLoading(true); setPage(1); setQuery(event.target.value); }}
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
                    if (option.value !== sortMode) setLoading(true);
                    setPage(1);
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
                onClick={() => { if (option !== elementFilter || page !== 1) setLoading(true); setPage(1); setElementFilter(option); }}
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

      <nav aria-label="Страницы коллекции" className="sticky top-0 z-20 mb-4 flex items-center justify-between gap-3 bg-[#080c10] py-2">
        <Button aria-label="Предыдущая страница" title="Предыдущая страница" variant="outline" disabled={loading || page <= 1} onClick={() => { setLoading(true); setPage(p => p - 1); }}><ArrowLeft className="h-4 w-4" /></Button>
        <span aria-live="polite" className="text-sm text-white/70">{loading ? "Загрузка…" : `${page} / ${pages}`}</span>
        <Button aria-label="Следующая страница" title="Следующая страница" variant="outline" disabled={loading || page >= pages} onClick={() => { setLoading(true); setPage(p => p + 1); }}><ArrowRight className="h-4 w-4" /></Button>
      </nav>
      <section aria-busy={loading} className={cn("grid grid-cols-3 gap-2", loading && "opacity-50 pointer-events-none")}>
        {!loading && overview.cards.length === 0 && (
          <div className="col-span-3 rounded-3xl border border-dashed border-white/15 p-5 text-center text-sm text-white/54">{total ? "Карточки не найдены." : t("client.hunt.cards.empty")}</div>
        )}
        {overview.cards.length > 0 && cards.length === 0 && (
          <div className="col-span-3 rounded-3xl border border-dashed border-white/15 p-5 text-center text-sm text-white/54">Карточки не найдены.</div>
        )}
        {cards.map((card, index) => {
          const ElementIcon = elementMeta[card.element].icon;
          const duplicateCount = duplicateCounts.get(card.species.slug) ?? 1;
          const tutorialTarget = forceUpgradeTutorial && !upgradeView && card.uuid === tutorialFirstCardUuid && !selectedCard;

          return (
            <button
              key={card.uuid}
              type="button"
              disabled={forceUpgradeTutorial && !tutorialTarget}
              onClick={() => setSelectedUuid(card.uuid)}
              className={cn(
                "group relative aspect-[3/4] overflow-hidden rounded-2xl border bg-slate-950 p-0 text-left shadow-[0_18px_42px_rgba(0,0,0,0.22)]",
                huntInteractiveClass,
                rarityClass[card.rarity],
                tutorialTarget && "z-[55] shadow-[0_0_0_3px_rgba(165,243,252,0.72),0_0_44px_rgba(103,232,249,0.34)]",
                forceUpgradeTutorial && !tutorialTarget && "pointer-events-none",
              )}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,rgba(103,232,249,0.12),rgba(2,6,12,0.25)_52%,rgba(2,6,12,0.62))]">
                <img src={mediaSrc(card.species.imageUrl)} alt="" className={cn("absolute inset-0 h-full w-full object-contain object-center transition", cardImageScale(card.species.slug), huntCreatureImageClass(card.species.slug))} />
                <span className="absolute left-2 top-2 rounded-full border border-black/30 bg-black/44 px-2 py-1 text-[11px] font-semibold text-white/74 backdrop-blur">
                  #{String((page - 1) * 20 + index + 1).padStart(3, "0")}
                </span>
                <span className={cn("absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border backdrop-blur", elementMeta[card.element].className)} title={elementMeta[card.element].label}>
                  <ElementIcon className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="absolute inset-x-0 bottom-0 min-w-0 bg-gradient-to-t from-black/88 via-black/62 to-transparent p-2.5 pt-10">
                <h2 className="truncate text-[13px] font-semibold leading-4 text-white">{huntSpeciesName(card.species, locale)}</h2>
                <div className="mt-1 flex items-center justify-between gap-1">
                  <Badge className={cn("max-w-full truncate px-1.5 py-0.5 text-[9px]", rarityBadgeClass[card.rarity])}>{huntRarityLabel(card.rarity, t)}</Badge>
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

      {forceUpgradeTutorial && !selectedCard && !upgradeView && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-brightness-75" aria-hidden="true" />
          <div className="fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-[60] mx-auto w-full max-w-[430px] px-4">
            <div className="relative min-h-[184px]">
              <img src="/hunt-assets/tutorial/lira-point.png" alt="" className="pointer-events-none absolute -bottom-2 -left-5 h-48 w-36 object-contain object-bottom drop-shadow-[0_18px_34px_rgba(0,0,0,0.5)]" />
              <div className="ml-24 rounded-[24px] border border-cyan-200/24 bg-slate-950/96 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.58)] backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/70">Лира Нокс</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Выбери этого героя</h2>
                <p className="mt-2 text-sm leading-5 text-white/68">Наш боец уже ждёт апгрейд. Тапни по карте, посмотрим его силу и поднимем уровень перед следующим матчем.</p>
              </div>
            </div>
          </div>
        </>
      )}

      <Dialog open={Boolean(selectedCard)} onOpenChange={(open) => !open && !forceUpgradeTutorial && setSelectedUuid(null)}>
        <DialogContent showClose={false} className={cn("hide-scrollbar max-h-[92dvh] w-[calc(100vw-1.25rem)] max-w-[430px] overflow-y-auto rounded-[24px] border-white/10 bg-[#030812] p-3 text-white shadow-[0_30px_90px_rgba(0,0,0,0.72)]", forceUpgradeTutorial && "z-[65]")}>
          {selectedCard && (
            <>
              <div className="absolute inset-0 rounded-[24px] bg-[radial-gradient(circle_at_15%_10%,rgba(52,211,153,0.16),transparent_32%),radial-gradient(circle_at_92%_5%,rgba(103,232,249,0.12),transparent_28%)] pointer-events-none" />
              <DialogTitle className="sr-only">{huntSpeciesName(selectedCard.species, locale)}</DialogTitle>

              <div className="relative flex items-center justify-between gap-2">
                <button type="button" onClick={() => { if (!forceUpgradeTutorial) setSelectedUuid(null); }} disabled={forceUpgradeTutorial} className={cn("flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/78", huntInteractiveClass, forceUpgradeTutorial && "opacity-35")} aria-label="Назад">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-10 items-center gap-2 rounded-2xl border border-cyan-200/20 bg-white/[0.06] px-3">
                    <Zap className="h-4 w-4 text-cyan-100" />
                    <span className="truncate text-sm font-semibold text-cyan-50">{overview.profile.influenceBalance} NearCoin</span>
                  </div>
                  <div className="relative">
                    <button type="button" onClick={() => setDetailMenuOpen((open) => !open)} disabled={forceUpgradeTutorial} className={cn("flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/78", huntInteractiveClass, forceUpgradeTutorial && "opacity-35")} aria-label="Меню">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {detailMenuOpen && (
                      <div className="absolute right-0 top-12 z-[85] w-52 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/96 p-1 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur">
                        <button
                          type="button"
                          disabled={busyUuid === selectedCard.uuid || total <= 1}
                          onClick={() => {
                            setDetailMenuOpen(false);
                            setSellConfirmCard(selectedCard);
                            setSelectedUuid(null);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-amber-50 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-45",
                            huntInteractiveClass,
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <WalletCards className="h-4 w-4 text-amber-200" />
                            Продать
                          </span>
                          <span className="text-xs text-cyan-100">{selectedSellValue} NC</span>
                        </button>
                        {total <= 1 && <p className="px-3 pb-2 text-[11px] leading-4 text-white/45">Последнюю карту продать нельзя.</p>}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="relative grid gap-3">
                <div className="grid grid-cols-[minmax(0,52%)_1fr] gap-2">
                  <div className={cn("overflow-hidden rounded-[22px] border bg-[radial-gradient(circle_at_50%_42%,rgba(103,232,249,0.18),rgba(2,6,12,0.72)_58%,rgba(2,6,12,0.96))]", rarityClass[selectedCard.rarity])}>
                    <div className="relative aspect-square min-h-[190px]">
                      <img src={mediaSrc(selectedCard.species.imageUrl)} alt="" className={cn("absolute inset-0 h-full w-full object-contain object-center", revealImageScale(selectedCard.species.slug), huntCreatureImageClass(selectedCard.species.slug))} />
                      <div className="absolute left-2 top-2">
                        <ElementBadge element={selectedCard.element} />
                      </div>
                      <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-1 bg-gradient-to-t from-black/86 via-black/50 to-transparent px-2 pb-2 pt-12">
                        <Badge className={cn("px-2 py-1 text-[10px]", rarityBadgeClass[selectedCard.rarity])}>{huntRarityLabel(selectedCard.rarity, t)}</Badge>
                        <Badge className="border-white/10 bg-white/[0.08] px-2 py-1 text-[10px] text-white">
                          <Star className="mr-1 h-3 w-3 fill-amber-200 text-amber-200" />
                          {t("client.hunt.levelShort")} {selectedCard.level}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-1.5">
                    {huntStatEntries(selectedCard.stats).map(([key, value]) => <StatValueBar key={key} label={key} value={value} />)}
                  </div>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-2xl font-semibold leading-tight text-white">{huntSpeciesName(selectedCard.species, locale)}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge className={cn("px-2.5 py-1 text-xs", rarityBadgeClass[selectedCard.rarity])}>{huntRarityLabel(selectedCard.rarity, t)}</Badge>
                      <ElementBadge element={selectedCard.element} />
                      <Badge className="border-white/10 bg-white/[0.08] px-2.5 py-1 text-xs text-white">
                        <Copy className="mr-1 h-3.5 w-3.5" />
                        x{duplicateCounts.get(selectedCard.species.slug) ?? 1}
                      </Badge>
                    </div>
                  </div>
                  <button type="button" className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-200/18 bg-white/[0.05] text-rose-200", huntInteractiveClass)} aria-label="Любимая карточка">
                    <Heart className="h-5 w-5" />
                  </button>
                </div>

                <p className="line-clamp-3 text-sm leading-5 text-white/62">{huntSpeciesDescription(selectedCard.species, locale)}</p>

                <div className="grid grid-cols-2 gap-2">
                  <Button disabled={busyUuid === selectedCard.uuid || selectedCard.level >= 30 || overview.profile.influenceBalance < selectedUpgradeCost} className={cn("h-12 rounded-2xl bg-cyan-200 text-sm font-semibold text-slate-950 hover:bg-cyan-100", huntInteractiveClass, forceUpgradeTutorial && "relative z-[80] shadow-[0_0_0_3px_rgba(165,243,252,0.85),0_0_44px_rgba(103,232,249,0.48)]")} onClick={() => void upgradeCard(selectedCard)}>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    {selectedCard.level >= 30 ? "Макс. уровень" : `${t("client.hunt.cards.upgrade")} · ${selectedUpgradeCost} NC`}
                  </Button>
                  <Button asChild variant="secondary" className={cn("h-12 rounded-2xl border-white/10 bg-white/[0.06] text-sm font-semibold", huntInteractiveClass, forceUpgradeTutorial && "pointer-events-none opacity-35")}>
                    <Link href={`/hunt/cards/${selectedCard.uuid}/awaken`}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Пробудить
                    </Link>
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(sellConfirmCard)} onOpenChange={(open) => !open && setSellConfirmCard(null)}>
        <DialogContent showClose={false} className="w-[calc(100vw-1.5rem)] max-w-[390px] rounded-[24px] border-amber-200/18 bg-[#050914] p-5 text-white shadow-[0_26px_80px_rgba(0,0,0,0.7)]">
          {sellConfirmCard && (
            <>
              <DialogTitle className="text-xl font-semibold">Продать карту?</DialogTitle>
              <p className="mt-2 text-sm leading-5 text-white/62">
                {huntSpeciesName(sellConfirmCard.species, locale)} исчезнет из коллекции. За продажу ты получишь {sellValue(sellConfirmCard)} NearCoin.
              </p>
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <div className={cn("h-16 w-16 shrink-0 overflow-hidden rounded-2xl border bg-slate-950", rarityClass[sellConfirmCard.rarity])}>
                  <img src={mediaSrc(sellConfirmCard.species.imageUrl)} alt="" className={cn("h-full w-full object-contain object-center", revealImageScale(sellConfirmCard.species.slug), huntCreatureImageClass(sellConfirmCard.species.slug))} />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{huntSpeciesName(sellConfirmCard.species, locale)}</p>
                  <p className="mt-1 text-xs text-white/50">
                    {huntRarityLabel(sellConfirmCard.rarity, t)} · Ур. {sellConfirmCard.level}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-cyan-100">+{sellValue(sellConfirmCard)} NC</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button variant="secondary" disabled={busyUuid === sellConfirmCard.uuid} onClick={() => setSellConfirmCard(null)} className={cn("h-12 rounded-2xl border-white/10 bg-white/[0.06] text-sm font-semibold", huntInteractiveClass)}>
                  Отмена
                </Button>
                <Button disabled={busyUuid === sellConfirmCard.uuid} onClick={() => void sellCard(sellConfirmCard)} className={cn("h-12 rounded-2xl bg-amber-200 text-sm font-semibold text-slate-950 hover:bg-amber-100", huntInteractiveClass)}>
                  <WalletCards className="mr-2 h-4 w-4" />
                  Продать
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {forceUpgradeTutorial && selectedCard && !upgradeView && (
        <>
          <div className="fixed inset-0 z-[55] bg-black/30 backdrop-brightness-75" aria-hidden="true" />
          <div className="fixed inset-x-0 top-[calc(74px+env(safe-area-inset-top))] z-[75] mx-auto w-full max-w-[430px] px-4">
            <div className="relative min-h-[172px]">
              <img src="/hunt-assets/tutorial/lira-reward.png" alt="" className="pointer-events-none absolute -bottom-2 -left-5 h-40 w-32 object-contain object-bottom drop-shadow-[0_18px_34px_rgba(0,0,0,0.5)]" />
              <div className="ml-24 rounded-[24px] border border-cyan-200/24 bg-slate-950/96 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.58)] backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/70">Лира Нокс</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Подними уровень</h2>
                <p className="mt-2 text-sm leading-5 text-white/68">Жми улучшение. После этого герой станет крепче, быстрее или опаснее, а в бою это сразу почувствуется.</p>
              </div>
            </div>
          </div>
        </>
      )}

      <Dialog open={Boolean(upgradeView)} onOpenChange={(open) => !open && !(forceUpgradeTutorial && upgradeView?.upgrade.status === "PENDING_BONUS") && setUpgradeView(null)}>
        <DialogContent showClose={false} className="hide-scrollbar max-h-[92dvh] w-[calc(100vw-1.25rem)] max-w-[430px] overflow-y-auto rounded-[24px] border-emerald-300/20 bg-[#030812] p-3 text-white shadow-[0_30px_90px_rgba(0,0,0,0.72)]">
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
                  <button type="button" onClick={() => { if (!(forceUpgradeTutorial && upgradeView.upgrade.status === "PENDING_BONUS")) setUpgradeView(null); }} disabled={forceUpgradeTutorial && upgradeView.upgrade.status === "PENDING_BONUS"} className={cn("flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/78", huntInteractiveClass, forceUpgradeTutorial && upgradeView.upgrade.status === "PENDING_BONUS" && "opacity-35")} aria-label="Закрыть">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {forceUpgradeTutorial && upgradeView.upgrade.status === "PENDING_BONUS" && (
                <div className="relative grid min-h-[134px] grid-cols-[82px_minmax(0,1fr)] items-end rounded-[22px] border border-cyan-200/24 bg-[linear-gradient(135deg,rgba(20,45,52,0.92),rgba(8,15,27,0.96))] p-3 shadow-[0_16px_44px_rgba(0,0,0,0.28)]">
                  <img src="/hunt-assets/tutorial/lira-reward.png" alt="" className="pointer-events-none h-[118px] w-[92px] self-end object-contain object-bottom drop-shadow-[0_14px_24px_rgba(0,0,0,0.46)]" />
                  <div className="relative mb-1 rounded-[20px] border border-white/12 bg-slate-950/58 px-4 py-3">
                    <span className="absolute -left-2 bottom-8 h-4 w-4 rotate-45 border-b border-l border-white/12 bg-[#10202f]" aria-hidden="true" />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/70">Лира Нокс</p>
                    <h2 className="mt-0.5 text-base font-semibold text-white">Выбери бонусную стату</h2>
                    <p className="mt-1 text-xs leading-5 text-white/68">После апгрейда можно добавить ещё один плюс. Для первого раза советую атаку или здоровье, но выбор за тобой.</p>
                  </div>
                </div>
              )}

              <div className="relative grid gap-3">
                <div className="grid grid-cols-[38%_1fr] gap-3">
                <div className={cn("overflow-hidden rounded-[22px] border bg-[radial-gradient(circle_at_50%_42%,rgba(132,204,22,0.18),rgba(2,6,12,0.72)_58%,rgba(2,6,12,0.96))]", rarityClass[upgradeView.card.rarity])}>
                  <div className="relative h-[160px]">
                    <img src={mediaSrc(upgradeView.card.species.imageUrl)} alt="" className={cn("absolute inset-0 h-full w-full object-contain object-center", revealImageScale(upgradeView.card.species.slug), huntCreatureImageClass(upgradeView.card.species.slug))} />
                    <div className="absolute left-3 top-3">
                      <Badge className={rarityBadgeClass[upgradeView.card.rarity]}>{huntRarityLabel(upgradeView.card.rarity, t)}</Badge>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/84 via-black/48 to-transparent p-4 pt-20 text-center">
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

                <div className="flex flex-col gap-2">
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
                </div>
                </div>

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
                          className={cn("min-h-[92px] rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left", pending && huntInteractiveClass, pending && forceUpgradeTutorial && "shadow-[0_0_0_1px_rgba(190,242,100,0.35),0_0_20px_rgba(190,242,100,0.14)]", bonusActive && "border-lime-200/35 bg-lime-300/10")}
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
            </>
          )}
        </DialogContent>
      </Dialog>
      {tutorialReward && (
        <TutorialRewardDialog
          reward={tutorialReward}
          onClose={() => {
            setTutorialReward(null);
            router.push("/hunt");
          }}
        />
      )}
    </main>
  );
}
