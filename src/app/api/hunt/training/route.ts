import { NextRequest, NextResponse } from "next/server";
import type { Battle, Frame } from "@/lib/hunt/tactics";
import {
  commitTrainingTurn,
  createTrainingMatch,
  readTrainingMatch,
} from "@/lib/hunt/battle-match";
import {
  requireUserSession,
  isUserAuthResponse,
} from "@/lib/auth/require-user-session";
import {
  requireAdminSession,
  isAuthResponse,
} from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";

export const runtime = "nodejs";
type ResponseData = { battle: Battle; token: string; matchId: string; frames: Frame[] };

// Training never grants currency, but the match state is server-authoritative.
export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (raw.length > 50000)
      return NextResponse.json({ error: "INVALID_ORDERS" }, { status: 400 });
    const body = JSON.parse(raw);
    if (body.action === "start") {
      let userId: number | undefined;
      let teamUuids: string[] | undefined;
      let previewSpeciesId: string | undefined;
      if (body.previewSpeciesId !== undefined) {
        const session = await requireAdminSession(req);
        if (isAuthResponse(session)) return session;
        const access = await requireAdminScope(session, "HUNT", "canView");
        if (!access.ok) return access.response;
        if (
          typeof body.previewSpeciesId !== "string" ||
          body.previewSpeciesId.length > 120
        )
          throw new Error("INVALID_TEAM");
        previewSpeciesId = body.previewSpeciesId;
      } else if (body.teamUuids !== undefined) {
        const session = await requireUserSession(req);
        if (isUserAuthResponse(session)) return session;
        if (
          !Array.isArray(body.teamUuids) ||
          body.teamUuids.some(
            (id: unknown) => typeof id !== "string" || id.length > 120,
          )
        )
          throw new Error("INVALID_TEAM");
        userId = session.userId;
        teamUuids = body.teamUuids;
      }
      const match = await createTrainingMatch({
        userId,
        teamUuids,
        previewSpeciesId,
      });
      return NextResponse.json<ResponseData>(
        {
          battle: match.battle,
          token: match.matchId,
          matchId: match.matchId,
          frames: match.frames,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (body.action === "read") {
      const session = await requireUserSession(req);
      const userId = isUserAuthResponse(session) ? undefined : session.userId;
      const matchId = typeof body.matchId === "string" ? body.matchId : body.token;
      const match = await readTrainingMatch(matchId, userId);
      return NextResponse.json<ResponseData>(
        {
          battle: match.battle,
          token: match.matchId,
          matchId: match.matchId,
          frames: match.frames,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (body.action !== "round") throw new Error("INVALID_ORDERS");
    const session = await requireUserSession(req);
    const userId = isUserAuthResponse(session) ? undefined : session.userId;
    const matchId = typeof body.matchId === "string" ? body.matchId : body.token;
    const result = await commitTrainingTurn({
      matchId,
      userId,
      orders: body.orders,
      bonus: body.bonus,
    });
    return NextResponse.json<ResponseData>(
      {
        battle: result.battle,
        token: result.matchId,
        matchId: result.matchId,
        frames: result.frames,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "CONTENT_NOT_READY")
      return NextResponse.json({ error: "CONTENT_NOT_READY" }, { status: 503 });
    if (
      !(error instanceof SyntaxError) &&
      !(
        error instanceof Error &&
        ["INVALID_SESSION", "INVALID_ORDERS", "INVALID_TEAM"].includes(
          error.message,
        )
      )
    ) {
      console.error("Hunt training failed", error);
      return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
    }
    const code =
      error instanceof Error && error.message === "INVALID_SESSION"
        ? "INVALID_SESSION"
        : "INVALID_ORDERS";
    return NextResponse.json({ error: code }, { status: 400 });
  }
}
