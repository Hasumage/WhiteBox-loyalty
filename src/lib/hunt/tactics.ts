import PF from "pathfinding";

export type Side = "player" | "bot";
export type Cell = { x: number; y: number };
export type Fighter = Cell & {
  profile?: FighterProfile;
  abilities?: Ability[];
  shieldExpires?: number;
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
      stat: "attack" | "speed" | "luck";
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
};
export type ActiveEffect = {
  type: "burn" | "poison" | "buff";
  sourceId: string;
  abilityId: string;
  amount: number;
  stat?: "attack" | "speed" | "luck";
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
  { x: 1, y: 4, income: 1 },
  { x: 4, y: 4, income: 2 },
  { x: 7, y: 4, income: 1 },
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
export const alive = (b: Battle, side?: Side) =>
  b.units.filter((u) => u.hp > 0 && (!side || u.side === side));
export const stats = (u: Fighter) => {
  const result: FighterProfile = { ...ROSTER[u.kind], luck: 10, ...u.profile };
  for (const effect of u.effects ?? []) {
    if (effect.type === "buff" && effect.stat && effect.starts <= u.activeTurn)
      result[effect.stat] += effect.amount;
  }
  result.luck = Math.min(100, result.luck);
  return result;
};
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
      (critical ? criticalMultiplier(u) : 1),
  );
export const hitDamage = (
  u: Fighter,
  target: Fighter,
  amount = stats(u).attack,
  critical = false,
  ignoreCover = false,
) =>
  Math.round(
    directDamage(u, target, amount, critical) *
      (1 - (ignoreCover ? 0 : coverProtection(u, target))),
  );
export function hitPreview(
  u: Fighter,
  target: Fighter,
  amount = stats(u).attack,
  options: { canCrit?: boolean; ignoreCover?: boolean } = {},
) {
  const damage = Math.max(
    0,
    hitDamage(u, target, amount, false, options.ignoreCover) - target.shield,
  );
  const maxDamage = Math.max(
    0,
    hitDamage(
      u,
      target,
      amount,
      options.canCrit !== false,
      options.ignoreCover,
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
          ? (abilityFor(unit, o.abilityId)?.cost ?? Infinity)
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
    energy: { player: 0, bot: 0 },
    score: { player: 0, bot: 0 },
    winner: null,
  };
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
    b.energy[u.side] >= ability.cost
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
        distance(t, center) <= ability.radius,
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
      ...hitPreview(u, target),
      hits: [hitPreview(u, target)],
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
          const hit = hitPreview(u, { ...target, shield: 0 }, power, effect);
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
          addHealing(target, healingPower(target, power));
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
        addHealing(u, healingPower(u, Math.round(actual * drain.ratio)));
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
const healingPower = (u: Fighter, amount: number) =>
  Math.round(
    amount *
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
  if (b.winner || !Array.isArray(orders) || orders.length > 3) return false;
  if (orders.some((o) => !o) || orderCost(b, orders, bonus) > b.energy[side])
    return false;
  if (
    bonus &&
    (!["shield", "haste"].includes(bonus.type) ||
      b.energy[side] < BONUS_COST ||
      !alive(b, side).some((u) => u.id === bonus.unitId))
  )
    return false;
  const ids = new Set<string>();
  return orders.every((o) => {
    if (!o || ids.has(o.unitId)) return false;
    ids.add(o.unitId);
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
        .reduce((n, e) => n + hitPreview(e, { ...u, ...p }).expectedDamage, 0);
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
      const value =
        positionValue(u) +
        hitPreview(u, e).expectedDamage * 0.5 +
        (e.hp <= hitPreview(u, e).damage ? 10 : 0) +
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
          orderCost(b, orders, bonus) + ability.cost > b.energy[side]
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
          abilityFor(u, candidate.abilityId)!.cost * 0.65;
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
  const frames: Frame[] = [];
  const push = (events: BattleEvent[]) =>
    frames.push({ battle: structuredClone(b), events });
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
    b.energy[unit.side] -= ability.cost;
    unit.cooldowns[ability.key] = b.round + ability.cooldown + 1;
  }
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
    const actors = alive(snapshot).filter((u) => speeds.get(u.id) === speed);
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
    for (const u of actors) {
      const o = orders.find((o) => o.unitId === u.id);
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
              healContributions.push({
                sourceId: u.id,
                targetId: target.id,
                amount: healingPower(target, power),
              });
              healing.set(
                target.id,
                (healing.get(target.id) ?? 0) + healingPower(target, power),
              );
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
                      : directDamage(u, target, power),
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
          const amount = hitDamage(u, target, stats(u).attack, critical);
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
      const absorbed = Math.min(u.shield, amount);
      const healthLost = Math.min(u.hp, amount - absorbed);
      b.statistics[id].absorbed += absorbed;
      u.shield -= absorbed;
      u.hp = Math.max(0, u.hp - amount + absorbed);
      for (const event of events.filter(
        (e) => e.type === "attack" && e.targetId === id,
      )) {
        // Equal-initiative hits share absorption, so lifesteal never favors array order.
        event.absorbed =
          amount > 0 ? absorbed * ((event.amount ?? 0) / amount) : 0;
        event.amount = (event.amount ?? 0) - event.absorbed;
        if (event.unitId && amount > absorbed) {
          const actualDamage =
            healthLost * (event.amount / (amount - absorbed));
          b.statistics[event.unitId].damage += actualDamage;
          if (event.lifestealRatio) {
            const caster = b.units.find((unit) => unit.id === event.unitId)!;
            const drained = healingPower(
              caster,
              Math.round(actualDamage * event.lifestealRatio),
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
  POINTS.forEach((p, i) => {
    const sides = (["player", "bot"] as Side[]).filter((side) =>
      alive(b, side).some((u) => distance(u, p) <= 1),
    );
    if (sides.length === 2) {
      captures.push({ type: "contested", point: i });
      return;
    }
    if (sides.length !== 1) return;
    const side = sides[0];
    const amount = Math.min(p.income, POINT_CAP - b.points[side][i]);
    if (!amount) return;
    b.points[side][i] += amount;
    b.energy[side] += amount;
    b.score[side] += amount;
    const contributors = alive(b, side).filter((u) => distance(u, p) <= 1);
    for (const u of contributors)
      b.statistics[u.id].control += amount / contributors.length;
    captures.push({ type: "capture", side, point: i, amount });
    if (b.points[side][i] === POINT_CAP)
      captures.push({ type: "exhausted", side, point: i });
  });
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
