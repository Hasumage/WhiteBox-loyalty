"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Boxes, CheckCircle2, Clock3, Gift, HelpCircle, ListChecks, PackageOpen, ShieldQuestion, Sparkles, Star, Tags, WalletCards, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { YandexRtbAd } from "@/components/ads/YandexRtbAd";
import { advanceHuntTutorial, getCachedHuntOverview, getHuntOverview, openHuntBox, type HuntBoxOffer, type HuntBoxReward, type HuntBoxType, type HuntOverview, type HuntRarity } from "@/lib/api/twa-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";
import { CreatureGlyph, elementMeta, huntInteractiveClass, huntRarityLabel, huntSpeciesName, huntStatEntries, rarityBadgeClass, rarityClass, StatValueBar } from "../_components/hunt-ui";

type ShopFilter = "all" | "boxes" | "limited";

type ShopItem = {
  id: string;
  configId?: string;
  boxType: HuntBoxType;
  image: string;
  title: string;
  description: string;
  cost: number;
  filter: ShopFilter;
  accent: string;
  minRarity: string;
  limited?: boolean;
  itemCountMin: number;
  itemCountMax: number;
  dailyLimit: number | null;
  statusDropChance: number;
  rarityChances: HuntBoxOffer["rarityChances"];
  guaranteedRarity: HuntBoxOffer["guaranteedRarity"];
  guaranteedCount: number;
  rotationElement: HuntBoxOffer["rotationElement"];
  rotationEndsAt: string | null;
};

type OpeningBox = {
  id: string;
  image: string;
  title: string;
  accent: string;
};

const HUNT_SHOP_BANNER_AD_BLOCK_ID = process.env.NEXT_PUBLIC_YANDEX_RSYA_HUNT_SHOP_BANNER_BLOCK_ID;

const filters: Array<{ id: ShopFilter; labelKey: TranslationKey }> = [
  { id: "all", labelKey: "client.hunt.shop.filterAll" },
  { id: "boxes", labelKey: "client.hunt.shop.filterBoxes" },
  { id: "limited", labelKey: "client.hunt.shop.filterLimited" },
];

const fallbackShopItems: ShopItem[] = [
  {
    id: "promo",
    boxType: "PROMO",
    image: "/hunt-assets/shop/promo-box.png",
    title: "Промо-бокс",
    description: "Один бесплатный бокс в сутки. Дроп не выше эпической редкости.",
    cost: 0,
    filter: "boxes",
    accent: "border-emerald-300/45",
    minRarity: "COMMON-EPIC",
    itemCountMin: 1,
    itemCountMax: 2,
    dailyLimit: 1,
    statusDropChance: 5.5,
    rarityChances: [
      { rarity: "COMMON", weight: 5200, chance: 52, enabled: true },
      { rarity: "UNCOMMON", weight: 3000, chance: 30, enabled: true },
      { rarity: "RARE", weight: 1400, chance: 14, enabled: true },
      { rarity: "EPIC", weight: 400, chance: 4, enabled: true },
      { rarity: "LEGENDARY", weight: 0, chance: 0, enabled: false },
    ],
    guaranteedRarity: null,
    guaranteedCount: 0,
    rotationElement: null,
    rotationEndsAt: null,
  },
  {
    id: "city",
    boxType: "POST",
    image: "/hunt-assets/shop/district-box-v2.png",
    title: "Районная коробка",
    description: "Базовая коробка Nearloy для обычных постов о местах и районных находок.",
    cost: 120,
    filter: "boxes",
    accent: "border-cyan-300/35",
    minRarity: "COMMON+",
    itemCountMin: 1,
    itemCountMax: 1,
    dailyLimit: null,
    statusDropChance: 2.5,
    rarityChances: [],
    guaranteedRarity: null,
    guaranteedCount: 0,
    rotationElement: null,
    rotationEndsAt: null,
  },
  {
    id: "rare",
    boxType: "CATEGORY",
    image: "/hunt-assets/shop/rare-card-crate.webp",
    title: "Редкая коробка",
    description: "Коробка с повышенным шансом редких и эпических персонажей.",
    cost: 300,
    filter: "boxes",
    accent: "border-violet-300/45",
    minRarity: "UNCOMMON+",
    itemCountMin: 1,
    itemCountMax: 2,
    dailyLimit: null,
    statusDropChance: 4.2,
    rarityChances: [],
    guaranteedRarity: null,
    guaranteedCount: 0,
    rotationElement: null,
    rotationEndsAt: null,
  },
  {
    id: "weekly",
    boxType: "DISTRICT",
    image: "/hunt-assets/shop/weekly-gold-chest.webp",
    title: "Королевский дроп",
    description: "Большой недельный сундук: гарантирует эпического персонажа и даёт несколько дополнительных предметов.",
    cost: 1000,
    filter: "limited",
    accent: "border-amber-300/55",
    minRarity: "COMMON+",
    limited: true,
    itemCountMin: 3,
    itemCountMax: 5,
    dailyLimit: null,
    statusDropChance: 9,
    rarityChances: [],
    guaranteedRarity: "EPIC",
    guaranteedCount: 1,
    rotationElement: null,
    rotationEndsAt: null,
  },
  {
    id: "elemental-weekly",
    boxType: "ELEMENTAL",
    image: "/hunt-assets/shop/elemental-nature-box-v2.png",
    title: "Стихийный дроп недели",
    description: "Недельная коробка текущей стихии. Выпадают только персонажи этой стихии, не выше эпической редкости.",
    cost: 420,
    filter: "boxes",
    accent: "border-emerald-300/45",
    minRarity: "COMMON-EPIC",
    itemCountMin: 2,
    itemCountMax: 3,
    dailyLimit: null,
    statusDropChance: 4,
    rarityChances: [
      { rarity: "COMMON", weight: 3600, chance: 36, enabled: true },
      { rarity: "UNCOMMON", weight: 3300, chance: 33, enabled: true },
      { rarity: "RARE", weight: 2300, chance: 23, enabled: true },
      { rarity: "EPIC", weight: 800, chance: 8, enabled: true },
      { rarity: "LEGENDARY", weight: 0, chance: 0, enabled: false },
    ],
    guaranteedRarity: null,
    guaranteedCount: 0,
    rotationElement: "NATURE",
    rotationEndsAt: null,
  },
  {
    id: "resource",
    boxType: "TRENDING",
    image: "/hunt-assets/shop/city-box-v2.png",
    title: "Городская коробка",
    description: "Городская коробка для развития коллекции: обычные, необычные и редкие персонажи с шансом на эпик.",
    cost: 650,
    filter: "boxes",
    accent: "border-sky-300/45",
    minRarity: "COMMON+",
    itemCountMin: 2,
    itemCountMax: 3,
    dailyLimit: null,
    statusDropChance: 6.5,
    rarityChances: [],
    guaranteedRarity: null,
    guaranteedCount: 0,
    rotationElement: null,
    rotationEndsAt: null,
  },
];

function fill(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, String(value)), template);
}

function chanceAtLeastOncePerBox(perItemChance: number, itemCountMin: number, itemCountMax: number, guaranteedSlots = 0) {
  const min = Math.max(1, itemCountMin);
  const max = Math.max(min, itemCountMax);
  let totalChance = 0;
  let variants = 0;
  for (let count = min; count <= max; count += 1) {
    const rolledSlots = Math.max(0, count - guaranteedSlots);
    totalChance += rolledSlots > 0 ? 1 - (1 - perItemChance) ** rolledSlots : 0;
    variants += 1;
  }
  return variants > 0 ? totalChance / variants : 0;
}

function normalizeBoxChances(item: ShopItem): ShopItem {
  const enabledTotal = item.rarityChances.filter((entry) => entry.enabled).reduce((sum, entry) => sum + entry.weight, 0);
  if (enabledTotal <= 0) return item;
  return {
    ...item,
    rarityChances: item.rarityChances.map((entry) => {
      const guaranteed = item.guaranteedRarity === entry.rarity && item.guaranteedCount > 0;
      const perItemChance = entry.enabled ? entry.weight / enabledTotal : 0;
      return {
        ...entry,
        chance: guaranteed
          ? 100
          : Math.round(chanceAtLeastOncePerBox(perItemChance, item.itemCountMin, item.itemCountMax, item.guaranteedCount) * 10000) / 100,
      };
    }),
  };
}

function itemForBoxType(boxType: HuntBoxType) {
  return fallbackShopItems.find((item) => item.boxType === boxType) ?? fallbackShopItems[0];
}

function isHuntRarity(value: string): value is HuntRarity {
  return value === "COMMON" || value === "UNCOMMON" || value === "RARE" || value === "EPIC" || value === "LEGENDARY";
}

function rarityLabel(value: string, t: (key: TranslationKey) => string) {
  return isHuntRarity(value) ? huntRarityLabel(value, t) : value;
}

function rarityShortLabel(value: string, t: (key: TranslationKey) => string) {
  const labels: Record<HuntRarity, TranslationKey> = {
    COMMON: "client.hunt.rarityShort.common",
    UNCOMMON: "client.hunt.rarityShort.uncommon",
    RARE: "client.hunt.rarityShort.rare",
    EPIC: "client.hunt.rarityShort.epic",
    LEGENDARY: "client.hunt.rarityShort.legendary",
  };
  return isHuntRarity(value) ? t(labels[value]) : value;
}

function rarityRangeLabel(value: string, t: (key: TranslationKey) => string) {
  return value
    .split("-")
    .map((part) => {
      const hasPlus = part.endsWith("+");
      const clean = hasPlus ? part.slice(0, -1) : part;
      return `${rarityShortLabel(clean, t)}${hasPlus ? "+" : ""}`;
    })
    .join("-");
}

function boxTypeLabel(type: HuntBoxType, t: (key: TranslationKey) => string) {
  const labels: Record<HuntBoxType, TranslationKey> = {
    DAILY: "client.hunt.shop.boxTypeDaily",
    POST: "client.hunt.shop.boxTypePost",
    DISTRICT: "client.hunt.shop.boxTypeDistrict",
    ELEMENTAL: "client.hunt.shop.boxTypeElemental",
    CATEGORY: "client.hunt.shop.boxTypeCategory",
    TRENDING: "client.hunt.shop.boxTypeTrending",
    PROMO: "client.hunt.shop.boxTypePromo",
    FOUNDER: "client.hunt.shop.boxTypeFounder",
    PARTNER: "client.hunt.shop.boxTypePartner",
  };
  return t(labels[type]);
}

function timeUntilLabel(value: string | null, t: (key: TranslationKey) => string) {
  if (!value) return "";
  const ms = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return t("client.hunt.shop.rotationSoon");
  const totalHours = Math.ceil(ms / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days <= 0) return fill(t("client.hunt.shop.rotationHours"), { hours });
  return fill(t("client.hunt.shop.rotationDaysHours"), { days, hours });
}

function RewardPreview({ reward }: { reward: HuntBoxReward }) {
  const { locale, t } = useI18n("ru");

  if (reward.kind === "PROFILE_STATUS") {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
        <motion.div
          initial={{ scale: 0.72, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 210, damping: 16 }}
          className="relative flex h-36 w-36 items-center justify-center rounded-[2rem] border border-amber-200/30 bg-[radial-gradient(circle_at_50%_30%,rgba(250,204,21,0.34),rgba(8,13,22,0.88))] shadow-[0_0_60px_rgba(250,204,21,0.22)]"
        >
          <Tags className="h-16 w-16 text-amber-100" />
          <span className="absolute inset-3 rounded-[1.5rem] border border-white/10" />
        </motion.div>
        <Badge className="mt-5 border-amber-200/25 bg-amber-200/10 text-amber-100">{rarityLabel(reward.rarity, t)}</Badge>
        <h2 className="mt-3 text-2xl font-semibold">{reward.status.title}</h2>
        <p className="mt-2 max-w-xs text-sm leading-6 text-white/62">{reward.status.description}</p>
      </div>
    );
  }

  const card = reward.card;
  return (
    <div className="min-h-[360px]">
      <div className="flex flex-col items-center text-center">
        <motion.div initial={{ scale: 0.72, rotateY: -18 }} animate={{ scale: 1, rotateY: 0 }} transition={{ delay: 0.1, type: "spring", stiffness: 210, damping: 16 }}>
          <CreatureGlyph card={card} size="lg" />
        </motion.div>
        <h2 className="mt-4 text-2xl font-semibold">{huntSpeciesName(card.species, locale)}</h2>
        <p className="mt-1 text-sm text-white/64">{card.trait}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {huntStatEntries(card.stats).map(([key, value]) => <StatValueBar key={key} label={key} value={value} />)}
      </div>
    </div>
  );
}

function BoxOpeningReveal({ box, rewards, onClose }: { box: OpeningBox; rewards: HuntBoxReward[]; onClose: () => void }) {
  const { locale, t } = useI18n("ru");
  const particles = Array.from({ length: 18 }, (_, index) => index);
  const [step, setStep] = useState(0);
  const currentReward = rewards[step] ?? null;
  const showingSummary = rewards.length > 0 && step >= rewards.length;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/82 p-4 backdrop-blur-lg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div className="absolute h-[420px] w-[420px] rounded-full bg-cyan-300/10 blur-3xl" animate={{ scale: currentReward ? 1.18 : [0.92, 1.08, 0.96], opacity: currentReward ? 0.42 : [0.2, 0.48, 0.22] }} transition={{ duration: currentReward ? 0.5 : 1.8, repeat: currentReward ? 0 : Infinity, ease: "easeInOut" }} />
      <motion.div className="absolute h-[320px] w-[320px] rounded-full bg-violet-400/10 blur-3xl" animate={{ rotate: 360, opacity: [0.16, 0.32, 0.16] }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }} />

      {particles.map((particle) => {
        const angle = (particle / particles.length) * Math.PI * 2;
        const distance = 112 + (particle % 4) * 22;
        return (
          <motion.span
            key={particle}
            className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-cyan-100 shadow-[0_0_18px_rgba(103,232,249,0.9)]"
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
            animate={{
              x: Math.cos(angle) * distance,
              y: Math.sin(angle) * distance,
              opacity: currentReward ? [0, 0.9, 0] : [0.1, 0.58, 0.1],
              scale: currentReward ? [0.5, 1.25, 0.15] : [0.55, 1, 0.55],
            }}
            transition={{ duration: currentReward ? 1.1 : 2.2, repeat: currentReward ? 0 : Infinity, delay: particle * 0.035, ease: "easeOut" }}
          />
        );
      })}

      <motion.div
        className={cn("relative w-full max-w-sm overflow-hidden rounded-[30px] border bg-slate-950/94 p-4 shadow-[0_34px_90px_rgba(0,0,0,0.72)]", currentReward?.kind === "CARD" ? rarityClass[currentReward.card.rarity] : box.accent)}
        initial={{ y: 18, scale: 0.96, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 18, scale: 0.96, opacity: 0 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(103,232,249,0.18),transparent_42%),radial-gradient(circle_at_20%_80%,rgba(132,204,22,0.12),transparent_34%)] pointer-events-none" />
        <div className="relative mb-3 flex items-center justify-between">
          <Badge className={currentReward?.kind === "CARD" ? rarityBadgeClass[currentReward.card.rarity] : "border-cyan-200/25 bg-cyan-200/10 text-cyan-100"}>
            {showingSummary ? t("client.hunt.reward.summary") : currentReward ? rarityLabel(currentReward.rarity, t) : box.title}
          </Badge>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/70">{currentReward ? `${Math.min(step + 1, rewards.length)} / ${rewards.length}` : t("client.hunt.reward.opening")}</span>
        </div>

        <div className="relative min-h-[360px]">
          <AnimatePresence mode="wait">
            {!currentReward && !showingSummary ? (
              <motion.div
                key="box"
                className="flex min-h-[360px] flex-col items-center justify-center text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.88, filter: "blur(10px)" }}
                transition={{ duration: 0.35 }}
              >
                <motion.div
                  className="relative"
                  animate={{ y: [0, -8, 0], rotate: [-1.5, 1.5, -1.5] }}
                  transition={{ duration: 1.35, repeat: Infinity, ease: "easeInOut" }}
                >
                  <motion.span className="absolute inset-4 rounded-full bg-cyan-200/24 blur-2xl" animate={{ opacity: [0.3, 0.75, 0.3], scale: [0.82, 1.18, 0.82] }} transition={{ duration: 1.2, repeat: Infinity }} />
                  <Image src={box.image} alt="" width={260} height={260} className="relative h-56 w-56 object-contain drop-shadow-[0_0_34px_rgba(103,232,249,0.35)]" priority />
                </motion.div>
                <p className="mt-4 text-2xl font-semibold text-white">{box.title}</p>
                <p className="mt-2 text-sm text-white/58">{t("client.hunt.reward.boxOpening")}</p>
              </motion.div>
            ) : showingSummary ? (
              <motion.div
                key="summary"
                className="min-h-[360px]"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
              >
                <h2 className="text-2xl font-semibold">Выпало</h2>
                <div className="mt-4 grid gap-2">
                  {rewards.map((reward) => (
                    <div key={reward.uuid} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-2">
                      {reward.kind === "CARD" ? (
                        <img src={reward.card.species.imageUrl ?? "/hunt-assets/cards/compass-light.webp"} alt="" className="h-14 w-14 rounded-xl object-cover" />
                      ) : (
                        <span className="flex h-14 w-14 items-center justify-center rounded-xl border border-amber-200/20 bg-amber-200/10 text-amber-100">
                          <Tags className="h-6 w-6" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{reward.kind === "CARD" ? huntSpeciesName(reward.card.species, locale) : reward.status.title}</p>
                        <p className="text-xs text-white/48">{reward.kind === "CARD" ? t("client.hunt.nhCard") : t("client.hunt.reward.status")}</p>
                      </div>
                      <Badge className={reward.kind === "CARD" ? rarityBadgeClass[reward.card.rarity] : "border-amber-200/25 bg-amber-200/10 text-amber-100"}>{rarityLabel(reward.rarity, t)}</Badge>
                    </div>
                  ))}
                </div>
                <Button className={cn("mt-4 w-full rounded-2xl bg-cyan-200 text-slate-950 hover:bg-cyan-100", huntInteractiveClass)} onClick={onClose}>
                  {t("client.hunt.keepCard")}
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key={currentReward.uuid}
                initial={{ opacity: 0, scale: 0.88, rotateY: -18, filter: "blur(12px)" }}
                animate={{ opacity: 1, scale: 1, rotateY: 0, filter: "blur(0px)" }}
                transition={{ type: "spring", stiffness: 180, damping: 20 }}
              >
                <RewardPreview reward={currentReward} />
                <Button className={cn("mt-4 w-full rounded-2xl bg-cyan-200 text-slate-950 hover:bg-cyan-100", huntInteractiveClass)} onClick={() => setStep((current) => current + 1)}>
                  {step + 1 >= rewards.length ? t("client.hunt.reward.showAll") : t("client.hunt.reward.next")}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function HuntShopPage() {
  const { t } = useI18n("ru");
  const router = useRouter();
  const [overview, setOverview] = useState<HuntOverview>(getCachedHuntOverview());
  const [filter, setFilter] = useState<ShopFilter>("all");
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [openingBox, setOpeningBox] = useState<OpeningBox | null>(null);
  const [lastRewards, setLastRewards] = useState<HuntBoxReward[]>([]);
  const [chanceTarget, setChanceTarget] = useState<ShopItem | null>(null);
  const [tutorialReturnHome, setTutorialReturnHome] = useState(false);
  const tutorialBoxRef = useRef<HTMLElement | null>(null);
  const forceFirstBox = !overview.profile.tutorialCompletedAt && overview.profile.huntTutorialStep === "OPEN_FIRST_BOX";

  async function refresh(force = false) {
    setOverview(await getHuntOverview(force));
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (forceFirstBox) setFilter("all");
  }, [forceFirstBox]);

  const shopItems = useMemo(() => {
    if (!overview.boxOffers?.length) return fallbackShopItems.map(normalizeBoxChances);
    return overview.boxOffers.map((offer) => {
      const fallback = itemForBoxType(offer.type);
      const isLimited = offer.type === "DISTRICT";
      return {
        id: offer.slug,
        configId: offer.uuid,
        boxType: offer.type,
        image: offer.imageUrl || fallback.image,
        title: offer.title,
        description: offer.description,
        cost: offer.cost,
        filter: isLimited ? "limited" : "boxes",
        accent: fallback.accent,
        minRarity: offer.maxRarity ? `${offer.minRarity}-${offer.maxRarity}` : `${offer.minRarity}+`,
        limited: isLimited,
        itemCountMin: offer.itemCountMin,
        itemCountMax: offer.itemCountMax,
        dailyLimit: offer.dailyLimit,
        statusDropChance: offer.statusDropChance,
        rarityChances: offer.rarityChances,
        guaranteedRarity: offer.guaranteedRarity,
        guaranteedCount: offer.guaranteedCount,
        rotationElement: offer.rotationElement,
        rotationEndsAt: offer.rotationEndsAt,
      } satisfies ShopItem;
    });
  }, [overview.boxOffers]);

  async function buyBox(item: ShopItem) {
    if (busyItem) return;
    setBusyItem(item.id);
    setNotice(null);
    setLastRewards([]);
    setOpeningBox({ id: item.id, image: item.image, title: item.title, accent: item.accent });
    const result = await openHuntBox(undefined, item.boxType, item.configId);
    if (result.ok) {
      setLastRewards(result.data.rewards?.length ? result.data.rewards : [{ uuid: result.data.card.uuid, kind: "CARD", rarity: result.data.card.rarity, position: 0, card: result.data.card }]);
      if (!overview.profile.tutorialCompletedAt && overview.profile.huntTutorialStep === "OPEN_FIRST_BOX") {
        await advanceHuntTutorial("box_opened");
        setTutorialReturnHome(true);
      }
      await refresh(true);
    } else {
      setOpeningBox(null);
      setNotice(result.message);
    }
    setBusyItem(null);
  }

  async function openGrantedBox(boxUuid: string, boxType: HuntBoxType) {
    if (busyItem) return;
    setBusyItem(boxUuid);
    setNotice(null);
    setLastRewards([]);
    const item = itemForBoxType(boxType);
    setOpeningBox({ id: boxUuid, image: item.image, title: item.title, accent: item.accent });
    const result = await openHuntBox(boxUuid);
    if (result.ok) {
      setLastRewards(result.data.rewards?.length ? result.data.rewards : [{ uuid: result.data.card.uuid, kind: "CARD", rarity: result.data.card.rarity, position: 0, card: result.data.card }]);
      if (!overview.profile.tutorialCompletedAt && overview.profile.huntTutorialStep === "OPEN_FIRST_BOX") {
        await advanceHuntTutorial("box_opened");
      }
      await refresh(true);
    } else {
      setOpeningBox(null);
      setNotice(result.message);
    }
    setBusyItem(null);
  }

  const visibleItems = filter === "all" ? shopItems : shopItems.filter((item) => item.filter === filter || (filter === "limited" && item.limited));
  const tutorialTargetItemId = forceFirstBox ? visibleItems.find((item) => item.boxType === "POST")?.id : null;

  useEffect(() => {
    if (!tutorialTargetItemId) return;
    const timeout = window.setTimeout(() => {
      tutorialBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 260);
    return () => window.clearTimeout(timeout);
  }, [tutorialTargetItemId]);

  return (
    <main className="min-h-full px-4 pb-24 pt-5 text-white">
      <AnimatePresence>
        {openingBox && (
          <BoxOpeningReveal
            box={openingBox}
            rewards={lastRewards}
            onClose={() => {
              setLastRewards([]);
              setOpeningBox(null);
              if (tutorialReturnHome) router.push("/hunt");
            }}
          />
        )}
      </AnimatePresence>
      <header className="mb-4 flex items-center justify-between">
        <Link href="/hunt" className={cn("flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/70", huntInteractiveClass)}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Button type="button" variant="outline" onClick={() => setHelpOpen(true)} className={cn("rounded-2xl border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.07]", huntInteractiveClass)}>
          <HelpCircle className="mr-2 h-4 w-4" />
          {t("client.hunt.shop.how")}
        </Button>
      </header>

      <section className="mb-4">
        <h1 className="text-3xl font-semibold">{t("client.hunt.shop.title")}</h1>
        <p className="mt-1 text-sm text-white/56">{t("client.hunt.shop.subtitle")}</p>
      </section>

      <section className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-cyan-200/20 bg-cyan-200/10 p-3">
          <Sparkles className="mb-2 h-5 w-5 text-cyan-100" />
          <p className="text-lg font-semibold">{overview.profile.influenceBalance}</p>
          <p className="text-xs text-white/50">{t("client.hunt.influence")}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <WalletCards className="mb-2 h-5 w-5 text-violet-200" />
          <p className="text-lg font-semibold">{overview.profile.cardsOwnedCount}</p>
          <p className="text-xs text-white/50">{t("client.hunt.cards")}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <Boxes className="mb-2 h-5 w-5 text-amber-200" />
          <p className="text-lg font-semibold">{overview.boxes.length}</p>
          <p className="text-xs text-white/50">{t("client.hunt.shop.granted")}</p>
        </div>
      </section>

      <section className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {filters.map((item) => (
          <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={cn("shrink-0 rounded-2xl border px-4 py-2 text-sm font-semibold", huntInteractiveClass, filter === item.id ? "border-cyan-200 bg-cyan-200 text-slate-950" : "border-white/10 bg-white/[0.04] text-white/62")}>
            {t(item.labelKey)}
          </button>
        ))}
      </section>

      {notice && <div className="mb-4 rounded-2xl border border-cyan-200/20 bg-cyan-200/10 px-3 py-2 text-sm text-cyan-50">{notice}</div>}

      <YandexRtbAd
        blockId={HUNT_SHOP_BANNER_AD_BLOCK_ID}
        pageNumber={1}
        placement="hunt-shop-banner"
        type="banner"
        className="mb-4"
      />

      {overview.boxes.length > 0 && (
        <section className="mb-4 rounded-3xl border border-cyan-200/20 bg-cyan-200/10 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">{t("client.hunt.shop.granted")}</p>
              <h2 className="text-xl font-semibold">{t("client.hunt.shop.readyBoxes")}</h2>
            </div>
            <Gift className="h-6 w-6 text-cyan-100" />
          </div>
          <div className="grid gap-2">
            {overview.boxes.slice(0, 3).map((box) => (
              <button key={box.uuid} type="button" onClick={() => openGrantedBox(box.uuid, box.type)} className={cn("flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-left", huntInteractiveClass)}>
                <span className="flex items-center gap-2 text-sm font-semibold"><PackageOpen className="h-4 w-4 text-cyan-100" />{boxTypeLabel(box.type, t)}</span>
                <span className="text-xs text-white/50">{rarityLabel(box.rarity, t)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="mb-4 overflow-hidden rounded-3xl border border-violet-300/35 bg-[radial-gradient(circle_at_right,rgba(139,92,246,0.24),rgba(8,13,22,0.86)_48%,rgba(4,6,12,0.98))]">
        <div className="grid grid-cols-[1fr_42%] items-center gap-2 p-4">
          <div>
            <Badge className="mb-3 border-violet-200/25 bg-violet-200/10 text-violet-100">{t("client.hunt.shop.limited")}</Badge>
            <h2 className="text-2xl font-semibold">{t("client.hunt.shop.weeklyDrop")}</h2>
            <p className="mt-2 text-sm leading-6 text-white/62">{t("client.hunt.shop.weeklyDropText")}</p>
            <p className="mt-3 flex items-center gap-2 text-sm text-violet-100"><Clock3 className="h-4 w-4" />{t("client.hunt.shop.weeklyTimer")}</p>
          </div>
          <Image src="/hunt-assets/shop/weekly-gold-chest.webp" alt="" width={320} height={320} className="h-auto w-full drop-shadow-[0_0_28px_rgba(168,85,247,0.35)]" />
        </div>
      </section>

      <section className="grid gap-3">
        {visibleItems.map((item) => {
          const tutorialTarget = forceFirstBox && item.boxType === "POST";
          return (
          <article ref={tutorialTarget ? tutorialBoxRef : undefined} key={item.id} className={cn("grid grid-cols-[112px_1fr] gap-3 rounded-3xl border bg-white/[0.035] p-3", item.accent, tutorialTarget && "relative z-[55] bg-slate-950 shadow-[0_0_0_3px_rgba(165,243,252,0.72),0_0_44px_rgba(103,232,249,0.34)]")}>
            <div className="flex items-center justify-center rounded-2xl bg-black/24">
              <Image src={item.image} alt="" width={160} height={160} className="h-28 w-28 object-contain drop-shadow-[0_0_18px_rgba(103,232,249,0.18)]" />
            </div>
            <div className="min-w-0">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h2 className="truncate text-lg font-semibold">{item.title}</h2>
                {item.limited && <Star className="h-4 w-4 shrink-0 fill-amber-200 text-amber-200" />}
              </div>
              <p className="text-sm leading-5 text-white/58">{item.description}</p>
              {(item.guaranteedRarity || item.rotationEndsAt) && (
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                  {item.guaranteedRarity && item.guaranteedCount > 0 && (
                    <span className="rounded-full border border-violet-200/25 bg-violet-200/10 px-2 py-1 text-violet-100">
                      {fill(t("client.hunt.shop.guaranteed"), { rarity: rarityLabel(item.guaranteedRarity, t), count: item.guaranteedCount })}
                    </span>
                  )}
                  {item.rotationElement && (
                    <span className={cn("rounded-full border px-2 py-1", elementMeta[item.rotationElement].className)}>
                      {elementMeta[item.rotationElement].label}
                    </span>
                  )}
                  {item.rotationEndsAt && (
                    <span className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-2 py-1 text-cyan-100">
                      {timeUntilLabel(item.rotationEndsAt, t)}
                    </span>
                  )}
                </div>
              )}
              <div className="mt-3 flex items-center justify-between gap-3">
                <button type="button" onClick={() => setChanceTarget(item)} className={cn("inline-flex h-11 max-w-[190px] items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-3 text-xs font-semibold tracking-[0.08em] text-white/78", huntInteractiveClass)}>
                  <ShieldQuestion className="h-4 w-4 shrink-0 text-cyan-200" />
                  <span className="truncate whitespace-nowrap">{rarityRangeLabel(item.minRarity, t)}</span>
                </button>
                <Button type="button" disabled={busyItem != null || overview.profile.influenceBalance < item.cost || (forceFirstBox && !tutorialTarget)} onClick={() => buyBox(item)} className={cn("rounded-2xl bg-cyan-200 px-4 text-slate-950 hover:bg-cyan-100", huntInteractiveClass)}>
                  <Zap className="mr-1.5 h-4 w-4" />
                  {fill(t("client.hunt.shop.buyFor"), { cost: item.cost })}
                </Button>
              </div>
            </div>
          </article>
        );})}
      </section>

      {forceFirstBox && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-brightness-75" aria-hidden="true" />
          <div className="fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-[60] mx-auto w-full max-w-[430px] px-4">
            <div className="relative min-h-[188px]">
              <img src="/hunt-assets/tutorial/lira-point.png" alt="" className="pointer-events-none absolute -bottom-2 -left-5 h-48 w-36 object-contain object-bottom drop-shadow-[0_18px_34px_rgba(0,0,0,0.5)]" />
              <div className="ml-24 rounded-[24px] border border-cyan-200/24 bg-slate-950/96 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.58)] backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/70">Лира Нокс</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Бери районную коробку</h2>
                <p className="mt-2 text-sm leading-5 text-white/68">Вот она, наш первый дроп. Нажимай на покупку, а я прослежу, чтобы из коробки вышел боец для стартового отряда.</p>
              </div>
            </div>
          </div>
        </>
      )}

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="border-white/10 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-cyan-200" />
              {t("client.hunt.shop.how")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm leading-6 text-white/66">
            <p>{t("client.hunt.shop.howOne")}</p>
            <p>{t("client.hunt.shop.howTwo")}</p>
            <p>{t("client.hunt.shop.howThree")}</p>
          </div>
          <Button type="button" onClick={() => setHelpOpen(false)} className={cn("rounded-2xl bg-cyan-200 text-slate-950 hover:bg-cyan-100", huntInteractiveClass)}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {t("client.hunt.shop.close")}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(chanceTarget)} onOpenChange={(open) => !open && setChanceTarget(null)}>
        <DialogContent className="border-white/10 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-cyan-200" />
              {t("client.hunt.shop.chancesTitle")}
            </DialogTitle>
          </DialogHeader>
          {chanceTarget && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                <p className="font-semibold">{chanceTarget.title}</p>
                <p className="mt-1 text-sm text-white/58">
                  {fill(t("client.hunt.shop.itemsPerOpen"), { count: chanceTarget.itemCountMin === chanceTarget.itemCountMax ? chanceTarget.itemCountMin : `${chanceTarget.itemCountMin}-${chanceTarget.itemCountMax}` })}
                  {chanceTarget.dailyLimit ? ` · ${fill(t("client.hunt.shop.dailyLimit"), { count: chanceTarget.dailyLimit })}` : ""}
                </p>
                {chanceTarget.guaranteedRarity && chanceTarget.guaranteedCount > 0 && (
                  <p className="mt-1 text-sm text-violet-100">
                    {fill(t("client.hunt.shop.guaranteed"), { rarity: rarityLabel(chanceTarget.guaranteedRarity, t), count: chanceTarget.guaranteedCount })}
                  </p>
                )}
                {chanceTarget.rotationElement && chanceTarget.rotationEndsAt && (
                  <p className="mt-1 text-sm text-cyan-100">
                    {elementMeta[chanceTarget.rotationElement].label} · {timeUntilLabel(chanceTarget.rotationEndsAt, t)}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                {chanceTarget.rarityChances.filter((entry) => entry.enabled && entry.weight > 0).map((entry) => (
                  <div key={entry.rarity} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                    <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                      <span>{rarityLabel(entry.rarity, t)}</span>
                      <span className="text-cyan-100">{entry.chance.toFixed(entry.chance < 1 ? 2 : 1)}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-cyan-200" style={{ width: `${Math.min(100, entry.chance)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-amber-200/20 bg-amber-200/10 p-3 text-sm">
                <span className="flex items-center gap-2 font-semibold"><Tags className="h-4 w-4 text-amber-100" />{t("client.hunt.reward.status")}</span>
                <span className="text-amber-100">{chanceTarget.statusDropChance.toFixed(chanceTarget.statusDropChance < 1 ? 2 : 1)}%</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
