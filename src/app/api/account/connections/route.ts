import { NextResponse, type NextRequest } from "next/server";
import { isUserAuthResponse, requireUserSession } from "@/lib/auth/require-user-session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const VK_PROVIDER = "vkid";

function isSyntheticOAuthEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return normalized.startsWith("vkid+") && normalized.endsWith("@oauth.nearloy.local");
}

function canDisconnect(user: { email: string; passwordHash: string | null }) {
  return Boolean(user.passwordHash) && !isSyntheticOAuthEmail(user.email);
}

function blockedReason(user: { email: string; passwordHash: string | null }) {
  if (!user.passwordHash) return "Сначала задайте пароль: иначе можно потерять доступ к аккаунту.";
  if (isSyntheticOAuthEmail(user.email)) return "Сначала укажите обычный email в аккаунте.";
  return null;
}

async function loadConnections(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      telegramId: true,
      maxId: true,
      oauthAccounts: {
        where: { provider: VK_PROVIDER },
        select: { providerAccountId: true },
        take: 1,
      },
    },
  });

  if (!user) return null;

  const canUnlink = canDisconnect(user);
  const unlinkBlockedReason = blockedReason(user);

  return {
    providers: {
      telegram: {
        connected: Boolean(user.telegramId),
        accountId: user.telegramId?.toString() ?? null,
        canUnlink,
        unlinkBlockedReason,
      },
      vkid: {
        connected: user.oauthAccounts.length > 0,
        accountId: user.oauthAccounts[0]?.providerAccountId ?? null,
        canUnlink,
        unlinkBlockedReason,
      },
      max: {
        connected: Boolean(user.maxId),
        accountId: user.maxId ?? null,
        canUnlink,
        unlinkBlockedReason,
      },
    },
  };
}

export async function GET(request: NextRequest) {
  const session = await requireUserSession(request);
  if (isUserAuthResponse(session)) return session;

  const data = await loadConnections(session.userId);
  if (!data) return NextResponse.json({ message: "User not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const session = await requireUserSession(request);
  if (isUserAuthResponse(session)) return session;

  const provider = request.nextUrl.searchParams.get("provider");
  if (provider !== "telegram" && provider !== "vkid" && provider !== "max") {
    return NextResponse.json({ message: "Unsupported provider" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, passwordHash: true },
  });
  if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

  const reason = blockedReason(user);
  if (reason) return NextResponse.json({ message: reason }, { status: 400 });

  if (provider === "vkid") {
    await prisma.oAuthAccount.deleteMany({ where: { userId: user.id, provider: VK_PROVIDER } });
  }
  if (provider === "telegram") {
    await prisma.user.update({ where: { id: user.id }, data: { telegramId: null, phoneNumber: null, phoneVerifiedAt: null } });
  }
  if (provider === "max") {
    await prisma.user.update({ where: { id: user.id }, data: { maxId: null } });
  }

  const data = await loadConnections(session.userId);
  return NextResponse.json(data);
}
