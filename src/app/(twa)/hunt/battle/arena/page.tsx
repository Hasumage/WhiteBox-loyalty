"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Orbit,
  Crosshair,
  Footprints,
  Heart,
  History,
  Loader2,
  LockKeyhole,
  RotateCcw,
  Shield,
  Swords,
  Trophy,
  Undo2,
  X,
  Zap,
  Flame,
  Droplets,
  Waves,
  Leaf,
  Sprout,
  Skull,
  Clover,
  Info,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import {
  alive,
  actionLimit,
  canAttack,
  attackFailure,
  canUseSkill,
  previewOrder,
  effectiveAbilityCost,
  effectiveAbilityRadius,
  skillReady,
  loadoutFor,
  type Ability,
  abilityFor,
  scaledPower,
  orderCost,
  skillTargetFailure,
  type AbilityId,
  createBattle,
  distance,
  moves,
  POINT_CAP,
  POINTS,
  ROUND_LIMIT,
  sameCell,
  stats,
  type Battle,
  type BattleEvent,
  type Bonus,
  type Cell,
  type Fighter,
  type Frame,
  type Order,
  type Side,
} from "@/lib/hunt/tactics";
import {
  readHuntBattleMatch,
  advanceHuntTutorial,
  startHuntRandomMatch,
  startHuntTrainingMatch,
  startHuntTutorialTrainingMatch,
  submitHuntBattleTurn,
} from "@/lib/api/twa-client";
import { BattleMap } from "./battle-map";
import { ActionButton } from "./action-button";
import { FighterDetails } from "./fighter-details";
import { BattleResults } from "./battle-results";
import { abilityIcons } from "@/lib/hunt/ability-icons";
import styles from "./arena.module.css";

type ResponseData = {
  battle: Battle;
  token: string;
  matchId?: string;
  controlledSide?: Side;
  mode?: "TRAINING" | "PVP_RANDOM" | "PVP_PRIVATE";
  status?: "WAITING" | "ACTIVE" | "FINISHED" | "EXPIRED" | "CANCELLED";
  waitingForOpponent?: boolean;
  pendingSides?: string[];
  botDisplayName?: string | null;
  reward?: {
    currency: number;
    trophies: number;
    dailyCap: number;
  };
  frames: Frame[];
  error?: string;
};

type BattleTutorialReward = {
  title: string;
  body: string;
  image: string;
  next: "hunt" | "upgrade";
};

type TutorialGuide = {
  title: string;
  body: string;
  tone?: "stats" | "resonance";
};

type TutorialGuideProgress = {
  statsSeen: boolean;
  moved: boolean;
  attacked: boolean;
  resonanceUsed: boolean;
  freeplayDismissed: boolean;
};

const resonanceEventLabels = {
  ru: {
    "resonance-battery": "Резонанс: возврат энергии",
    "resonance-captor": "Резонанс: удержание точки",
    "resonance-captor-flag": "Резонанс: флаг точки",
    "resonance-captor-rush": "Резонанс: командный рывок",
    "resonance-controller": "Резонанс: сбитый шаг",
    "resonance-controller-break": "Резонанс: срыв команды",
    "resonance-duelist-extra": "Резонанс: второй выпад",
    "resonance-duelist-step": "Резонанс: удар после шага",
    "resonance-finisher-momentum": "Резонанс: темп победы",
    "resonance-guardian": "Резонанс: первый щит",
    "resonance-guardian-pulse": "Резонанс: защитный импульс",
    "resonance-guardian-redirect": "Резонанс: перехват беды",
    "resonance-healer": "Резонанс: ближняя помощь",
    "resonance-healer-deep": "Резонанс: глубокий отклик",
    "resonance-healer-revive": "Резонанс: возвращение",
    "resonance-provoker": "Резонанс: сбитый фокус",
    "resonance-provoker-answer": "Резонанс: ответ команды",
    "resonance-scout-window": "Резонанс: тактическое окно",
    "resonance-sniper-mark": "Резонанс: метка цели",
  },
  en: {
    "resonance-battery": "Resonance: energy refund",
    "resonance-captor": "Resonance: point hold",
    "resonance-captor-flag": "Resonance: point flag",
    "resonance-captor-rush": "Resonance: team rush",
    "resonance-controller": "Resonance: broken step",
    "resonance-controller-break": "Resonance: command break",
    "resonance-duelist-extra": "Resonance: second lunge",
    "resonance-duelist-step": "Resonance: step strike",
    "resonance-finisher-momentum": "Resonance: victory tempo",
    "resonance-guardian": "Resonance: first shield",
    "resonance-guardian-pulse": "Resonance: guard pulse",
    "resonance-guardian-redirect": "Resonance: danger intercept",
    "resonance-healer": "Resonance: close aid",
    "resonance-healer-deep": "Resonance: deep response",
    "resonance-healer-revive": "Resonance: return",
    "resonance-provoker": "Resonance: broken focus",
    "resonance-provoker-answer": "Resonance: team answer",
    "resonance-scout-window": "Resonance: tactical window",
    "resonance-sniper-mark": "Resonance: target mark",
  },
} as const;

function resonanceEventLabel(
  locale: "ru" | "en",
  abilityId?: string,
) {
  if (!abilityId?.startsWith("resonance-")) return null;
  return (
    resonanceEventLabels[locale][
      abilityId as keyof typeof resonanceEventLabels.ru
    ] ?? null
  );
}

export default function HuntBattleArenaPage() {
  const { t, locale } = useI18n("ru");
  const router = useRouter();
  const [battle, setBattle] = useState<Battle>(createBattle);
  const [token, setToken] = useState("");
  const [controlledSide, setControlledSide] = useState<Side>("player");
  const opponentSide: Side = controlledSide === "player" ? "bot" : "player";
  const [matchMode, setMatchMode] = useState<ResponseData["mode"]>("TRAINING");
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [pendingSides, setPendingSides] = useState<string[]>([]);
  const [opponentName, setOpponentName] = useState<string | null>(null);
  const [tutorialBattle, setTutorialBattle] = useState(false);
  const [reward, setReward] = useState<ResponseData["reward"]>(undefined);
  const [battleTutorialReward, setBattleTutorialReward] = useState<BattleTutorialReward | null>(null);
  const [tutorialPhase, setTutorialPhase] = useState<"first" | "second" | null>(null);
  const [tutorialProgress, setTutorialProgress] = useState<TutorialGuideProgress>({
    statsSeen: false,
    moved: false,
    attacked: false,
    resonanceUsed: false,
    freeplayDismissed: false,
  });
  const [legacyPreview, setLegacyPreview] = useState(false);
  const [selected, setSelected] = useState("player-0");
  const [orders, setOrders] = useState<Order[]>([]);
  const [bonus, setBonus] = useState<Bonus | null>(null);
  const [armedAbility, setArmedAbility] = useState<AbilityId | null>(null);
  const skillArmed = armedAbility !== null;
  const [notice, setNotice] = useState<
    BattleEvent["reason"] | "coverHint" | null
  >(null);
  const [busy, setBusy] = useState(true);
  const [events, setEvents] = useState<BattleEvent[]>([]);
  const [log, setLog] = useState<BattleEvent[]>([]);
  const [error, setError] = useState<"error" | "expired" | null>(null);
  const [rules, setRules] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [point, setPoint] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(true);
  const [inspected, setInspected] = useState<string | null>(null);
  const mounted = useRef(true);
  const requestId = useRef(0);
  const inFlight = useRef(false);
  const tutorialAdvanced = useRef(false);
  const reduced = useReducedMotion();
  const name = (u: Fighter) =>
    (locale === "ru" ? u.profile?.nameRu : u.profile?.nameEn) ||
    t(`arena.${stats(u).key}` as TranslationKey);
  const abilityName = (a: Ability) =>
    (locale === "ru" ? a.nameRu : a.nameEn) ||
    t(`arena.${a.key}` as TranslationKey);
  const unit = battle.units.find((u) => u.id === selected) ?? battle.units[0];
  const legal = useMemo(
    () =>
      !busy && !battle.winner && unit.hp > 0
        ? skillArmed
          ? []
          : moves(battle, unit, bonus)
        : [],
    [battle, unit, bonus, busy, skillArmed],
  );
  const unitOrders = orders.filter((o) => o.unitId === unit.id);
  const selectedOrder = unitOrders.at(-1);
  const canAppendExtraOrder =
    unitOrders.length > 0 &&
    orders.length < actionLimit(battle, controlledSide) &&
    actionLimit(battle, controlledSide) >
      alive(battle, controlledSide).length;
  const preview = selectedOrder
    ? previewOrder(battle, selectedOrder, bonus)
    : null;
  const skill = abilityFor(
    unit,
    armedAbility ??
      (selectedOrder?.type === "skill" ? selectedOrder.abilityId : undefined),
  )!;
  const availableEnergy =
    battle.energy[controlledSide] -
    orderCost(
      battle,
      canAppendExtraOrder
        ? orders
        : orders.filter((o) => o.unitId !== unit.id),
      bonus,
    );
  const tr = (key: string) => t(`arena.${key}` as TranslationKey);
  const shieldTurnsLeft =
    unit.shield > 0
      ? Math.max(1, (unit.shieldExpires ?? battle.round) - battle.round + 1)
      : 0;
  const sideLabel = (side: Side) =>
    side === controlledSide
      ? t("arena.you")
      : matchMode === "TRAINING"
        ? t("arena.bot")
        : opponentName || t("arena.opponent" as TranslationKey);
  const teamSizeLabel = `${battle.units.filter((u) => u.side === controlledSide).length} ${locale === "ru" ? "на" : "vs"} ${battle.units.filter((u) => u.side === opponentSide).length}`;
  const modeLabel = `${matchMode === "TRAINING" ? (locale === "ru" ? "Тренировка" : "Training") : "PvP"} · ${teamSizeLabel}`;
  const tutorialEnemy = alive(battle, opponentSide)[0] ?? null;
  const usableTutorialSkill = loadoutFor(unit)
    .map((id) => abilityFor(unit, id))
    .find((definition) => {
      if (!definition || !skillReady(battle, unit, definition.key)) return false;
      if (availableEnergy < effectiveAbilityCost(unit, definition)) return false;
      if (definition.target === "self") return true;
      if (!tutorialEnemy) return false;
      return canUseSkill(battle, unit, {
        unitId: unit.id,
        type: "skill",
        abilityId: definition.key,
        targetId: tutorialEnemy.id,
      });
    });
  const tutorialStandingOnPoint = POINTS.some(
    (resonancePoint) => distance(unit, resonancePoint) <= 1,
  );
  const tutorialGuide: TutorialGuide | null = (() => {
    if (!tutorialBattle || battle.winner || busy || waitingForOpponent) return null;
    if (tutorialPhase === "second" && !tutorialProgress.statsSeen)
      return {
        title: "Смотри на характеристики",
        body: "Ниже подсвечены статы выбранного героя: здоровье, атака, скорость, шаги, радиус и удача. Тапни Чайро или Тайдли и сравни их перед ходом.",
        tone: "stats" as const,
      };
    if (tutorialProgress.resonanceUsed)
      return tutorialProgress.freeplayDismissed
        ? null
        : {
            title: "Дальше бой за тобой",
            body: "Главное показали: двигаться, атаковать и тратить резонанс на способность ты уже умеешь. Теперь спокойно добей соперника.",
          };
    if (selectedOrder?.type === "skill")
      return {
        title: "Вот это уже похоже на план",
        body: "Способность готова. Она потратит резонанс, зато даст больше пользы, чем обычный удар. Заверши ход, посмотрим результат.",
      };
    if (armedAbility)
      return {
        title: "Теперь выбери цель",
        body: "Тапни по врагу на поле. Если цель в радиусе и путь не перекрыт, герой ударит способностью.",
      };
    if (selectedOrder?.type === "attack")
      return {
        title: "Удар выбран",
        body: "Враг попал в радиус атаки. Заверши ход, и герой нанесёт урон первым, если скорость позволит.",
      };
    if (selectedOrder?.type === "move")
      return {
        title: "Маршрут есть",
        body: "Отлично. Заверши ход, герой передвинется. Если окажемся рядом с точкой резонанса, в конце хода получим энергию.",
      };
    if (tutorialProgress.moved && !tutorialProgress.attacked)
      return tutorialEnemy && canAttack(unit, tutorialEnemy)
        ? {
            title: "Теперь удар",
            body: "Хорошая позиция. Тапни по врагу на поле: если он в радиусе атаки, герой подготовит удар на этот ход.",
          }
        : {
            title: "Ещё ближе",
            body: "Мы сдвинулись правильно, но до удара пока далековато. Подойди так, чтобы враг оказался в радиусе атаки.",
          };
    if (usableTutorialSkill)
      return {
        title: "Тратим резонанс с умом",
        body: `У нас есть энергия для способности «${abilityName(usableTutorialSkill)}». Нажми её, а потом выбери врага. Вот ради этого мы и брали точку.`,
        tone: "resonance" as const,
      };
    if (tutorialProgress.attacked)
      return {
        title: "Нужен резонанс",
        body: "Обычный удар ты уже показал. Теперь держись рядом с точкой резонанса и заверши ход: накопим энергию для способности.",
      };
    if (tutorialStandingOnPoint)
      return {
        title: "Это точка резонанса",
        body: "Стой рядом с ней и завершай ход. Точка даст резонанс для способностей и очки контроля, но после нескольких сборов выгорит.",
      };
    if (tutorialEnemy && canAttack(unit, tutorialEnemy))
      return {
        title: "Враг уже в радиусе",
        body: "Можно тапнуть по нему и дать обычную атаку. Но если есть резонанс, способность часто выгоднее.",
      };
    return {
      title: "Начнём с позиции",
      body: "Тапни по подсвеченной клетке ближе к точке резонанса. В бою перемещение решает: кто держит точки, тот быстрее получает способности.",
    };
  })();
  const tutorialStatsHighlight =
    tutorialBattle && tutorialPhase === "second" && !tutorialProgress.statsSeen;
  const tutorialResonanceHighlight = tutorialGuide?.tone === "resonance";
  function abilityDescription(id: AbilityId) {
    const definition = abilityFor(unit, id)!;
    const cooldown = Math.max(0, (unit.cooldowns[id] ?? 1) - battle.round);
    const cost = effectiveAbilityCost(unit, definition);
    const radius = effectiveAbilityRadius(unit, definition);
    return (
      <>
        <div className={styles.abilityNumbers}>
          {definition.effects
            .filter((e) => e.enabled !== false)
            .map((effect, i) => {
              const amount =
                effect.type === "push" || effect.type === "pull"
                  ? Math.min(
                      effect.maxDistance ?? 2,
                      scaledPower(unit, effect.power),
                    )
                  : scaledPower(unit, effect.power);
              const label =
                effect.type === "buff"
                  ? tr(effect.stat)
                  : tr(effect.type === "damage" ? "baseDamage" : effect.type);
              return (
                <span key={i}>
                  <b>
                    {label} {amount}
                  </b>
                  <small>
                    {Math.round(effect.power.factor * 100)}%{" "}
                    {tr(
                      effect.power.stat === "hp" ? "maxHp" : effect.power.stat,
                    )}
                    {effect.power.flat ? ` + ${effect.power.flat}` : ""}
                  </small>
                  {effect.type === "lifesteal" && (
                    <small>
                      {tr("drainRatio")}: {Math.round(effect.ratio * 100)}%
                    </small>
                  )}
                  {"duration" in effect && (
                    <small>
                      {tr("duration")}:{" "}
                      {effect.type === "shield"
                        ? (effect.duration ?? 0) + 1
                        : effect.duration}
                    </small>
                  )}
                  {"delay" in effect && (
                    <small>
                      {tr("startsIn")} {effect.delay ?? 1} {tr("turnsShort")}
                    </small>
                  )}
                  {effect.type === "poison" && (
                    <small>
                      {tr("healingPenalty")}:{" "}
                      {Math.round((effect.healingReduction ?? 0.3) * 100)}%
                    </small>
                  )}
                  {"canCrit" in effect && effect.canCrit === false && (
                    <small>{tr("noCrit")}</small>
                  )}
                  {"ignoreCover" in effect && effect.ignoreCover && (
                    <small>{tr("ignoresCover")}</small>
                  )}
                </span>
              );
            })}
        </div>
        <p>
          {(locale === "ru"
            ? definition.descriptionRu
            : definition.descriptionEn) ?? tr(`${id}Hint`)}
        </p>
        <div className={styles.abilityMeta}>
          <span>
            <Zap size={12} /> {definition.cost}
            {cost !== definition.cost ? ` → ${cost}` : ""} · {tr("energy")}
          </span>
          <span>
            {tr("cooldown")}: {definition.cooldown}
          </span>
          <span>
            {tr(
              definition.target === "enemy"
                ? "enemyTarget"
                : definition.target === "ally"
                  ? "allyTarget"
                  : "selfTarget",
            )}
            {radius ? ` · ${tr("radius")} ${radius}` : ""}
            {radius
              ? ` · ${tr("targetLimit")}: ${definition.maxTargets ?? 6}`
              : ""}
          </span>
          {definition.lineOfSight === false && (
            <span>{tr("noLineOfSight")}</span>
          )}
          {definition.target !== "self" && (
            <span>
              {tr("range")}:{" "}
              {definition.range ?? stats(unit).range + definition.rangeBonus}
            </span>
          )}
        </div>
        {(cooldown > 0 || availableEnergy < cost) && (
          <small className={styles.abilityUnavailable}>
            {cooldown > 0
              ? `${tr("cooldown")}: ${cooldown}`
              : `${tr("notEnoughEnergy")}: ${availableEnergy}/${cost}`}
          </small>
        )}
      </>
    );
  }
  function eventText(e: BattleEvent) {
    const actor = e.unitId ? battle.units.find((u) => u.id === e.unitId) : null;
    const side = e.side ?? actor?.side;
    const resonanceAction = resonanceEventLabel(locale, e.abilityId);
    const ability = actor ? abilityFor(actor, e.abilityId) : undefined;
    const prefix = [
      side ? sideLabel(side) : "",
      actor ? name(actor) : "",
      e.point !== undefined ? `${t("arena.point")} ${e.point + 1}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const action = e.reason
      ? t(`arena.${e.reason}`)
      : resonanceAction
        ? resonanceAction
        : e.effect
        ? tr(e.effect)
        : e.type === "skill" && ability
          ? abilityName(ability)
          : t(`arena.${e.type}`);
    return `${prefix}: ${e.displacement ? tr(e.displacement) : action}${e.amount !== undefined ? ` ${e.amount}` : ""}${e.critical ? ` · ${tr("critical")}` : ""}${e.covered ? ` · ${tr("cover")}` : ""}${e.absorbed ? ` · ${t("arena.absorbed")} ${e.absorbed}` : ""}`;
  }

  function orderLabel(order: Order) {
    if (order.type === "move")
      return `${t("arena.move")} ${order.to.x + 1}:${order.to.y + 1}`;
    if (order.type === "attack") {
      const target = battle.units.find((u) => u.id === order.targetId);
      return `${t("arena.attack")}${target ? ` · ${name(target)}` : ""}`;
    }
    if (order.type === "skill") {
      const actor = battle.units.find((u) => u.id === order.unitId);
      const ability = actor ? abilityFor(actor, order.abilityId) : undefined;
      return ability ? abilityName(ability) : t("arena.skill");
    }
    return t("arena.wait");
  }

  const start = useCallback(async () => {
    const id = ++requestId.current;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const previewSpeciesId = new URLSearchParams(window.location.search).get(
        "species",
      );
      let data: ResponseData;
      let storedTutorialBattle = false;
      let storedTutorialPhase: "first" | "second" | null = null;
      if (previewSpeciesId) {
        setLegacyPreview(true);
        const res = await fetch("/api/hunt/training", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start", previewSpeciesId }),
        });
        if (!res.ok) throw new Error("start");
        data = await res.json();
      } else {
        setLegacyPreview(false);
        const stored = JSON.parse(
          localStorage.getItem("nearloy-hunt-battle-state") || "null",
        );
        storedTutorialBattle = Boolean(stored?.tutorial);
        storedTutorialPhase = stored?.tutorialPhase === "second" ? "second" : storedTutorialBattle ? "first" : null;
        const existingMatchId =
          typeof stored?.matchId === "string" ? stored.matchId : null;
        const storedTeam = Array.isArray(stored?.teamUuids)
          ? stored.teamUuids
          : [];
        if (!existingMatchId && storedTutorialBattle && [1, 2].includes(storedTeam.length)) {
          const result = await startHuntTutorialTrainingMatch(storedTeam[0], storedTeam);
          if (!result.ok) throw new Error("start");
          data = result.data;
        } else if (!existingMatchId && storedTeam.length !== 3) {
          setLegacyPreview(true);
          const res = await fetch("/api/hunt/training", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "start" }),
          });
          if (!res.ok) throw new Error("start");
          data = await res.json();
        } else {
          const result = existingMatchId
            ? await readHuntBattleMatch(existingMatchId)
            : stored?.mode === "random"
              ? await startHuntRandomMatch(storedTeam)
              : await startHuntTrainingMatch(storedTeam);
          if (!result.ok) throw new Error("start");
          data = result.data;
        }
      }
      if (!mounted.current || id !== requestId.current) return;
      setBattle(data.battle);
      setToken(data.matchId ?? data.token);
      setControlledSide(data.controlledSide ?? "player");
      setMatchMode(data.mode ?? "TRAINING");
      setTutorialBattle(storedTutorialBattle);
      setTutorialProgress({
        statsSeen: false,
        moved: false,
        attacked: false,
        resonanceUsed: false,
        freeplayDismissed: false,
      });
      setWaitingForOpponent(Boolean(data.waitingForOpponent));
      setPendingSides(data.pendingSides ?? []);
      setOpponentName(data.botDisplayName ?? null);
      setReward(undefined);
      setTutorialPhase(storedTutorialPhase);
      setOrders([]);
      setBonus(null);
      setArmedAbility(null);
      setNotice(null);
      setEvents([]);
      setLog([]);
      setSelected(`${data.controlledSide ?? "player"}-0`);
      setShowResult(true);
      setInspected(null);
      setPoint(null);
    } catch {
      if (mounted.current && id === requestId.current) setError("error");
    } finally {
      if (mounted.current && id === requestId.current) {
        setBusy(false);
        inFlight.current = false;
      }
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void start();
    return () => {
      mounted.current = false;
    };
  }, [start]);
  useEffect(() => {
    if (!token || legacyPreview || battle.winner) return;
    if (!waitingForOpponent && !pendingSides.length) return;
    const timer = window.setInterval(async () => {
      const result = await readHuntBattleMatch(token);
      if (!mounted.current || !result.ok) return;
      const data = result.data;
      if (data.status === "ACTIVE" && waitingForOpponent && !data.waitingForOpponent) {
        setWaitingForOpponent(false);
        setPendingSides(data.pendingSides ?? []);
        setControlledSide(data.controlledSide);
        setMatchMode(data.mode);
        setOpponentName(data.botDisplayName ?? null);
        setBattle(data.battle);
        setSelected((prev) =>
          alive(data.battle, data.controlledSide).some((u) => u.id === prev)
            ? prev
            : (alive(data.battle, data.controlledSide)[0]?.id ?? prev),
        );
      }
      if (data.frames.length && data.battle.round !== battle.round) {
        setBattle(data.battle);
        setWaitingForOpponent(false);
        setPendingSides(data.pendingSides ?? []);
        setOpponentName(data.botDisplayName ?? null);
        if (data.reward) setReward(data.reward);
      }
    }, 1800);
    return () => window.clearInterval(timer);
  }, [battle.round, battle.winner, legacyPreview, pendingSides.length, token, waitingForOpponent]);

  useEffect(() => {
    if (!battle.winner || busy || tutorialAdvanced.current) return;
    const stored = JSON.parse(
      localStorage.getItem("nearloy-hunt-battle-state") || "null",
    );
    if (!stored?.tutorial) return;
    tutorialAdvanced.current = true;
    void (async () => {
      const phase = stored?.tutorialPhase === "second" ? "second" : "first";
      const action = phase === "second" ? "second_battle_finished" : "battle_finished";
      const result = await advanceHuntTutorial(action);
      if (result.ok) {
        setBattleTutorialReward({
          title: phase === "second" ? "Смотри, какой милашка" : "Тайдли сам напросился",
          body:
            phase === "second"
              ? "Я нашла Блуми в кусту. Он пытался выглядеть загадочно, но выдал себя тем, что радостно шуршал листьями. Теперь у нас три героя: огонь, вода и природа. Стихия влияет на урон по другим стихиям, так что команда уже начинает играть головой."
              : "Смотри на этого водяного серьёзного парня. Он всю дуэль делал вид, что просто мимо проплывал, а теперь уже записался к нам в отряд.",
          image: phase === "second" ? "/hunt-assets/tutorial/lira-bloomy.png" : "/hunt-assets/tutorial/lira-tydli.png",
          next: phase === "second" ? "upgrade" : "hunt",
        });
        if (phase === "second") await advanceHuntTutorial("tactics_seen");
        setShowResult(false);
        localStorage.setItem(
          "nearloy-hunt-battle-state",
          JSON.stringify({ ...stored, tutorialCompletedBattle: true, tutorialPhase: phase }),
        );
      }
    })();
  }, [battle.winner, busy]);

  useEffect(() => {
    if (!tutorialProgress.resonanceUsed || tutorialProgress.freeplayDismissed) return;
    const timeout = window.setTimeout(() => {
      setTutorialProgress((progress) => ({
        ...progress,
        freeplayDismissed: true,
      }));
    }, 5200);
    return () => window.clearTimeout(timeout);
  }, [tutorialProgress.resonanceUsed, tutorialProgress.freeplayDismissed]);

  useEffect(() => {
    if (!tutorialStatsHighlight) return;
    const timeout = window.setTimeout(() => {
      setTutorialProgress((progress) => ({ ...progress, statsSeen: true }));
    }, 6200);
    return () => window.clearTimeout(timeout);
  }, [tutorialStatsHighlight]);

  function setOrder(order: Order) {
    if (busy || battle.winner || waitingForOpponent) return;
    setArmedAbility(null);
    setInspected(null);
    setNotice(null);
    setOrders((prev) => {
      const limit = actionLimit(battle, controlledSide);
      const teamSize = alive(battle, controlledSide).length;
      const hasUnitOrder = prev.some((o) => o.unitId === order.unitId);
      if (hasUnitOrder && prev.length < limit && limit > teamSize)
        return [...prev, order];
      return [...prev.filter((o) => o.unitId !== order.unitId), order];
    });
  }
  function chooseCell(to: Cell) {
    if (legal.some((p) => sameCell(p, to)))
      setOrder({
        unitId: unit.id,
        type: "move",
        to,
      });
  }
  function chooseFighter(u: Fighter) {
    if (busy || battle.winner || waitingForOpponent || u.hp <= 0) return;
    if (armedAbility) {
      const order: Extract<Order, { type: "skill" }> = {
        unitId: unit.id,
        type: "skill",
        abilityId: armedAbility,
        targetId: u.id,
      };
      if (
        canUseSkill(battle, unit, order) &&
        availableEnergy >= abilityFor(unit, armedAbility)!.cost
      )
        setOrder(order);
      else setNotice(skillTargetFailure(battle, unit, order) ?? null);
      return;
    }
    if (u.side === controlledSide) {
      setSelected(u.id);
      setArmedAbility(null);
      setNotice(null);
      setPoint(null);
    } else if (canAttack(unit, u)) {
      setOrder({ unitId: unit.id, type: "attack", targetId: u.id });
    } else setNotice(attackFailure(unit, u) ?? null);
  }
  function chooseSkill(id: AbilityId) {
    setInspected(null);
    if (
      busy ||
      battle.winner ||
      waitingForOpponent ||
      !skillReady(battle, unit, id) ||
      availableEnergy < effectiveAbilityCost(unit, abilityFor(unit, id)!)
    )
      return;
    setNotice(null);
    if (abilityFor(unit, id)!.target === "self")
      setOrder({ unitId: unit.id, type: "skill", abilityId: id });
    else setArmedAbility((prev) => (prev === id ? null : id));
  }
  async function commit() {
    if (inFlight.current || busy || battle.winner || waitingForOpponent || !token)
      return;
    inFlight.current = true;
    setBusy(true);
    setInspected(null);
    setError(null);
    setPoint(null);
    setArmedAbility(null);
    const submittedOrders = orders;
    const id = ++requestId.current;
    try {
      let data: ResponseData;
      if (legacyPreview) {
        const res = await fetch("/api/hunt/training", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "round", token, orders, bonus }),
        });
        data = await res.json();
        if (!res.ok) {
          if (mounted.current)
            setError(data.error === "INVALID_SESSION" ? "expired" : "error");
          return;
        }
      } else {
        const result = await submitHuntBattleTurn(token, orders);
        if (!result.ok) {
          if (mounted.current)
            setError(result.message.includes("INVALID_SESSION") ? "expired" : "error");
          return;
        }
        data = result.data;
      }
      const roundLog: BattleEvent[] = [];
      setOrders([]);
      setBonus(null);
      if (tutorialBattle) {
        setTutorialProgress((progress) => ({
          statsSeen: progress.statsSeen,
          moved: progress.moved || submittedOrders.some((order) => order.type === "move"),
          attacked: progress.attacked || submittedOrders.some((order) => order.type === "attack"),
          resonanceUsed:
            progress.resonanceUsed ||
            submittedOrders.some((order) => order.type === "skill"),
          freeplayDismissed:
            progress.resonanceUsed ||
            !submittedOrders.some((order) => order.type === "skill")
              ? progress.freeplayDismissed
              : false,
        }));
      }
      setWaitingForOpponent(Boolean(data.waitingForOpponent));
      setPendingSides(data.pendingSides ?? []);
      setOpponentName(data.botDisplayName ?? opponentName);
      if (data.reward) setReward(data.reward);
      if (data.waitingForOpponent) {
        setBattle(data.battle);
        setToken(data.matchId ?? data.token);
        setEvents([]);
        setLog([]);
        return;
      }
      for (const frame of data.frames) {
        if (!mounted.current || requestId.current !== id) return;
        setBattle(frame.battle);
        setEvents(frame.events);
        roundLog.push(...frame.events);
        await new Promise((resolve) => setTimeout(resolve, reduced ? 50 : 750));
      }
      if (!mounted.current || requestId.current !== id) return;
      setToken(data.matchId ?? data.token);
      setControlledSide(data.controlledSide ?? controlledSide);
      setMatchMode(data.mode ?? matchMode);
      setOpponentName(data.botDisplayName ?? opponentName);
      setEvents([]);
      setLog(roundLog);
      setSelected((prev) =>
        alive(data.battle, data.controlledSide ?? controlledSide).some(
          (u) => u.id === prev,
        )
          ? prev
          : (alive(data.battle, data.controlledSide ?? controlledSide)[0]?.id ??
            prev),
      );
    } catch {
      if (mounted.current) setError("error");
    } finally {
      if (mounted.current && requestId.current === id) {
        setBusy(false);
        inFlight.current = false;
      }
    }
  }

  return (
    <div className={styles.arena} translate="no" suppressHydrationWarning>
      <header className={styles.header} suppressHydrationWarning>
        <div>
          <span className={styles.eyebrow} suppressHydrationWarning>
            {modeLabel}
          </span>
          <h1 suppressHydrationWarning>{t("arena.title")}</h1>
        </div>
        <div className={styles.headerTools}>
          <span className={styles.round} suppressHydrationWarning>
            {t("arena.turn")}{" "}
            <b>
              {battle.round}/{ROUND_LIMIT}
            </b>
          </span>
          <button
            className={styles.icon}
            title={t("arena.elementWheel")}
            aria-label={t("arena.elementWheel")}
            onClick={() => setRules(true)}
          >
            <Orbit size={20} />
          </button>
          <Link
            className={styles.icon}
            href="/hunt/battle"
            title={t("arena.lobby")}
            aria-label={t("arena.lobby")}
          >
            <X size={20} />
          </Link>
        </div>
      </header>
      <div className={styles.scoreboard}>
        <span className={styles.playerColor}>
          {sideLabel(controlledSide)} <b>{battle.score[controlledSide]}</b>
          <small
            className={tutorialResonanceHighlight ? styles.tutorialResonanceMeter : undefined}
            title={t("arena.energy")}
          >
            <Zap size={14} />
            {battle.energy[controlledSide] - orderCost(battle, orders, bonus)}
          </small>
        </span>
        <span title={t("arena.score")}>
          <Trophy size={15} />
        </span>
        <span className={styles.botColor}>
          <small title={t("arena.energy")}>
            <Zap size={14} />
            {battle.energy[opponentSide]}
          </small>
          <b>{battle.score[opponentSide]}</b> {sideLabel(opponentSide)}
        </span>
      </div>
      <div className={styles.body}>
        <div className={styles.map}>
          <BattleMap
            battle={battle}
            selected={unit}
            legal={legal}
            orders={orders}
            events={events}
            busy={busy}
            onCell={chooseCell}
            onFighter={chooseFighter}
            onPoint={setPoint}
            onCover={() => setNotice("coverHint")}
            onInspect={(u) => {
              if (!busy) setInspected(u.id);
            }}
            armedAbility={armedAbility}
          />
          {point === null && (
            <div className={styles.feedback} aria-live="polite">
              {busy && events.length > 0 ? (
                events
                  .filter((e) => e.type !== "move")
                  .slice(-2)
                  .map((e, i) => <p key={i}>{eventText(e)}</p>)
              ) : notice ? (
                <p>{t(`arena.${notice}`)}</p>
              ) : skillArmed ? (
                <p>
                  {t(
                    skill.target === "ally"
                      ? "arena.targetAlly"
                      : "arena.targetEnemy",
                  )}
                </p>
              ) : preview && selectedOrder ? (
                <>
                  <p>
                    <b>{t("arena.forecast")}</b> ·{" "}
                    {selectedOrder.type === "skill"
                      ? abilityName(skill)
                      : t(`arena.${selectedOrder.type}`)}
                    {preview.steps !== undefined
                      ? ` · ${preview.steps} ${t("arena.steps")}`
                      : ""}
                    {preview.heal !== undefined
                      ? ` · ${t("arena.heal")} +${preview.heal}`
                      : ""}
                    {preview.shield
                      ? ` · ${t("arena.shield")} ${preview.shield}`
                      : ""}
                  </p>
                  {preview.damage !== undefined && (
                    <>
                      <div className={styles.previewBadges}>
                        <span className={styles.previewDamage}>
                          <Swords size={12} /> {preview.damage}–
                          {preview.maxDamage}
                        </span>
                        <span>
                          {tr("critical")}:{" "}
                          {[
                            ...new Set(preview.hits?.map((h) => h.chance)),
                          ].join(" / ")}
                          %
                        </span>
                        {preview.hits?.some((h) => h.covered) && (
                          <span>
                            <Shield size={12} /> {tr("cover")} −30%
                          </span>
                        )}
                        {[
                          ...new Set(preview.displacements?.map((d) => d.type)),
                        ].map((type) => {
                          const steps = preview
                            .displacements!.filter((d) => d.type === type)
                            .map((d) => d.path.length - 1);
                          const min = Math.min(...steps),
                            max = Math.max(...steps);
                          return (
                            <span key={type}>
                              {tr(type)}: {min === max ? min : `${min}–${max}`}
                            </span>
                          );
                        })}
                      </div>
                      <small>{t("arena.previewRisk")}</small>
                    </>
                  )}
                </>
              ) : (
                log
                  .filter((e) =>
                    ["exhausted", "miss", "blocked", "cancelled"].includes(
                      e.type,
                    ),
                  )
                  .slice(-1)
                  .map((e, i) => <p key={i}>{eventText(e)}</p>)
              )}
            </div>
          )}
          {point !== null && (
            <div className={styles.pointInfo}>
              <button
                className={styles.dismiss}
                aria-label={t("arena.close")}
                onClick={() => setPoint(null)}
              >
                <X size={16} />
              </button>
              <strong>
                {point === 1
                  ? t("arena.centerPoint")
                  : `${t("arena.point")} ${point + 1}`}{" "}
                · +{POINTS[point].income} {t("arena.income")}
              </strong>
              <span>
                {t("arena.remaining")}: {sideLabel(controlledSide)}{" "}
                {POINT_CAP - battle.points[controlledSide][point]}/{POINT_CAP} ·{" "}
                {sideLabel(opponentSide)} {POINT_CAP - battle.points[opponentSide][point]}/
                {POINT_CAP}
              </span>
              {battle.points[controlledSide][point] === POINT_CAP && (
                <span>
                  <LockKeyhole size={13} /> {t("arena.exhausted")}
                </span>
              )}
              {battle.points[controlledSide][point] === POINT_CAP && (
                <small>{t("arena.pointStopped")}</small>
              )}
              {(["player", "bot"] as const).every((side) =>
                alive(battle, side).some(
                  (u) => distance(u, POINTS[point]) <= 1,
                ),
              ) && <small>{t("arena.pointContested")}</small>}
            </div>
          )}
          {(busy && !token) || waitingForOpponent ? (
            <div className={styles.mapLoading}>
              {waitingForOpponent ? null : <Loader2 className={styles.spin} />}
              {waitingForOpponent
                ? pendingSides.includes(controlledSide)
                  ? t("arena.waitOpponent" as TranslationKey)
                  : t("arena.waitSecondPlayer" as TranslationKey)
                : t("arena.loading")}
            </div>
          ) : null}
        </div>
        <aside className={styles.panel}>
          <AnimatePresence>
            {inspected && (
              <FighterDetails
                key={inspected}
                unit={battle.units.find((u) => u.id === inspected)!}
                onClose={() => setInspected(null)}
              />
            )}
          </AnimatePresence>
          <div className={styles.team}>
            {battle.units
              .filter((u) => u.side === controlledSide)
              .map((u) => (
                <button
                  key={u.id}
                  disabled={busy || u.hp <= 0 || !!battle.winner}
                  className={`${styles.teamMember} ${selected === u.id ? styles.activeMember : ""}`}
                  aria-label={name(u)}
                  aria-pressed={selected === u.id}
                  onClick={() => {
                    setInspected(null);
                    setSelected(u.id);
                    setArmedAbility(null);
                    setNotice(null);
                    setPoint(null);
                  }}
                >
                  <Image src={stats(u).image} width={88} height={88} alt="" />
                  <span>
                    <b>{name(u)}</b>
                    <small>
                      {t("arena.level")} · {u.hp}/{stats(u).hp}
                      {orders.filter((order) => order.unitId === u.id).length >
                      1
                        ? ` · x${orders.filter((order) => order.unitId === u.id).length}`
                        : ""}
                    </small>
                  </span>
                  {orders.some((o) => o.unitId === u.id) && (
                    <Check size={13} className={styles.orderCheck} />
                  )}
                </button>
              ))}
          </div>
          <div className={`${styles.unitStats} ${tutorialStatsHighlight ? styles.tutorialStatsHighlight : ""}`}>
            <button
              className={styles.stateButton}
              aria-label={t("arena.characterState")}
              onClick={() => setInspected(unit.id)}
              disabled={busy}
            >
              <Info size={17} />
            </button>
            {[
              [Heart, unit.hp, "hp", null],
              [
                Shield,
                unit.shield,
                "shield",
                unit.shield > 0
                  ? `${shieldTurnsLeft} ${tr("turnsShort")}`
                  : null,
              ],
              [Swords, stats(unit).attack, "attack", null],
              [Zap, stats(unit).speed, "speed", null],
              [Footprints, stats(unit).movement, "movement", null],
              [Crosshair, stats(unit).range, "range", null],
              [Clover, stats(unit).luck, "luck", null],
            ].map(([Icon, value, label, meta]) => {
              const Glyph = Icon as typeof Heart;
              return (
                <span
                  key={label as string}
                  className={label === "shield" && unit.shield > 0 ? styles.shieldStat : undefined}
                  title={t(`arena.${label}` as TranslationKey)}
                >
                  <Glyph size={14} />
                  <b>{value as number}</b>
                  {meta && <small>{meta as string}</small>}
                </span>
              );
            })}
          </div>
          <div className={styles.effectStrip}>
            {[...new Set(unit.effects.map((e) => e.type))].map((type) => {
              const effects = unit.effects.filter((e) => e.type === type);
              const remaining = Math.max(
                ...effects.map(
                  (e) => e.expires - Math.max(battle.round, e.starts) + 1,
                ),
              );
              const Icon =
                type === "burn" ? Flame : type === "poison" ? Skull : Sprout;
              return (
                <ActionButton
                  key={`${unit.id}:${type}`}
                  className={styles.effectChip}
                  aria-label={tr(type)}
                  description={
                    effects
                      .map((e) => `${tr(e.stat ?? e.type)}: ${e.amount}`)
                      .join(" · ") + ` · ${remaining} ${tr("turns")}`
                  }
                >
                  <Icon size={11} /> {tr(type)} {remaining}
                </ActionButton>
              );
            })}
          </div>
          <div className={styles.actions}>
            {loadoutFor(unit).map((id) => {
              const definition = abilityFor(unit, id)!;
              const legacyIcons: Record<string, typeof Shield> = {
                lavaShield: Shield,
                ember: Flame,
                eruption: Flame,
                tideLance: Crosshair,
                tidalWave: Waves,
                waterVeil: Droplets,
                plantain: Leaf,
                venom: Skull,
                bloom: Sprout,
              };
              const Icon =
                abilityIcons[definition.icon as keyof typeof abilityIcons] ??
                legacyIcons[id] ??
                Swords;
              const cooldown = Math.max(
                0,
                (unit.cooldowns[id] ?? 1) - battle.round,
              );
              const cost = effectiveAbilityCost(unit, definition);
              return (
                <ActionButton
                  key={`${unit.id}:${id}`}
                  className={`${styles.skillButton} ${
                    tutorialResonanceHighlight && usableTutorialSkill?.key === id
                      ? styles.tutorialSkillHighlight
                      : ""
                  }`}
                  disabled={
                    busy ||
                    !!battle.winner ||
                    !skillReady(battle, unit, id) ||
                    availableEnergy < cost
                  }
                  aria-label={abilityName(definition)}
                  description={abilityDescription(id)}
                  aria-pressed={
                    armedAbility === id ||
                    (selectedOrder?.type === "skill" &&
                      selectedOrder.abilityId === id)
                  }
                  onClick={() => chooseSkill(id)}
                >
                  <Icon size={19} />
                  <span>
                    {abilityName(definition)}
                    <small>
                      {cooldown ? (
                        `${tr("cooldown")} ${cooldown}`
                      ) : (
                        <>
                          <Zap size={10} /> {definition.cost}
                          {cost !== definition.cost ? ` → ${cost}` : ""}
                        </>
                      )}
                    </small>
                  </span>
                </ActionButton>
              );
            })}
            <ActionButton
              className={styles.icon}
              disabled={busy || (!selectedOrder && !armedAbility)}
              aria-label={t("arena.cancel")}
              description={t("arena.cancelHint")}
              onClick={() => {
                setArmedAbility(null);
                setOrders((prev) => {
                  const index = prev.map((o) => o.unitId).lastIndexOf(unit.id);
                  if (index < 0) return prev;
                  return prev.filter((_, orderIndex) => orderIndex !== index);
                });
              }}
            >
              <Undo2 size={18} />
            </ActionButton>
          </div>
          <div className={styles.orderSummary} aria-live="polite">
            <span>
              {unitOrders.length
                ? unitOrders
                    .map((order, index) => `${index + 1}. ${orderLabel(order)}`)
                    .join(" · ")
                : name(unit)}
            </span>
            <span>
              {t("arena.ready")} {orders.length}/
              {actionLimit(battle, controlledSide)}{" "}
              <button
                aria-label={t("arena.log")}
                title={t("arena.log")}
                onClick={() => setShowLog(true)}
              >
                <History size={14} />
              </button>
            </span>
          </div>
          {error && (
            <div className={styles.error} role="alert">
              {t(`arena.${error}`)}
              {(!token || error === "expired") && (
                <button onClick={() => void start()}>
                  {t("arena.restart")}
                </button>
              )}
            </div>
          )}
          <ActionButton
            className={styles.confirm}
            disabled={busy || waitingForOpponent || !token}
            aria-label={t(battle.winner ? "arena.restart" : "arena.confirm")}
            description={t(
              battle.winner ? "arena.restartHint" : "arena.confirmHint",
            )}
            onClick={() => (battle.winner ? void start() : void commit())}
          >
            <span className={styles.confirmIcon} aria-hidden="true">
              {busy ? (
                <Loader2 size={19} className={styles.spin} />
              ) : battle.winner ? (
                <RotateCcw size={19} />
              ) : (
                <Check size={19} />
              )}
            </span>
            <span className={styles.confirmText} translate="no">
              {busy
                ? t("arena.resolving")
                : battle.winner
                  ? t("arena.restart")
                  : t("arena.confirm")}
            </span>
          </ActionButton>
        </aside>
      </div>
      {tutorialGuide && (
        <div
          className={`${styles.tutorialCoach} ${
            tutorialGuide.tone === "resonance" ? styles.resonanceCoach : ""
          } ${tutorialGuide.tone === "stats" ? styles.statsCoach : ""}`}
          aria-live="polite"
        >
          <Image
            src="/hunt-assets/tutorial/lira-point.png"
            alt=""
            width={166}
            height={206}
            priority
          />
          <div>
            <small>Лира Нокс</small>
            <strong>{tutorialGuide.title}</strong>
            <p>{tutorialGuide.body}</p>
          </div>
        </div>
      )}
      <Dialog open={rules} onOpenChange={setRules}>
        <DialogContent
          className={`${styles.modal} ${styles.wheelModal}`}
          showClose={false}
        >
          <DialogTitle>{t("arena.elementWheel")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("arena.elementWheelAlt")}
          </DialogDescription>
          <DialogClose
            className={styles.modalClose}
            aria-label={t("arena.close")}
          >
            <X size={20} />
          </DialogClose>
          <Image
            className={styles.wheelImage}
            src="/hunt-assets/ui/element-counters-v4.png"
            width={1254}
            height={1254}
            sizes="(max-width: 430px) 90vw, 390px"
            alt={t("arena.elementWheelAlt")}
          />
        </DialogContent>
      </Dialog>
      {battleTutorialReward && (
        <div className={styles.tutorialRewardOverlay}>
          <section className={styles.tutorialRewardCard}>
            <Image
              src={battleTutorialReward.image}
              alt=""
              width={136}
              height={220}
            />
            <div>
              <small>Лира Нокс</small>
              <h2>{battleTutorialReward.title}</h2>
              <p>{battleTutorialReward.body}</p>
              <button
                type="button"
                onClick={() => {
                  const next = battleTutorialReward.next;
                  setBattleTutorialReward(null);
                  router.push(next === "upgrade" ? "/hunt" : "/hunt");
                }}
              >
                Забираем
              </button>
            </div>
          </section>
        </div>
      )}
      <Dialog open={showLog} onOpenChange={setShowLog}>
        <DialogContent className={styles.modal} showClose={false}>
          <DialogTitle>{t("arena.log")}</DialogTitle>
          <DialogDescription>
            {t("arena.turn")}{" "}
            {Math.max(1, battle.round - (battle.winner ? 0 : 1))}
          </DialogDescription>
          <DialogClose
            className={styles.modalClose}
            aria-label={t("arena.close")}
          >
            <X size={20} />
          </DialogClose>
          <div className={styles.rules}>
            {log.length === 0 ? (
              <p>{t("arena.wait")}</p>
            ) : (
              log.map((e, i) => <p key={i}>{eventText(e)}</p>)
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!battle.winner && !busy && showResult}
        onOpenChange={setShowResult}
      >
        <DialogContent
          className={`${styles.modal} ${styles.resultModal}`}
          showClose={false}
        >
          <Trophy size={24} className={styles.playerColor} />
          <DialogTitle>
            {t(
              battle.winner === "draw"
                ? "arena.draw"
                : battle.winner === controlledSide
                ? "arena.win"
                : "arena.loss",
            )}
          </DialogTitle>
          <DialogDescription>
            {t("arena.score")}: {battle.score[controlledSide]} :{" "}
            {battle.score[opponentSide]}
          </DialogDescription>
          {reward && (
            <div className={styles.rewardLine}>
              <span>
                <Zap size={14} /> +{reward.currency} NearCoin
              </span>
              <span className={reward.trophies >= 0 ? styles.playerColor : styles.botColor}>
                <Trophy size={14} /> {reward.trophies >= 0 ? "+" : ""}
                {reward.trophies}
              </span>
            </div>
          )}
          <BattleResults battle={battle} />
          <DialogClose
            className={styles.modalClose}
            aria-label={t("arena.close")}
          >
            <X size={20} />
          </DialogClose>
          <button className={styles.confirm} onClick={() => void start()} translate="no">
            <span className={styles.confirmIcon} aria-hidden="true">
              <RotateCcw size={18} />
            </span>
            <span className={styles.confirmText}>{t("arena.restart")}</span>
          </button>
          <Link href="/hunt/battle" className={styles.lobby}>
            <ArrowLeft size={16} />
            {t("arena.lobby")}
          </Link>
        </DialogContent>
      </Dialog>
    </div>
  );
}
