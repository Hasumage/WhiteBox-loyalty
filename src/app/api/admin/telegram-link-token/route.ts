import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const STALE_PRISMA_MESSAGE =
  "Telegram link storage is not available in the active Prisma client. Run npm run db:generate and restart the web dev server.";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminSession(request);
    if (isAuthResponse(session)) return session;

    const admin =
      (await prisma.user.findUnique({
        where: { id: session.userId },
        select: { id: true, role: true, email: true },
      })) ??
      (session.email
        ? await prisma.user.findUnique({
            where: { email: session.email },
            select: { id: true, role: true, email: true },
          })
        : null);

    if (!admin || !["ADMIN", "SUPER_ADMIN", "MANAGER", "SUPPORT"].includes(admin.role)) {
      return NextResponse.json(
        { message: "Admin user was not found in database. Please log out and log in again." },
        { status: 404 },
      );
    }

    const token = randomBytes(18).toString("base64url");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const telegramLinkToken = prisma.telegramLinkToken;

    if (!telegramLinkToken) {
      return NextResponse.json({ message: STALE_PRISMA_MESSAGE }, { status: 503 });
    }

    await telegramLinkToken.create({ data: { token, userId: admin.id, expiresAt } });

    const username = (process.env.TELEGRAM_BOT_USERNAME || "NearLoy_Loyalty_bot").replace(/^@/, "");
    return NextResponse.json({ token, expiresAt, deepLink: `https://t.me/${username}?start=link_${token}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create Telegram link";
    return NextResponse.json({ message }, { status: 500 });
  }
}
