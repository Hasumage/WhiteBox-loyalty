import {
  createBattle,
  criticalChance,
  criticalMultiplier,
  coverProtection,
  hitPreview,
  hitDamage,
  displacementPath,
  resolveRound,
  pathTo,
  previewOrder,
  type Fighter,
  type Order,
} from "./tactics";

function luck(u: Fighter, value: number) {
  u.effects.push({
    type: "buff",
    stat: "luck",
    amount: value - 10,
    sourceId: u.id,
    abilityId: "test",
    starts: 1,
    expires: 10,
  });
}
const duel = () => {
  const b = createBattle();
  b.energy.player = b.energy.bot = 20;
  Object.assign(b.units[0], { x: 0, y: 3 });
  Object.assign(b.units[3], { x: 0, y: 4 });
  return b;
};

describe("Critical hits, park cover and displacement", () => {
  it("simultaneous forces toward the same landing cell both stop", () => {
    const b = duel();
    Object.assign(b.units[0], { x: 2, y: 4 });
    Object.assign(b.units[1], { x: 6, y: 4, kind: 0 });
    Object.assign(b.units[3], { x: 3, y: 4 });
    Object.assign(b.units[4], { x: 5, y: 4 });
    const frames = resolveRound(
      b,
      [
        {
          unitId: "player-0",
          type: "skill",
          abilityId: "eruption",
          targetId: "bot-0",
        },
        {
          unitId: "player-1",
          type: "skill",
          abilityId: "eruption",
          targetId: "bot-1",
        },
      ],
      [],
      null,
      null,
      () => 0.99,
    );
    expect(frames.at(-1)!.battle.units[3].x).toBe(3);
    expect(frames.at(-1)!.battle.units[4].x).toBe(5);
    expect(
      frames
        .flatMap((f) => f.events)
        .filter((e) => e.type === "displace")
        .map((e) => e.amount),
    ).toEqual([0, 0]);
  });
  it("a slower displaced attacker revalidates range instead of hitting its old target", () => {
    const b = duel();
    Object.assign(b.units[5], { x: 0, y: 4 });
    Object.assign(b.units[3], { x: 8, y: 0 });
    const frames = resolveRound(
      b,
      [
        {
          unitId: "player-0",
          type: "skill",
          abilityId: "eruption",
          targetId: "bot-2",
        },
      ],
      [{ unitId: "bot-2", type: "attack", targetId: "player-0" }],
      null,
      null,
      () => 0.99,
    );
    expect(
      frames
        .flatMap((f) => f.events)
        .some(
          (e) =>
            e.type === "miss" &&
            e.unitId === "bot-2" &&
            e.reason === "outOfRange",
        ),
    ).toBe(true);
  });
  it.each([
    [10, 10, 5, 1.3],
    [10, 1, 11.75, 1.3],
    [20, 10, 12.5, 1.6],
    [30, 10, 20, 1.9],
    [40, 10, 25, 2.2],
    [1, 10, 1, 1.03],
  ])("balances luck %i vs %i", (a, d, chance, multiplier) => {
    const b = duel();
    luck(b.units[0], a);
    luck(b.units[3], d);
    expect(criticalChance(b.units[0], b.units[3])).toBeCloseTo(chance);
    expect(criticalMultiplier(b.units[0])).toBeCloseTo(multiplier);
  });
  it("uses strict probability boundaries and has no guaranteed meter", () => {
    const b = duel();
    const o: Order = { unitId: "player-0", type: "attack", targetId: "bot-0" };
    for (const [roll, critical] of [
      [0.04999, true],
      [0.05, false],
    ] as const) {
      const hit = resolveRound(b, [o], [], null, null, () => roll)
        .flatMap((f) => f.events)
        .find((e) => e.type === "attack")!;
      expect(hit.critical).toBe(critical);
      const preview = hitPreview(b.units[0], b.units[3]);
      expect(hit.amount).toBe(critical ? preview.maxDamage : preview.damage);
    }
    expect(b.units[0]).not.toHaveProperty("criticalCharge");
  });
  it("matches the probability over evenly sampled independent rolls", () => {
    const b = duel();
    luck(b.units[3], 1);
    const p = criticalChance(b.units[0], b.units[3]) / 100;
    const hits = Array.from(
      { length: 10000 },
      (_, i) => (i + 0.5) / 10000 < p,
    ).filter(Boolean);
    expect(hits).toHaveLength(1175);
  });
  it("cover protects only the adjacent target behind it, not melee or flanks", () => {
    expect(coverProtection({ x: 2, y: 1 }, { x: 2, y: 4 })).toBe(0.3);
    expect(coverProtection({ x: 4, y: 4 }, { x: 2, y: 4 })).toBe(0);
    expect(coverProtection({ x: 2, y: 4 }, { x: 2, y: 3 })).toBe(0);
    const b = createBattle();
    expect(pathTo(b, b.units[0], { x: 2, y: 5 })).toEqual([]);
  });
  it("cover applies to critical damage before shields and matches preview", () => {
    const b = createBattle();
    Object.assign(b.units[1], { x: 2, y: 1 });
    Object.assign(b.units[3], { x: 2, y: 4, shield: 2 });
    const p = hitPreview(b.units[1], b.units[3]);
    expect(p.covered).toBe(true);
    const frames = resolveRound(
      b,
      [{ unitId: "player-1", type: "attack", targetId: "bot-0" }],
      [],
      null,
      null,
      () => 0,
    );
    const hit = frames
      .flatMap((f) => f.events)
      .find((e) => e.type === "attack")!;
    expect(hit.amount).toBe(p.maxDamage);
    expect(hit.absorbed).toBe(2);
    expect(hit.covered).toBe(true);
    expect(hitDamage(b.units[1], b.units[3], 10, true)).toBe(11);
  });
  it("DOT never rolls for critical hits or receives cover mitigation", () => {
    const b = duel();
    Object.assign(b.units[3], { x: 2, y: 4 });
    b.units[3].effects.push({
      type: "burn",
      sourceId: "player-0",
      abilityId: "ember",
      amount: 6,
      starts: 1,
      expires: 2,
    });
    const roll = jest.fn(() => 0);
    const hits = resolveRound(b, [], [], null, null, roll)
      .flatMap((f) => f.events)
      .filter((e) => e.type === "attack");
    expect(roll).not.toHaveBeenCalled();
    expect(hits[0].amount).toBe(6);
    expect(hits[0].critical).toBeUndefined();
  });
  it("limits forced paths to two cells, stops at covers, occupants and map edges", () => {
    const b = duel(),
      u = b.units[3];
    Object.assign(u, { x: 2, y: 4 });
    expect(displacementPath(b, { x: 2, y: 2 }, u, "push", 20)).toHaveLength(1);
    Object.assign(u, { x: 0, y: 7 });
    expect(displacementPath(b, { x: 0, y: 6 }, u, "push", 20)).toHaveLength(2);
    Object.assign(u, { x: 0, y: 4 });
    expect(displacementPath(b, b.units[0], u, "pull", 2)).toHaveLength(1);
    expect(displacementPath(b, b.units[0], u, "push", 20)).toHaveLength(3);
  });
  it("eruption preview and post-hit displacement agree on a stationary board", () => {
    const b = duel();
    const o: Order = {
      unitId: "player-0",
      type: "skill",
      abilityId: "eruption",
      targetId: "bot-0",
    };
    const preview = previewOrder(b, o);
    const frames = resolveRound(b, [o], [], null, null, () => 0.99);
    const shift = frames
      .flatMap((f) => f.events)
      .find((e) => e.type === "displace")!;
    expect(shift.path).toEqual(preview.displacements![0].path);
    expect(shift.amount).toBe(2);
    expect(frames.at(-1)!.battle.units[3].y).toBe(6);
    expect(frames.at(-1)!.battle.score.bot).toBe(0);
  });
  it("whirlpool pulls surviving targets toward the caster", () => {
    const b = duel();
    Object.assign(b.units[1], { x: 0, y: 0 });
    Object.assign(b.units[3], { x: 0, y: 2 });
    const frames = resolveRound(
      b,
      [
        {
          unitId: "player-1",
          type: "skill",
          abilityId: "tidalWave",
          targetId: "bot-0",
        },
      ],
      [],
      null,
      null,
      () => 0.99,
    );
    expect(frames.at(-1)!.battle.units[3].y).toBe(1);
    expect(
      frames.flatMap((f) => f.events).find((e) => e.type === "displace")
        ?.displacement,
    ).toBe("pull");
  });
  it("a lethal hit does not displace or revive its target", () => {
    const b = duel();
    b.units[3].hp = 1;
    const frames = resolveRound(
      b,
      [
        {
          unitId: "player-0",
          type: "skill",
          abilityId: "eruption",
          targetId: "bot-0",
        },
      ],
      [],
      null,
      null,
      () => 0,
    );
    expect(frames.at(-1)!.battle.units[3].hp).toBe(0);
    expect(
      frames.flatMap((f) => f.events).some((e) => e.type === "displace"),
    ).toBe(false);
  });
});
