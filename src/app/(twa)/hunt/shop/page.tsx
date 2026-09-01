"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Boxes, CheckCircle2, Clock3, Gift, HelpCircle, PackageOpen, ShieldQuestion, Sparkles, Star, WalletCards, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getCachedHuntOverview, getHuntOverview, openHuntBox, type HuntBoxType, type HuntCard, type HuntOverview } from "@/lib/api/twa-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";
import { CreatureGlyph, huntInteractiveClass, huntStatEntries, rarityBadgeClass, rarityClass, StatValueBar } from "../_components/hunt-ui";

type ShopFilter = "all" | "boxes" | "limited";

type ShopItem = {
  id: string;
  boxType: HuntBoxType;
  image: string;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  cost: number;
  filter: ShopFilter;
  accent: string;
  minRarity: string;
  limited?: boolean;
};

type OpeningBox = {
  id: string;
  image: string;
  title: string;
  accent: string;
};

const filters: Array<{ id: ShopFilter; labelKey: TranslationKey }> = [
  { id: "all", labelKey: "client.hunt.shop.filterAll" },
  { id: "boxes", labelKey: "client.hunt.shop.filterBoxes" },
  { id: "limited", labelKey: "client.hunt.shop.filterLimited" },
];

const shopItems: ShopItem[] = [
  {
    id: "city",
    boxType: "POST",
    image: "/hunt-assets/shop/city-crate.webp",
    titleKey: "client.hunt.shop.cityBox",
    descriptionKey: "client.hunt.shop.cityBoxText",
    cost: 120,
    filter: "boxes",
    accent: "border-cyan-300/35",
    minRarity: "COMMON+",
  },
  {
    id: "rare",
    boxType: "CATEGORY",
    image: "/hunt-assets/shop/rare-card-crate.webp",
    titleKey: "client.hunt.shop.rareBox",
    descriptionKey: "client.hunt.shop.rareBoxText",
    cost: 300,
    filter: "boxes",
    accent: "border-violet-300/45",
    minRarity: "UNCOMMON+",
  },
  {
    id: "weekly",
    boxType: "DISTRICT",
    image: "/hunt-assets/shop/weekly-gold-chest.webp",
    titleKey: "client.hunt.shop.weeklyBox",
    descriptionKey: "client.hunt.shop.weeklyBoxText",
    cost: 900,
    filter: "limited",
    accent: "border-amber-300/55",
    minRarity: "EPIC+",
    limited: true,
  },
  {
    id: "resource",
    boxType: "TRENDING",
    image: "/hunt-assets/shop/resource-chest.webp",
    titleKey: "client.hunt.shop.resourceBox",
    descriptionKey: "client.hunt.shop.resourceBoxText",
    cost: 650,
    filter: "boxes",
    accent: "border-sky-300/45",
    minRarity: "RARE+",
  },
];

function fill(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, String(value)), template);
}

function itemForBoxType(boxType: HuntBoxType) {
  return shopItems.find((item) => item.boxType === boxType) ?? shopItems[0];
}

function BoxOpeningReveal({ box, card, onClose }: { box: OpeningBox; card: HuntCard | null; onClose: () => void }) {
  const { t } = useI18n("ru");
  const particles = Array.from({ length: 18 }, (_, index) => index);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/82 p-4 backdrop-blur-lg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div className="absolute h-[420px] w-[420px] rounded-full bg-cyan-300/10 blur-3xl" animate={{ scale: card ? 1.18 : [0.92, 1.08, 0.96], opacity: card ? 0.42 : [0.2, 0.48, 0.22] }} transition={{ duration: card ? 0.5 : 1.8, repeat: card ? 0 : Infinity, ease: "easeInOut" }} />
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
              opacity: card ? [0, 0.9, 0] : [0.1, 0.58, 0.1],
              scale: card ? [0.5, 1.25, 0.15] : [0.55, 1, 0.55],
            }}
            transition={{ duration: card ? 1.1 : 2.2, repeat: card ? 0 : Infinity, delay: particle * 0.035, ease: "easeOut" }}
          />
        );
      })}

      <motion.div
        className={cn("relative w-full max-w-sm overflow-hidden rounded-[30px] border bg-slate-950/94 p-4 shadow-[0_34px_90px_rgba(0,0,0,0.72)]", card ? rarityClass[card.rarity] : box.accent)}
        initial={{ y: 18, scale: 0.96, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 18, scale: 0.96, opacity: 0 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(103,232,249,0.18),transparent_42%),radial-gradient(circle_at_20%_80%,rgba(132,204,22,0.12),transparent_34%)] pointer-events-none" />
        <div className="relative mb-3 flex items-center justify-between">
          <Badge className={card ? rarityBadgeClass[card.rarity] : "border-cyan-200/25 bg-cyan-200/10 text-cyan-100"}>
            {card ? card.rarity : box.title}
          </Badge>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/70">{card ? t("client.hunt.nhCard") : "OPENING"}</span>
        </div>

        <div className="relative min-h-[360px]">
          <AnimatePresence mode="wait">
            {!card ? (
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
                <p className="mt-2 text-sm text-white/58">Сундук открывается...</p>
              </motion.div>
            ) : (
              <motion.div
                key="card"
                className="min-h-[360px]"
                initial={{ opacity: 0, scale: 0.88, rotateY: -18, filter: "blur(12px)" }}
                animate={{ opacity: 1, scale: 1, rotateY: 0, filter: "blur(0px)" }}
                transition={{ type: "spring", stiffness: 180, damping: 20 }}
              >
                <div className="flex flex-col items-center text-center">
                  <motion.div initial={{ scale: 0.72 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: "spring", stiffness: 210, damping: 16 }}>
                    <CreatureGlyph card={card} size="lg" />
                  </motion.div>
                  <h2 className="mt-4 text-2xl font-semibold">{card.species.name}</h2>
                  <p className="mt-1 text-sm text-white/64">{card.trait}</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {huntStatEntries(card.stats).map(([key, value]) => <StatValueBar key={key} label={key} value={value} />)}
                </div>
                <Button className={cn("mt-4 w-full rounded-2xl bg-cyan-200 text-slate-950 hover:bg-cyan-100", huntInteractiveClass)} onClick={onClose}>
                  {t("client.hunt.keepCard")}
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
  const [overview, setOverview] = useState<HuntOverview>(getCachedHuntOverview());
  const [filter, setFilter] = useState<ShopFilter>("all");
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [openingBox, setOpeningBox] = useState<OpeningBox | null>(null);
  const [lastCard, setLastCard] = useState<HuntCard | null>(null);

  async function refresh(force = false) {
    setOverview(await getHuntOverview(force));
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function buyBox(item: ShopItem) {
    if (busyItem) return;
    setBusyItem(item.id);
    setNotice(null);
    setLastCard(null);
    setOpeningBox({ id: item.id, image: item.image, title: t(item.titleKey), accent: item.accent });
    const result = await openHuntBox(undefined, item.boxType);
    if (result.ok) {
      setLastCard(result.data.card);
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
    setLastCard(null);
    const item = itemForBoxType(boxType);
    setOpeningBox({ id: boxUuid, image: item.image, title: t(item.titleKey), accent: item.accent });
    const result = await openHuntBox(boxUuid);
    if (result.ok) {
      setLastCard(result.data.card);
      await refresh(true);
    } else {
      setOpeningBox(null);
      setNotice(result.message);
    }
    setBusyItem(null);
  }

  const visibleItems = filter === "all" ? shopItems : shopItems.filter((item) => item.filter === filter || (filter === "limited" && item.limited));

  return (
    <main className="min-h-full px-4 pb-24 pt-5 text-white">
      <AnimatePresence>
        {openingBox && (
          <BoxOpeningReveal
            box={openingBox}
            card={lastCard}
            onClose={() => {
              setLastCard(null);
              setOpeningBox(null);
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
                <span className="flex items-center gap-2 text-sm font-semibold"><PackageOpen className="h-4 w-4 text-cyan-100" />{box.type}</span>
                <span className="text-xs text-white/50">{box.rarity}</span>
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
        {visibleItems.map((item) => (
          <article key={item.id} className={cn("grid grid-cols-[112px_1fr] gap-3 rounded-3xl border bg-white/[0.035] p-3", item.accent)}>
            <div className="flex items-center justify-center rounded-2xl bg-black/24">
              <Image src={item.image} alt="" width={160} height={160} className="h-28 w-28 object-contain drop-shadow-[0_0_18px_rgba(103,232,249,0.18)]" />
            </div>
            <div className="min-w-0">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h2 className="truncate text-lg font-semibold">{t(item.titleKey)}</h2>
                {item.limited && <Star className="h-4 w-4 shrink-0 fill-amber-200 text-amber-200" />}
              </div>
              <p className="text-sm leading-5 text-white/58">{t(item.descriptionKey)}</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-white/55">
                  <ShieldQuestion className="h-4 w-4 text-cyan-200" />
                  {item.minRarity}
                </div>
                <Button type="button" disabled={busyItem != null || overview.profile.influenceBalance < item.cost} onClick={() => buyBox(item)} className={cn("rounded-2xl bg-cyan-200 px-4 text-slate-950 hover:bg-cyan-100", huntInteractiveClass)}>
                  <Zap className="mr-1.5 h-4 w-4" />
                  {fill(t("client.hunt.shop.buyFor"), { cost: item.cost })}
                </Button>
              </div>
            </div>
          </article>
        ))}
      </section>

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
    </main>
  );
}
