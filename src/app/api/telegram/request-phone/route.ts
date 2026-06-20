import { NextResponse, type NextRequest } from "next/server";
import { isUserAuthResponse, requireUserSession } from "@/lib/auth/require-user-session";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessageQueued } from "@/lib/telegram/telegram-queue";

export const runtime = "nodejs";

const PHONE_KEYBOARD = {
  keyboard: [[{ text: "Поделиться телефоном", request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
};

function isPhoneFieldUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return message.includes("phoneNumber") || message.includes("phoneVerifiedAt");
}

function safeTelegramPhoneError(error: unknown) {
  if (isPhoneFieldUnavailable(error)) {
    return "Привязка телефона обновляется. Перезапустите web-сервер после Prisma generate и попробуйте ещё раз.";
  }
  return "Не удалось отправить запрос телефона в Telegram.";
}

async function findUserBySession(session: { userId: number; email?: string | null }) {
  const fullSelect = {
    id: true,
    email: true,
    accountStatus: true,
    telegramId: true,
    phoneNumber: true,
  } as const;
  const legacySelect = {
    id: true,
    email: true,
    accountStatus: true,
    telegramId: true,
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
    return legacyUser ? { ...legacyUser, phoneNumber: null } : null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireUserSession(request);
    if (isUserAuthResponse(session)) return session;

    const user = await findUserBySession(session);

    if (!user) {
      return NextResponse.json({ message: "Пользователь не найден. Выйдите из аккаунта и войдите снова." }, { status: 404 });
    }
    if (user.accountStatus !== "ACTIVE") {
      return NextResponse.json({ message: "Привязка телефона доступна только для активного аккаунта." }, { status: 423 });
    }
    if (!user.telegramId) {
      return NextResponse.json({ message: "Сначала подключите Telegram, затем запросите привязку телефона." }, { status: 400 });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json({ message: "Токен Telegram-бота не настроен." }, { status: 503 });
    }

    const delivery = await sendTelegramMessageQueued({
      botToken,
      chatId: user.telegramId.toString(),
      text: user.phoneNumber
        ? "Телефон уже привязан к NearLoy. Если нужно обновить номер, нажмите кнопку ниже и отправьте актуальный контакт."
        : "Нажмите на кнопку «Поделиться телефоном», чтобы передать подтверждённый номер в NearLoy.",
      replyMarkup: PHONE_KEYBOARD,
      proxyUrl: process.env.TELEGRAM_PROXY_URL,
      recipientRole: "client",
      recipientLabel: user.email ?? `user:${user.id}`,
      source: "telegram-phone-request",
      sourceId: String(user.id),
      priority: 5,
      throwOnFailure: false,
    });

    return NextResponse.json({ sent: delivery.ok, queued: delivery.queued });
  } catch (error) {
    return NextResponse.json({ message: safeTelegramPhoneError(error) }, { status: 500 });
  }
}
