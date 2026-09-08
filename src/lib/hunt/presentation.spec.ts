import { createBattle, resolveRound } from "./tactics";
import { cameraForEvents, effectTiming } from "./presentation";

describe("Battle presentation and server totals", () => {
  it("keeps camera inside the map even for actors at opposite edges", () => {
    const b = createBattle();
    for (const [width, height] of [
      [320, 240],
      [430, 540],
    ]) {
      const camera = cameraForEvents(
        b,
        [{ type: "attack", unitId: "player-0", targetId: "bot-0" }],
        width,
        height,
        2,
      )!;
      expect(camera.x).toBeLessThanOrEqual(0);
      expect(camera.y).toBeLessThanOrEqual(0);
      expect(camera.x + 720 * camera.scale).toBeGreaterThanOrEqual(width);
      expect(camera.y + 720 * camera.scale).toBeGreaterThanOrEqual(height);
    }
    expect(cameraForEvents(b, [], 320, 240, 1)).toBeNull();
  });
  it("shows pending and active durations without spending a turn early", () => {
    const u = createBattle().units[0];
    const effect = {
      type: "burn" as const,
      sourceId: u.id,
      abilityId: "ember",
      amount: 3,
      starts: 2,
      expires: 3,
    };
    expect(effectTiming(u, effect)).toEqual({ pending: true, remaining: 2 });
    u.activeTurn = 3;
    expect(effectTiming(u, effect)).toEqual({ pending: false, remaining: 1 });
  });
  it("credits actual damage, not overkill, and counts shield absorption on the defender", () => {
    const b = createBattle();
    Object.assign(b.units[0], { x: 0, y: 3 });
    Object.assign(b.units[3], { x: 0, y: 4, hp: 2, shield: 3 });
    const end = resolveRound(
      b,
      [{ unitId: "player-0", type: "attack", targetId: "bot-0" }],
      [],
      null,
      null,
      () => 0.99,
    ).at(-1)!.battle;
    expect(end.statistics["player-0"].damage).toBe(2);
    expect(end.statistics["bot-0"].absorbed).toBe(3);
    expect(b.statistics["player-0"].damage).toBe(0);
  });
  it("credits only useful healing to its caster and shares control without duplicating team score", () => {
    const b = createBattle();
    b.energy.player = 3;
    Object.assign(b.units[0], { x: 4, y: 4, hp: 29 });
    Object.assign(b.units[2], { x: 4, y: 5 });
    const end = resolveRound(
      b,
      [
        {
          unitId: "player-2",
          type: "skill",
          abilityId: "plantain",
          targetId: "player-0",
        },
      ],
      [],
      null,
      null,
      () => 0.99,
    ).at(-1)!.battle;
    expect(end.statistics["player-2"].healing).toBe(1);
    expect(end.statistics["player-0"].control).toBe(1);
    expect(end.statistics["player-2"].control).toBe(1);
    expect(end.score.player).toBe(2);
    expect(createBattle().statistics["player-2"].healing).toBe(0);
  });
});
