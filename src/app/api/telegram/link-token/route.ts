import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isUserAuthResponse, requireUserSession } from "@/lib/auth/require-user-session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const STALE_PRISMA_MESSAGE =
  "Telegram link storage is not available in the active Prisma client. Run npm run db:generate and restart the web dev server.";

export async function POST(request: NextRequest) {
  try {
    const session = await requireUserSession(request);
    if (isUserAuthResponse(session)) return session;

    const user =
      (await prisma.user.findUnique({
        where: { id: session.userId },
        select: { id: true, email: true, accountStatus: true },
      })) ??
      (session.email
        ? await prisma.user.findUnique({
            where: { email: session.email },
            select: { id: true, email: true, accountStatus: true },
          })
        : null);

    if (!user) {
      return NextResponse.json({ message: "User was not found. Please log out and sign in again." }, { status: 404 });
    }
    if (user.accountStatus !== "ACTIVE") {
      return NextResponse.json({ message: "Telegram can be connected only for an active account." }, { status: 423 });
    }

    const telegramLinkToken = prisma.telegramLinkToken;
    if (!telegramLinkToken) {
      return NextResponse.json({ message: STALE_PRISMA_MESSAGE }, { status: 503 });
    }

    const now = new Date();
    const token = randomBytes(18).toString("base64url");
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

    await prisma.$transaction([
      telegramLinkToken.updateMany({
        where: { userId: user.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      }),
      telegramLinkToken.create({ data: { token, userId: user.id, expiresAt } }),
    ]);

    const username = (process.env.TELEGRAM_BOT_USERNAME || "White_Box_Loyalty_bot").replace(/^@/, "");
    return NextResponse.json({ token, expiresAt, deepLink: `https://t.me/${username}?start=link_${token}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create Telegram link";
    return NextResponse.json({ message }, { status: 500 });
  }
}
