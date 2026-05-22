import { NextResponse, type NextRequest } from "next/server";
import { isUserAuthResponse, requireUserSession } from "@/lib/auth/require-user-session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type TelegramStatusUser = {
  id: number;
  email: string;
  name: string;
  role: string;
  accountStatus: string;
  telegramId: bigint | null;
  phoneNumber: string | null;
  phoneVerifiedAt: Date | null;
  updatedAt: Date;
};

function isPhoneFieldUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return message.includes("phoneNumber") || message.includes("phoneVerifiedAt");
}

function safeTelegramStatusError(error: unknown) {
  if (isPhoneFieldUnavailable(error)) {
    return "Telegram status is temporarily updating. Restart the web server after Prisma generation and try again.";
  }
  return "Failed to check Telegram connection.";
}

async function findUserBySession(session: { userId: number; email?: string | null }) {
  const fullSelect = {
    id: true,
    email: true,
    name: true,
    role: true,
    accountStatus: true,
    telegramId: true,
    phoneNumber: true,
    phoneVerifiedAt: true,
    updatedAt: true,
  } as const;
  const legacySelect = {
    id: true,
    email: true,
    name: true,
    role: true,
    accountStatus: true,
    telegramId: true,
    updatedAt: true,
  } as const;

  try {
    return (
      (await prisma.user.findUnique({
        where: { id: session.userId },
        select: fullSelect,
      })) ??
      (session.email
        ? await prisma.user.findUnique({
            where: { email: session.email },
            select: fullSelect,
          })
        : null)
    );
  } catch (error) {
    if (!isPhoneFieldUnavailable(error)) throw error;
    const legacyUser =
      (await prisma.user.findUnique({
        where: { id: session.userId },
        select: legacySelect,
      })) ??
      (session.email
        ? await prisma.user.findUnique({
            where: { email: session.email },
            select: legacySelect,
          })
        : null);
    return legacyUser ? { ...legacyUser, phoneNumber: null, phoneVerifiedAt: null } : null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireUserSession(request);
    if (isUserAuthResponse(session)) return session;

    const user = (await findUserBySession(session)) as TelegramStatusUser | null;

    if (!user) {
      return NextResponse.json({ message: "User was not found. Please log out and sign in again." }, { status: 404 });
    }

    return NextResponse.json({
      connected: Boolean(user.telegramId),
      telegramId: user.telegramId?.toString() ?? null,
      phoneNumber: user.phoneNumber,
      phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? null,
      email: user.email,
      name: user.name,
      role: user.role,
      accountStatus: user.accountStatus,
      canConnect: user.accountStatus === "ACTIVE",
      updatedAt: user.updatedAt.toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ message: safeTelegramStatusError(error) }, { status: 500 });
  }
}
