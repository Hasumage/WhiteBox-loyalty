import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { estimateOwnedTeamPower, loadBattleContent } from "./battle-content";
import {
  HUNT_DAILY_BATTLE_REWARD_CAP,
  battleRewardFor,
  isBalancedMatch,
  shouldResetTrophySeason,
} from "./battle-rewards";
import {
  createBattle,
  planAI,
  resolveRound,
  validateOrders,
  type Battle,
  type Bonus,
  type Frame,
  type Order,
  type Side,
} from "./tactics";

const MATCH_TTL_MS = 2 * 60 * 60 * 1000;
const TURN_TTL_MS = 5 * 60 * 1000;
const MATCHMAKING_BOT_MIN_MS = 20 * 1000;
const MATCHMAKING_BOT_SPREAD_MS = 10 * 1000;
const secret = process.env.JWT_SECRET || "hunt-local-battle-secret";
const BOT_NAMES = [
  "Мира Спот",
  "Ночной Куратор",
  "Карта Лиса",
  "Районный Гость",
  "Северный Сосед",
  "Тихий Игрок",
  "Неон Визитор",
  "Парк Раннер",
];

export type BattleRewardResult = {
  currency: number;
  trophies: number;
  dailyCap: number;
};

function expires(ms: number) {
  return new Date(Date.now() + ms);
}

function json<T>(value: T) {
  return JSON.parse(JSON.stringify(value));
}

function matchmakingBotDeadline() {
  return expires(
    MATCHMAKING_BOT_MIN_MS +
      (randomBytes(1)[0] / 255) * MATCHMAKING_BOT_SPREAD_MS,
  );
}

function botName(seed: string) {
  const index =
    [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) %
    BOT_NAMES.length;
  return BOT_NAMES[index];
}

function rollFor(matchSeed: string) {
  return (attacker: { id: string }, target: { id: string }, turn: number) =>
    createHmac("sha256", secret)
      .update(`hunt-crit-v2:${matchSeed}:${turn}:${attacker.id}:${target.id}`)
      .digest()
      .readUInt32BE(0) / 4294967296;
}

function parseBattle(value: unknown): Battle {
  if (!value || typeof value !== "object") throw new Error("INVALID_SESSION");
  return value as Battle;
}

function makeBattleCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "NH-";
  for (let index = 0; index < 4; index += 1) {
    code += alphabet[randomBytes(1)[0] % alphabet.length];
  }
  return code;
}

function readPending(value: unknown) {
  if (!value || typeof value !== "object") return {};
  return value as Partial<
    Record<Side, { orders: Order[]; bonus?: Bonus | null; submittedAt: string }>
  >;
}

function controlledSide(match: {
  ownerId: number | null;
  opponentUserId: number | null;
}, userId: number): Side {
  if (match.ownerId === userId) return "player";
  if (match.opponentUserId === userId) return "bot";
  throw new Error("INVALID_SESSION");
}

async function assertOwnsTeam(userId: number, teamUuids: string[]) {
  if (
    teamUuids.length !== 3 ||
    new Set(teamUuids).size !== 3 ||
    teamUuids.some((id) => typeof id !== "string" || id.length > 120)
  )
    throw new Error("INVALID_TEAM");
  const owned = await prisma.huntCard.count({
    where: { ownerId: userId, uuid: { in: teamUuids } },
  });
  if (owned !== 3) throw new Error("INVALID_TEAM");
}

async function dailyBattleAwarded(
  tx: Prisma.TransactionClient,
  userId: number,
) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const result = await tx.huntCurrencyLedger.aggregate({
    where: {
      userId,
      reason: "BATTLE_REWARD",
      createdAt: { gte: start },
    },
    _sum: { amount: true },
  });
  return Math.max(0, result._sum.amount ?? 0);
}

async function addBattleReward(
  tx: Prisma.TransactionClient,
  userId: number,
  sourceId: string,
  winner: Side | "draw" | null,
  side: Side,
) {
  const current = await tx.huntPlayerProfile.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
  const resetSeason = shouldResetTrophySeason(
    current.huntTrophySeasonStartedAt,
  );
  const baselineTrophies = resetSeason ? 0 : current.huntTrophies;
  const awardedToday = await dailyBattleAwarded(tx, userId);
  const reward = battleRewardFor(
    winner,
    side,
    HUNT_DAILY_BATTLE_REWARD_CAP - awardedToday,
  );
  const nextBalance = current.influenceBalance + reward.currency;
  const nextTrophies = Math.max(0, baselineTrophies + reward.trophies);
  await tx.huntPlayerProfile.update({
    where: { userId },
    data: {
      influenceBalance: nextBalance,
      lifetimeInfluence:
        reward.currency > 0 ? { increment: reward.currency } : undefined,
      huntTrophies: nextTrophies,
      huntLifetimeTrophies:
        reward.trophies > 0 ? { increment: reward.trophies } : undefined,
      huntTrophySeasonStartedAt: resetSeason ? new Date() : undefined,
    },
  });
  if (reward.currency > 0) {
    await tx.huntCurrencyLedger.create({
      data: {
        userId,
        amount: reward.currency,
        reason: "BATTLE_REWARD",
        sourceType: "battle_match",
        sourceId,
        balanceAfter: nextBalance,
        metadata: { winner, side, trophies: reward.trophies },
      },
    });
  }
  return { ...reward, dailyCap: HUNT_DAILY_BATTLE_REWARD_CAP };
}

async function settleRewards(matchId: string, battle: Battle) {
  if (!battle.winner) return {};
  return prisma.$transaction(async (tx) => {
    const rewards: Partial<Record<Side, BattleRewardResult>> = {};
    const match = await tx.huntBattleMatch.findUnique({
      where: { id: matchId },
    });
    if (!match || !["PVP_RANDOM", "PVP_PRIVATE"].includes(match.mode))
      return rewards;
    const data: Prisma.HuntBattleMatchUpdateInput = {};
    if (match.ownerId && !match.ownerRewardedAt) {
      const reward = await addBattleReward(
        tx,
        match.ownerId,
        match.uuid,
        battle.winner,
        "player",
      );
      data.ownerRewardedAt = new Date();
      data.ownerTrophyDelta = reward.trophies;
      rewards.player = reward;
    }
    if (match.opponentUserId && !match.opponentRewardedAt) {
      const reward = await addBattleReward(
        tx,
        match.opponentUserId,
        match.uuid,
        battle.winner,
        "bot",
      );
      data.opponentRewardedAt = new Date();
      data.opponentTrophyDelta = reward.trophies;
      rewards.bot = reward;
    }
    if (Object.keys(data).length) {
      await tx.huntBattleMatch.update({ where: { id: match.id }, data });
    }
    return rewards;
  });
}

export async function createTrainingMatch(options: {
  userId?: number;
  teamUuids?: string[];
  tutorialCardUuid?: string;
  tutorialTeamUuids?: string[];
  previewSpeciesId?: string;
}) {
  const seed = randomBytes(18).toString("base64url");
  const battle = await loadBattleContent({
    userId: options.userId,
    teamUuids: options.teamUuids,
    tutorialCardUuid: options.tutorialCardUuid,
    tutorialTeamUuids: options.tutorialTeamUuids,
    speciesIds: options.previewSpeciesId
      ? Array(3).fill(options.previewSpeciesId)
      : undefined,
    randomTrainingBot: !options.previewSpeciesId,
    seed,
    botPowerRatio: 0.92,
  });
  const botSpeciesIds = battle.units
    .filter((unit) => unit.side === "bot")
    .map((unit) => unit.profile?.speciesId)
    .filter((id): id is string => Boolean(id));
  const match = await prisma.huntBattleMatch.create({
    data: {
      mode: "TRAINING",
      status: "ACTIVE",
      ownerId: options.userId,
      ownerTeamUuids: options.teamUuids ?? [],
      botSpeciesIds,
      battleState: json(battle),
      lastFrames: [],
      seed,
      turnDeadlineAt: expires(TURN_TTL_MS),
      expiresAt: expires(MATCH_TTL_MS),
    },
  });
  return { matchId: match.uuid, battle, frames: [] as Frame[] };
}

export async function readTrainingMatch(matchId: string, userId?: number) {
  const match = await prisma.huntBattleMatch.findUnique({
    where: { uuid: matchId },
  });
  if (!match || match.mode !== "TRAINING") throw new Error("INVALID_SESSION");
  if (match.ownerId && match.ownerId !== userId) throw new Error("INVALID_SESSION");
  if (match.expiresAt.getTime() < Date.now()) {
    await prisma.huntBattleMatch.update({
      where: { id: match.id },
      data: { status: "EXPIRED" },
    });
    throw new Error("INVALID_SESSION");
  }
  return {
    matchId: match.uuid,
    battle: parseBattle(match.battleState),
    frames: (match.lastFrames as Frame[] | null) ?? [],
    status: match.status,
  };
}

export async function commitTrainingTurn(options: {
  matchId: string;
  userId?: number;
  orders: Order[];
  bonus?: Bonus | null;
}) {
  if (options.bonus != null) throw new Error("INVALID_ORDERS");
  const match = await prisma.huntBattleMatch.findUnique({
    where: { uuid: options.matchId },
  });
  if (!match || match.mode !== "TRAINING") throw new Error("INVALID_SESSION");
  if (match.ownerId && match.ownerId !== options.userId)
    throw new Error("INVALID_SESSION");
  if (match.status !== "ACTIVE" || match.expiresAt.getTime() < Date.now())
    throw new Error("INVALID_SESSION");
  const battle = parseBattle(match.battleState);
  if (!validateOrders(battle, "player", options.orders, options.bonus))
    throw new Error("INVALID_ORDERS");
  const ai = planAI(battle);
  const frames = resolveRound(
    battle,
    options.orders,
    ai.orders,
    options.bonus,
    ai.bonus,
    rollFor(match.seed),
  );
  const next = frames.at(-1)?.battle ?? battle;
  const status = next.winner ? "FINISHED" : "ACTIVE";
  await prisma.huntBattleMatch.update({
    where: { id: match.id },
    data: {
      status,
      battleState: json(next),
      lastFrames: json(frames),
      pendingOrders: Prisma.JsonNull,
      turnNumber: next.round,
      turnDeadlineAt: status === "ACTIVE" ? expires(TURN_TTL_MS) : null,
      finishedAt: status === "FINISHED" ? new Date() : null,
    },
  });
  return { matchId: match.uuid, battle: next, frames };
}

export async function createPrivateMatch(options: {
  userId: number;
  teamUuids: string[];
}) {
  await assertOwnsTeam(options.userId, options.teamUuids);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const match = await prisma.huntBattleMatch.create({
        data: {
          mode: "PVP_PRIVATE",
          status: "WAITING",
          ownerId: options.userId,
          code: makeBattleCode(),
          ownerTeamUuids: options.teamUuids,
          ownerPower: await estimateOwnedTeamPower(options.userId, options.teamUuids),
          battleState: json(createBattle()),
          lastFrames: [],
          seed: randomBytes(18).toString("base64url"),
          turnDeadlineAt: expires(TURN_TTL_MS),
          expiresAt: expires(10 * 60 * 1000),
        },
      });
      return {
        matchId: match.uuid,
        code: match.code!,
        status: match.status,
        controlledSide: "player" as Side,
        battle: parseBattle(match.battleState),
        frames: [] as Frame[],
      };
    } catch (error) {
      if (attempt === 7) throw error;
    }
  }
  throw new Error("SERVER_ERROR");
}

export async function createOrJoinRandomMatch(options: {
  userId: number;
  teamUuids: string[];
}) {
  const power = await estimateOwnedTeamPower(options.userId, options.teamUuids);
  const waiting = await prisma.huntBattleMatch.findMany({
    where: {
      mode: "PVP_RANDOM",
      status: "WAITING",
      ownerId: { not: options.userId },
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  const candidate = waiting.find((match) =>
    isBalancedMatch(
      match.ownerPower,
      power,
      Date.now() - match.createdAt.getTime(),
    ),
  );
  if (candidate?.ownerId) {
    const battle = await loadBattleContent({
      userId: candidate.ownerId,
      teamUuids: candidate.ownerTeamUuids,
      opponentUserId: options.userId,
      opponentTeamUuids: options.teamUuids,
    });
    const claimed = await prisma.huntBattleMatch.updateMany({
      where: { id: candidate.id, status: "WAITING" },
      data: {
        status: "ACTIVE",
        opponentUserId: options.userId,
        opponentTeamUuids: options.teamUuids,
        opponentPower: power,
        battleState: json(battle),
        pendingOrders: Prisma.JsonNull,
        lastFrames: [],
        matchedAt: new Date(),
        expiresAt: expires(MATCH_TTL_MS),
        turnDeadlineAt: expires(TURN_TTL_MS),
      },
    });
    if (claimed.count === 1) {
      const updated = await prisma.huntBattleMatch.findUniqueOrThrow({
        where: { id: candidate.id },
      });
      return {
        matchId: updated.uuid,
        status: updated.status,
        mode: updated.mode,
        controlledSide: "bot" as Side,
        battle,
        frames: [] as Frame[],
        waitingForOpponent: false,
        botDisplayName: null,
      };
    }
  }
  const seed = randomBytes(18).toString("base64url");
  const match = await prisma.huntBattleMatch.create({
    data: {
      mode: "PVP_RANDOM",
      status: "WAITING",
      ownerId: options.userId,
      ownerTeamUuids: options.teamUuids,
      ownerPower: power,
      battleState: json(createBattle()),
      lastFrames: [],
      seed,
      turnDeadlineAt: matchmakingBotDeadline(),
      expiresAt: expires(MATCH_TTL_MS),
    },
  });
  return {
    matchId: match.uuid,
    status: match.status,
    mode: match.mode,
    controlledSide: "player" as Side,
    battle: parseBattle(match.battleState),
    frames: [] as Frame[],
    waitingForOpponent: true,
    botDisplayName: null,
  };
}

async function maybeFillRandomBot(match: {
  id: string;
  uuid: string;
  mode: string;
  status: string;
  ownerId: number | null;
  ownerTeamUuids: string[];
  turnDeadlineAt: Date | null;
  seed: string;
  botDisplayName: string | null;
}) {
  if (
    match.mode !== "PVP_RANDOM" ||
    match.status !== "WAITING" ||
    !match.ownerId ||
    !match.turnDeadlineAt ||
    match.turnDeadlineAt.getTime() > Date.now()
  )
    return null;
  const battle = await loadBattleContent({
    userId: match.ownerId,
    teamUuids: match.ownerTeamUuids,
    randomTrainingBot: true,
    seed: match.seed,
    botPowerRatio: 0.94,
  });
  const displayName = botName(match.seed);
  for (const unit of battle.units.filter((unit) => unit.side === "bot")) {
    unit.profile = {
      ...unit.profile!,
      nameRu: unit.profile?.nameRu,
      nameEn: unit.profile?.nameEn,
    };
  }
  const updated = await prisma.huntBattleMatch.update({
    where: { id: match.id },
    data: {
      status: "ACTIVE",
      botDisplayName: displayName,
      botSpeciesIds: battle.units
        .filter((unit) => unit.side === "bot")
        .map((unit) => unit.profile?.speciesId)
        .filter((id): id is string => Boolean(id)),
      battleState: json(battle),
      pendingOrders: Prisma.JsonNull,
      lastFrames: [],
      matchedAt: new Date(),
      turnDeadlineAt: expires(TURN_TTL_MS),
    },
  });
  return { updated, battle, displayName };
}

export async function joinPrivateMatch(options: {
  userId: number;
  code: string;
  teamUuids: string[];
}) {
  await assertOwnsTeam(options.userId, options.teamUuids);
  const normalizedCode = options.code.trim().toUpperCase();
  const match = await prisma.huntBattleMatch.findUnique({
    where: { code: normalizedCode.startsWith("NH-") ? normalizedCode : `NH-${normalizedCode}` },
  });
  if (!match || match.mode !== "PVP_PRIVATE") throw new Error("INVALID_SESSION");
  if (match.status !== "WAITING" || match.expiresAt.getTime() < Date.now())
    throw new Error("INVALID_SESSION");
  if (!match.ownerId || match.ownerId === options.userId)
    throw new Error("INVALID_TEAM");
  const battle = await loadBattleContent({
    userId: match.ownerId,
    teamUuids: match.ownerTeamUuids,
    opponentUserId: options.userId,
    opponentTeamUuids: options.teamUuids,
  });
  const claimed = await prisma.huntBattleMatch.updateMany({
    where: { id: match.id, status: "WAITING" },
    data: {
      status: "ACTIVE",
      opponentUserId: options.userId,
      opponentTeamUuids: options.teamUuids,
      battleState: json(battle),
      lastFrames: [],
      pendingOrders: Prisma.JsonNull,
      expiresAt: expires(MATCH_TTL_MS),
      turnDeadlineAt: expires(TURN_TTL_MS),
    },
  });
  if (claimed.count !== 1) throw new Error("INVALID_SESSION");
  const updated = await prisma.huntBattleMatch.findUniqueOrThrow({
    where: { id: match.id },
  });
  return {
    matchId: updated.uuid,
    code: updated.code,
    status: updated.status,
    controlledSide: "bot" as Side,
    battle,
    frames: [] as Frame[],
  };
}

export async function readMatchForUser(matchId: string, userId: number) {
  let match = await prisma.huntBattleMatch.findUnique({
    where: { uuid: matchId },
  });
  if (!match) throw new Error("INVALID_SESSION");
  const filled = await maybeFillRandomBot(match);
  if (filled) {
    match = filled.updated;
  }
  const side = controlledSide(match, userId);
  if (match.expiresAt.getTime() < Date.now()) {
    await prisma.huntBattleMatch.update({
      where: { id: match.id },
      data: { status: "EXPIRED" },
    });
    throw new Error("INVALID_SESSION");
  }
  return {
    matchId: match.uuid,
    code: match.code,
    status: match.status,
    mode: match.mode,
    controlledSide: side,
    battle: filled?.battle ?? parseBattle(match.battleState),
    frames: (match.lastFrames as Frame[] | null) ?? [],
    pendingSides: Object.keys(readPending(match.pendingOrders)),
    botDisplayName: match.botDisplayName,
  };
}

export async function cancelWaitingMatch(options: {
  matchId: string;
  userId: number;
}) {
  const match = await prisma.huntBattleMatch.findUnique({
    where: { uuid: options.matchId },
  });
  if (!match) throw new Error("INVALID_SESSION");
  if (match.ownerId !== options.userId || match.status !== "WAITING")
    throw new Error("INVALID_SESSION");
  await prisma.huntBattleMatch.update({
    where: { id: match.id },
    data: { status: "CANCELLED", expiresAt: new Date() },
  });
  return { matchId: match.uuid, status: "CANCELLED" as const };
}

export async function submitPvpTurn(options: {
  matchId: string;
  userId: number;
  orders: Order[];
  bonus?: Bonus | null;
}) {
  if (options.bonus != null) throw new Error("INVALID_ORDERS");
  const match = await prisma.huntBattleMatch.findUnique({
    where: { uuid: options.matchId },
  });
  if (!match || !["PVP_PRIVATE", "PVP_RANDOM"].includes(match.mode))
    throw new Error("INVALID_SESSION");
  if (match.status !== "ACTIVE" || match.expiresAt.getTime() < Date.now())
    throw new Error("INVALID_SESSION");
  const side = controlledSide(match, options.userId);
  const battle = parseBattle(match.battleState);
  if (!validateOrders(battle, side, options.orders, options.bonus))
    throw new Error("INVALID_ORDERS");
  if (match.mode === "PVP_RANDOM" && !match.opponentUserId && side === "player") {
    const ai = planAI(battle);
    const frames = resolveRound(
      battle,
      options.orders,
      ai.orders,
      options.bonus,
      ai.bonus,
      rollFor(match.seed),
    );
    const next = frames.at(-1)?.battle ?? battle;
    const status = next.winner ? "FINISHED" : "ACTIVE";
    await prisma.huntBattleMatch.update({
      where: { id: match.id },
      data: {
        status,
        battleState: json(next),
        lastFrames: json(frames),
        pendingOrders: Prisma.JsonNull,
        turnNumber: next.round,
        turnDeadlineAt: status === "ACTIVE" ? expires(TURN_TTL_MS) : null,
        finishedAt: status === "FINISHED" ? new Date() : null,
      },
    });
    const rewards =
      status === "FINISHED" ? await settleRewards(match.id, next) : {};
    return {
      matchId: match.uuid,
      code: match.code,
      status,
      controlledSide: side,
      battle: next,
      frames,
      waitingForOpponent: false,
      pendingSides: [],
      reward: rewards[side],
      botDisplayName: match.botDisplayName,
    };
  }
  const pending = {
    ...readPending(match.pendingOrders),
    [side]: {
      orders: options.orders,
      bonus: options.bonus ?? null,
      submittedAt: new Date().toISOString(),
    },
  };
  if (!pending.player || !pending.bot) {
    await prisma.huntBattleMatch.update({
      where: { id: match.id },
      data: { pendingOrders: json(pending) },
    });
    return {
      matchId: match.uuid,
      code: match.code,
      status: match.status,
      controlledSide: side,
      battle,
      frames: [] as Frame[],
      waitingForOpponent: true,
      pendingSides: Object.keys(pending),
    };
  }
  const frames = resolveRound(
    battle,
    pending.player.orders,
    pending.bot.orders,
    pending.player.bonus,
    pending.bot.bonus,
    rollFor(match.seed),
  );
  const next = frames.at(-1)?.battle ?? battle;
  const status = next.winner ? "FINISHED" : "ACTIVE";
  await prisma.huntBattleMatch.update({
    where: { id: match.id },
    data: {
      status,
      battleState: json(next),
      lastFrames: json(frames),
      pendingOrders: Prisma.JsonNull,
      turnNumber: next.round,
      turnDeadlineAt: status === "ACTIVE" ? expires(TURN_TTL_MS) : null,
      finishedAt: status === "FINISHED" ? new Date() : null,
    },
  });
  const rewards = status === "FINISHED" ? await settleRewards(match.id, next) : {};
  return {
    matchId: match.uuid,
    code: match.code,
    status,
    controlledSide: side,
    battle: next,
    frames,
    waitingForOpponent: false,
    pendingSides: [],
    reward: rewards[side],
    botDisplayName: match.botDisplayName,
  };
}
