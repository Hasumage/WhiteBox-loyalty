"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bot, CheckCircle2, Copy, Dices, Gamepad2, KeyRound, Loader2, RefreshCw, Shield, Sparkles, Swords, UserPlus, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getCachedHuntOverview,
  createHuntBattleCode,
  findRandomHuntBattle,
  getHuntCardCatalogResult,
  getHuntOverview,
  type HuntCard,
  type HuntCatalogSpecies,
  type HuntOverview,
} from "@/lib/api/twa-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import { cn } from "@/lib/utils";
import { ElementBadge, huntInteractiveClass, huntStatEntries, mediaSrc, rarityBadgeClass, rarityClass, StatValueBar } from "../_components/hunt-ui";

type BattleMode = "idle" | "searching" | "matched" | "code";

const opponentNames = ["Nika Pulse", "Alex Route", "Mira Spot", "Leo Signal", "Dima North", "Sasha Ray"];

function fill(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, String(value)), template);
}

function buildMatchCode() {
  const segment = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `NH-${segment}`;
}

function cardPower(card: HuntCard) {
  return huntStatEntries(card.stats).reduce((sum, [, value]) => sum + value, 0) + card.level * 2;
}

function speciesPower(species: HuntCatalogSpecies) {
  return huntStatEntries(species.baseStats).reduce((sum, [, value]) => sum + value, 0) + (species.ownedCount > 0 ? 4 : 0);
}

function PlayerCard({ card }: { card: HuntCard | null }) {
  const { t } = useI18n("ru");
  if (!card) {
    return (
      <div className="rounded-3xl border border-dashed border-white/14 bg-white/[0.03] p-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-200/16 bg-cyan-200/8 text-cyan-100">
          <WalletCards className="h-6 w-6" />
        </div>
        <p className="mt-3 text-sm font-semibold">{t("client.hunt.battle.noCard")}</p>
        <p className="mt-1 text-xs leading-5 text-white/48">{t("client.hunt.battle.noCardHint")}</p>
        <Button asChild className={cn("mt-3 rounded-2xl bg-cyan-200 text-slate-950 hover:bg-cyan-100", huntInteractiveClass)}>
          <Link href="/hunt/shop">{t("client.hunt.shop.title")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-3xl border bg-slate-950/72", rarityClass[card.rarity])}>
      <div className="relative aspect-square bg-[radial-gradient(circle_at_50%_44%,rgba(103,232,249,0.16),rgba(2,6,12,0.78)_62%,rgba(2,6,12,0.98))]">
        <img src={mediaSrc(card.species.imageUrl) ?? "/hunt-assets/cards/compass-light.webp"} alt="" className="absolute inset-0 h-full w-full scale-[1.04] object-contain object-center" />
        <div className="absolute left-3 top-3">
          <ElementBadge element={card.element} />
        </div>
        <Badge className={cn("absolute bottom-3 left-3", rarityBadgeClass[card.rarity])}>{card.rarity}</Badge>
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{card.species.name}</h2>
            <p className="mt-0.5 text-xs text-white/52">{t("client.hunt.levelShort")} {card.level}</p>
          </div>
          <Badge className="border-cyan-200/20 bg-cyan-200/10 text-cyan-100">{cardPower(card)}</Badge>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {huntStatEntries(card.stats).map(([key, value]) => <StatValueBar key={key} label={key} value={value} />)}
        </div>
      </div>
    </div>
  );
}

function OpponentCard({ opponent }: { opponent: HuntCatalogSpecies | null }) {
  const { t } = useI18n("ru");
  if (!opponent) {
    return (
      <div className="rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.72),rgba(8,13,22,0.96))] p-4">
        <div className="flex aspect-square items-center justify-center rounded-3xl border border-white/10 bg-white/[0.04]">
          <Bot className="h-12 w-12 text-cyan-100/72" />
        </div>
        <p className="mt-3 text-sm font-semibold">{t("client.hunt.battle.opponentPending")}</p>
        <p className="mt-1 text-xs leading-5 text-white/48">{t("client.hunt.battle.opponentHint")}</p>
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-3xl border bg-slate-950/72", rarityClass[opponent.baseRarity])}>
      <div className="relative aspect-square bg-[radial-gradient(circle_at_50%_44%,rgba(168,85,247,0.12),rgba(2,6,12,0.78)_62%,rgba(2,6,12,0.98))]">
        <img src={mediaSrc(opponent.imageUrl) ?? "/hunt-assets/cards/compass-light.webp"} alt="" className="absolute inset-0 h-full w-full scale-[1.04] object-contain object-center" />
        <div className="absolute left-3 top-3">
          <ElementBadge element={opponent.element} />
        </div>
        <Badge className={cn("absolute bottom-3 left-3", rarityBadgeClass[opponent.baseRarity])}>{opponent.baseRarity}</Badge>
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{opponent.name}</h2>
            <p className="mt-0.5 text-xs text-white/52">{opponentNames[speciesPower(opponent) % opponentNames.length]}</p>
          </div>
          <Badge className="border-violet-200/20 bg-violet-200/10 text-violet-100">{speciesPower(opponent)}</Badge>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {huntStatEntries(opponent.baseStats).map(([key, value]) => <StatValueBar key={key} label={key} value={value} />)}
        </div>
      </div>
    </div>
  );
}

export default function HuntBattlePage() {
  const { t } = useI18n("ru");
  const [overview, setOverview] = useState<HuntOverview>(getCachedHuntOverview());
  const [catalog, setCatalog] = useState<HuntCatalogSpecies[]>([]);
  const [selectedCardUuid, setSelectedCardUuid] = useState<string | null>(overview.cards[0]?.uuid ?? null);
  const [mode, setMode] = useState<BattleMode>("idle");
  const [opponent, setOpponent] = useState<HuntCatalogSpecies | null>(null);
  const [matchCode, setMatchCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([getHuntOverview(), getHuntCardCatalogResult(true)]).then(([nextOverview, catalogResult]) => {
      if (!mounted) return;
      setOverview(nextOverview);
      setSelectedCardUuid((current) => current ?? nextOverview.cards[0]?.uuid ?? null);
      if (catalogResult.ok) setCatalog(catalogResult.data);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const selectedCard = useMemo(() => overview.cards.find((card) => card.uuid === selectedCardUuid) ?? overview.cards[0] ?? null, [overview.cards, selectedCardUuid]);
  const unlockedOpponents = useMemo(() => catalog.filter((item) => item.ownedCount > 0), [catalog]);
  const opponentPool = unlockedOpponents.length ? unlockedOpponents : catalog;

  async function findRandomOpponent() {
    if (!selectedCard || opponentPool.length === 0) {
      setNotice(t("client.hunt.battle.needCard"));
      return;
    }
    setNotice(null);
    setMode("searching");
    const result = await findRandomHuntBattle(selectedCard.uuid);
    if (result.ok) {
      setOpponent(result.data.opponent);
      setMode("matched");
      return;
    }
    setNotice(result.message);
    window.setTimeout(() => {
      const nextOpponent = opponentPool[Math.floor(Math.random() * opponentPool.length)] ?? null;
      setOpponent(nextOpponent);
      setMode("matched");
    }, 450);
  }

  async function copyCode() {
    const code = matchCode || buildMatchCode();
    setMatchCode(code);
    setMode("code");
    try {
      await navigator.clipboard.writeText(code);
      setNotice(fill(t("client.hunt.battle.codeCopied"), { code }));
    } catch {
      setNotice(code);
    }
  }

  async function createCode() {
    if (!selectedCard) {
      setNotice(t("client.hunt.battle.needCard"));
      return;
    }
    setOpponent(null);
    const result = await createHuntBattleCode(selectedCard.uuid);
    setMatchCode(result.ok ? result.data.code : buildMatchCode());
    setMode("code");
    setNotice(result.ok ? null : result.message);
  }

  function joinMatch() {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      setNotice(t("client.hunt.battle.codeInvalid"));
      return;
    }
    setMatchCode(code.startsWith("NH-") ? code : `NH-${code}`);
    setMode("code");
    setNotice(t("client.hunt.battle.joinReady"));
  }

  const battleTitle = mode === "matched" ? t("client.hunt.battle.matched") : mode === "searching" ? t("client.hunt.battle.searching") : mode === "code" ? t("client.hunt.battle.codeMode") : t("client.hunt.battle.ready");

  return (
    <main className="min-h-full px-4 pb-24 pt-5 text-white">
      <header className="mb-4 flex items-center justify-between gap-3">
        <Link href="/hunt" className={cn("flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/70", huntInteractiveClass)}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Badge className="border-cyan-200/20 bg-cyan-200/10 text-cyan-100">{t("client.hunt.title")}</Badge>
      </header>

      <section className="mb-4 overflow-hidden rounded-3xl border border-cyan-200/16 bg-[radial-gradient(circle_at_50%_0%,rgba(103,232,249,0.16),rgba(8,13,22,0.84)_44%,rgba(3,7,18,0.96))] p-4 shadow-[0_0_45px_rgba(103,232,249,0.10)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/78">{t("client.hunt.battle.eyebrow")}</p>
            <h1 className="mt-1 text-3xl font-semibold">{t("client.hunt.battle.title")}</h1>
            <p className="mt-2 text-sm leading-6 text-white/60">{t("client.hunt.battle.subtitle")}</p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/22 bg-cyan-200/10 text-cyan-100">
            <Swords className="h-6 w-6" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Button type="button" onClick={findRandomOpponent} disabled={mode === "searching"} className={cn("col-span-2 rounded-2xl bg-cyan-200 text-slate-950 hover:bg-cyan-100", huntInteractiveClass)}>
            {mode === "searching" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Dices className="mr-2 h-4 w-4" />}
            {t("client.hunt.battle.random")}
          </Button>
          <Button type="button" onClick={() => void createCode()} variant="secondary" className={cn("rounded-2xl border-white/10 bg-white/[0.06]", huntInteractiveClass)}>
            <KeyRound className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {notice && <div className="mb-4 rounded-2xl border border-cyan-200/20 bg-cyan-200/10 px-3 py-2 text-sm text-cyan-50">{notice}</div>}

      <section className="mb-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/42">{t("client.hunt.battle.arena")}</p>
            <h2 className="mt-1 text-xl font-semibold">{battleTitle}</h2>
          </div>
          {mode === "matched" && <Badge className="border-emerald-200/20 bg-emerald-200/10 text-emerald-100"><CheckCircle2 className="mr-1 h-3 w-3" />{t("client.hunt.battle.found")}</Badge>}
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <PlayerCard card={selectedCard} />
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-cyan-100">
            <Swords className="h-5 w-5" />
          </div>
          <OpponentCard opponent={opponent} />
        </div>
      </section>

      <section className="mb-4 grid gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center gap-2">
          <Gamepad2 className="h-5 w-5 text-cyan-100" />
          <h2 className="text-lg font-semibold">{t("client.hunt.battle.lobby")}</h2>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Input value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder={t("client.hunt.battle.codePlaceholder")} className="h-12 rounded-2xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/38" />
          <Button type="button" onClick={joinMatch} variant="secondary" className={cn("h-12 rounded-2xl border-white/10 bg-white/[0.06]", huntInteractiveClass)}>
            <UserPlus className="h-4 w-4" />
          </Button>
        </div>
        {matchCode && (
          <button type="button" onClick={copyCode} className={cn("flex items-center justify-between gap-3 rounded-2xl border border-cyan-200/18 bg-cyan-200/10 px-4 py-3 text-left", huntInteractiveClass)}>
            <span>
              <span className="block text-xs uppercase tracking-[0.18em] text-cyan-100/72">{t("client.hunt.battle.matchCode")}</span>
              <span className="mt-1 block text-xl font-semibold text-cyan-50">{matchCode}</span>
            </span>
            <Copy className="h-5 w-5 text-cyan-100" />
          </button>
        )}
      </section>

      <section className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("client.hunt.battle.chooseCard")}</h2>
          <Button type="button" onClick={() => void getHuntOverview(true).then(setOverview)} variant="ghost" className={cn("h-9 rounded-2xl px-3 text-white/68 hover:bg-white/[0.06]", huntInteractiveClass)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("client.hunt.refreshing").replace("...", "")}
          </Button>
        </div>
        {overview.cards.length === 0 && <div className="rounded-3xl border border-dashed border-white/15 p-5 text-center text-sm text-white/54">{t("client.hunt.cards.empty")}</div>}
        <div className="grid grid-cols-3 gap-2">
          {overview.cards.map((card) => {
            const selected = card.uuid === selectedCard?.uuid;
            return (
              <button key={card.uuid} type="button" onClick={() => setSelectedCardUuid(card.uuid)} className={cn("relative overflow-hidden rounded-2xl border bg-slate-950 text-left", huntInteractiveClass, selected ? "border-cyan-200 shadow-[0_0_30px_rgba(103,232,249,0.16)]" : "border-white/10")}>
                <div className="relative aspect-square bg-white/[0.03]">
                  <img src={mediaSrc(card.species.imageUrl) ?? "/hunt-assets/cards/compass-light.webp"} alt="" className="absolute inset-0 h-full w-full scale-[1.08] object-contain object-center" />
                  {selected && <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-cyan-200 text-slate-950"><Shield className="h-4 w-4" /></span>}
                </div>
                <div className="p-2">
                  <p className="truncate text-xs font-semibold">{card.species.name}</p>
                  <p className="mt-0.5 text-[10px] text-white/46">{t("client.hunt.levelShort")} {card.level}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
