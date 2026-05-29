import { NextResponse, type NextRequest } from "next/server";
import { isUserAuthResponse, requireUserSession } from "@/lib/auth/require-user-session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await requireUserSession(request);
  if (isUserAuthResponse(session)) return session;

  const result = await prisma.userProfileStatusUnlock.updateMany({
    where: { userId: session.userId, seenAt: null },
    data: { seenAt: new Date() },
  });

  return NextResponse.json({ ok: true, updated: result.count });
}
