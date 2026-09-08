import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  planAI,
  resolveRound,
  validateOrders,
  type Battle,
} from "@/lib/hunt/tactics";
import { loadBattleContent } from "@/lib/hunt/battle-content";
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
const secret = process.env.JWT_SECRET || randomBytes(32).toString("hex");
const sign = (payload: string) =>
  createHmac("sha256", secret)
    .update(`hunt-training-v7:${payload}`)
    .digest("base64url");
function seal(battle: Battle, matchId = randomBytes(16).toString("hex")) {
  const payload = Buffer.from(
    JSON.stringify({
      battle,
      matchId,
      expires: Date.now() + 2 * 60 * 60 * 1000,
    }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
function unseal(token: unknown): { battle: Battle; matchId: string } {
  if (typeof token !== "string" || token.length > 180000)
    throw new Error("INVALID_SESSION");
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) throw new Error("INVALID_SESSION");
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  )
    throw new Error("INVALID_SESSION");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString());
  if (data.expires < Date.now() || typeof data.matchId !== "string")
    throw new Error("INVALID_SESSION");
  return { battle: data.battle, matchId: data.matchId };
}

// Training is intentionally independent of inventory and never grants currency.
// A signed snapshot lets any server instance verify the board without a DB migration.
export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (raw.length > 200000)
      return NextResponse.json({ error: "INVALID_ORDERS" }, { status: 400 });
    const body = JSON.parse(raw);
    if (body.action === "start") {
      let options: Parameters<typeof loadBattleContent>[0] = {};
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
        options = { speciesIds: Array(3).fill(body.previewSpeciesId) };
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
        options = { teamUuids: body.teamUuids, userId: session.userId };
      }
      const battle = await loadBattleContent(options);
      return NextResponse.json(
        { battle, token: seal(battle), frames: [] },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (body.action !== "round") throw new Error("INVALID_ORDERS");
    if (body.bonus != null) throw new Error("INVALID_ORDERS");
    const { battle, matchId } = unseal(body.token);
    if (!validateOrders(battle, "player", body.orders, body.bonus))
      throw new Error("INVALID_ORDERS");
    const ai = planAI(battle);
    const frames = resolveRound(
      battle,
      body.orders,
      ai.orders,
      body.bonus,
      ai.bonus,
      (attacker, target, turn) =>
        createHmac("sha256", secret)
          .update(`hunt-crit-v1:${matchId}:${turn}:${attacker.id}:${target.id}`)
          .digest()
          .readUInt32BE(0) / 4294967296,
    );
    const next = frames[frames.length - 1].battle;
    return NextResponse.json(
      { battle: next, token: seal(next, matchId), frames },
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
