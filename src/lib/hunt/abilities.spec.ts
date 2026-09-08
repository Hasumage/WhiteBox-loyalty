import {
  ABILITIES,
  LOADOUTS,
  createBattle,
  resolveRound as randomResolve,
  validateOrders,
  stats,
  skillReady,
  directDamage,
  elementMultiplier,
  BASE_ELEMENTS,
  ELEMENT_COUNTERS,
  previewOrder,
  type Battle,
  type Order,
  type AbilityId,
} from "./tactics";
const resolveRound = (...args: Parameters<typeof randomResolve>) =>
  randomResolve(
    args[0],
    args[1],
    args[2],
    args[3],
    args[4],
    args[5] ?? (() => 0.99),
  );

const funded = () => {
  const b = createBattle();
  b.energy.player = b.energy.bot = 20;
  return b;
};
const cast = (
  kind: number,
  abilityId: AbilityId,
  targetId?: string,
): Order => ({ unitId: `player-${kind}`, type: "skill", abilityId, targetId });
const finish = (b: Battle, orders: Order[] = [], enemies: Order[] = []) =>
  resolveRound(b, orders, enemies).at(-1)!.battle;
const duel = () => {
  const b = funded();
  Object.assign(b.units[0], { x: 0, y: 3 });
  Object.assign(b.units[1], { x: 0, y: 2 });
  Object.assign(b.units[2], { x: 0, y: 1 });
  Object.assign(b.units[3], { x: 1, y: 2 });
  Object.assign(b.units[4], { x: 1, y: 1 });
  Object.assign(b.units[5], { x: 1, y: 3 });
  return b;
};

describe("Stat-scaled Hunt abilities", () => {
  it("locks all abilities at zero resonance and rejects spending the same energy twice", () => {
    const b = createBattle();
    expect(skillReady(b, b.units[0], "lavaShield")).toBe(false);
    expect(validateOrders(b, "player", [cast(0, "lavaShield")])).toBe(false);
    b.energy.player = 4;
    expect(
      validateOrders(b, "player", [
        cast(0, "lavaShield"),
        cast(2, "plantain", "player-2"),
      ]),
    ).toBe(false);
    expect(
      validateOrders(b, "player", [cast(0, "lavaShield")], {
        type: "shield",
        unitId: "player-1",
      }),
    ).toBe(false);
    b.energy.player = 5;
    expect(
      validateOrders(b, "player", [
        cast(0, "lavaShield"),
        cast(2, "plantain", "player-2"),
      ]),
    ).toBe(true);
  });
  it("preserves control score and commits cost and independent cooldowns", () => {
    let b = funded();
    b.score.player = 7;
    const frames = resolveRound(b, [cast(0, "lavaShield")], []);
    expect(frames.some((f) => f.battle.units[0].shield === 12)).toBe(true);
    b = frames.at(-1)!.battle;
    expect(b.energy.player).toBe(18);
    expect(b.score.player).toBe(7);
    expect(b.units[0].shield).toBe(0);
    expect(skillReady(b, b.units[0], "lavaShield")).toBe(false);
    expect(skillReady(b, b.units[0], "ember")).toBe(true);
    b = finish(b);
    expect(skillReady(b, b.units[0], "lavaShield")).toBe(false);
    b = finish(b);
    expect(skillReady(b, b.units[0], "lavaShield")).toBe(true);
  });
  it("rejects forged, foreign, wrong-side, out-of-range and wall-blocked skills", () => {
    const b = duel();
    for (const order of [
      cast(0, "plantain", "player-0"),
      cast(0, "ember", "player-0"),
      cast(2, "plantain", "bot-1"),
      { ...cast(0, "lavaShield"), abilityId: "unknown" },
      { ...cast(0, "lavaShield"), to: { x: 0, y: 4 } },
    ])
      expect(validateOrders(b, "player", [order])).toBe(false);
    Object.assign(b.units[1], { x: 2, y: 2 });
    Object.assign(b.units[3], { x: 4, y: 2 });
    expect(validateOrders(b, "player", [cast(1, "tideLance", "bot-0")])).toBe(
      false,
    );
  });
  it("applies single damage with elemental advantage and matches preview", () => {
    const b = duel(),
      order = cast(1, "tideLance", "bot-0");
    const result = finish(b, [order]);
    expect(b.units[3].hp - result.units[3].hp).toBe(
      previewOrder(b, order).damage,
    );
    expect(result.units[4].hp).toBe(b.units[4].hp);
    expect(result.units[5].hp).toBe(b.units[5].hp);
  });
  it("pays for a delayed shot even when a faster target escapes", () => {
    const b = funded();
    b.points.player[0] = 4;
    Object.assign(b.units[1], { x: 0, y: 4 });
    Object.assign(b.units[3], { x: 4, y: 4 });
    const frames = resolveRound(
      b,
      [cast(1, "tideLance", "bot-0")],
      [{ unitId: "bot-0", type: "move", to: { x: 5, y: 4 } }],
    );
    expect(
      frames.flatMap((f) => f.events).some((e) => e.reason === "outOfRange"),
    ).toBe(true);
    expect(frames.at(-1)!.battle.energy.player).toBe(17);
    expect(frames.at(-1)!.battle.units[3].hp).toBe(30);
  });
  it("area damage hits nearby enemies but never allies or distant enemies", () => {
    const b = duel();
    Object.assign(b.units[4], { x: 8, y: 0 });
    const result = finish(b, [cast(0, "eruption", "bot-0")]);
    expect(result.units[3].hp).toBeLessThan(b.units[3].hp);
    expect(result.units[5].hp).toBeLessThan(b.units[5].hp);
    expect(result.units[4].hp).toBe(b.units[4].hp);
    expect(result.units[1].hp).toBe(b.units[1].hp);
  });
  it("area shields affect allies and use the stronger shield without stacking", () => {
    const b = duel();
    b.units[0].shield = 20;
    const frames = resolveRound(b, [cast(1, "waterVeil", "player-1")], []);
    const protectedFrame = frames.find((f) =>
      f.events.some((e) => e.effect === "shield"),
    )!.battle;
    expect(protectedFrame.units[0].shield).toBe(20);
    expect(protectedFrame.units[1].shield).toBe(8);
    expect(protectedFrame.units[2].shield).toBe(8);
    expect(protectedFrame.units[3].shield).toBe(0);
  });
  it("heals an area from caster maximum health and cannot revive", () => {
    const b = duel();
    b.units[0].hp = 0;
    b.units[1].hp = 10;
    b.units[2].hp = 36;
    const result = finish(b, [cast(2, "plantain", "player-1")]);
    expect(result.units[0].hp).toBe(0);
    expect(result.units[1].hp).toBe(18);
    expect(result.units[2].hp).toBe(38);
  });
  it("burn begins next turn, is absorbed by a shield and expires after two ticks", () => {
    let b = duel();
    b = finish(b, [cast(0, "ember", "bot-0")]);
    const hp = b.units[3].hp;
    expect(b.units[3].effects[0].type).toBe("burn");
    b = finish(
      b,
      [],
      [{ unitId: "bot-0", type: "skill", abilityId: "lavaShield" }],
    );
    expect(b.units[3].hp).toBe(hp);
    b = finish(b);
    expect(b.units[3].hp).toBe(hp - 3);
    expect(b.units[3].effects).toHaveLength(0);
    b = finish(b);
    expect(b.units[3].hp).toBe(hp - 3);
  });
  it("poison bypasses shields, weakens healing and lasts three ticks", () => {
    let b = duel();
    b.units[3].hp = 10;
    b = finish(b, [cast(2, "venom", "bot-0")]);
    const hp = b.units[3].hp;
    b = finish(
      b,
      [],
      [
        { unitId: "bot-0", type: "skill", abilityId: "lavaShield" },
        {
          unitId: "bot-2",
          type: "skill",
          abilityId: "plantain",
          targetId: "bot-0",
        },
      ],
    );
    expect(b.units[3].hp).toBe(hp + 6 - 2);
    b = finish(finish(b));
    expect(b.units[3].effects).toHaveLength(0);
  });
  it("buffs start next turn, scale from stats, expire, and increase skill damage", () => {
    let b = duel();
    const frames = resolveRound(b, [cast(2, "bloom", "player-1")], []);
    const applied = frames.find((f) =>
      f.events.some((e) => e.effect === "buff"),
    )!.battle;
    expect(stats(applied.units[1]).attack).toBe(7);
    b = frames.at(-1)!.battle;
    expect(stats(b.units[1])).toMatchObject({ attack: 9, speed: 3, luck: 15 });
    const order = cast(1, "tideLance", "bot-0");
    expect(previewOrder(b, order).damage).toBe(16);
    b = finish(b);
    expect(stats(b.units[1]).attack).toBe(9);
    b = finish(b);
    expect(stats(b.units[1]).attack).toBe(7);
  });
  it("reapplying poison refreshes duration without multiplying damage", () => {
    let b = duel();
    b = finish(b, [cast(2, "venom", "bot-0")]);
    b.units[2].cooldowns.venom = 1;
    b = finish(b, [cast(2, "venom", "bot-0")]);
    expect(b.units[3].effects.filter((e) => e.type === "poison")).toHaveLength(
      1,
    );
    expect(b.units[3].effects[0].expires).toBe(5);
  });
  it("gives each base element exactly two strengths and two weaknesses", () => {
    BASE_ELEMENTS.forEach((e) => {
      expect(ELEMENT_COUNTERS[e]).toHaveLength(2);
      expect(
        BASE_ELEMENTS.filter((other) => ELEMENT_COUNTERS[other].includes(e)),
      ).toHaveLength(2);
      for (const target of ELEMENT_COUNTERS[e]) {
        expect(elementMultiplier(e, target)).toBe(1.2);
        expect(elementMultiplier(target, e)).toBe(1);
      }
      expect(elementMultiplier(e, e)).toBe(1);
      expect(elementMultiplier(e, "LIGHT")).toBe(1);
    });
    const b = duel();
    expect(directDamage(b.units[0], b.units[5], 10)).toBe(12);
    expect(directDamage(b.units[1], b.units[0], 10)).toBe(12);
    expect(ELEMENT_COUNTERS.WATER).toEqual(["FLAME", "MUSIC"]);
  });
  it("light and shadow counter each other but not themselves or base elements", () => {
    expect(elementMultiplier("LIGHT", "SHADOW")).toBe(1.2);
    expect(elementMultiplier("SHADOW", "LIGHT")).toBe(1.2);
    for (const e of ["LIGHT", "SHADOW"] as const) {
      expect(elementMultiplier(e, e)).toBe(1);
      for (const base of BASE_ELEMENTS) {
        expect(elementMultiplier(e, base)).toBe(1);
        expect(elementMultiplier(base, e)).toBe(1);
      }
    }
  });
  it("rolls critical hits independently for each area target", () => {
    const b = duel();
    const frames = resolveRound(
      b,
      [cast(0, "eruption", "bot-0")],
      [],
      null,
      null,
      (_u, target) => (target.id === "bot-0" ? 0 : 0.99),
    );
    const hits = frames
      .flatMap((f) => f.events)
      .filter((e) => e.type === "attack");
    expect(hits.find((e) => e.targetId === "bot-0")?.critical).toBe(true);
    expect(hits.find((e) => e.targetId === "bot-2")?.critical).toBe(false);
  });
  it("has valid positive costs, scaling and owned loadouts for every effect family", () => {
    const families = new Set<string>();
    LOADOUTS.flat().forEach((id) => {
      const ability = ABILITIES[id as keyof typeof ABILITIES];
      expect(ability.cost).toBeGreaterThan(0);
      ability.effects.forEach((e) => {
        expect(e.power.factor).toBeGreaterThan(0);
        families.add(e.type);
      });
    });
    expect([...families].sort()).toEqual([
      "buff",
      "burn",
      "damage",
      "heal",
      "poison",
      "pull",
      "push",
      "shield",
    ]);
  });
  it("a lethal periodic effect prevents income and can end the round", () => {
    const b = funded();
    b.units
      .filter((u) => u.side === "bot")
      .forEach((u) => {
        u.hp = 0;
      });
    Object.assign(b.units[3], {
      x: 4,
      y: 4,
      hp: 2,
      effects: [
        {
          type: "poison",
          sourceId: "player-2",
          abilityId: "venom",
          amount: 2,
          starts: 1,
          expires: 2,
        },
      ],
    });
    const result = finish(b);
    expect(result.units[3].hp).toBe(0);
    expect(result.score.bot).toBe(0);
    expect(result.winner).toBe("player");
  });
  it("remaining resonance never replaces control score for the final result", () => {
    const b = funded();
    b.round = 10;
    b.score.player = 5;
    b.score.bot = 4;
    b.energy.player = 2;
    const result = finish(b, [cast(0, "lavaShield")]);
    expect(result.energy.player).toBe(0);
    expect(result.energy.bot).toBe(20);
    expect(result.winner).toBe("player");
  });
});
