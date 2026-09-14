import {
  HUNT_DAILY_BATTLE_REWARD_CAP,
  battleRewardFor,
  isBalancedMatch,
  matchmakingWindow,
  shouldResetTrophySeason,
} from "./battle-rewards";

describe("Hunt battle rewards and matchmaking", () => {
  it("rejects hopeless power gaps even after waiting", () => {
    expect(isBalancedMatch(1000, 660, 30000)).toBe(false);
    expect(isBalancedMatch(1000, 720, 30000)).toBe(true);
  });

  it("expands the acceptable matchmaking window over time", () => {
    expect(matchmakingWindow(900, 0)).toBeLessThan(matchmakingWindow(900, 25000));
  });

  it("caps daily battle currency but still awards trophies", () => {
    expect(battleRewardFor("player", "player", 12)).toEqual({
      currency: 12,
      trophies: 24,
    });
    expect(battleRewardFor("bot", "player", HUNT_DAILY_BATTLE_REWARD_CAP)).toEqual({
      currency: 18,
      trophies: -12,
    });
  });

  it("resets trophy seasons after 60 days", () => {
    expect(
      shouldResetTrophySeason("2026-01-01T00:00:00.000Z", new Date("2026-03-02T00:00:00.000Z")),
    ).toBe(true);
    expect(
      shouldResetTrophySeason("2026-01-02T00:00:00.000Z", new Date("2026-03-02T00:00:00.000Z")),
    ).toBe(false);
  });
});
