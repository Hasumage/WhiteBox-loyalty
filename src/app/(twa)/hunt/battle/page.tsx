"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Copy, Dices, KeyRound, Loader2, Plus, RefreshCw, Shield, UserPlus, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createHuntPrivateMatch,
  getCachedHuntOverview,
  getHuntCollectionOverview,
  joinHuntPrivateMatch,
  startHuntRandomMatch,
  type HuntCard,
  type HuntOverview,
} from "@/lib/api/twa-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import { cn } from "@/lib/utils";
import { elementMeta, huntInteractiveClass, huntRarityLabel, huntSpeciesName, mediaSrc, rarityBadgeClass, rarityClass } from "../_components/hunt-ui";

type BattleMode = "random" | "code" | "join";

const TEAM_SIZE = 3;
const STORAGE_KEY = "nearloy-hunt-battle-state";

function fill(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, String(value)), template);
}

function buildMatchCode() {
  const segment = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `NH-${segment}`;
}

function saveBattleState(payload: { mode: BattleMode; teamUuids: string[]; leadCardUuid: string; opponentUuid?: string | null; matchCode?: string | null; matchId?: string | null }) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...payload, savedAt: new Date().toISOString() }));
}

function SquadSlot({ card, pending, onReplace, locale, t }: { card: HuntCard | null; pending: HuntCard | null; onReplace: () => void; locale: "ru" | "en"; t: ReturnType<typeof useI18n>["t"] }) {
  const ElementIcon = card ? elementMeta[card.element].icon : null;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onReplace();
      }}
      disabled={!pending}
      className={cn(
        "relative min-h-[132px] overflow-hidden rounded-3xl border bg-slate-950 text-left",
        pending ? huntInteractiveClass : "cursor-default",
        card ? rarityClass[card.rarity] : "border-dashed border-white/14",
        pending && "hunt-squad-slot-replaceable hover:border-cyan-200/60 hover:shadow-[0_0_30px_rgba(103,232,249,0.16)]",
      )}
    >
      {card ? (
        <>
          <img src={mediaSrc(card.species.imageUrl) ?? "/hunt-assets/cards/compass-light.webp"} alt="" className="absolute inset-0 h-full w-full object-cover object-center opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/24 to-transparent" />
          {ElementIcon && (
            <span className={cn("absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur", elementMeta[card.element].className)} title={elementMeta[card.element].label}>
              <ElementIcon className="h-4 w-4" />
            </span>
          )}
          <div className="absolute inset-x-2 bottom-2">
            <p className="truncate text-sm font-semibold text-white">{huntSpeciesName(card.species, locale)}</p>
            <div className="mt-1 flex items-center gap-2">
              <Badge className={cn("h-6 px-2 text-[10px]", rarityBadgeClass[card.rarity])}>{huntRarityLabel(card.rarity, t)}</Badge>
            </div>
          </div>
        </>
      ) : (
        <div className="flex h-full min-h-[132px] flex-col items-center justify-center p-3 text-center text-white/50">
          <Plus className="h-6 w-6 text-cyan-100/72" />
          <span className="mt-2 text-xs">Пустой слот</span>
        </div>
      )}
    </button>
  );
}

function CandidateOverlay({ card, locale }: { card: HuntCard | null; locale: "ru" | "en" }) {
  if (!card) return null;
  const ElementIcon = elementMeta[card.element].icon;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[104px] z-40 flex justify-center px-4">
      <button
        type="button"
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "pointer-events-auto hunt-candidate-card w-[132px] overflow-hidden rounded-3xl border bg-[#070c1c] text-left backdrop-blur",
          rarityClass[card.rarity],
        )}
        aria-label="Выбранная карточка"
      >
        <div className="relative aspect-[1.08/1] bg-black">
          <img src={mediaSrc(card.species.imageUrl) ?? "/hunt-assets/cards/compass-light.webp"} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
          <span className={cn("absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur", elementMeta[card.element].className)} title={elementMeta[card.element].label}>
            <ElementIcon className="h-4 w-4" />
          </span>
        </div>
        <div className="min-h-[58px] border-t border-white/5 bg-[#081126] px-2.5 py-2">
          <p className="truncate text-[13px] font-semibold text-white">{huntSpeciesName(card.species, locale)}</p>
          <p className="mt-1 text-[11px] text-white/50">ур. {card.level}</p>
        </div>
      </button>
    </div>
  );
}

function CollectionCard({ card, selected, inTeam, onClick, locale }: { card: HuntCard; selected: boolean; inTeam: boolean; onClick: () => void; locale: "ru" | "en" }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        "relative overflow-hidden rounded-3xl border bg-[#070c1c] text-left",
        huntInteractiveClass,
        selected ? "border-cyan-200 shadow-[0_0_28px_rgba(103,232,249,0.18)]" : inTeam ? "border-emerald-200/45" : "border-white/10",
      )}
    >
      <div className="relative aspect-[1.08/1] bg-black">
        <img src={mediaSrc(card.species.imageUrl) ?? "/hunt-assets/cards/compass-light.webp"} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
        {inTeam && <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-cyan-200 text-slate-950"><Shield className="h-4 w-4" /></span>}
      </div>
      <div className="min-h-[58px] border-t border-white/5 bg-[#081126] px-2.5 py-2">
        <p className="truncate text-[13px] font-semibold text-white">{huntSpeciesName(card.species, locale)}</p>
        <p className="mt-1 text-[11px] text-white/50">ур. {card.level}</p>
      </div>
    </button>
  );
}

export default function HuntBattleLobbyPage() {
  const { locale, t } = useI18n("ru");
  const router = useRouter();
  const squadRef = useRef<HTMLElement | null>(null);
  const [overview, setOverview] = useState<HuntOverview>(getCachedHuntOverview());
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [knownCards, setKnownCards] = useState<HuntCard[]>(getCachedHuntOverview().cards);
  const [teamUuids, setTeamUuids] = useState<string[]>(() => getCachedHuntOverview().cards.slice(0, TEAM_SIZE).map((card) => card.uuid));
  const [pendingCardUuid, setPendingCardUuid] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [matchCode, setMatchCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<"random" | "code" | null>(null);

  useEffect(() => {
    let mounted = true;
    getHuntCollectionOverview(false, { page, locale }).then((nextOverview) => {
      if (!mounted) return;
      setOverview(nextOverview);
      setPages(nextOverview.collection.pages);
      setKnownCards(current => [...new Map([...current, ...nextOverview.cards].map(card => [card.uuid, card])).values()]);
      setTeamUuids((current) => {
        const kept = current;
        const additions = nextOverview.cards.map((card) => card.uuid).filter((uuid) => !kept.includes(uuid));
        return [...kept, ...additions].slice(0, TEAM_SIZE);
      });
    }).catch(() => {
      if (mounted) setNotice("Не удалось загрузить полную коллекцию. Обновите список карточек.");
    });
    return () => {
      mounted = false;
    };
  }, [page, locale]);

  const cardsByUuid = useMemo(() => new Map(knownCards.map((card) => [card.uuid, card])), [knownCards]);
  const team = teamUuids.map((uuid) => cardsByUuid.get(uuid) ?? null);
  const pendingCard = pendingCardUuid ? cardsByUuid.get(pendingCardUuid) ?? null : null;
  const ready = team.filter(Boolean).length === TEAM_SIZE;

  function selectPendingCard(uuid: string) {
    setPendingCardUuid(uuid);
    window.requestAnimationFrame(() => {
      squadRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function replaceSlot(index: number) {
    if (!pendingCard) return;
    setTeamUuids((current) => {
      const next = [...current];
      const previousIndex = next.indexOf(pendingCard.uuid);
      if (previousIndex >= 0) next[previousIndex] = next[index] ?? "";
      next[index] = pendingCard.uuid;
      return next.filter(Boolean).slice(0, TEAM_SIZE);
    });
    setPendingCardUuid(null);
  }

  async function refresh() {
    try {
      const next = await getHuntCollectionOverview(true, { page, locale });
      setOverview(next);
      setPages(next.collection.pages);
      setKnownCards(current => [...new Map([...current, ...next.cards].map(card => [card.uuid, card])).values()]);
    } catch {
      setNotice("Не удалось загрузить полную коллекцию. Обновите список карточек.");
    }
  }

  async function startRandomMatch() {
    const leadCard = team.find(Boolean);
    if (!leadCard || !ready) {
      setNotice("Соберите отряд из трёх персонажей.");
      return;
    }
    setNotice(null);
    setBusy("random");
    const result = await startHuntRandomMatch(teamUuids.slice(0, TEAM_SIZE));
    setBusy(null);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    saveBattleState({
      mode: "random",
      teamUuids: teamUuids.slice(0, TEAM_SIZE),
      leadCardUuid: leadCard.uuid,
      opponentUuid: null,
      matchId: result.data.matchId,
    });
    router.push("/hunt/battle/loading");
  }

  async function createCode() {
    const leadCard = team.find(Boolean);
    if (!leadCard || !ready) {
      setNotice("Соберите отряд из трёх персонажей.");
      return;
    }
    setNotice(null);
    setBusy("code");
    const result = await createHuntPrivateMatch(teamUuids.slice(0, TEAM_SIZE));
    if (!result.ok) {
      setBusy(null);
      setNotice(result.message);
      return;
    }
    const code = result.data.code ?? buildMatchCode();
    setMatchCode(code);
    saveBattleState({ mode: "code", teamUuids: teamUuids.slice(0, TEAM_SIZE), leadCardUuid: leadCard.uuid, matchCode: code, matchId: result.data.matchId });
    setBusy(null);
    router.push("/hunt/battle/arena");
  }

  async function joinMatch() {
    const leadCard = team.find(Boolean);
    const code = joinCode.trim().toUpperCase();
    if (!leadCard || !ready) {
      setNotice("Соберите отряд из трёх персонажей.");
      return;
    }
    if (code.length < 4) {
      setNotice(t("client.hunt.battle.codeInvalid"));
      return;
    }
    setNotice(null);
    setBusy("code");
    const result = await joinHuntPrivateMatch(code, teamUuids.slice(0, TEAM_SIZE));
    setBusy(null);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    saveBattleState({ mode: "join", teamUuids: teamUuids.slice(0, TEAM_SIZE), leadCardUuid: leadCard.uuid, matchCode: result.data.code ?? (code.startsWith("NH-") ? code : `NH-${code}`), matchId: result.data.matchId });
    router.push("/hunt/battle/arena");
  }

  async function copyCode() {
    if (!matchCode) return;
    try {
      await navigator.clipboard.writeText(matchCode);
      setNotice(fill(t("client.hunt.battle.codeCopied"), { code: matchCode }));
    } catch {
      setNotice(matchCode);
    }
  }

  return (
    <main className="min-h-full px-4 pb-24 pt-5 text-white" onClick={() => setPendingCardUuid(null)}>
      <section ref={squadRef} className="mb-4 scroll-mt-5 rounded-3xl border border-cyan-200/16 bg-[radial-gradient(circle_at_50%_0%,rgba(103,232,249,0.16),rgba(8,13,22,0.84)_44%,rgba(3,7,18,0.96))] p-4 shadow-[0_0_45px_rgba(103,232,249,0.10)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/78">Лобби</p>
            <h1 className="mt-1 text-2xl font-semibold">Соберите отряд</h1>
          </div>
          <Badge className={cn("border-cyan-200/20 bg-cyan-200/10 text-cyan-100", ready && "border-emerald-200/25 bg-emerald-200/10 text-emerald-100")}>
            {team.filter(Boolean).length} / {TEAM_SIZE}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: TEAM_SIZE }, (_, index) => (
            <SquadSlot key={index} card={team[index]} pending={pendingCard} locale={locale} t={t} onReplace={() => replaceSlot(index)} />
          ))}
        </div>

        <p className="mt-3 min-h-5 text-xs leading-5 text-white/52">
          {pendingCard ? "Нажмите на слот отряда, чтобы заменить персонажа." : "Выберите персонажа ниже и замените им слот в отряде."}
        </p>

        <div className="mt-4 grid grid-cols-[1fr_60px] gap-2">
          <Button type="button" onClick={() => void startRandomMatch()} disabled={busy === "random"} aria-busy={busy === "random"} className={cn("h-12 rounded-2xl bg-cyan-200 text-slate-950 hover:bg-cyan-100", huntInteractiveClass)}>
            <span className="mr-2 flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
              {busy === "random" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Dices className="h-4 w-4" />}
            </span>
            <span>Случайный бой</span>
          </Button>
          <Button type="button" onClick={() => void createCode()} disabled={busy === "code"} variant="secondary" className={cn("h-12 w-[60px] rounded-2xl border-white/10 bg-white/[0.06]", huntInteractiveClass)} aria-label={t("client.hunt.battle.matchCode")}>
            <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
              {busy === "code" ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            </span>
          </Button>
        </div>

        <div className="mt-2 grid grid-cols-[1fr_60px] gap-2">
          <Input value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder={t("client.hunt.battle.codePlaceholder")} className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/38" />
          <Button type="button" onClick={() => void joinMatch()} variant="secondary" className={cn("h-11 w-[60px] rounded-2xl border-white/10 bg-white/[0.06]", huntInteractiveClass)}>
            <UserPlus className="h-4 w-4" />
          </Button>
        </div>

        {matchCode && (
          <button type="button" onClick={copyCode} className={cn("mt-2 flex w-full items-center justify-between gap-3 rounded-2xl border border-cyan-200/18 bg-cyan-200/10 px-4 py-3 text-left", huntInteractiveClass)}>
            <span>
              <span className="block text-xs uppercase tracking-[0.18em] text-cyan-100/72">{t("client.hunt.battle.matchCode")}</span>
              <span className="mt-1 block text-xl font-semibold text-cyan-50">{matchCode}</span>
            </span>
            <Copy className="h-5 w-5 text-cyan-100" />
          </button>
        )}
      </section>

      {notice && <div className="mb-4 rounded-2xl border border-cyan-200/20 bg-cyan-200/10 px-3 py-2 text-sm text-cyan-50">{notice}</div>}

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <WalletCards className="h-5 w-5 text-cyan-100" />
            <h2 className="text-lg font-semibold">Карты для отряда</h2>
          </div>
          <Button type="button" onClick={() => void refresh()} variant="ghost" className={cn("h-9 rounded-2xl px-3 text-white/68 hover:bg-white/[0.06]", huntInteractiveClass)}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {overview.cards.length === 0 && <div className="rounded-3xl border border-dashed border-white/15 p-5 text-center text-sm text-white/54">{t("client.hunt.cards.empty")}</div>}

        <div className="grid grid-cols-3 gap-2">
          {overview.cards.map((card) => (
            <CollectionCard key={card.uuid} card={card} selected={card.uuid === pendingCardUuid} inTeam={teamUuids.includes(card.uuid)} locale={locale} onClick={() => selectPendingCard(card.uuid)} />
          ))}
        </div>
      </section>
      <nav aria-label="Страницы карточек" className="flex items-center justify-between gap-3">
        <Button aria-label="Предыдущая страница" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ArrowLeft className="h-4 w-4" /></Button>
        <span>{page} / {pages}</span>
        <Button aria-label="Следующая страница" disabled={page >= pages} onClick={() => setPage(p => p + 1)}><ArrowRight className="h-4 w-4" /></Button>
      </nav>
      <CandidateOverlay card={pendingCard} locale={locale} />
      <style jsx global>{`
        @keyframes hunt-squad-slot-nudge {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
          18% { transform: translate3d(-1px, 0, 0) rotate(-0.45deg); }
          36% { transform: translate3d(1px, 0, 0) rotate(0.45deg); }
          54% { transform: translate3d(0, -1px, 0) rotate(0deg); }
          72% { transform: translate3d(1px, 0, 0) rotate(0.35deg); }
        }
        .hunt-squad-slot-replaceable {
          animation: hunt-squad-slot-nudge 1.05s ease-in-out infinite;
        }
        .hunt-candidate-card {
          box-shadow:
            0 20px 58px rgba(0, 0, 0, 0.62),
            0 0 0 1px rgba(103, 232, 249, 0.12),
            0 0 34px rgba(103, 232, 249, 0.22);
          animation:
            hunt-candidate-float 220ms ease-out both,
            hunt-candidate-glow 1.65s ease-in-out infinite;
        }
        @keyframes hunt-candidate-float {
          from { opacity: 0; transform: translate3d(0, 12px, 0) scale(0.96); }
          to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes hunt-candidate-glow {
          0%, 100% {
            filter: drop-shadow(0 0 10px rgba(103, 232, 249, 0.20));
            box-shadow:
              0 20px 58px rgba(0, 0, 0, 0.62),
              0 0 0 1px rgba(103, 232, 249, 0.12),
              0 0 28px rgba(103, 232, 249, 0.18);
          }
          50% {
            filter: drop-shadow(0 0 18px rgba(103, 232, 249, 0.36));
            box-shadow:
              0 22px 64px rgba(0, 0, 0, 0.66),
              0 0 0 1px rgba(103, 232, 249, 0.28),
              0 0 46px rgba(103, 232, 249, 0.34);
          }
        }
      `}</style>
    </main>
  );
}
