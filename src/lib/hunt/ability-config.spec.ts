import { parseAbilityConfig, parseAbilityEdit } from "./ability-config";
import {
  createBattle,
  resolveRound,
  previewOrder,
  canUseSkill,
  type Ability,
} from "./tactics";

const config = () => ({
  cost: 3,
  cooldown: 2,
  target: "enemy",
  radius: 0,
  rangeBonus: 1,
  effects: [
    { type: "lifesteal", power: { stat: "attack", factor: 1 }, ratio: 0.5 },
  ],
});
function setup() {
  const b = createBattle();
  b.energy.player = 10;
  Object.assign(b.units[0], {
    x: 0,
    y: 3,
    hp: 10,
    abilities: [{ key: "drain", ...parseAbilityConfig(config()) }],
  });
  Object.assign(b.units[3], { x: 0, y: 4 });
  return b;
}
const order = {
  unitId: "player-0",
  type: "skill" as const,
  abilityId: "drain",
  targetId: "bot-0",
};
describe("Editable ability framework", () => {
  it.each([
    { cost: -1 },
    { cooldown: 1.5 },
    { radius: 20 },
    { maxTargets: 0 },
    { target: "everybody" },
    { unimplemented: true },
    { effects: [] },
    { range: -1 },
    { lineOfSight: "false" },
    {
      effects: [
        { type: "lifesteal", power: { stat: "attack", factor: 1 }, ratio: 1.1 },
      ],
    },
    { effects: [{ type: "damage", power: { stat: "attack", factor: NaN } }] },
    {
      effects: [
        {
          type: "damage",
          enabled: false,
          power: { stat: "attack", factor: 1 },
        },
      ],
    },
  ])("rejects invalid configuration %j", (patch) => {
    expect(() => parseAbilityConfig({ ...config(), ...patch })).toThrow();
  });
  it("normalizes configuration idempotently and rejects unsupported schema versions", () => {
    const parsed = parseAbilityConfig(config());
    expect(parseAbilityConfig(parsed)).toEqual(parsed);
    expect(() => parseAbilityEdit({ schemaVersion: 2 })).toThrow();
  });
  it("life steal heals from actual HP loss, not shield damage or overkill", () => {
    const b = setup();
    b.units[3].hp = 2;
    b.units[3].shield = 3;
    const end = resolveRound(b, [order], [], null, null, () => 0.99).at(
      -1,
    )!.battle;
    expect(end.units[0].hp).toBe(11);
    expect(end.statistics["player-0"].damage).toBe(2);
    expect(end.statistics["player-0"].healing).toBe(1);
  });
  it("fully absorbed life steal does not heal", () => {
    const b = setup();
    b.units[3].shield = 100;
    expect(
      resolveRound(b, [order], [], null, null, () => 0).at(-1)!.battle.units[0]
        .hp,
    ).toBe(10);
  });
  it("life steal cannot revive a caster killed at the same initiative", () => {
    const b = setup();
    b.units[0].hp = 1;
    const end = resolveRound(
      b,
      [order],
      [{ unitId: "bot-0", type: "attack", targetId: "player-0" }],
      null,
      null,
      () => 0.99,
    ).at(-1)!.battle;
    expect(end.units[0].hp).toBe(0);
    expect(end.statistics["player-0"].healing).toBe(0);
  });
  it("applies poison healing reduction and caps healing at max HP", () => {
    const b = setup();
    b.units[0].effects.push({
      type: "poison",
      amount: 0,
      sourceId: "bot-0",
      abilityId: "poison",
      starts: 1,
      expires: 3,
      healingReduction: 1,
    });
    expect(
      resolveRound(b, [order], [], null, null, () => 0.99).at(-1)!.battle
        .units[0].hp,
    ).toBe(10);
    expect(
      resolveRound(b, [order], [], null, null, () => 0.99).at(-1)!.battle
        .statistics["player-0"].healing,
    ).toBe(0);
    b.units[0].effects = [];
    b.units[0].hp = 29;
    expect(
      resolveRound(b, [order], [], null, null, () => 0.99).at(-1)!.battle
        .units[0].hp,
    ).toBe(30);
  });
  it("reads custom loadout, fixed range, disabled effects, noncritical damage and target limits", () => {
    const b = setup();
    const custom: Ability = {
      key: "drain",
      ...parseAbilityConfig({
        ...config(),
        range: 4,
        radius: 2,
        maxTargets: 1,
        effects: [
          {
            type: "damage",
            canCrit: false,
            ignoreCover: true,
            power: { stat: "attack", factor: 1, flat: 2 },
          },
          {
            type: "burn",
            enabled: false,
            power: { stat: "attack", factor: 1 },
            duration: 2,
          },
        ],
      }),
    };
    b.units[0].abilities = [custom];
    expect(canUseSkill(b, b.units[0], order)).toBe(true);
    const preview = previewOrder(b, order);
    expect(preview.hits).toHaveLength(1);
    expect(preview.hits![0].chance).toBe(0);
    const frames = resolveRound(b, [order], [], null, null, () => 0);
    expect(frames.at(-1)!.battle.units[3].effects).toEqual([]);
    expect(
      frames.flatMap((f) => f.events).find((e) => e.type === "attack")
        ?.critical,
    ).toBe(false);
    custom.enabled = false;
    expect(canUseSkill(b, b.units[0], order)).toBe(false);
  });
  it("persistent shields expire on their configured turn", () => {
    let b = setup();
    b.units[0].abilities = [
      {
        key: "drain",
        cost: 1,
        cooldown: 0,
        target: "self",
        radius: 0,
        rangeBonus: 0,
        effects: [
          { type: "shield", duration: 1, power: { stat: "hp", factor: 0.4 } },
        ],
      },
    ];
    b = resolveRound(
      b,
      [{ ...order, targetId: "player-0" }],
      [],
      null,
      null,
      () => 0.99,
    ).at(-1)!.battle;
    expect(b.units[0].shield).toBe(12);
    b = resolveRound(b, [], [], null, null, () => 0.99).at(-1)!.battle;
    expect(b.units[0].shield).toBe(0);
  });
  it("composite hits share shields consistently regardless of effect order", () => {
    const b = setup();
    b.units[3].shield = 9;
    b.units[0].abilities![0].effects = [
      { type: "damage", power: { stat: "attack", factor: 1 }, canCrit: false },
      {
        type: "lifesteal",
        power: { stat: "attack", factor: 1 },
        canCrit: false,
        ratio: 0.5,
      },
    ];
    expect(previewOrder(b, order).damage).toBe(9);
    expect(previewOrder(b, order).heal).toBe(2);
    const end = resolveRound(b, [order], [], null, null, () => 0).at(
      -1,
    )!.battle;
    expect(end.units[0].hp).toBe(12);
    b.units[0].abilities![0].effects.reverse();
    expect(
      resolveRound(b, [order], [], null, null, () => 0).at(-1)!.battle
        .statistics,
    ).toEqual(end.statistics);
  });
  it("weaker shields do not prolong a stronger shield", () => {
    const b = setup();
    b.units[0].shield = 20;
    b.units[0].shieldExpires = 1;
    b.units[0].abilities![0] = {
      key: "drain",
      cost: 1,
      cooldown: 0,
      target: "self",
      radius: 0,
      rangeBonus: 0,
      effects: [
        { type: "shield", power: { stat: "hp", factor: 0.1 }, duration: 4 },
      ],
    };
    expect(
      resolveRound(
        b,
        [{ ...order, targetId: "player-0" }],
        [],
        null,
        null,
        () => 0.99,
      ).at(-1)!.battle.units[0].shield,
    ).toBe(0);
  });
});
