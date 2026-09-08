"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
  canAttack,
  attackFailure,
  canUseSkill,
  previewOrder,
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
} from "@/lib/hunt/tactics";
import { BattleMap } from "./battle-map";
import { ActionButton } from "./action-button";
import { FighterDetails } from "./fighter-details";
import { BattleResults } from "./battle-results";
import { abilityIcons } from "@/lib/hunt/ability-icons";
import styles from "./arena.module.css";

type ResponseData = {
  battle: Battle;
  token: string;
  frames: Frame[];
  error?: string;
};

export default function HuntBattleArenaPage() {
  const { t, locale } = useI18n("ru");
  const [battle, setBattle] = useState<Battle>(createBattle);
  const [token, setToken] = useState("");
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
  const selectedOrder = orders.find((o) => o.unitId === unit.id);
  const preview = selectedOrder
    ? previewOrder(battle, selectedOrder, bonus)
    : null;
  const skill = abilityFor(
    unit,
    armedAbility ??
      (selectedOrder?.type === "skill" ? selectedOrder.abilityId : undefined),
  )!;
  const availableEnergy =
    battle.energy.player -
    orderCost(
      battle,
      orders.filter((o) => o.unitId !== unit.id),
      bonus,
    );
  const tr = (key: string) => t(`arena.${key}` as TranslationKey);
  function abilityDescription(id: AbilityId) {
    const definition = abilityFor(unit, id)!;
    const cooldown = Math.max(0, (unit.cooldowns[id] ?? 1) - battle.round);
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
            <Zap size={12} /> {definition.cost} · {tr("energy")}
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
            {definition.radius ? ` · ${tr("radius")} ${definition.radius}` : ""}
            {definition.radius
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
        {(cooldown > 0 || availableEnergy < definition.cost) && (
          <small className={styles.abilityUnavailable}>
            {cooldown > 0
              ? `${tr("cooldown")}: ${cooldown}`
              : `${tr("notEnoughEnergy")}: ${availableEnergy}/${definition.cost}`}
          </small>
        )}
      </>
    );
  }
  function eventText(e: BattleEvent) {
    const actor = e.unitId ? battle.units.find((u) => u.id === e.unitId) : null;
    const side = e.side ?? actor?.side;
    const prefix = [
      side ? t(side === "player" ? "arena.you" : "arena.bot") : "",
      actor ? name(actor) : "",
      e.point !== undefined ? `${t("arena.point")} ${e.point + 1}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const action = e.reason
      ? t(`arena.${e.reason}`)
      : e.effect
        ? tr(e.effect)
        : e.type === "skill" && actor
          ? abilityName(abilityFor(actor, e.abilityId)!)
          : t(`arena.${e.type}`);
    return `${prefix}: ${e.displacement ? tr(e.displacement) : action}${e.amount !== undefined ? ` ${e.amount}` : ""}${e.critical ? ` · ${tr("critical")}` : ""}${e.covered ? ` · ${tr("cover")}` : ""}${e.absorbed ? ` · ${t("arena.absorbed")} ${e.absorbed}` : ""}`;
  }

  const start = useCallback(async () => {
    const id = ++requestId.current;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/hunt/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          ...(() => {
            const previewSpeciesId = new URLSearchParams(
              window.location.search,
            ).get("species");
            if (previewSpeciesId) return { previewSpeciesId };
            try {
              const stored = JSON.parse(
                localStorage.getItem("nearloy-hunt-battle-state") || "null",
              );
              return Array.isArray(stored?.teamUuids) &&
                stored.teamUuids.length === 3
                ? { teamUuids: stored.teamUuids }
                : {};
            } catch {
              return {};
            }
          })(),
        }),
      });
      if (!res.ok) throw new Error("start");
      const data: ResponseData = await res.json();
      if (!mounted.current || id !== requestId.current) return;
      setBattle(data.battle);
      setToken(data.token);
      setOrders([]);
      setBonus(null);
      setArmedAbility(null);
      setNotice(null);
      setEvents([]);
      setLog([]);
      setSelected("player-0");
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

  function setOrder(order: Order) {
    if (busy || battle.winner) return;
    setArmedAbility(null);
    setInspected(null);
    setNotice(null);
    setOrders((prev) => [
      ...prev.filter((o) => o.unitId !== order.unitId),
      order,
    ]);
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
    if (busy || battle.winner || u.hp <= 0) return;
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
    if (u.side === "player") {
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
      !skillReady(battle, unit, id) ||
      availableEnergy < abilityFor(unit, id)!.cost
    )
      return;
    setNotice(null);
    if (abilityFor(unit, id)!.target === "self")
      setOrder({ unitId: unit.id, type: "skill", abilityId: id });
    else setArmedAbility((prev) => (prev === id ? null : id));
  }
  async function commit() {
    if (inFlight.current || busy || battle.winner || !token) return;
    inFlight.current = true;
    setBusy(true);
    setInspected(null);
    setError(null);
    setPoint(null);
    setArmedAbility(null);
    const id = ++requestId.current;
    try {
      const res = await fetch("/api/hunt/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "round", token, orders, bonus }),
      });
      const data: ResponseData = await res.json();
      if (!res.ok) {
        if (mounted.current)
          setError(data.error === "INVALID_SESSION" ? "expired" : "error");
        return;
      }
      const roundLog: BattleEvent[] = [];
      setOrders([]);
      setBonus(null);
      for (const frame of data.frames) {
        if (!mounted.current || requestId.current !== id) return;
        setBattle(frame.battle);
        setEvents(frame.events);
        roundLog.push(...frame.events);
        await new Promise((resolve) => setTimeout(resolve, reduced ? 50 : 750));
      }
      if (!mounted.current || requestId.current !== id) return;
      setToken(data.token);
      setEvents([]);
      setLog(roundLog);
      setSelected((prev) =>
        alive(data.battle, "player").some((u) => u.id === prev)
          ? prev
          : (alive(data.battle, "player")[0]?.id ?? prev),
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
    <div className={styles.arena}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{t("arena.training")}</span>
          <h1>{t("arena.title")}</h1>
        </div>
        <div className={styles.headerTools}>
          <span className={styles.round}>
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
          {t("arena.you")} <b>{battle.score.player}</b>
          <small title={t("arena.energy")}>
            <Zap size={14} />
            {battle.energy.player - orderCost(battle, orders, bonus)}
          </small>
        </span>
        <span title={t("arena.score")}>
          <Trophy size={15} />
        </span>
        <span className={styles.botColor}>
          <small title={t("arena.energy")}>
            <Zap size={14} />
            {battle.energy.bot}
          </small>
          <b>{battle.score.bot}</b> {t("arena.bot")}
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
                {t("arena.remaining")}: {t("arena.you")}{" "}
                {POINT_CAP - battle.points.player[point]}/{POINT_CAP} ·{" "}
                {t("arena.bot")} {POINT_CAP - battle.points.bot[point]}/
                {POINT_CAP}
              </span>
              {battle.points.player[point] === POINT_CAP && (
                <span>
                  <LockKeyhole size={13} /> {t("arena.exhausted")}
                </span>
              )}
              {battle.points.player[point] === POINT_CAP && (
                <small>{t("arena.pointStopped")}</small>
              )}
              {(["player", "bot"] as const).every((side) =>
                alive(battle, side).some(
                  (u) => distance(u, POINTS[point]) <= 1,
                ),
              ) && <small>{t("arena.pointContested")}</small>}
            </div>
          )}
          {busy && !token && (
            <div className={styles.mapLoading}>
              <Loader2 className={styles.spin} />
              {t("arena.loading")}
            </div>
          )}
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
              .filter((u) => u.side === "player")
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
                    </small>
                  </span>
                  {orders.some((o) => o.unitId === u.id) && (
                    <Check size={13} className={styles.orderCheck} />
                  )}
                </button>
              ))}
          </div>
          <div className={styles.unitStats}>
            <button
              className={styles.stateButton}
              aria-label={t("arena.characterState")}
              onClick={() => setInspected(unit.id)}
              disabled={busy}
            >
              <Info size={17} />
            </button>
            {[
              [Heart, unit.hp, "hp"],
              [Swords, stats(unit).attack, "attack"],
              [Zap, stats(unit).speed, "speed"],
              [Footprints, stats(unit).movement, "movement"],
              [Crosshair, stats(unit).range, "range"],
              [Clover, stats(unit).luck, "luck"],
            ].map(([Icon, value, label]) => {
              const Glyph = Icon as typeof Heart;
              return (
                <span
                  key={label as string}
                  title={t(`arena.${label}` as TranslationKey)}
                >
                  <Glyph size={14} />
                  <b>{value as number}</b>
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
              return (
                <ActionButton
                  key={`${unit.id}:${id}`}
                  className={styles.skillButton}
                  disabled={
                    busy ||
                    !!battle.winner ||
                    !skillReady(battle, unit, id) ||
                    availableEnergy < definition.cost
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
                setOrders((prev) => prev.filter((o) => o.unitId !== unit.id));
              }}
            >
              <Undo2 size={18} />
            </ActionButton>
          </div>
          <div className={styles.orderSummary} aria-live="polite">
            <span>
              {selectedOrder ? t(`arena.${selectedOrder.type}`) : name(unit)}
              {selectedOrder?.type === "move"
                ? ` · ${selectedOrder.to.x + 1}:${selectedOrder.to.y + 1}`
                : selectedOrder?.type === "attack"
                  ? ` · ${name(battle.units.find((u) => u.id === selectedOrder.targetId)!)}`
                  : ""}
            </span>
            <span>
              {t("arena.ready")} {orders.length}/
              {alive(battle, "player").length}{" "}
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
            disabled={busy || !token}
            aria-label={t(battle.winner ? "arena.restart" : "arena.confirm")}
            description={t(
              battle.winner ? "arena.restartHint" : "arena.confirmHint",
            )}
            onClick={() => (battle.winner ? void start() : void commit())}
          >
            {busy ? (
              <Loader2 size={19} className={styles.spin} />
            ) : battle.winner ? (
              <RotateCcw size={19} />
            ) : (
              <Check size={19} />
            )}
            {busy
              ? t("arena.resolving")
              : battle.winner
                ? t("arena.restart")
                : t("arena.confirm")}
          </ActionButton>
        </aside>
      </div>
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
              battle.winner === "player"
                ? "arena.win"
                : battle.winner === "bot"
                  ? "arena.loss"
                  : "arena.draw",
            )}
          </DialogTitle>
          <DialogDescription>
            {t("arena.score")}: {battle.score.player} : {battle.score.bot}
          </DialogDescription>
          <BattleResults battle={battle} />
          <DialogClose
            className={styles.modalClose}
            aria-label={t("arena.close")}
          >
            <X size={20} />
          </DialogClose>
          <button className={styles.confirm} onClick={() => void start()}>
            <RotateCcw size={18} />
            {t("arena.restart")}
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
