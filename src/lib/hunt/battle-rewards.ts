import type { Side } from "./tactics";

export const HUNT_TROPHY_SEASON_DAYS = 60;
export const HUNT_DAILY_BATTLE_REWARD_CAP = 300;
export const HUNT_BATTLE_WIN_REWARD = 45;
export const HUNT_BATTLE_LOSS_REWARD = 18;
export const HUNT_BATTLE_DRAW_REWARD = 26;
export const HUNT_BATTLE_WIN_TROPHIES = 24;
export const HUNT_BATTLE_LOSS_TROPHIES = -12;
export const HUNT_BATTLE_DRAW_TROPHIES = 4;

export function battleRewardFor(
  winner: Side | "draw" | null,
  side: Side,
  dailyRemaining: number,
) {
  if (!winner) return { currency: 0, trophies: 0 };
  const desired =
    winner === "draw"
      ? HUNT_BATTLE_DRAW_REWARD
      : winner === side
        ? HUNT_BATTLE_WIN_REWARD
        : HUNT_BATTLE_LOSS_REWARD;
  const trophies =
    winner === "draw"
      ? HUNT_BATTLE_DRAW_TROPHIES
      : winner === side
        ? HUNT_BATTLE_WIN_TROPHIES
        : HUNT_BATTLE_LOSS_TROPHIES;
  return {
    currency: Math.max(0, Math.min(desired, dailyRemaining)),
    trophies,
  };
}

export function shouldResetTrophySeason(
  seasonStartedAt: Date | string | null | undefined,
  now = new Date(),
) {
  if (!seasonStartedAt) return true;
  const started =
    seasonStartedAt instanceof Date ? seasonStartedAt : new Date(seasonStartedAt);
  return (
    Number.isNaN(started.getTime()) ||
    now.getTime() - started.getTime() >= HUNT_TROPHY_SEASON_DAYS * 86400000
  );
}

export function matchmakingWindow(power: number, waitedMs: number) {
  const base = Math.max(60, Math.round(power * 0.16));
  const expansion = Math.floor(waitedMs / 5000) * Math.max(20, power * 0.04);
  return Math.round(base + expansion);
}

export function isBalancedMatch(leftPower: number, rightPower: number, waitedMs = 0) {
  const strongest = Math.max(leftPower, rightPower, 1);
  const weakest = Math.min(leftPower, rightPower);
  if (weakest / strongest < 0.68) return false;
  return Math.abs(leftPower - rightPower) <= matchmakingWindow(strongest, waitedMs);
}
