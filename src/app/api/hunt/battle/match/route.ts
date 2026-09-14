import { NextRequest, NextResponse } from "next/server";
import {
  cancelWaitingMatch,
  commitTrainingTurn,
  createPrivateMatch,
  createOrJoinRandomMatch,
  createTrainingMatch,
  joinPrivateMatch,
  readMatchForUser,
  submitPvpTurn,
} from "@/lib/hunt/battle-match";
import type { Battle, Frame, Side } from "@/lib/hunt/tactics";
import {
  requireUserSession,
  isUserAuthResponse,
} from "@/lib/auth/require-user-session";

export const runtime = "nodejs";

type MatchResponse = {
  battle: Battle;
  token: string;
  matchId: string;
  mode?: string;
  status?: string;
  code?: string | null;
  controlledSide: Side;
  frames: Frame[];
  waitingForOpponent?: boolean;
  pendingSides?: string[];
  botDisplayName?: string | null;
  reward?: {
    currency: number;
    trophies: number;
    dailyCap: number;
  };
};

function bad(error = "INVALID_ORDERS", status = 400) {
  return NextResponse.json({ error, message: error }, { status });
}

function teamUuids(value: unknown) {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    value.some((id) => typeof id !== "string" || id.length > 120)
  )
    throw new Error("INVALID_TEAM");
  return value as string[];
}

function optionalUuid(value: unknown) {
  if (typeof value !== "string" || value.length > 120) throw new Error("INVALID_TEAM");
  return value;
}

function tutorialTeamUuids(value: unknown) {
  if (
    !Array.isArray(value) ||
    ![1, 2].includes(value.length) ||
    value.some((id) => typeof id !== "string" || id.length > 120)
  )
    throw new Error("INVALID_TEAM");
  return value as string[];
}

function isReward(value: unknown): value is NonNullable<MatchResponse["reward"]> {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as Record<string, unknown>).currency === "number" &&
    typeof (value as Record<string, unknown>).trophies === "number" &&
    typeof (value as Record<string, unknown>).dailyCap === "number"
  );
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (raw.length > 50000) return bad();
    const body = JSON.parse(raw);
    const session = await requireUserSession(req);
    if (isUserAuthResponse(session)) return session;
    if (body.action === "training") {
      const match = await createTrainingMatch({
        userId: session.userId,
        teamUuids: teamUuids(body.teamUuids),
      });
      return NextResponse.json<MatchResponse>(
        {
          battle: match.battle,
          token: match.matchId,
          matchId: match.matchId,
          mode: "TRAINING",
          status: "ACTIVE",
          controlledSide: "player",
          frames: match.frames,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (body.action === "tutorial_training") {
      const match = await createTrainingMatch({
        userId: session.userId,
        tutorialTeamUuids: Array.isArray(body.teamUuids)
          ? tutorialTeamUuids(body.teamUuids)
          : [optionalUuid(body.cardUuid)],
      });
      return NextResponse.json<MatchResponse>(
        {
          battle: match.battle,
          token: match.matchId,
          matchId: match.matchId,
          mode: "TRAINING",
          status: "ACTIVE",
          controlledSide: "player",
          frames: match.frames,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (body.action === "create_private") {
      const match = await createPrivateMatch({
        userId: session.userId,
        teamUuids: teamUuids(body.teamUuids),
      });
      return NextResponse.json<MatchResponse>(
        {
          battle: match.battle,
          token: match.matchId,
          matchId: match.matchId,
          mode: "PVP_PRIVATE",
          status: match.status,
          code: match.code,
          controlledSide: match.controlledSide,
          frames: match.frames,
          waitingForOpponent: true,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (body.action === "random") {
      const match = await createOrJoinRandomMatch({
        userId: session.userId,
        teamUuids: teamUuids(body.teamUuids),
      });
      return NextResponse.json<MatchResponse>(
        {
          battle: match.battle,
          token: match.matchId,
          matchId: match.matchId,
          mode: "PVP_RANDOM",
          status: match.status,
          controlledSide: match.controlledSide,
          frames: match.frames,
          waitingForOpponent: match.waitingForOpponent,
          botDisplayName: match.botDisplayName,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (body.action === "join_private") {
      if (typeof body.code !== "string") throw new Error("INVALID_SESSION");
      const match = await joinPrivateMatch({
        userId: session.userId,
        code: body.code,
        teamUuids: teamUuids(body.teamUuids),
      });
      return NextResponse.json<MatchResponse>(
        {
          battle: match.battle,
          token: match.matchId,
          matchId: match.matchId,
          mode: "PVP_PRIVATE",
          status: match.status,
          code: match.code,
          controlledSide: match.controlledSide,
          frames: match.frames,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (body.action === "read") {
      if (typeof body.matchId !== "string") throw new Error("INVALID_SESSION");
      const match = await readMatchForUser(body.matchId, session.userId);
      return NextResponse.json<MatchResponse>(
        {
          battle: match.battle,
          token: match.matchId,
          matchId: match.matchId,
          mode: match.mode,
          status: match.status,
          code: match.code,
          controlledSide: match.controlledSide,
          frames: match.frames,
          waitingForOpponent: match.status === "WAITING",
          pendingSides: match.pendingSides,
          botDisplayName: match.botDisplayName,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (body.action === "cancel") {
      if (typeof body.matchId !== "string") throw new Error("INVALID_SESSION");
      const result = await cancelWaitingMatch({
        matchId: body.matchId,
        userId: session.userId,
      });
      return NextResponse.json(
        result,
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (body.action === "turn") {
      if (typeof body.matchId !== "string") throw new Error("INVALID_SESSION");
      const match = await readMatchForUser(body.matchId, session.userId);
      const result =
        match.mode === "TRAINING"
          ? await commitTrainingTurn({
              matchId: body.matchId,
              userId: session.userId,
              orders: body.orders,
              bonus: body.bonus,
            })
          : await submitPvpTurn({
              matchId: body.matchId,
              userId: session.userId,
              orders: body.orders,
              bonus: body.bonus,
            });
      const nextStatus =
        "status" in result && typeof result.status === "string"
          ? result.status
          : match.status;
      const waitingForOpponent =
        "waitingForOpponent" in result
          ? Boolean(result.waitingForOpponent)
          : false;
      const pendingSides =
        "pendingSides" in result && Array.isArray(result.pendingSides)
          ? result.pendingSides
          : undefined;
      const reward =
        "reward" in result && isReward(result.reward)
          ? result.reward
          : undefined;
      const botDisplayName =
        "botDisplayName" in result &&
        (typeof result.botDisplayName === "string" ||
          result.botDisplayName === null)
          ? result.botDisplayName
          : match.botDisplayName;
      return NextResponse.json<MatchResponse>(
        {
          battle: result.battle,
          token: result.matchId,
          matchId: result.matchId,
          mode: match.mode,
          status: nextStatus,
          code: match.code,
          controlledSide: match.controlledSide,
          frames: result.frames,
          waitingForOpponent,
          pendingSides,
          reward,
          botDisplayName,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    return bad();
  } catch (error) {
    if (error instanceof Error && error.message === "CONTENT_NOT_READY")
      return bad("CONTENT_NOT_READY", 503);
    if (
      error instanceof Error &&
      ["INVALID_SESSION", "INVALID_ORDERS", "INVALID_TEAM"].includes(
        error.message,
      )
    )
      return bad(error.message);
    console.error("Hunt battle match failed", error);
    return bad("SERVER_ERROR", 500);
  }
}

// Legacy training route still supports admin preview. User-facing clients should
// use this match route so training and PvP share one wire contract.
export async function GET() {
  return bad("METHOD_NOT_ALLOWED", 405);
}
