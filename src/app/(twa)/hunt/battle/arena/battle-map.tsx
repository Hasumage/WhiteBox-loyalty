"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Maximize,
  Minus,
  Plus,
  Flame,
  Skull,
  Sparkles,
  ShieldHalf,
} from "lucide-react";
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import {
  alive,
  canAttack,
  canUseSkill,
  previewOrder,
  abilityFor,
  abilityTargets,
  LOW_COVERS,
  type AbilityId,
  distance,
  pathTo,
  POINT_CAP,
  POINTS,
  sameCell,
  SIZE,
  stats,
  WALLS,
  type Battle,
  type BattleEvent,
  type Cell,
  type Fighter,
  type Order,
} from "@/lib/hunt/tactics";
import styles from "./arena.module.css";
import { cameraForEvents } from "@/lib/hunt/presentation";

const TILE = 66;
const coord = (n: number) => 96 + n * TILE;
export function BattleMap({
  battle,
  selected,
  legal,
  orders,
  events,
  busy,
  armedAbility,
  onCell,
  onFighter,
  onPoint,
  onCover,
  onInspect,
}: {
  battle: Battle;
  selected: Fighter;
  legal: Cell[];
  orders: Order[];
  events: BattleEvent[];
  busy: boolean;
  armedAbility: AbilityId | null;
  onCell: (p: Cell) => void;
  onFighter: (u: Fighter) => void;
  onPoint: (i: number) => void;
  onCover: () => void;
  onInspect: (u: Fighter) => void;
}) {
  const { t, locale } = useI18n("ru");
  const mapRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<ReactZoomPanPinchRef>(null);
  const [minimumScale, setMinimumScale] = useState(1);
  const dragged = useRef(false);
  const pointerStart = useRef({ x: 0, y: 0 });
  const reduced = useReducedMotion();
  const manualCamera = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inspectedByHold = useRef(false);
  const clearHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };
  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (!busy) {
      manualCamera.current = false;
      return;
    }
    if (manualCamera.current || !zoomRef.current || !mapRef.current) return;
    const viewport = mapRef.current.getBoundingClientRect();
    const camera = cameraForEvents(
      battle,
      events,
      viewport.width,
      viewport.height,
      zoomRef.current.state.scale,
    );
    if (camera)
      zoomRef.current.setTransform(
        camera.x,
        camera.y,
        camera.scale,
        reduced ? 0 : 320,
        "easeOut",
      );
  }, [battle, events, busy, reduced]);
  const name = (u: Fighter) =>
    (locale === "ru" ? u.profile?.nameRu : u.profile?.nameEn) ||
    t(`arena.${stats(u).key}` as TranslationKey);
  const fit = useCallback(() => {
    const r = mapRef.current?.getBoundingClientRect();
    if (r) {
      const scale = Math.max(r.width / 720, r.height / 720);
      setMinimumScale(scale);
      void zoomRef.current?.centerView(scale, 0);
    }
  }, []);
  useEffect(() => {
    const observer = new ResizeObserver(fit);
    if (mapRef.current) observer.observe(mapRef.current);
    return () => observer.disconnect();
  }, [fit]);
  return (
    <div className={styles.mapCanvas} ref={mapRef}>
      <TransformWrapper
        ref={zoomRef}
        minScale={minimumScale}
        maxScale={Math.max(2.5, minimumScale * 4)}
        initialScale={1}
        centerOnInit
        limitToBounds
        centerZoomedOut={false}
        disablePadding
        autoAlignment={{ sizeX: 0, sizeY: 0, animationTime: 0 }}
        zoomAnimation={{ disabled: true }}
        onInit={fit}
        doubleClick={{ disabled: true }}
        panning={{ velocityDisabled: true }}
        onPanningStart={() => {
          if (busy) manualCamera.current = true;
        }}
        onPinchStart={() => {
          if (busy) manualCamera.current = true;
        }}
        onWheelStart={() => {
          if (busy) manualCamera.current = true;
        }}
      >
        <TransformComponent
          wrapperStyle={{ width: "100%", height: "100%", touchAction: "none" }}
          contentStyle={{ width: 720, height: 720 }}
        >
          <svg
            width="720"
            height="720"
            viewBox="0 0 720 720"
            role="group"
            aria-label={t("arena.title")}
            className={styles.board}
            onPointerDownCapture={(e) => {
              pointerStart.current = { x: e.clientX, y: e.clientY };
              dragged.current = false;
            }}
            onPointerMoveCapture={(e) => {
              if (
                Math.hypot(
                  e.clientX - pointerStart.current.x,
                  e.clientY - pointerStart.current.y,
                ) > 6
              ) {
                dragged.current = true;
                clearHold();
              }
            }}
            onPointerUpCapture={clearHold}
            onPointerCancelCapture={clearHold}
          >
            <defs>
              <clipPath id="fighter-circle">
                <circle r="25" />
              </clipPath>
              <pattern
                id="arena-grid"
                width={TILE}
                height={TILE}
                patternUnits="userSpaceOnUse"
                x="63"
                y="63"
              >
                <path
                  d={`M ${TILE} 0 H 0 V ${TILE}`}
                  fill="none"
                  stroke="#ffffff"
                  strokeOpacity="0.3"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <image
              href="/hunt-assets/battle/resonance-park.png"
              width="720"
              height="720"
              preserveAspectRatio="xMidYMid slice"
            />
            <rect
              x="63"
              y="63"
              width="594"
              height="594"
              fill="url(#arena-grid)"
            />
            {Array.from({ length: SIZE * SIZE }, (_, i) => {
              const p = { x: i % SIZE, y: Math.floor(i / SIZE) };
              const available =
                !orders.some(
                  (o) => o.unitId === selected.id && o.type === "skill",
                ) && legal.some((c) => sameCell(c, p));
              return (
                <rect
                  key={i}
                  x={coord(p.x) - 32}
                  y={coord(p.y) - 32}
                  width="64"
                  height="64"
                  rx="5"
                  className={available ? styles.legalCell : undefined}
                  fill={available ? "#42cae8" : "transparent"}
                  fillOpacity={available ? 0.3 : 0}
                  stroke={available ? "#9af0ff" : "none"}
                  strokeWidth="1.5"
                  role={available ? "button" : undefined}
                  tabIndex={available ? 0 : undefined}
                  aria-label={
                    available
                      ? `${t("arena.move")} ${p.x + 1}, ${p.y + 1}`
                      : undefined
                  }
                  onClick={() => {
                    if (!dragged.current) onCell(p);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onCell(p);
                    }
                  }}
                />
              );
            })}
            {LOW_COVERS.map((w) => (
              <image
                key={`cover-${w.x}-${w.y}`}
                href="/hunt-assets/battle/park-cover.png"
                x={coord(w.x) - 31}
                y={coord(w.y) - 31}
                width="62"
                height="62"
                role="button"
                tabIndex={0}
                aria-label={`${t("arena.cover")} ${w.x + 1}, ${w.y + 1}`}
                onClick={() => {
                  if (!dragged.current) onCover();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onCover();
                  }
                }}
              >
                <title>{t("arena.cover")}</title>
              </image>
            ))}
            {WALLS.map((w) => (
              <g key={`${w.x}:${w.y}`} pointerEvents="none">
                <rect
                  x={coord(w.x) - 27}
                  y={coord(w.y) - 24}
                  width="54"
                  height="52"
                  rx="7"
                  fill="#293542"
                  stroke="#91b9c9"
                  strokeWidth="2"
                />
                <rect
                  x={coord(w.x) - 22}
                  y={coord(w.y) - 24}
                  width="44"
                  height="38"
                  rx="6"
                  fill="#3d5365"
                />
                <path
                  d={`M${coord(w.x) - 15} ${coord(w.y)} l15 -12 l15 12`}
                  fill="none"
                  stroke="#97d4e4"
                  strokeWidth="3"
                />
              </g>
            ))}
            {POINTS.map((p, i) => {
              const exhausted = battle.points.player[i] >= POINT_CAP;
              const occupants = (["player", "bot"] as const).filter((s) =>
                alive(battle, s).some((u) => distance(u, p) <= 1),
              );
              const color =
                occupants.length === 2
                  ? "#ffdc83"
                  : occupants[0] === "player"
                    ? "#9af0ff"
                    : occupants[0] === "bot"
                      ? "#ff9eac"
                      : "#fff2b4";
              return (
                <g
                  key={i}
                  role="button"
                  tabIndex={0}
                  aria-label={`${t("arena.point")} ${i + 1}`}
                  onClick={() => {
                    if (!dragged.current) {
                      onPoint(i);
                      onCell(p);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onPoint(i);
                  }}
                  className={styles.point}
                >
                  <circle
                    cx={coord(p.x)}
                    cy={coord(p.y)}
                    r={i === 1 ? 31 : 26}
                    fill="#111923"
                    fillOpacity="0.85"
                    stroke={color}
                    strokeWidth="3"
                    strokeDasharray={exhausted ? "4 5" : undefined}
                  />
                  <path
                    d={`M${coord(p.x)} ${coord(p.y) - 16} l10 16 l-10 16 l-10 -16 Z`}
                    fill={color}
                    opacity={exhausted ? 0.3 : 1}
                  />
                  <text
                    x={coord(p.x)}
                    y={coord(p.y) + 5}
                    textAnchor="middle"
                    fill="#0c1420"
                    fontSize="14"
                    fontWeight="800"
                  >
                    {p.income}
                  </text>
                  <text
                    x={coord(p.x)}
                    y={coord(p.y) + 46}
                    textAnchor="middle"
                    fill="white"
                    stroke="#0c1420"
                    strokeWidth="4"
                    paintOrder="stroke"
                    fontSize="14"
                    fontWeight="700"
                  >
                    {POINT_CAP - battle.points.player[i]}/{POINT_CAP}
                  </text>
                </g>
              );
            })}
            {orders.map((o) => {
              const actor = battle.units.find((u) => u.id === o.unitId)!;
              if (o.type === "wait") return null;
              if (o.type === "skill") {
                const ability = abilityFor(actor, o.abilityId)!;
                const center =
                  ability.target === "self"
                    ? actor
                    : battle.units.find((u) => u.id === o.targetId)!;
                if (!center) return null;
                const color =
                  ability.target === "enemy" ? "#ff9eac" : "#9af0ff";
                return (
                  <g key={o.unitId} pointerEvents="none">
                    {Array.from({ length: SIZE * SIZE }, (_, i) => ({
                      x: i % SIZE,
                      y: Math.floor(i / SIZE),
                    }))
                      .filter((p) => distance(p, center) <= ability.radius)
                      .map((p) => (
                        <rect
                          key={`${p.x}:${p.y}`}
                          x={coord(p.x) - 31}
                          y={coord(p.y) - 31}
                          width={62}
                          height={62}
                          rx={5}
                          fill={color}
                          fillOpacity={0.2}
                          stroke={color}
                          strokeDasharray="4 4"
                        />
                      ))}
                  </g>
                );
              }
              const moving = o.type === "move";
              const to = moving
                ? (o as { to: Cell }).to
                : battle.units.find(
                    (u) => "targetId" in o && u.id === o.targetId,
                  )!;
              if (!to) return null;
              const path = moving ? pathTo(battle, actor, to) : [actor, to];
              return (
                <g key={o.unitId} pointerEvents="none">
                  <polyline
                    points={path
                      .map((p) => `${coord(p.x)},${coord(p.y)}`)
                      .join(" ")}
                    fill="none"
                    stroke={!moving ? "#ff738f" : "#9af0ff"}
                    strokeWidth="4"
                    strokeDasharray="6 5"
                  />
                  <circle
                    cx={coord(to.x)}
                    cy={coord(to.y)}
                    r="9"
                    fill={!moving ? "#ff738f" : "#9af0ff"}
                  />
                </g>
              );
            })}
            {orders
              .flatMap((o) => previewOrder(battle, o).displacements ?? [])
              .map((d, i) => {
                const end = d.path[d.path.length - 1];
                if (d.path.length < 2) return null;
                return (
                  <g key={`force-${i}`} pointerEvents="none">
                    <polyline
                      points={d.path
                        .map((p) => `${coord(p.x)},${coord(p.y)}`)
                        .join(" ")}
                      fill="none"
                      stroke="#ffda91"
                      strokeWidth="4"
                      strokeDasharray="4 5"
                    />
                    <circle
                      cx={coord(end.x)}
                      cy={coord(end.y)}
                      r="26"
                      fill="#ffda91"
                      fillOpacity="0.16"
                      stroke="#ffda91"
                      strokeDasharray="4 3"
                    />
                    <text
                      x={coord(end.x)}
                      y={coord(end.y) + 5}
                      textAnchor="middle"
                      fill="#ffda91"
                      stroke="#111620"
                      strokeWidth="3"
                      paintOrder="stroke"
                      fontSize="15"
                    >
                      {d.path.length - 1}
                    </text>
                  </g>
                );
              })}
            {battle.units.map((u) => {
              const targeted =
                !busy &&
                (armedAbility
                  ? canUseSkill(battle, selected, {
                      unitId: selected.id,
                      type: "skill",
                      targetId: u.id,
                      abilityId: armedAbility,
                    })
                  : u.side === "bot" && canAttack(selected, u));
              const planned = orders.filter((o) =>
                o.type === "skill"
                  ? abilityTargets(
                      battle,
                      battle.units.find((a) => a.id === o.unitId)!,
                      o,
                    ).some((t) => t.id === u.id)
                  : o.type === "attack" && o.targetId === u.id,
              );
              const hits = planned
                .flatMap((o) => previewOrder(battle, o).hits ?? [])
                .filter((h) => h.targetId === u.id);
              const predicted = hits.reduce((n, h) => n + h.damage, 0);
              const predictedMax = hits.reduce((n, h) => n + h.maxDamage, 0);
              const restored = events
                .filter((e) => e.type === "heal" && e.unitId === u.id)
                .reduce((n, e) => n + (e.amount ?? 0), 0);
              const hit = events.some(
                (e) => e.type === "attack" && e.targetId === u.id,
              );
              const active = u.id === selected.id && u.hp > 0;
              const criticalHit = events.some(
                (e) => e.type === "attack" && e.targetId === u.id && e.critical,
              );
              const acting = events.some(
                (e) =>
                  e.unitId === u.id &&
                  ["attack", "skill", "move"].includes(e.type),
              );
              const movePath = !reduced
                ? events.find(
                    (e) =>
                      (e.type === "move" && e.unitId === u.id) ||
                      (e.type === "displace" && e.targetId === u.id),
                  )?.path
                : undefined;
              return (
                <motion.g
                  key={u.id}
                  initial={false}
                  animate={{
                    x: movePath?.map((p) => coord(p.x)) ?? coord(u.x),
                    y: movePath?.map((p) => coord(p.y)) ?? coord(u.y),
                    opacity: u.hp > 0 ? 1 : 0.2,
                  }}
                  transition={{ duration: reduced ? 0 : 0.5, ease: "linear" }}
                  role="button"
                  tabIndex={u.hp > 0 ? 0 : -1}
                  aria-label={`${u.side === "player" ? t("arena.you") : t("arena.bot")}: ${name(u)}, ${u.hp}/${stats(u).hp}`}
                  onClick={() => {
                    if (inspectedByHold.current) {
                      inspectedByHold.current = false;
                      return;
                    }
                    if (!dragged.current) onFighter(u);
                  }}
                  onPointerDown={(e) => {
                    clearHold();
                    inspectedByHold.current = false;
                    if (busy || !e.isPrimary) return;
                    holdTimer.current = setTimeout(() => {
                      inspectedByHold.current = true;
                      onInspect(u);
                    }, 450);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    clearHold();
                    inspectedByHold.current = true;
                    onInspect(u);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onFighter(u);
                    }
                  }}
                  className={styles.fighter}
                >
                  {acting && (
                    <circle
                      r="36"
                      fill="none"
                      stroke="#9af0ff"
                      strokeWidth="2"
                      strokeDasharray="3 5"
                    />
                  )}
                  {hit && (
                    <motion.circle
                      key={`impact-${battle.round}-${JSON.stringify(events.filter((e) => e.targetId === u.id))}`}
                      r="32"
                      fill="none"
                      stroke={criticalHit ? "#ffda91" : "#fff"}
                      strokeWidth={criticalHit ? 5 : 2}
                      initial={{ opacity: 0, r: 26 }}
                      animate={{
                        opacity: [0, 1, 0],
                        r: [26, 35, criticalHit ? 56 : 42],
                      }}
                      transition={{
                        delay: reduced ? 0 : 0.25,
                        duration: reduced ? 0 : 0.4,
                      }}
                    />
                  )}
                  <circle
                    r={active ? 31 : 28}
                    fill="#0b111b"
                    stroke={
                      hit
                        ? "#ffffff"
                        : u.side === "player"
                          ? "#9af0ff"
                          : "#ff839c"
                    }
                    strokeWidth={active ? 4 : 3}
                  />
                  {targeted && (
                    <circle
                      r="32"
                      fill="none"
                      stroke="#ff839c"
                      strokeWidth="2"
                      strokeDasharray="4 3"
                    />
                  )}
                  <image
                    href={stats(u).image}
                    x="-25"
                    y="-25"
                    width="50"
                    height="50"
                    clipPath="url(#fighter-circle)"
                    preserveAspectRatio="xMidYMid slice"
                  />
                  {u.shield > 0 && (
                    <circle
                      r="35"
                      stroke="#c0ccff"
                      strokeWidth="3"
                      fill="none"
                    />
                  )}
                  {hits.some((h) => h.covered) && (
                    <ShieldHalf
                      x="-9"
                      y="-53"
                      width="18"
                      height="18"
                      color="#9af0ff"
                    />
                  )}
                  {[...new Set(u.effects.map((e) => e.type))].map((type, i) => {
                    const Icon =
                      type === "burn"
                        ? Flame
                        : type === "poison"
                          ? Skull
                          : Sparkles;
                    return (
                      <g
                        key={type}
                        transform={`translate(${-24 + i * 18}, -48)`}
                        pointerEvents="none"
                      >
                        <circle cx={7} cy={7} r={9} fill="#10171f" />
                        <Icon
                          width={14}
                          height={14}
                          color={
                            type === "burn"
                              ? "#ffc178"
                              : type === "poison"
                                ? "#c7a4ff"
                                : "#9af0ff"
                          }
                        />
                      </g>
                    );
                  })}
                  <rect
                    x="-25"
                    y="29"
                    width="50"
                    height="7"
                    rx="3"
                    fill="#111923"
                  />
                  <rect
                    x="-25"
                    y="29"
                    width={(50 * u.hp) / stats(u).hp}
                    height="7"
                    rx="3"
                    fill={u.side === "player" ? "#9af0ff" : "#ff839c"}
                  />
                  <text
                    y="49"
                    textAnchor="middle"
                    fill="white"
                    stroke="#0c1420"
                    strokeWidth="4"
                    paintOrder="stroke"
                    fontWeight="700"
                    fontSize="14"
                  >
                    {u.hp}
                  </text>
                  {orders.some((o) => o.unitId === u.id) && (
                    <circle cx="23" cy="-23" r="7" fill="#9af0ff" />
                  )}
                  {hit && (
                    <motion.text
                      key={`damage-${battle.round}-${JSON.stringify(events.filter((e) => e.targetId === u.id))}`}
                      initial={{ opacity: reduced ? 1 : 0, y: 5 }}
                      animate={{ opacity: 1, y: -5 }}
                      transition={{
                        delay: reduced ? 0 : 0.25,
                        duration: reduced ? 0 : 0.3,
                      }}
                      y="-40"
                      textAnchor="middle"
                      fill={criticalHit ? "#ffda91" : "#fff"}
                      stroke="#922d49"
                      strokeWidth="4"
                      paintOrder="stroke"
                      fontSize="24"
                      fontWeight="800"
                    >
                      −
                      {events
                        .filter(
                          (e) => e.type === "attack" && e.targetId === u.id,
                        )
                        .reduce((n, e) => n + (e.amount ?? 0), 0)}
                      {events.some((e) => e.targetId === u.id && e.critical)
                        ? "!"
                        : ""}
                    </motion.text>
                  )}
                  {!hit && (predicted > 0 || restored > 0) && (
                    <text
                      y="-40"
                      textAnchor="middle"
                      fill={restored > 0 ? "#d4c8ff" : "#ffc0ce"}
                      stroke="#111620"
                      strokeWidth="4"
                      paintOrder="stroke"
                      fontSize="20"
                      fontWeight="800"
                    >
                      {restored > 0
                        ? `+${restored}`
                        : `${predicted}–${predictedMax}`}
                    </text>
                  )}
                </motion.g>
              );
            })}
            {events
              .filter((e) => e.type === "attack" && !e.effect)
              .map((e, i) => {
                const from = battle.units.find((u) => u.id === e.unitId)!;
                const to = battle.units.find((u) => u.id === e.targetId)!;
                return (
                  <motion.line
                    key={`${battle.round}:${i}:${e.unitId}`}
                    x1={coord(from.x)}
                    y1={coord(from.y)}
                    x2={coord(to.x)}
                    y2={coord(to.y)}
                    stroke={
                      e.critical
                        ? "#ffda91"
                        : e.effect === "poison"
                          ? "#c7a4ff"
                          : from.side === "player"
                            ? "#b9f4ff"
                            : "#ffbecb"
                    }
                    strokeWidth={e.critical ? 8 : 4}
                    strokeLinecap="round"
                    pointerEvents="none"
                    initial={{ opacity: 1, pathLength: 0 }}
                    animate={{ opacity: 0, pathLength: 1 }}
                    transition={{ duration: reduced ? 0 : 0.35 }}
                  />
                );
              })}
          </svg>
        </TransformComponent>
      </TransformWrapper>
      <div className={styles.zoomTools}>
        <button
          className={styles.icon}
          aria-label={t("arena.zoomIn")}
          title={t("arena.zoomIn")}
          onClick={() => void zoomRef.current?.zoomIn()}
        >
          <Plus size={19} />
        </button>
        <button
          className={styles.icon}
          aria-label={t("arena.zoomOut")}
          title={t("arena.zoomOut")}
          onClick={() => void zoomRef.current?.zoomOut()}
        >
          <Minus size={19} />
        </button>
        <button
          className={styles.icon}
          aria-label={t("arena.center")}
          title={t("arena.center")}
          onClick={fit}
        >
          <Maximize size={17} />
        </button>
      </div>
    </div>
  );
}
