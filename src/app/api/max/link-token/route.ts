import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isUserAuthResponse, requireUserSession } from "@/lib/auth/require-user-session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const STALE_PRISMA_MESSAGE =
  "MAX link storage is not available in the active Prisma client. Run npm run db:generate and restart the web dev server.";

function resolveMaxBotDeepLink(token: string) {
  const configuredUrl = process.env.MAX_BOT_URL?.trim();
  if (configuredUrl) {
    const separator = configuredUrl.includes("?") ? "&" : "?";
    return `${configuredUrl}${separator}start=link_${token}`;
  }

  const username = process.env.MAX_BOT_USERNAME?.trim().replace(/^@/, "");
  if (username) return `https://max.ru/${username}?start=link_${token}`;

  return null;
}

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
      return NextResponse.json({ message: "Пользователь не найден. Выйдите и войдите снова." }, { status: 404 });
    }
    if (user.accountStatus !== "ACTIVE") {
      return NextResponse.json({ message: "MAX можно подключить только к активному аккаунту." }, { status: 423 });
    }

    const telegramLinkToken = prisma.telegramLinkToken;
    if (!telegramLinkToken) {
      return NextResponse.json({ message: STALE_PRISMA_MESSAGE }, { status: 503 });
    }

    const now = new Date();
    const token = randomBytes(18).toString("base64url");
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
    const deepLink = resolveMaxBotDeepLink(token);

    if (!deepLink) {
      return NextResponse.json(
        { message: "Ссылка на MAX-бота не настроена. Укажите MAX_BOT_URL или MAX_BOT_USERNAME." },
        { status: 503 },
      );
    }

    await prisma.$transaction([
      telegramLinkToken.updateMany({
        where: { userId: user.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      }),
      telegramLinkToken.create({ data: { token, userId: user.id, expiresAt } }),
    ]);

    return NextResponse.json({ token, expiresAt, deepLink });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось создать ссылку MAX.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
