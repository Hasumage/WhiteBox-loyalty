import {
  alive,
  canAttack,
  createBattle,
  directDamage,
  moves,
  pathTo,
  planAI,
  POINT_CAP,
  resolveRound as randomResolve,
  stats,
  validateOrders,
  type Battle,
  type Order,
} from "./tactics";
const resolveRound = (...args: Parameters<typeof randomResolve>) =>
  randomResolve(args[0], args[1], args[2], args[3], args[4], () => 0.99);

const resolve = (b: Battle, p: Order[] = [], ai: Order[] = []) =>
  resolveRound(b, p, ai).at(-1)!.battle;
describe("Hunt tactical training", () => {
  it("emits a one-time exhaustion event and contested point feedback", () => {
    let b = createBattle();
    Object.assign(b.units[0], { x: 4, y: 4 });
    b.points.player[1] = 3;
    const frames = resolveRound(b, [], []);
    expect(
      frames
        .flatMap((f) => f.events)
        .some(
          (e) => e.type === "exhausted" && e.side === "player" && e.point === 1,
        ),
    ).toBe(true);
    b = frames.at(-1)!.battle;
    expect(
      resolveRound(b, [], [])
        .flatMap((f) => f.events)
        .some((e) => e.type === "exhausted"),
    ).toBe(false);
    Object.assign(b.units[3], { x: 4, y: 3 });
    expect(
      resolveRound(b, [], [])
        .flatMap((f) => f.events)
        .some((e) => e.type === "contested" && e.point === 1),
    ).toBe(true);
  });
  it("starts with identical level-one profiles and rotated spawn positions", () => {
    const b = createBattle();
    alive(b, "player").forEach((p) => {
      const ai = b.units.find((u) => u.side === "bot" && u.kind === p.kind)!;
      expect(stats(p)).toEqual(stats(ai));
      expect([p.x + ai.x, p.y + ai.y]).toEqual([8, 8]);
    });
  });
  it("rejects duplicate orders, enemy orders, occupied tiles, distant attacks and forged bonuses", () => {
    const b = createBattle();
    expect(
      validateOrders(b, "player", [
        { unitId: "player-0", type: "wait" },
        { unitId: "player-0", type: "wait" },
      ]),
    ).toBe(false);
    expect(
      validateOrders(b, "player", [{ unitId: "bot-0", type: "wait" }]),
    ).toBe(false);
    expect(
      validateOrders(b, "player", [
        { unitId: "player-0", type: "move", to: { x: 4, y: 8 } },
      ]),
    ).toBe(false);
    expect(
      validateOrders(b, "player", [
        { unitId: "player-0", type: "attack", targetId: "bot-0" },
      ]),
    ).toBe(false);
    expect(
      validateOrders(b, "player", [], { type: "shield", unitId: "player-0" }),
    ).toBe(false);
    expect(
      validateOrders(b, "player", [
        { unitId: "player-0", type: "move", to: { x: -1, y: 8 } },
      ]),
    ).toBe(false);
  });
  it("routes around obstacles and blocks their line of sight", () => {
    const b = createBattle();
    const p = b.units[1],
      enemy = b.units[4];
    Object.assign(p, { x: 2, y: 2 });
    Object.assign(enemy, { x: 4, y: 2 });
    expect(canAttack(p, enemy)).toBe(false);
    const path = pathTo(b, p, { x: 4, y: 3 });
    expect(path.length).toBeGreaterThan(0);
    expect(path.some((c) => c.x === 3 && c.y === 2)).toBe(false);
  });
  it("resolves equal-speed lethal attacks simultaneously", () => {
    const b = createBattle();
    Object.assign(b.units[0], { x: 4, y: 4, hp: 9 });
    Object.assign(b.units[3], { x: 4, y: 3, hp: 9 });
    const result = resolve(
      b,
      [{ unitId: "player-0", type: "attack", targetId: "bot-0" }],
      [{ unitId: "bot-0", type: "attack", targetId: "player-0" }],
    );
    expect(result.units[0].hp).toBe(0);
    expect(result.units[3].hp).toBe(0);
  });
  it("lets a fast move escape a slower attack", () => {
    const b = createBattle();
    Object.assign(b.units[0], { x: 4, y: 4 });
    Object.assign(b.units[5], { x: 4, y: 3 });
    const result = resolve(
      b,
      [{ unitId: "player-0", type: "move", to: { x: 4, y: 6 } }],
      [{ unitId: "bot-2", type: "attack", targetId: "player-0" }],
    );
    expect(result.units[0].hp).toBe(30);
  });
  it("does not privilege either side in a same-speed destination collision", () => {
    const b = createBattle();
    Object.assign(b.units[0], { x: 3, y: 4 });
    Object.assign(b.units[3], { x: 5, y: 4 });
    const result = resolve(
      b,
      [{ unitId: "player-0", type: "move", to: { x: 4, y: 4 } }],
      [{ unitId: "bot-0", type: "move", to: { x: 4, y: 4 } }],
    );
    expect(result.units[0].x).toBe(3);
    expect(result.units[3].x).toBe(5);
  });
  it("caps central income independently per side and never restores it after leaving", () => {
    let b = createBattle();
    Object.assign(b.units[0], { x: 4, y: 4 });
    b = resolve(resolve(resolve(b)));
    expect(b.points.player[1]).toBe(POINT_CAP);
    expect(b.energy.player).toBe(4);
    Object.assign(b.units[0], { x: 0, y: 8 });
    Object.assign(b.units[3], { x: 4, y: 4 });
    b = resolve(b);
    expect(b.points.bot[1]).toBe(2);
    expect(b.points.player[1]).toBe(4);
    Object.assign(b.units[3], { x: 8, y: 0 });
    Object.assign(b.units[0], { x: 4, y: 4 });
    b = resolve(b);
    expect(b.energy.player).toBe(4);
  });
  it("pays nothing for contested points or extra allies", () => {
    let b = createBattle();
    Object.assign(b.units[0], { x: 4, y: 4 });
    Object.assign(b.units[1], { x: 4, y: 5 });
    Object.assign(b.units[3], { x: 4, y: 3 });
    b = resolve(b);
    expect(b.score.player).toBe(0);
    expect(b.score.bot).toBe(0);
    Object.assign(b.units[3], { x: 8, y: 0 });
    b = resolve(b);
    expect(b.score.player).toBe(2);
  });
  it("charges shield once, preserves score and expires it after the round", () => {
    const b = createBattle();
    b.energy.player = 3;
    b.score.player = 3;
    Object.assign(b.units[0], { x: 0, y: 0 });
    Object.assign(b.units[3], { x: 1, y: 0 });
    const result = resolveRound(
      b,
      [],
      [{ unitId: "bot-0", type: "attack", targetId: "player-0" }],
      { type: "shield", unitId: "player-0" },
    ).at(-1)!.battle;
    expect(result.units[0].hp).toBe(28);
    expect(result.units[0].shield).toBe(0);
    expect(result.energy.player).toBe(0);
    expect(result.score.player).toBe(3);
  });
  it("haste grants one tile without granting an additional order", () => {
    const b = createBattle();
    b.energy.player = 3;
    expect(
      moves(b, b.units[0], { type: "haste", unitId: "player-0" }).length,
    ).toBeGreaterThan(moves(b, b.units[0]).length);
  });
  it("applies resonance bonuses to ranged damage and healing", () => {
    let b = createBattle();
    const sniper = b.units[0];
    const target = b.units[3];
    Object.assign(sniper, {
      x: 1,
      y: 1,
      profile: { ...stats(sniper), attack: 10, rangedDamageBonus: 0.1 },
    });
    Object.assign(target, {
      x: 1,
      y: 3,
      profile: { ...stats(target), element: stats(sniper).element },
    });
    expect(directDamage(sniper, target, 10)).toBe(11);

    b = createBattle();
    const healer = b.units[0];
    const ally = b.units[1];
    Object.assign(healer, {
      x: 4,
      y: 4,
      profile: { ...stats(healer), attack: 10, healingBonus: 0.1 },
      abilities: [
        {
          key: "testHeal",
          cost: 0,
          cooldown: 1,
          target: "ally",
          radius: 0,
          rangeBonus: 0,
          range: 3,
          effects: [{ type: "heal", power: { stat: "attack", factor: 1 } }],
        },
      ],
    });
    Object.assign(ally, {
      x: 4,
      y: 5,
      hp: 1,
      profile: { ...stats(ally), hp: 30 },
    });
    const result = resolveRound(b, [
      { unitId: healer.id, type: "skill", abilityId: "testHeal", targetId: ally.id },
    ], []).at(-1)!.battle;
    expect(result.units.find((unit) => unit.id === ally.id)!.hp).toBe(12);
  });
  it("applies rank three guardian shield and scout opening movement", () => {
    let b = createBattle();
    const guardian = b.units[0];
    const enemy = b.units[3];
    Object.assign(guardian, {
      x: 1,
      y: 1,
      profile: { ...stats(guardian), hp: 40, battleClass: "GUARDIAN", fusionRank: 3 },
    });
    Object.assign(enemy, {
      x: 1,
      y: 2,
      profile: { ...stats(enemy), attack: 10, element: stats(guardian).element },
    });
    b = resolveRound(b, [], [
      { unitId: enemy.id, type: "attack", targetId: guardian.id },
    ]).at(-1)!.battle;
    expect(b.units.find((unit) => unit.id === guardian.id)!.shield).toBe(5);

    b = createBattle();
    const scout = b.units[0];
    Object.assign(scout, {
      profile: { ...stats(scout), movement: 4, battleClass: "SCOUT", fusionRank: 3 },
    });
    const openingMoves = moves(b, scout).length;
    b.round = 2;
    expect(openingMoves).toBeGreaterThan(moves(b, scout).length);
  });
  it("applies rank three healer pulse and battery resonance refund", () => {
    let b = createBattle();
    const healer = b.units[0];
    const ally = b.units[1];
    Object.assign(healer, {
      x: 4,
      y: 4,
      profile: { ...stats(healer), hp: 40, battleClass: "HEALER", fusionRank: 3 },
    });
    Object.assign(ally, {
      x: 4,
      y: 5,
      hp: 10,
      profile: { ...stats(ally), hp: 30 },
    });
    b = resolve(b);
    expect(b.units.find((unit) => unit.id === ally.id)!.hp).toBe(14);

    b = createBattle();
    const battery = b.units[0];
    const target = b.units[3];
    Object.assign(battery, {
      x: 4,
      y: 4,
      profile: { ...stats(battery), battleClass: "BATTERY", fusionRank: 3 },
      abilities: [
        {
          key: "testZap",
          cost: 3,
          cooldown: 1,
          target: "enemy",
          radius: 0,
          rangeBonus: 0,
          range: 3,
          effects: [{ type: "damage", power: { stat: "attack", factor: 1 } }],
        },
      ],
    });
    Object.assign(target, { x: 4, y: 5 });
    b.energy.player = 3;
    b = resolveRound(b, [
      { unitId: battery.id, type: "skill", abilityId: "testZap", targetId: target.id },
    ], []).at(-1)!.battle;
    expect(b.energy.player).toBe(2);
  });
  it("applies higher-rank battery discounts, captor flags and finisher momentum", () => {
    let b = createBattle();
    const battery = b.units[0];
    const target = b.units[3];
    Object.assign(battery, {
      x: 4,
      y: 4,
      profile: { ...stats(battery), battleClass: "BATTERY", fusionRank: 4 },
      abilities: [
        {
          key: "testZap",
          cost: 4,
          cooldown: 1,
          target: "enemy",
          radius: 0,
          rangeBonus: 0,
          range: 3,
          effects: [{ type: "damage", power: { stat: "attack", factor: 1 } }],
        },
      ],
    });
    Object.assign(target, { x: 4, y: 5 });
    b.energy.player = 4;
    b = resolveRound(b, [
      { unitId: battery.id, type: "skill", abilityId: "testZap", targetId: target.id },
    ], []).at(-1)!.battle;
    expect(b.energy.player).toBe(3);

    b = createBattle();
    const captor = b.units[0];
    Object.assign(captor, {
      x: 4,
      y: 4,
      profile: { ...stats(captor), battleClass: "CAPTOR", fusionRank: 5 },
    });
    b = resolve(b);
    expect(b.pointFlags?.player[1]).toBe(true);
    expect(b.units.filter((unit) => unit.side === "player").some((unit) =>
      unit.effects.some((effect) => effect.abilityId === "resonance-captor-rush"),
    )).toBe(true);

    b = createBattle();
    const finisher = b.units[0];
    const victim = b.units[3];
    Object.assign(finisher, {
      x: 4,
      y: 4,
      profile: { ...stats(finisher), attack: 20, battleClass: "FINISHER", fusionRank: 5 },
    });
    Object.assign(victim, { x: 4, y: 5, hp: 1 });
    b = resolveRound(b, [
      { unitId: finisher.id, type: "attack", targetId: victim.id },
    ], []).at(-1)!.battle;
    expect(b.energy.player).toBe(3);
    expect(b.units.find((unit) => unit.id === finisher.id)!.effects.some(
      (effect) => effect.abilityId === "resonance-finisher-momentum",
    )).toBe(true);
  });
  it("applies higher-rank guardian redirect and healer revive", () => {
    let b = createBattle();
    const ally = b.units[0];
    const guardian = b.units[1];
    const enemy = b.units[3];
    Object.assign(ally, { x: 4, y: 4, hp: 12, profile: { ...stats(ally), hp: 30 } });
    Object.assign(guardian, {
      x: 4,
      y: 5,
      profile: { ...stats(guardian), hp: 40, battleClass: "GUARDIAN", fusionRank: 5 },
    });
    Object.assign(enemy, {
      x: 4,
      y: 3,
      profile: { ...stats(enemy), attack: 20, element: stats(ally).element },
    });
    b = resolveRound(b, [], [
      { unitId: enemy.id, type: "attack", targetId: ally.id },
    ]).at(-1)!.battle;
    expect(b.units.find((unit) => unit.id === ally.id)!.hp).toBeGreaterThan(0);
    expect(b.units.find((unit) => unit.id === guardian.id)!.hp).toBeLessThan(40);

    b = createBattle();
    const healer = b.units[0];
    const fallen = b.units[1];
    const target = b.units[2];
    Object.assign(healer, {
      x: 4,
      y: 4,
      profile: { ...stats(healer), hp: 40, battleClass: "HEALER", fusionRank: 5 },
      abilities: [
        {
          key: "testHeal",
          cost: 0,
          cooldown: 1,
          target: "ally",
          radius: 1,
          rangeBonus: 0,
          range: 3,
          effects: [{ type: "heal", power: { stat: "hp", factor: 0.1 } }],
        },
      ],
    });
    Object.assign(fallen, { x: 4, y: 5, hp: 0, profile: { ...stats(fallen), hp: 32 } });
    Object.assign(target, { x: 5, y: 5, hp: 10 });
    b = resolveRound(b, [
      { unitId: healer.id, type: "skill", abilityId: "testHeal", targetId: target.id },
    ], []).at(-1)!.battle;
    expect(b.units.find((unit) => unit.id === fallen.id)!.hp).toBe(12);
  });
  it("allows an extra action to resolve a second order from the same fighter", () => {
    const b = createBattle();
    const striker = b.units[0];
    const first = b.units[3];
    const second = b.units[4];
    Object.assign(striker, {
      x: 4,
      y: 4,
      profile: { ...stats(striker), attack: 6, element: stats(first).element },
    });
    Object.assign(first, { x: 4, y: 5, hp: 20, profile: { ...stats(first), hp: 20 } });
    Object.assign(second, { x: 5, y: 4, hp: 20, profile: { ...stats(second), hp: 20, element: stats(first).element } });
    b.actionLimitBonus = { player: 1, bot: 0 };
    const orders: Order[] = [
      { unitId: striker.id, type: "attack", targetId: first.id },
      { unitId: striker.id, type: "attack", targetId: second.id },
    ];
    expect(validateOrders(b, "player", orders)).toBe(true);
    const result = resolveRound(b, orders, []).at(-1)!.battle;
    expect(result.units.find((unit) => unit.id === first.id)!.hp).toBeLessThan(20);
    expect(result.units.find((unit) => unit.id === second.id)!.hp).toBeLessThan(20);
  });
  it("finishes at ten rounds and forbids acting after the result", () => {
    const b = createBattle();
    b.round = 10;
    const result = resolve(b);
    expect(result.winner).toBe("draw");
    expect(validateOrders(result, "player", [])).toBe(false);
  });
  it("AI produces legal actions and respects limits throughout a full match", () => {
    let b = createBattle();
    for (let i = 0; i < 10 && !b.winner; i++) {
      const p = planAI(b, "player"),
        ai = planAI(b);
      expect(validateOrders(b, "player", p.orders, p.bonus)).toBe(true);
      expect(validateOrders(b, "bot", ai.orders, ai.bonus)).toBe(true);
      b = resolveRound(b, p.orders, ai.orders, p.bonus, ai.bonus).at(
        -1,
      )!.battle;
      for (const side of ["player", "bot"] as const) {
        expect(b.points[side].every((n) => n <= POINT_CAP)).toBe(true);
        expect(b.energy[side]).toBeGreaterThanOrEqual(0);
      }
      expect(new Set(alive(b).map((u) => `${u.x}:${u.y}`)).size).toBe(
        alive(b).length,
      );
    }
    expect(b.winner).not.toBeNull();
  });
  it("keeps mirrored AI teams symmetrical every round", () => {
    let b = createBattle();
    for (let i = 0; i < 10 && !b.winner; i++) {
      const p = planAI(b, "player"),
        ai = planAI(b);
      b = resolveRound(b, p.orders, ai.orders, p.bonus, ai.bonus).at(
        -1,
      )!.battle;
      for (const u of b.units.filter((u) => u.side === "player")) {
        const opposite = b.units.find(
          (e) => e.side === "bot" && e.kind === u.kind,
        )!;
        expect([u.hp, u.x, u.y]).toEqual([
          opposite.hp,
          8 - opposite.x,
          8 - opposite.y,
        ]);
      }
      expect(b.score.player).toBe(b.score.bot);
      expect(b.energy.player).toBe(b.energy.bot);
    }
    expect(b.winner).toBe("draw");
  });
});
