import PF from "pathfinding";

export type Side = "player" | "bot";
export type Cell = { x: number; y: number };
export type Fighter = Cell & {
  profile?: FighterProfile;
  abilities?: Ability[];
  shieldExpires?: number;
  classTriggers?: Partial<
    Record<
      | "batteryRefund"
      | "controllerBreak"
      | "duelistExtraAction"
      | "finisherMomentum"
      | "guardianRedirect"
      | "guardianShield"
      | "provokerFocus"
      | "provokerExtraAction"
      | "scoutWindow"
      | "sniperMark",
      boolean
    >
  >;
  id: string;
  side: Side;
  kind: number;
  hp: number;
  shield: number;
  cooldowns: Record<string, number>;
  effects: ActiveEffect[];
  activeTurn: number;
};
export type Order =
  | { unitId: string; type: "move"; to: Cell }
  | { unitId: string; type: "attack"; targetId: string }
  | {
      unitId: string;
      type: "skill";
      abilityId?: string;
      targetId?: string;
      to?: Cell;
    }
  | { unitId: string; type: "wait" };
export type Bonus = { type: "shield" | "haste"; unitId: string };
export type Battle = {
  statistics: Record<
    string,
    { damage: number; healing: number; absorbed: number; control: number }
  >;
  round: number;
  units: Fighter[];
  points: Record<Side, number[]>;
  captureProgress?: Record<Side, number[]>;
  pointFlags?: Record<Side, boolean[]>;
  actionLimitBonus?: Record<Side, number>;
  energy: Record<Side, number>;
  score: Record<Side, number>;
  winner: Side | "draw" | null;
};
export type BattleEvent = {
  type:
    | "move"
    | "attack"
    | "miss"
    | "blocked"
    | "capture"
    | "bonus"
    | "skill"
    | "heal"
    | "displace"
    | "exhausted"
    | "contested"
    | "cancelled";
  effect?: "burn" | "poison" | "shield" | "buff";
  abilityId?: string;
  unitId?: string;
  targetId?: string;
  amount?: number;
  side?: Side;
  point?: number;
  path?: Cell[];
  reason?:
    | "outOfRange"
    | "lineBlocked"
    | "targetDown"
    | "actorDown"
    | "collision"
    | "pathOccupied";
  absorbed?: number;
  critical?: boolean;
  covered?: boolean;
  displacement?: "push" | "pull";
  lifestealRatio?: number;
};
export type Frame = { battle: Battle; events: BattleEvent[] };
export const SIZE = 9;
export const ROUND_LIMIT = 10;
export const POINT_CAP = 4;
export const BONUS_COST = 3;
export type ScaledStat = "hp" | "attack" | "speed" | "luck";
export type Scaling = { stat: ScaledStat; factor: number; flat?: number };
export type AbilityEffect = { enabled?: boolean } & (
  | { type: "push" | "pull"; power: Scaling; maxDistance?: number }
  | { type: "damage"; power: Scaling; canCrit?: boolean; ignoreCover?: boolean }
  | {
      type: "lifesteal";
      power: Scaling;
      ratio: number;
      canCrit?: boolean;
      ignoreCover?: boolean;
    }
  | { type: "heal"; power: Scaling }
  | { type: "shield"; power: Scaling; duration?: number }
  | {
      type: "burn" | "poison";
      power: Scaling;
      duration: number;
      delay?: number;
      healingReduction?: number;
      stacking?: "refresh" | "replace";
    }
  | {
      type: "buff";
      stat: "attack" | "speed" | "luck" | "movement";
      power: Scaling;
      duration: number;
      delay?: number;
      stacking?: "refresh" | "replace";
    }
);
export type Ability = {
  nameRu?: string;
  nameEn?: string;
  descriptionRu?: string;
  descriptionEn?: string;
  icon?: string;
  enabled?: boolean;
  revision?: number;
  key: string;
  cost: number;
  cooldown: number;
  target: "self" | "enemy" | "ally";
  radius: number;
  rangeBonus: number;
  delayed?: boolean;
  range?: number;
  lineOfSight?: boolean;
  maxTargets?: number;
  effects: readonly AbilityEffect[];
};
export type FighterProfile = {
  key: string;
  speciesId?: string;
  nameRu?: string;
  nameEn?: string;
  image: string;
  hp: number;
  attack: number;
  speed: number;
  movement: number;
  range: number;
  luck: number;
  element: Element;
  fusionRank?: number;
  battleClass?: string | null;
  healingBonus?: number;
  captureBonus?: number;
  rangedDamageBonus?: number;
};
export type ActiveEffect = {
  type: "burn" | "poison" | "buff";
  sourceId: string;
  abilityId: string;
  amount: number;
  stat?: "attack" | "speed" | "luck" | "movement";
  starts: number;
  expires: number;
  healingReduction?: number;
  stacking?: "refresh" | "replace";
};
export const ABILITIES = {
  lavaShield: {
    key: "lavaShield",
    cost: 2,
    cooldown: 2,
    target: "self",
    radius: 0,
    rangeBonus: 0,
    effects: [{ type: "shield", power: { stat: "hp", factor: 0.4 } }],
  },
  ember: {
    key: "ember",
    cost: 3,
    cooldown: 2,
    target: "enemy",
    radius: 0,
    rangeBonus: 1,
    effects: [
      { type: "damage", power: { stat: "attack", factor: 0.65 } },
      { type: "burn", power: { stat: "attack", factor: 0.3 }, duration: 2 },
    ],
  },
  eruption: {
    key: "eruption",
    cost: 4,
    cooldown: 3,
    target: "enemy",
    radius: 1,
    rangeBonus: 1,
    effects: [
      { type: "damage", power: { stat: "attack", factor: 0.8 } },
      { type: "push", power: { stat: "speed", factor: 0.5 } },
    ],
  },
  tideLance: {
    key: "tideLance",
    cost: 3,
    cooldown: 2,
    target: "enemy",
    radius: 0,
    rangeBonus: 1,
    delayed: true,
    effects: [
      { type: "damage", power: { stat: "attack", factor: 1.4 } },
      { type: "push", power: { stat: "speed", factor: 0.5 } },
    ],
  },
  tidalWave: {
    key: "tidalWave",
    cost: 4,
    cooldown: 3,
    target: "enemy",
    radius: 1,
    rangeBonus: 0,
    effects: [
      { type: "damage", power: { stat: "attack", factor: 0.8 } },
      { type: "pull", power: { stat: "speed", factor: 0.5 } },
    ],
  },
  waterVeil: {
    key: "waterVeil",
    cost: 3,
    cooldown: 2,
    target: "ally",
    radius: 1,
    rangeBonus: 0,
    effects: [{ type: "shield", power: { stat: "hp", factor: 0.3 } }],
  },
  plantain: {
    key: "plantain",
    cost: 3,
    cooldown: 2,
    target: "ally",
    radius: 1,
    rangeBonus: 1,
    effects: [{ type: "heal", power: { stat: "hp", factor: 0.22 } }],
  },
  venom: {
    key: "venom",
    cost: 3,
    cooldown: 2,
    target: "enemy",
    radius: 0,
    rangeBonus: 2,
    effects: [
      { type: "damage", power: { stat: "attack", factor: 0.35 } },
      { type: "poison", power: { stat: "attack", factor: 0.22 }, duration: 3 },
    ],
  },
  bloom: {
    key: "bloom",
    cost: 3,
    cooldown: 3,
    target: "ally",
    radius: 1,
    rangeBonus: 1,
    effects: [
      {
        type: "buff",
        stat: "attack",
        power: { stat: "attack", factor: 0.25 },
        duration: 2,
      },
      {
        type: "buff",
        stat: "speed",
        power: { stat: "speed", factor: 0.5 },
        duration: 2,
      },
      {
        type: "buff",
        stat: "luck",
        power: { stat: "luck", factor: 0.5 },
        duration: 2,
      },
    ],
  },
} as const satisfies Record<string, Ability>;
export type AbilityId = string;
export const LOADOUTS: readonly (readonly AbilityId[])[] = [
  ["lavaShield", "ember", "eruption"],
  ["tideLance", "tidalWave", "waterVeil"],
  ["plantain", "venom", "bloom"],
];
export type Element =
  "FLAME" | "NATURE" | "WATER" | "MUSIC" | "WIND" | "LIGHT" | "SHADOW";
export const BASE_ELEMENTS: readonly Element[] = [
  "FLAME",
  "NATURE",
  "WATER",
  "MUSIC",
  "WIND",
];
export const ELEMENT_COUNTERS: Record<Element, readonly Element[]> = {
  FLAME: ["NATURE", "MUSIC"],
  WATER: ["FLAME", "MUSIC"],
  NATURE: ["WATER", "WIND"],
  WIND: ["FLAME", "WATER"],
  MUSIC: ["NATURE", "WIND"],
  LIGHT: ["SHADOW"],
  SHADOW: ["LIGHT"],
};
export function elementMultiplier(source: Element, target: Element) {
  return ELEMENT_COUNTERS[source].includes(target) ? 1.2 : 1;
}
export const POINTS = [
  { x: 1.15, y: 4, income: 1 },
  { x: 4, y: 4, income: 2 },
  { x: 6.85, y: 4, income: 1 },
];
export const WALLS: Cell[] = [
  { x: 3, y: 2 },
  { x: 5, y: 2 },
  { x: 3, y: 6 },
  { x: 5, y: 6 },
];
export const ROSTER = [
  {
    key: "coffee",
    image: "/hunt-assets/cards/coffee-ember.webp",
    hp: 30,
    attack: 9,
    speed: 3,
    movement: 3,
    range: 1,
    element: "FLAME",
  },
  {
    key: "water",
    image: "/hunt-assets/cards/water-route.webp",
    hp: 26,
    attack: 7,
    speed: 2,
    movement: 2,
    range: 3,
    element: "WATER",
  },
  {
    key: "nature",
    image: "/hunt-assets/cards/nature-sprout.webp",
    hp: 38,
    attack: 8,
    speed: 1,
    movement: 2,
    range: 1,
    element: "NATURE",
  },
] as const;
export const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
export const distance = (a: Cell, b: Cell) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const nearPoint = (unit: Cell, point: Cell) => distance(unit, point) <= 1;
export const alive = (b: Battle, side?: Side) =>
  b.units.filter((u) => u.hp > 0 && (!side || u.side === side));
export const stats = (u: Fighter) => {
  const result: FighterProfile = { ...ROSTER[u.kind], luck: 10, ...u.profile };
  for (const effect of u.effects ?? []) {
    if (effect.type === "buff" && effect.stat && effect.starts <= u.activeTurn)
      result[effect.stat] += effect.amount;
  }
  result.luck = Math.min(100, result.luck);
  result.attack = Math.max(1, result.attack);
  result.speed = Math.max(1, result.speed);
  result.movement = Math.max(1, result.movement);
  return result;
};
function hasClassRank(u: Fighter, battleClass: string, rank: number) {
  const profile = stats(u);
  return profile.battleClass === battleClass && (profile.fusionRank ?? 1) >= rank;
}
export function actionLimit(b: Battle, side: Side) {
  return Math.max(1, 3 + (b.actionLimitBonus?.[side] ?? 0));
}
export function effectiveAbilityCost(u: Fighter, ability: Ability) {
  if (hasClassRank(u, "BATTERY", 4) && ability.cost > 0)
    return Math.max(1, Math.ceil(ability.cost * 0.75));
  return ability.cost;
}
export function effectiveAbilityRadius(u: Fighter, ability: Ability) {
  if (hasClassRank(u, "SNIPER", 4) && ability.radius > 0)
    return ability.radius + Math.max(1, Math.ceil(ability.radius * 0.2));
  return ability.radius;
}
function applyTeamBuff(
  b: Battle,
  side: Side,
  sourceId: string,
  stat: "attack" | "speed" | "luck" | "movement",
  factor: number,
  abilityId: string,
  events: BattleEvent[],
  duration = 1,
) {
  for (const ally of alive(b, side)) {
    const amount = Math.max(1, Math.round(stats(ally)[stat] * factor));
    ally.effects.push({
      type: "buff",
      sourceId,
      abilityId,
      stat,
      amount,
      starts: b.round + 1,
      expires: b.round + duration,
      stacking: "replace",
    });
    events.push({ type: "bonus", unitId: ally.id, effect: "buff", amount, abilityId });
  }
}
function classDamageMultiplier(
  b: Battle | undefined,
  u: Fighter,
  target: Fighter,
  source: "attack" | "skill" = "attack",
) {
  let multiplier = 1;
  if (b && hasClassRank(u, "DUELIST", 3)) {
    const otherEnemiesNearby = alive(b, u.side === "player" ? "bot" : "player")
      .some((enemy) => enemy.id !== target.id && distance(enemy, target) <= 1);
    if (!otherEnemiesNearby) multiplier *= 1.12;
  }
  if (hasClassRank(u, "FINISHER", 3) && target.hp <= stats(target).hp * 0.4)
    multiplier *= source === "skill" && (stats(u).fusionRank ?? 1) >= 4 ? 1.22 : 1.18;
  if (hasClassRank(u, "SNIPER", 3) && distance(u, target) > 1)
    multiplier *= 1.14;
  if (
    target.effects.some(
      (effect) =>
        effect.abilityId === "resonance-sniper-mark" &&
        effect.sourceId === u.id &&
        effect.starts <= target.activeTurn,
    )
  )
    multiplier *= 1.2;
  return multiplier;
}
export const scaledPower = (u: Fighter, power: Scaling) =>
  Math.max(
    1,
    Math.round(stats(u)[power.stat] * power.factor + (power.flat ?? 0)),
  );
export const loadoutFor = (u: Fighter): readonly string[] =>
  u.abilities?.map((a) => a.key) ?? LOADOUTS[u.kind];
export const abilityFor = (u: Fighter, id?: string): Ability | undefined => {
  const key = id ?? loadoutFor(u)[0];
  if (u.abilities) return u.abilities.find((a) => a.key === key);
  return LOADOUTS[u.kind].includes(key)
    ? ABILITIES[key as keyof typeof ABILITIES]
    : undefined;
};
export const criticalChance = (u: Fighter, target: Fighter) =>
  Math.min(25, Math.max(1, 5 + 0.75 * (stats(u).luck - stats(target).luck)));
export const criticalMultiplier = (u: Fighter) => 1 + 0.03 * stats(u).luck;
export type CriticalRoll = (
  attacker: Fighter,
  target: Fighter,
  turn: number,
) => number;
export const LOW_COVERS: Cell[] = [
  { x: 2, y: 3 },
  { x: 6, y: 3 },
  { x: 2, y: 5 },
  { x: 6, y: 5 },
];
export function coverProtection(u: Cell, target: Cell) {
  if (distance(u, target) <= 1) return 0;
  const line = PF.Util.expandPath([
    [u.x, u.y],
    [target.x, target.y],
  ]);
  return LOW_COVERS.some(
    (c) =>
      distance(c, target) === 1 &&
      line.some(([x, y]) => c.x === x && c.y === y),
  )
    ? 0.3
    : 0;
}
export const directDamage = (
  u: Fighter,
  target: Fighter,
  amount = stats(u).attack,
  critical = false,
) =>
  Math.round(
    amount *
      elementMultiplier(stats(u).element, stats(target).element) *
      (distance(u, target) > 1 ? 1 + (stats(u).rangedDamageBonus ?? 0) : 1) *
      (critical ? criticalMultiplier(u) : 1),
  );
export const hitDamage = (
  u: Fighter,
  target: Fighter,
  amount = stats(u).attack,
  critical = false,
  ignoreCover = false,
  b?: Battle,
  source: "attack" | "skill" = "attack",
) =>
  Math.round(
    directDamage(u, target, amount, critical) *
      classDamageMultiplier(b, u, target, source) *
      (1 - (ignoreCover ? 0 : coverProtection(u, target))),
  );
export function hitPreview(
  u: Fighter,
  target: Fighter,
  amount = stats(u).attack,
  options: {
    canCrit?: boolean;
    ignoreCover?: boolean;
    battle?: Battle;
    source?: "attack" | "skill";
  } = {},
) {
  const damage = Math.max(
    0,
    hitDamage(
      u,
      target,
      amount,
      false,
      options.ignoreCover,
      options.battle,
      options.source,
    ) - target.shield,
  );
  const maxDamage = Math.max(
    0,
    hitDamage(
      u,
      target,
      amount,
      options.canCrit !== false,
      options.ignoreCover,
      options.battle,
      options.source,
    ) - target.shield,
  );
  const chance = options.canCrit === false ? 0 : criticalChance(u, target);
  return {
    damage,
    maxDamage,
    chance,
    expectedDamage: damage + ((maxDamage - damage) * chance) / 100,
    covered: !options.ignoreCover && coverProtection(u, target) > 0,
    targetId: target.id,
  };
}
export function displacementPath(
  b: Battle,
  from: Cell,
  target: Fighter,
  type: "push" | "pull",
  steps: number,
  maxDistance = 2,
) {
  const dx = target.x - from.x,
    dy = target.y - from.y;
  const direction =
    Math.abs(dx) >= Math.abs(dy)
      ? { x: Math.sign(dx), y: 0 }
      : { x: 0, y: Math.sign(dy) };
  const sign = type === "push" ? 1 : -1;
  const path: Cell[] = [{ x: target.x, y: target.y }];
  for (let i = 0; i < Math.min(maxDistance, steps); i++) {
    const last = path[path.length - 1];
    const next = {
      x: last.x + sign * direction.x,
      y: last.y + sign * direction.y,
    };
    if (
      sameCell(next, last) ||
      next.x < 0 ||
      next.y < 0 ||
      next.x >= SIZE ||
      next.y >= SIZE ||
      [
        ...WALLS,
        ...LOW_COVERS,
        ...alive(b).filter((u) => u.id !== target.id),
      ].some((p) => sameCell(p, next))
    )
      break;
    path.push(next);
  }
  return path;
}
export function orderCost(b: Battle, orders: Order[], bonus?: Bonus | null) {
  return (
    (bonus ? BONUS_COST : 0) +
    orders.reduce((total, o) => {
      const unit = b.units.find((u) => u.id === o.unitId);
      return (
        total +
        (o.type === "skill" && unit
          ? abilityFor(unit, o.abilityId)
            ? effectiveAbilityCost(unit, abilityFor(unit, o.abilityId)!)
            : Infinity
          : 0)
      );
    }, 0)
  );
}
export function createBattle(): Battle {
  return {
    statistics: Object.fromEntries(
      ["player", "bot"].flatMap((side) =>
        ROSTER.map((_, kind) => [
          `${side}-${kind}`,
          { damage: 0, healing: 0, absorbed: 0, control: 0 },
        ]),
      ),
    ),
    round: 1,
    units: (["player", "bot"] as Side[]).flatMap((side) =>
      ROSTER.map((r, kind) => ({
        id: `${side}-${kind}`,
        side,
        kind,
        hp: r.hp,
        shield: 0,
        cooldowns: {},
        effects: [],
        activeTurn: 1,
        x: side === "player" ? 2 + kind * 2 : 6 - kind * 2,
        y: side === "player" ? 8 : 0,
      })),
    ),
    points: { player: [0, 0, 0], bot: [0, 0, 0] },
    pointFlags: { player: [false, false, false], bot: [false, false, false] },
    actionLimitBonus: { player: 0, bot: 0 },
    energy: { player: 0, bot: 0 },
    score: { player: 0, bot: 0 },
    winner: null,
  };
}
export function applyBattleStartResonance(battle: Battle) {
  for (const side of ["player", "bot"] as Side[])
    if (alive(battle, side).some((unit) => hasClassRank(unit, "BATTERY", 5)))
      battle.energy[side] += 1;
  return battle;
}
export function pathTo(b: Battle, unit: Fighter, to: Cell): Cell[] {
  if (
    !Number.isInteger(to.x) ||
    !Number.isInteger(to.y) ||
    to.x < 0 ||
    to.y < 0 ||
    to.x >= SIZE ||
    to.y >= SIZE
  )
    return [];
  const grid = new PF.Grid(SIZE, SIZE);
  [
    ...WALLS,
    ...LOW_COVERS,
    ...alive(b).filter((u) => u.id !== unit.id),
  ].forEach((p) => grid.setWalkableAt(p.x, p.y, false));
  if (!grid.isWalkableAt(to.x, to.y)) return [];
  return new PF.AStarFinder({ allowDiagonal: false })
    .findPath(unit.x, unit.y, to.x, to.y, grid)
    .map(([x, y]) => ({ x, y }));
}
export function canAttack(unit: Fighter, target: Fighter) {
  return attackFailure(unit, target) === undefined;
}
export function attackFailure(
  unit: Fighter,
  target: Fighter,
  range: number = stats(unit).range,
  lineOfSight = true,
): BattleEvent["reason"] | undefined {
  if (unit.hp <= 0) return "actorDown";
  if (target.hp <= 0 || unit.side === target.side) return "targetDown";
  if (distance(unit, target) > range) return "outOfRange";
  if (
    lineOfSight &&
    PF.Util.expandPath([
      [unit.x, unit.y],
      [target.x, target.y],
    ]).some(([x, y]) => WALLS.some((w) => w.x === x && w.y === y))
  )
    return "lineBlocked";
  return undefined;
}
export function skillReady(b: Battle, u: Fighter, id?: string) {
  const ability = abilityFor(u, id);
  return (
    !!ability &&
    ability.enabled !== false &&
    u.hp > 0 &&
    b.round >= (u.cooldowns[ability.key] ?? 1) &&
    b.energy[u.side] >= effectiveAbilityCost(u, ability)
  );
}
export function skillTargetFailure(
  b: Battle,
  u: Fighter,
  o: Extract<Order, { type: "skill" }>,
) {
  const ability = abilityFor(u, o.abilityId);
  if (!ability || o.to) return "outOfRange" as const;
  if (ability.target === "self")
    return o.targetId && o.targetId !== u.id
      ? ("targetDown" as const)
      : undefined;
  const target = b.units.find((t) => t.id === o.targetId);
  if (
    !target ||
    (ability.target === "ally"
      ? target.side !== u.side
      : target.side === u.side)
  )
    return "targetDown" as const;
  return attackFailure(
    u,
    { ...target, side: u.side === "player" ? "bot" : "player" },
    ability.range ?? stats(u).range + ability.rangeBonus,
    ability.lineOfSight !== false,
  );
}
export function abilityTargets(
  b: Battle,
  u: Fighter,
  o: Extract<Order, { type: "skill" }>,
) {
  const ability = abilityFor(u, o.abilityId);
  if (!ability || skillTargetFailure(b, u, o)) return [];
  const center =
    ability.target === "self" ? u : b.units.find((t) => t.id === o.targetId)!;
  return alive(b)
    .filter(
      (t) =>
        (ability.target === "enemy" ? t.side !== u.side : t.side === u.side) &&
        distance(t, center) <= effectiveAbilityRadius(u, ability),
    )
    .sort(
      (a, c) =>
        distance(a, center) - distance(c, center) ||
        (u.side === "player" ? 1 : -1) * (a.y - c.y || a.x - c.x),
    )
    .slice(0, ability.maxTargets ?? 6);
}
export function canUseSkill(
  b: Battle,
  u: Fighter,
  order: Extract<Order, { type: "skill" }>,
) {
  return skillReady(b, u, order.abilityId) && !skillTargetFailure(b, u, order);
}
export function previewOrder(b: Battle, order: Order, bonus?: Bonus | null) {
  const u = b.units.find((u) => u.id === order.unitId)!;
  if (order.type === "move") {
    const to = order.to!;
    return {
      path: pathTo(b, u, to),
      shield: 0,
      steps: pathTo(b, u, to).length - 1,
    };
  }
  if (order.type === "attack") {
    const target = b.units.find((t) => t.id === order.targetId)!;
    return {
      ...hitPreview(u, target, stats(u).attack, { battle: b, source: "attack" }),
      hits: [hitPreview(u, target, stats(u).attack, { battle: b, source: "attack" })],
      delayed: false,
      targetId: target.id,
    };
  }
  if (order.type === "skill") {
    const ability = abilityFor(u, order.abilityId)!;
    const targets = abilityTargets(b, u, order);
    let damage = 0,
      shield = 0,
      utility = 0;
    const healing = new Map<string, number>();
    const addHealing = (target: Fighter, amount: number) =>
      healing.set(target.id, (healing.get(target.id) ?? 0) + amount);
    const hits: ReturnType<typeof hitPreview>[] = [];
    const drains: { hit: ReturnType<typeof hitPreview>; ratio: number }[] = [];
    const displacements: {
      targetId: string;
      path: Cell[];
      type: "push" | "pull";
    }[] = [];
    for (const effect of ability.effects) {
      if (effect.enabled === false) continue;
      const power = scaledPower(u, effect.power);
      for (const target of targets) {
        if (effect.type === "damage" || effect.type === "lifesteal") {
          const hit = hitPreview(u, { ...target, shield: 0 }, power, {
            ...effect,
            battle: b,
            source: "skill",
          });
          hits.push(hit);
          if (effect.type === "lifesteal")
            drains.push({ hit, ratio: effect.ratio });
        }
        if (effect.type === "push" || effect.type === "pull") {
          const path = displacementPath(
            b,
            u,
            target,
            effect.type,
            power,
            effect.maxDistance ?? 2,
          );
          displacements.push({ targetId: target.id, path, type: effect.type });
          utility += (path.length - 1) * 2;
        }
        if (effect.type === "heal")
          addHealing(target, healingPower(target, power, u));
        if (effect.type === "shield")
          shield += Math.max(0, power - target.shield);
        if (effect.type === "burn" || effect.type === "poison")
          utility += power * effect.duration * 0.6;
        if (effect.type === "buff")
          utility += power * (effect.stat === "luck" ? 0.15 : 0.8);
      }
    }
    // Composite direct hits share one shield pool, just like server resolution.
    for (const target of targets) {
      const group = hits.filter((hit) => hit.targetId === target.id);
      const normal = group.reduce((sum, hit) => sum + hit.damage, 0);
      const critical = group.reduce((sum, hit) => sum + hit.maxDamage, 0);
      const remaining = Math.max(0, normal - target.shield);
      for (const hit of group) {
        hit.damage = normal ? (remaining * hit.damage) / normal : 0;
        hit.maxDamage = critical
          ? (Math.max(0, critical - target.shield) * hit.maxDamage) / critical
          : 0;
        hit.expectedDamage =
          hit.damage + ((hit.maxDamage - hit.damage) * hit.chance) / 100;
      }
      damage += remaining;
      for (const drain of drains.filter((d) => d.hit.targetId === target.id)) {
        const actual = remaining
          ? (Math.min(target.hp, remaining) * drain.hit.damage) / remaining
          : 0;
        addHealing(u, healingPower(u, Math.round(actual * drain.ratio), u));
      }
    }
    return {
      damage: ability.effects.some(
        (e) =>
          e.enabled !== false &&
          (e.type === "damage" || e.type === "lifesteal"),
      )
        ? damage
        : undefined,
      heal: ability.effects.some(
        (e) =>
          e.enabled !== false && (e.type === "heal" || e.type === "lifesteal"),
      )
        ? [...healing].reduce((total, [id, amount]) => {
            const target = b.units.find((unit) => unit.id === id)!;
            return total + Math.min(amount, stats(target).hp - target.hp);
          }, 0)
        : undefined,
      shield: ability.effects.some(
        (e) => e.enabled !== false && e.type === "shield",
      )
        ? shield
        : undefined,
      utility,
      hits,
      displacements,
      maxDamage: hits.reduce((n, h) => n + h.maxDamage, 0),
      expectedDamage: hits.reduce((n, h) => n + h.expectedDamage, 0),
      delayed: ability.delayed,
      targets: targets.map((t) => t.id),
    };
  }
  return { shield: bonus?.type === "shield" && bonus.unitId === u.id ? 7 : 0 };
}
const healingPower = (u: Fighter, amount: number, source?: Fighter) =>
  Math.round(
    amount *
      (1 + (source ? (stats(source).healingBonus ?? 0) : 0)) *
      (1 -
        Math.max(
          0,
          ...u.effects
            .filter((e) => e.type === "poison" && e.starts <= u.activeTurn)
            .map((e) => e.healingReduction ?? 0.3),
        )),
  );
export function moves(b: Battle, unit: Fighter, bonus?: Bonus | null) {
  const limit =
    stats(unit).movement +
    (b.round === 1 && hasClassRank(unit, "SCOUT", 3)
      ? Math.max(1, Math.ceil(stats(unit).movement * 0.25))
      : 0) +
    (bonus?.type === "haste" && bonus.unitId === unit.id ? 1 : 0);
  const result: Cell[] = [];
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      if (distance(unit, { x, y }) > limit) continue;
      const path = pathTo(b, unit, { x, y });
      if (path.length > 1 && path.length <= limit + 1) result.push({ x, y });
    }
  return result;
}
export function validateOrders(
  b: Battle,
  side: Side,
  orders: Order[],
  bonus?: Bonus | null,
) {
  if (!Array.isArray(orders)) return false;
  if (b.winner || orders.length > actionLimit(b, side)) return false;
  if (
    actionLimit(b, side) <= alive(b, side).length &&
    new Set(orders.map((o) => o.unitId)).size !== orders.length
  )
    return false;
  if (orders.some((o) => !o) || orderCost(b, orders, bonus) > b.energy[side])
    return false;
  if (
    bonus &&
    (!["shield", "haste"].includes(bonus.type) ||
      b.energy[side] < BONUS_COST ||
      !alive(b, side).some((u) => u.id === bonus.unitId))
  )
    return false;
  return orders.every((o) => {
    if (!o) return false;
    const u = alive(b, side).find((u) => u.id === o.unitId);
    if (!u) return false;
    if (o.type === "wait") return true;
    if (o.type === "skill") return canUseSkill(b, u, o);
    if (o.type === "move")
      return !!o.to && moves(b, u, bonus).some((p) => sameCell(p, o.to));
    if (o.type === "attack") {
      const target = b.units.find((t) => t.id === o.targetId);
      return !!target && canAttack(u, target);
    }
    return false;
  });
}

// The AI only sees the public start-of-round board, never the player's orders.
export type Strategy = "balanced" | "center" | "split" | "focus" | "defense";
export type AIPolicy = { strategy?: Strategy; seed?: number; skills?: boolean };
export function planAI(
  b: Battle,
  side: Side = "bot",
  policy: AIPolicy = {},
): { orders: Order[]; bonus: Bonus | null } {
  const strategy = policy.strategy ?? "balanced";
  let randomState = policy.seed ?? 1;
  const variation = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return policy.seed === undefined ? 0 : (randomState / 4294967296) * 0.35;
  };
  const enemies = alive(b, side === "bot" ? "player" : "bot");
  const team = alive(b, side);
  const bonus: Bonus | null = null;
  const reserved: Cell[] = [];
  const orders: Order[] = [];
  for (const u of team.sort((a, c) => stats(c).speed - stats(a).speed)) {
    const positionValue = (p: Cell) => {
      const pointValue = Math.max(
        0,
        ...POINTS.map((point, i) => {
          if (b.points[side][i] >= POINT_CAP) return 0;
          const crowd = reserved.some((r) => distance(r, point) <= 1)
            ? 0.32
            : 1;
          const contested = enemies.some((e) => distance(e, point) <= 1);
          const preference =
            strategy === "center"
              ? i === 1
                ? 1.8
                : 0.65
              : strategy === "split"
                ? i === 1
                  ? 0.7
                  : 1.4
                : strategy === "focus"
                  ? 0.3
                  : 1;
          return (
            ((10 + point.income * 2) /
              (1 + Math.max(0, distance(p, point) - 1))) *
            crowd *
            (contested ? 0.3 : 1) *
            preference
          );
        }),
      );
      const threat = enemies
        .filter((e) => canAttack(e, { ...u, ...p }))
        .reduce(
          (n, e) =>
            n +
            hitPreview(e, { ...u, ...p }, stats(e).attack, {
              battle: b,
              source: "attack",
            }).expectedDamage,
          0,
        );
      const targets =
        strategy === "focus"
          ? enemies
              .slice()
              .sort((a, c) => a.hp - c.hp)
              .slice(0, 1)
          : enemies;
      const approach = targets.length
        ? (strategy === "focus" ? 18 : 3) /
          (1 + Math.min(...targets.map((e) => distance(p, e))))
        : 0;
      return (
        pointValue +
        approach -
        threat * (strategy === "defense" ? 0.7 : u.hp <= 12 ? 0.6 : 0.12)
      );
    };
    let best: Order = { unitId: u.id, type: "wait" };
    let bestValue = positionValue(u);
    // Relative ordering keeps tie-breaking symmetric when the board is rotated.
    const options = moves(b, u, bonus)
      .filter((p) => !reserved.some((r) => sameCell(r, p)))
      .sort((a, c) => (side === "player" ? 1 : -1) * (a.y - c.y || a.x - c.x));
    for (const to of options) {
      const value = positionValue(to) - 0.1 + variation();
      if (value > bestValue) {
        bestValue = value;
        best = { unitId: u.id, type: "move", to };
      }
    }
    for (const e of enemies.filter((e) => canAttack(u, e))) {
      const preview = hitPreview(u, e, stats(u).attack, {
        battle: b,
        source: "attack",
      });
      const value =
        positionValue(u) +
        preview.expectedDamage * 0.5 +
        (e.hp <= preview.damage ? 10 : 0) +
        variation();
      if (value > bestValue) {
        bestValue = value;
        best = { unitId: u.id, type: "attack", targetId: e.id };
      }
    }
    if (policy.skills !== false) {
      const candidates = loadoutFor(u).flatMap((abilityId) => {
        const ability = abilityFor(u, abilityId)!;
        if (
          !skillReady(b, u, abilityId) ||
          orderCost(b, orders, bonus) + effectiveAbilityCost(u, ability) >
            b.energy[side]
        )
          return [];
        const targets =
          ability.target === "self"
            ? [u]
            : ability.target === "enemy"
              ? enemies
              : team;
        return targets
          .map((target): Extract<Order, { type: "skill" }> => ({
            unitId: u.id,
            type: "skill",
            abilityId,
            targetId: target.id,
          }))
          .filter((o) => canUseSkill(b, u, o));
      });
      for (const candidate of candidates) {
        const preview = previewOrder(b, candidate);
        const incoming = abilityTargets(b, u, candidate).reduce(
          (total, target) =>
            total +
            enemies
              .filter((e) => canAttack(e, target))
              .reduce((n, e) => n + directDamage(e, target), 0),
          0,
        );
        const value =
          positionValue(u) +
          (preview.expectedDamage ?? 0) * 0.5 +
          (preview.heal ?? 0) * 0.65 +
          Math.min(preview.shield ?? 0, incoming) * 0.55 +
          (preview.utility ?? 0) * 0.55 -
          effectiveAbilityCost(u, abilityFor(u, candidate.abilityId)!) * 0.65;
        if (value > bestValue) {
          bestValue = value;
          best = candidate;
        }
      }
    }
    reserved.push(
      best.type === "move" || (best.type === "skill" && best.to) ? best.to! : u,
    );
    orders.push(best);
  }
  return { orders, bonus };
}

export function resolveRound(
  initial: Battle,
  playerOrders: Order[],
  botOrders: Order[],
  playerBonus?: Bonus | null,
  botBonus?: Bonus | null,
  roll: CriticalRoll = Math.random,
): Frame[] {
  if (
    !validateOrders(initial, "player", playerOrders, playerBonus) ||
    !validateOrders(initial, "bot", botOrders, botBonus)
  )
    throw new Error("INVALID_ORDERS");
  const b = structuredClone(initial);
  b.actionLimitBonus = { player: 0, bot: 0 };
  const frames: Frame[] = [];
  const push = (events: BattleEvent[]) =>
    frames.push({ battle: structuredClone(b), events });
  const resonanceEvents: BattleEvent[] = [];
  for (const [side, bonus] of [
    ["player", playerBonus],
    ["bot", botBonus],
  ] as const) {
    if (!bonus) continue;
    b.energy[side] -= BONUS_COST;
    const unit = b.units.find((u) => u.id === bonus.unitId)!;
    if (bonus.type === "shield") unit.shield = 7;
    push([{ type: "bonus", unitId: unit.id }]);
  }
  const orders = [...playerOrders, ...botOrders];
  for (const o of orders) {
    if (o.type !== "skill") continue;
    const unit = b.units.find((u) => u.id === o.unitId)!;
    const ability = abilityFor(unit, o.abilityId)!;
    const cost = effectiveAbilityCost(unit, ability);
    b.energy[unit.side] -= cost;
    if (
      cost > 0 &&
      hasClassRank(unit, "BATTERY", 3) &&
      !unit.classTriggers?.batteryRefund
    ) {
      unit.classTriggers = { ...unit.classTriggers, batteryRefund: true };
      const amount = Math.max(1, Math.round(cost * 0.5));
      b.energy[unit.side] += amount;
      resonanceEvents.push({
        type: "bonus",
        unitId: unit.id,
        amount,
        abilityId: "resonance-battery",
      });
    }
    unit.cooldowns[ability.key] = b.round + ability.cooldown + 1;
  }
  if (resonanceEvents.length) push(resonanceEvents);
  // Equal initiative uses the same snapshot: attacks can mutually eliminate units.
  const initiative = (u: Fighter) => {
    const o = orders.find((o) => o.unitId === u.id);
    return o?.type === "skill" && abilityFor(u, o.abilityId)?.delayed
      ? 0
      : stats(u).speed;
  };
  const speeds = new Map(b.units.map((u) => [u.id, initiative(u)]));
  for (const speed of [...new Set(speeds.values())].sort((a, c) => c - a)) {
    const snapshot = structuredClone(b);
    const actors = orders
      .map((order, index) => ({
        order,
        index,
        unit: snapshot.units.find((u) => u.id === order.unitId),
      }))
      .filter(
        (
          entry,
        ): entry is {
          order: Order;
          index: number;
          unit: Fighter;
        } =>
          !!entry.unit &&
          entry.unit.hp > 0 &&
          speeds.get(entry.unit.id) === speed,
      );
    const events: BattleEvent[] = [];
    const destinations = new Map<string, Cell>();
    const damage = new Map<string, number>();
    const healing = new Map<string, number>();
    const healContributions: {
      sourceId: string;
      targetId: string;
      amount: number;
    }[] = [];
    const effects: { targetId: string; effect: ActiveEffect }[] = [];
    const shields = new Map<string, number>();
    const shieldExpiry = new Map<string, number>();
    const forces: {
      unitId: string;
      targetId: string;
      from: Cell;
      type: "push" | "pull";
      steps: number;
      maxDistance: number;
    }[] = [];
    for (const dead of snapshot.units.filter(
      (u) =>
        u.hp <= 0 &&
        speeds.get(u.id) === speed &&
        initial.units.find((i) => i.id === u.id)!.hp > 0,
    )) {
      if (orders.some((o) => o.unitId === dead.id && o.type !== "wait"))
        events.push({
          type: "cancelled",
          unitId: dead.id,
          reason: "actorDown",
        });
    }
    for (const { order: o, unit: u } of actors) {
      if (o?.type === "skill") {
        const ability = abilityFor(u, o.abilityId)!;
        events.push({ type: "skill", unitId: u.id, abilityId: ability.key });
        const reason = skillTargetFailure(snapshot, u, o);
        if (reason) {
          events.push({
            type: "miss",
            unitId: u.id,
            targetId: o.targetId,
            reason,
          });
          continue;
        }
        const targets = abilityTargets(snapshot, u, o);
        for (const effect of ability.effects.filter((e) => e.enabled !== false))
          for (const target of targets) {
            const power = scaledPower(u, effect.power);
            if (effect.type === "damage" || effect.type === "lifesteal") {
              const critical =
                effect.canCrit !== false &&
                roll(u, target, b.round) < criticalChance(u, target) / 100;
              const amount = hitDamage(
                u,
                target,
                power,
                critical,
                effect.ignoreCover,
                snapshot,
                "skill",
              );
              damage.set(target.id, (damage.get(target.id) ?? 0) + amount);
              events.push({
                type: "attack",
                unitId: u.id,
                targetId: target.id,
                amount,
                critical,
                covered: !effect.ignoreCover && coverProtection(u, target) > 0,
                lifestealRatio:
                  effect.type === "lifesteal" ? effect.ratio : undefined,
              });
            } else if (effect.type === "heal") {
              const amount = healingPower(target, power, u);
              healContributions.push({
                sourceId: u.id,
                targetId: target.id,
                amount,
              });
              healing.set(target.id, (healing.get(target.id) ?? 0) + amount);
              if (hasClassRank(u, "HEALER", 4)) {
                const extra = healingPower(
                  target,
                  Math.max(1, Math.round(stats(u).hp * 0.15)),
                  u,
                );
                healContributions.push({
                  sourceId: u.id,
                  targetId: target.id,
                  amount: extra,
                });
                healing.set(target.id, (healing.get(target.id) ?? 0) + extra);
                events.push({
                  type: "heal",
                  unitId: target.id,
                  amount: extra,
                  abilityId: "resonance-healer-deep",
                });
              }
              if (hasClassRank(u, "HEALER", 5)) {
                const fallen = b.units
                  .filter(
                    (ally) =>
                      ally.side === u.side &&
                      ally.hp <= 0 &&
                      distance(ally, target) <= effectiveAbilityRadius(u, ability),
                  )
                  .sort((a, c) => a.id.localeCompare(c.id))[0];
                if (fallen) {
                  const revived = Math.max(1, Math.round(stats(fallen).hp * 0.25));
                  const live = b.units.find((unit) => unit.id === fallen.id)!;
                  live.hp = revived;
                  events.push({
                    type: "heal",
                    unitId: live.id,
                    amount: revived,
                    abilityId: "resonance-healer-revive",
                  });
                }
              }
            } else if (effect.type === "shield") {
              const previous = shields.get(target.id) ?? 0;
              if (power >= previous) {
                shields.set(target.id, power);
                shieldExpiry.set(
                  target.id,
                  Math.max(
                    power === previous ? (shieldExpiry.get(target.id) ?? 0) : 0,
                    b.round + (effect.duration ?? 0),
                  ),
                );
              }
              if (hasClassRank(u, "GUARDIAN", 4)) {
                const amount = Math.max(1, Math.round(stats(u).hp * 0.1));
                const allies = [u, ...alive(snapshot, u.side)]
                  .filter((ally, index, list) => list.findIndex((item) => item.id === ally.id) === index)
                  .sort(
                    (a, c) =>
                      (a.id === u.id ? -1 : c.id === u.id ? 1 : 0) ||
                      distance(a, u) - distance(c, u) ||
                      a.id.localeCompare(c.id),
                  )
                  .slice(0, 2);
                for (const ally of allies) {
                  const previous = shields.get(ally.id) ?? 0;
                  if (amount >= previous) {
                    shields.set(ally.id, amount);
                    shieldExpiry.set(ally.id, Math.max(shieldExpiry.get(ally.id) ?? 0, b.round + 1));
                    events.push({
                      type: "bonus",
                      unitId: ally.id,
                      amount,
                      effect: "shield",
                      abilityId: "resonance-guardian-pulse",
                    });
                  }
                }
              }
            } else if (effect.type === "push" || effect.type === "pull") {
              forces.push({
                unitId: u.id,
                targetId: target.id,
                from: u,
                type: effect.type,
                steps: power,
                maxDistance: effect.maxDistance ?? 2,
              });
            } else if ("duration" in effect) {
              effects.push({
                targetId: target.id,
                effect: {
                  type: effect.type,
                  sourceId: u.id,
                  abilityId: ability.key,
                  amount:
                    effect.type === "buff"
                      ? power
                      : Math.round(
                          directDamage(u, target, power) *
                            classDamageMultiplier(snapshot, u, target, "skill"),
                        ),
                  stat: effect.type === "buff" ? effect.stat : undefined,
                  starts: b.round + (effect.delay ?? 1),
                  expires: b.round + (effect.delay ?? 1) + effect.duration - 1,
                  healingReduction:
                    effect.type === "poison"
                      ? (effect.healingReduction ?? 0.3)
                      : undefined,
                  stacking: effect.stacking ?? "refresh",
                },
              });
            }
          }
      }
      if (o?.type === "move") {
        const bonus = u.side === "player" ? playerBonus : botBonus;
        if (moves(snapshot, u, bonus).some((p) => sameCell(p, o.to)))
          destinations.set(u.id, o.to);
        else
          events.push({
            type: "blocked",
            unitId: u.id,
            reason: "pathOccupied",
          });
      } else if (o?.type === "attack") {
        const target = snapshot.units.find((t) => t.id === o.targetId)!;
        if (canAttack(u, target)) {
          const critical =
            roll(u, target, b.round) < criticalChance(u, target) / 100;
          const amount = hitDamage(
            u,
            target,
            stats(u).attack,
            critical,
            false,
            snapshot,
            "attack",
          );
          damage.set(target.id, (damage.get(target.id) ?? 0) + amount);
          events.push({
            type: "attack",
            unitId: u.id,
            targetId: target.id,
            amount,
            critical,
            covered: coverProtection(u, target) > 0,
          });
        } else
          events.push({
            type: "miss",
            unitId: u.id,
            targetId: target.id,
            reason: attackFailure(u, target),
          });
      }
    }
    for (const [id, to] of destinations) {
      if (
        [...destinations].some(([other, p]) => other !== id && sameCell(p, to))
      )
        events.push({ type: "blocked", unitId: id, reason: "collision" });
      else {
        const path = pathTo(
          snapshot,
          snapshot.units.find((u) => u.id === id)!,
          to,
        );
        Object.assign(
          b.units.find((u) => u.id === id)!,
          to,
        );
        events.push({ type: "move", unitId: id, path });
        const moved = b.units.find((u) => u.id === id)!;
        if (hasClassRank(moved, "DUELIST", 4)) {
          const amount = Math.max(1, Math.round(stats(moved).attack * 0.15));
          moved.effects.push({
            type: "buff",
            sourceId: moved.id,
            abilityId: "resonance-duelist-step",
            stat: "attack",
            amount,
            starts: b.round + 1,
            expires: b.round + 1,
            stacking: "replace",
          });
          events.push({
            type: "bonus",
            unitId: moved.id,
            effect: "buff",
            amount,
            abilityId: "resonance-duelist-step",
          });
        }
        if (hasClassRank(moved, "SCOUT", 5) && !moved.classTriggers?.scoutWindow) {
          moved.classTriggers = { ...moved.classTriggers, scoutWindow: true };
          b.actionLimitBonus ??= { player: 0, bot: 0 };
          b.actionLimitBonus[moved.side] += 1;
          events.push({
            type: "bonus",
            unitId: moved.id,
            amount: 1,
            abilityId: "resonance-scout-window",
          });
        }
      }
    }
    for (const [id, amount] of shields) {
      const unit = b.units.find((u) => u.id === id)!;
      if (amount < unit.shield) continue;
      unit.shieldExpires = Math.max(
        amount === unit.shield ? (unit.shieldExpires ?? b.round) : 0,
        shieldExpiry.get(id) ?? b.round,
      );
      unit.shield = amount;
      events.push({ type: "bonus", unitId: id, amount, effect: "shield" });
    }
    for (const [id, amount] of damage) {
      const u = b.units.find((u) => u.id === id)!;
      let effectiveAmount = amount;
      const protector = alive(b, u.side)
        .filter(
          (ally) =>
            ally.id !== u.id &&
            hasClassRank(ally, "GUARDIAN", 5) &&
            !ally.classTriggers?.guardianRedirect &&
            distance(ally, u) <= 1,
        )
        .sort((a, c) => a.hp - c.hp || a.id.localeCompare(c.id))[0];
      if (protector && amount - u.shield >= u.hp) {
        const redirected = Math.max(1, Math.round(amount * 0.5));
        effectiveAmount = Math.max(0, amount - redirected);
        const protectorAbsorbed = Math.min(protector.shield, redirected);
        const protectorLost = Math.min(
          protector.hp,
          redirected - protectorAbsorbed,
        );
        protector.classTriggers = {
          ...protector.classTriggers,
          guardianRedirect: true,
        };
        protector.shield -= protectorAbsorbed;
        protector.hp = Math.max(0, protector.hp - protectorLost);
        b.statistics[protector.id].absorbed += protectorAbsorbed;
        events.push({
          type: "bonus",
          unitId: protector.id,
          targetId: u.id,
          amount: redirected,
          abilityId: "resonance-guardian-redirect",
        });
      }
      const absorbed = Math.min(u.shield, effectiveAmount);
      const healthLost = Math.min(u.hp, effectiveAmount - absorbed);
      b.statistics[id].absorbed += absorbed;
      u.shield -= absorbed;
      u.hp = Math.max(0, u.hp - effectiveAmount + absorbed);
      for (const event of events.filter(
        (e) => e.type === "attack" && e.targetId === id,
      )) {
        // Equal-initiative hits share absorption, so lifesteal never favors array order.
        event.amount = (event.amount ?? 0) * (amount > 0 ? effectiveAmount / amount : 1);
        event.absorbed =
          effectiveAmount > 0
            ? absorbed * ((event.amount ?? 0) / effectiveAmount)
            : 0;
        event.amount = (event.amount ?? 0) - event.absorbed;
        if (event.unitId && effectiveAmount > absorbed) {
          const actualDamage =
            healthLost * (event.amount / (effectiveAmount - absorbed));
          b.statistics[event.unitId].damage += actualDamage;
          if (event.lifestealRatio) {
            const caster = b.units.find((unit) => unit.id === event.unitId)!;
            const drained = healingPower(
              caster,
              Math.round(actualDamage * event.lifestealRatio),
              caster,
            );
            healing.set(caster.id, (healing.get(caster.id) ?? 0) + drained);
            healContributions.push({
              sourceId: caster.id,
              targetId: caster.id,
              amount: drained,
            });
          }
        }
      }
      if (
        healthLost > 0 &&
        hasClassRank(u, "GUARDIAN", 3) &&
        !u.classTriggers?.guardianShield
      ) {
        const shield = Math.max(1, Math.round(stats(u).hp * 0.12));
        u.classTriggers = { ...u.classTriggers, guardianShield: true };
        u.shield = Math.max(u.shield, shield);
        u.shieldExpires = Math.max(u.shieldExpires ?? 0, b.round + 1);
        events.push({
          type: "bonus",
          unitId: u.id,
          amount: shield,
          effect: "shield",
          abilityId: "resonance-guardian",
        });
      }
      if (
        healthLost > 0 &&
        hasClassRank(u, "PROVOKER", 3) &&
        !u.classTriggers?.provokerFocus
      ) {
        const attackerId = events.find(
          (event) => event.type === "attack" && event.targetId === id && event.unitId,
        )?.unitId;
        const attacker = attackerId ? b.units.find((unit) => unit.id === attackerId) : null;
        if (attacker && attacker.hp > 0) {
          const amount = -Math.max(1, Math.round(stats(attacker).attack * 0.15));
          u.classTriggers = { ...u.classTriggers, provokerFocus: true };
          attacker.effects.push({
            type: "buff",
            sourceId: u.id,
            abilityId: "resonance-provoker",
            stat: "attack",
            amount,
            starts: b.round + 1,
            expires: b.round + 1,
            stacking: "replace",
          });
          events.push({
            type: "bonus",
            unitId: attacker.id,
            effect: "buff",
            amount,
            abilityId: "resonance-provoker",
          });
        }
      }
      for (const event of events.filter(
        (event) => event.type === "attack" && event.targetId === id && event.unitId,
      )) {
        const attacker = b.units.find((unit) => unit.id === event.unitId);
        if (
          attacker &&
          event.amount &&
          event.amount > 0 &&
          hasClassRank(attacker, "DUELIST", 5) &&
          !attacker.classTriggers?.duelistExtraAction &&
          roll(attacker, u, b.round + 0.35) < 0.35
        ) {
          attacker.classTriggers = {
            ...attacker.classTriggers,
            duelistExtraAction: true,
          };
          b.actionLimitBonus ??= { player: 0, bot: 0 };
          b.actionLimitBonus[attacker.side] += 1;
          events.push({
            type: "bonus",
            unitId: attacker.id,
            amount: 1,
            abilityId: "resonance-duelist-extra",
          });
        }
        if (
          attacker &&
          event.amount &&
          event.amount > 0 &&
          hasClassRank(attacker, "SNIPER", 5) &&
          distance(attacker, u) > 1 &&
          !attacker.classTriggers?.sniperMark
        ) {
          attacker.classTriggers = { ...attacker.classTriggers, sniperMark: true };
          u.effects.push({
            type: "buff",
            sourceId: attacker.id,
            abilityId: "resonance-sniper-mark",
            stat: "luck",
            amount: 0,
            starts: b.round + 1,
            expires: b.round + 2,
            stacking: "replace",
          });
          events.push({
            type: "bonus",
            unitId: u.id,
            effect: "buff",
            abilityId: "resonance-sniper-mark",
          });
        }
        if (
          attacker &&
          event.amount &&
          event.amount > 0 &&
          hasClassRank(attacker, "CONTROLLER", 3) &&
          roll(attacker, u, b.round + 0.25) < 0.25
        ) {
          const amount = -Math.max(1, Math.round(stats(u).movement * 0.25));
          u.effects.push({
            type: "buff",
            sourceId: attacker.id,
            abilityId: "resonance-controller",
            stat: "movement",
            amount,
            starts: b.round + 1,
            expires: b.round + 1,
            stacking: "replace",
          });
          events.push({
            type: "bonus",
            unitId: u.id,
            effect: "buff",
            amount,
            abilityId: "resonance-controller",
          });
          if (
            hasClassRank(attacker, "CONTROLLER", 5) &&
            !attacker.classTriggers?.controllerBreak
          ) {
            attacker.classTriggers = {
              ...attacker.classTriggers,
              controllerBreak: true,
            };
            b.actionLimitBonus ??= { player: 0, bot: 0 };
            b.actionLimitBonus[u.side] -= 1;
            const drain = Math.floor(b.energy[u.side] * 0.2);
            b.energy[u.side] = Math.max(0, b.energy[u.side] - drain);
            events.push({
              type: "bonus",
              unitId: u.id,
              amount: drain,
              abilityId: "resonance-controller-break",
            });
          }
        }
      }
      if (healthLost > 0 && u.hp <= 0) {
        const killerId = events.find(
          (event) => event.type === "attack" && event.targetId === id && event.unitId,
        )?.unitId;
        const killer = killerId ? b.units.find((unit) => unit.id === killerId) : null;
        if (killer && hasClassRank(killer, "FINISHER", 5)) {
          b.energy[killer.side] += 1;
          const amount = Math.max(1, Math.round(stats(killer).attack * 0.12));
          killer.effects.push({
            type: "buff",
            sourceId: killer.id,
            abilityId: "resonance-finisher-momentum",
            stat: "attack",
            amount,
            starts: b.round + 1,
            expires: ROUND_LIMIT,
            stacking: "refresh",
          });
          events.push({
            type: "bonus",
            unitId: killer.id,
            effect: "buff",
            amount,
            abilityId: "resonance-finisher-momentum",
          });
        }
      }
      if (
        healthLost > 0 &&
        hasClassRank(u, "PROVOKER", 5) &&
        !u.classTriggers?.provokerExtraAction
      ) {
        u.classTriggers = { ...u.classTriggers, provokerExtraAction: true };
        b.actionLimitBonus ??= { player: 0, bot: 0 };
        b.actionLimitBonus[u.side] += 1;
        events.push({
          type: "bonus",
          unitId: u.id,
          amount: 1,
          abilityId: "resonance-provoker-answer",
        });
      }
    }
    for (const [id, amount] of healing) {
      const u = b.units.find((u) => u.id === id)!;
      if (u.hp <= 0 || amount <= 0) continue;
      const restored = Math.min(amount, stats(u).hp - u.hp);
      u.hp += restored;
      for (const contribution of healContributions.filter(
        (h) => h.targetId === id,
      ))
        b.statistics[contribution.sourceId].healing +=
          (restored * contribution.amount) / amount;
      if (restored) events.push({ type: "heal", unitId: id, amount: restored });
    }
    for (const { targetId, effect } of effects) {
      const target = b.units.find((u) => u.id === targetId)!;
      if (target.hp <= 0) continue;
      // Reapplication refreshes a family instead of multiplying DOT or stat buffs.
      const old = target.effects.find(
        (e) => e.type === effect.type && e.stat === effect.stat,
      );
      if (old && effect.stacking === "replace") Object.assign(old, effect);
      else if (old) {
        if (effect.amount > old.amount) old.sourceId = effect.sourceId;
        old.amount = Math.max(old.amount, effect.amount);
        old.expires = Math.max(old.expires, effect.expires);
        old.starts = Math.min(old.starts, effect.starts);
        if (effect.type === "poison")
          old.healingReduction = Math.max(
            old.healingReduction ?? 0.3,
            effect.healingReduction ?? 0.3,
          );
      } else target.effects.push(effect);
      events.push({
        type: "bonus",
        unitId: target.id,
        effect: effect.type,
        amount: effect.amount,
      });
    }
    if (events.length) push(events);
    // Resolve forces against one post-hit board. Conflicting paths cancel, never favor a side.
    const proposals = forces.map((f) => {
      const target = b.units.find((u) => u.id === f.targetId)!;
      return {
        ...f,
        path:
          target.hp > 0
            ? displacementPath(
                b,
                f.from,
                target,
                f.type,
                f.steps,
                f.maxDistance,
              )
            : [],
      };
    });
    const shifted: BattleEvent[] = [];
    for (const f of proposals) {
      if (!f.path.length) continue;
      const conflict = proposals.some(
        (other) =>
          other !== f &&
          (other.targetId === f.targetId ||
            f.path
              .slice(1)
              .some((p) => other.path.slice(1).some((q) => sameCell(p, q)))),
      );
      const path = conflict ? f.path.slice(0, 1) : f.path;
      Object.assign(
        b.units.find((u) => u.id === f.targetId)!,
        path[path.length - 1],
      );
      shifted.push({
        type: "displace",
        unitId: f.unitId,
        targetId: f.targetId,
        displacement: f.type,
        path,
        amount: path.length - 1,
      });
    }
    if (shifted.length) push(shifted);
  }
  const periodic: BattleEvent[] = [];
  for (const unit of alive(b)) {
    for (const effect of unit.effects.filter(
      (e) => e.type !== "buff" && e.starts <= b.round,
    )) {
      const absorbed =
        effect.type === "burn" ? Math.min(unit.shield, effect.amount) : 0;
      unit.shield -= absorbed;
      const amount = Math.min(unit.hp, effect.amount - absorbed);
      unit.hp -= amount;
      b.statistics[unit.id].absorbed += absorbed;
      b.statistics[effect.sourceId].damage += amount;
      periodic.push({
        type: "attack",
        unitId: effect.sourceId,
        targetId: unit.id,
        amount,
        absorbed,
        effect: effect.type as "burn" | "poison",
      });
    }
  }
  if (periodic.length) push(periodic);
  const captures: BattleEvent[] = [];
  b.captureProgress ??= {
    player: [...b.points.player],
    bot: [...b.points.bot],
  };
  b.pointFlags ??= {
    player: [false, false, false],
    bot: [false, false, false],
  };
  const pointFlags = b.pointFlags;
  POINTS.forEach((p, i) => {
    const sides = (["player", "bot"] as Side[]).filter((side) =>
      alive(b, side).some(
        (u) => nearPoint(u, p) || (hasClassRank(u, "CONTROLLER", 4) && distance(u, p) <= 2),
      ) || pointFlags[side][i],
    );
    if (sides.length === 2) {
      captures.push({ type: "contested", point: i });
      return;
    }
    if (sides.length !== 1) return;
    const side = sides[0];
    const contributors = alive(b, side).filter(
      (u) => nearPoint(u, p) || (hasClassRank(u, "CONTROLLER", 4) && distance(u, p) <= 2),
    );
    const flagOnly = pointFlags[side][i] && contributors.length === 0;
    const captureMultiplier = Math.max(
      1,
      ...contributors.map((u) => 1 + (stats(u).captureBonus ?? 0)),
    );
    b.captureProgress![side][i] += p.income * captureMultiplier;
    const amount = Math.min(
      Math.floor(b.captureProgress![side][i]) - b.points[side][i],
      POINT_CAP - b.points[side][i],
    );
    if (!amount) return;
    b.points[side][i] += amount;
    b.energy[side] += amount;
    b.score[side] += amount;
    if (contributors.length)
      for (const u of contributors)
        b.statistics[u.id].control += amount / contributors.length;
    captures.push({ type: "capture", side, point: i, amount });
    const captor = contributors.find((u) => hasClassRank(u, "CAPTOR", 4));
    if (captor) {
      pointFlags[side][i] = true;
      captures.push({
        type: "bonus",
        unitId: captor.id,
        point: i,
        abilityId: "resonance-captor-flag",
      });
    }
    const firstCaptor = contributors.find(
      (u) => hasClassRank(u, "CAPTOR", 5) && !u.classTriggers?.finisherMomentum,
    );
    if (firstCaptor && !flagOnly) {
      firstCaptor.classTriggers = {
        ...firstCaptor.classTriggers,
        finisherMomentum: true,
      };
      applyTeamBuff(
        b,
        side,
        firstCaptor.id,
        "attack",
        0.08,
        "resonance-captor-rush",
        captures,
      );
    }
    if (b.points[side][i] === POINT_CAP)
      captures.push({ type: "exhausted", side, point: i });
  });
  for (const unit of alive(b)) {
    if (
      hasClassRank(unit, "CAPTOR", 3) &&
      POINTS.some((point) => distance(unit, point) <= 1)
    ) {
      const amount = Math.max(1, Math.round(stats(unit).hp * 0.1));
      if (amount > unit.shield) {
        unit.shield = amount;
        unit.shieldExpires = Math.max(unit.shieldExpires ?? 0, b.round + 1);
        captures.push({
          type: "bonus",
          unitId: unit.id,
          amount,
          effect: "shield",
          abilityId: "resonance-captor",
        });
      }
    }
    if (hasClassRank(unit, "HEALER", 3)) {
      const amount = Math.max(1, Math.round(stats(unit).hp * 0.1));
      const target = alive(b, unit.side)
        .filter((ally) => ally.id !== unit.id && distance(ally, unit) <= 1 && ally.hp < stats(ally).hp)
        .sort(
          (a, c) =>
            a.hp / stats(a).hp - c.hp / stats(c).hp ||
            a.hp - c.hp ||
            a.id.localeCompare(c.id),
        )[0];
      if (target) {
        const restored = Math.min(amount, stats(target).hp - target.hp);
        target.hp += restored;
        b.statistics[unit.id].healing += restored;
        if (restored)
          captures.push({
            type: "heal",
            unitId: target.id,
            amount: restored,
            abilityId: "resonance-healer",
          });
      }
    }
  }
  b.units.forEach((u) => {
    if (b.round >= (u.shieldExpires ?? b.round)) u.shield = 0;
    u.effects = u.effects.filter((e) => e.expires > b.round);
    u.activeTurn = b.round + 1;
  });
  const playerAlive = alive(b, "player").length > 0;
  const botAlive = alive(b, "bot").length > 0;
  if (!playerAlive || !botAlive)
    b.winner = playerAlive ? "player" : botAlive ? "bot" : "draw";
  else if (b.round === ROUND_LIMIT)
    b.winner =
      b.score.player === b.score.bot
        ? "draw"
        : b.score.player > b.score.bot
          ? "player"
          : "bot";
  if (!b.winner) b.round++;
  push(captures);
  return frames;
}
