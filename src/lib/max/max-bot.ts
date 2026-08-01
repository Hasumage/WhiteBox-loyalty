import { createTelegramCustomerLookupCode, isTelegramLookupCodeRequest } from "@/lib/telegram/customer-lookup-code";
import { prisma } from "@/lib/prisma";
import { sendMaxMessage } from "./max-service";

type MaxUserLike = {
  id?: string | number | bigint | null;
  user_id?: string | number | bigint | null;
};

type MaxChatLike = {
  id?: string | number | bigint | null;
  chat_id?: string | number | bigint | null;
};

type MaxMessageLike = {
  text?: string | null;
  body?: { text?: string | null } | null;
  sender?: MaxUserLike | null;
  user?: MaxUserLike | null;
  recipient?: MaxChatLike | null;
  chat?: MaxChatLike | null;
};

export type MaxUpdate = {
  update_type?: string;
  type?: string;
  event_type?: string;
  user?: MaxUserLike | null;
  chat?: MaxChatLike | null;
  message?: MaxMessageLike | null;
  payload?: {
    user?: MaxUserLike | null;
    chat?: MaxChatLike | null;
    message?: MaxMessageLike | null;
  } | null;
};

function pickId(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "bigint") return value.toString();
  }
  return null;
}

function eventType(update: MaxUpdate) {
  return update.update_type ?? update.event_type ?? update.type ?? "";
}

function updateMessage(update: MaxUpdate) {
  return update.message ?? update.payload?.message ?? null;
}

function updateUserId(update: MaxUpdate) {
  const message = updateMessage(update);
  return pickId(
    message?.sender?.user_id,
    message?.sender?.id,
    message?.user?.user_id,
    message?.user?.id,
    update.user?.user_id,
    update.user?.id,
    update.payload?.user?.user_id,
    update.payload?.user?.id,
  );
}

function updateChatId(update: MaxUpdate) {
  const message = updateMessage(update);
  return pickId(
    message?.recipient?.chat_id,
    message?.recipient?.id,
    message?.chat?.chat_id,
    message?.chat?.id,
    update.chat?.chat_id,
    update.chat?.id,
    update.payload?.chat?.chat_id,
    update.payload?.chat?.id,
  );
}

function updateText(update: MaxUpdate) {
  const message = updateMessage(update);
  return message?.text ?? message?.body?.text ?? "";
}

function normalizedText(update: MaxUpdate) {
  return updateText(update).trim().toLowerCase().replace(/ё/g, "е");
}

function linkTokenFromUpdate(update: MaxUpdate) {
  const text = updateText(update).trim();
  const match = text.match(/(?:^|\s)(?:\/start\s+)?link_([A-Za-z0-9_-]{16,})/);
  return match?.[1] ?? null;
}

function isStartEvent(update: MaxUpdate) {
  const type = eventType(update);
  const text = normalizedText(update);
  return type === "bot_started" || text === "/start" || text === "start" || text === "привет" || text === "здравствуй";
}

function welcomeText() {
  return [
    "Добро пожаловать в NearLoy.",
    "",
    "Я помогу быстро открыть NearLoy и показать код клиента сотруднику компании.",
    "Если аккаунт уже привязан к MAX, напишите «код» — пришлю одноразовый код на 15 минут.",
  ].join("\n");
}

function loginText() {
  return [
    "MAX ещё не привязан к аккаунту NearLoy.",
    "",
    "Откройте настройки аккаунта в NearLoy и нажмите «Связать» в строке MAX.",
  ].join("\n");
}

async function reply(update: MaxUpdate, text: string) {
  const userId = updateUserId(update);
  const chatId = updateChatId(update);
  await sendMaxMessage({ userId, chatId, text });
}

async function handleMaxLink(update: MaxUpdate, tokenValue: string, maxId: string) {
  const token = await prisma.telegramLinkToken.findUnique({
    where: { token: tokenValue },
    include: { user: true },
  });

  if (!token || token.usedAt || token.expiresAt <= new Date()) {
    await reply(update, "Ссылка MAX истекла. Создайте новую ссылку в NearLoy и попробуйте ещё раз.");
    return { ok: false as const, message: "link_token_invalid" as const };
  }

  const existing = await prisma.user.findUnique({
    where: { maxId },
    select: { id: true },
  });

  if (existing && existing.id !== token.userId) {
    await reply(update, "Этот MAX уже привязан к другому аккаунту NearLoy.");
    return { ok: false as const, message: "max_already_linked" as const };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: token.userId },
      data: { maxId },
    }),
    prisma.telegramLinkToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await reply(update, "Готово. MAX подключён к аккаунту NearLoy.");
  return { ok: true as const, linked: true as const };
}

export async function handleMaxUpdate(update: MaxUpdate) {
  const userId = updateUserId(update);
  const token = linkTokenFromUpdate(update);

  if (token) {
    if (!userId) {
      await reply(update, "Не удалось понять MAX-пользователя. Откройте чат с ботом и попробуйте ещё раз.");
      return { ok: false as const, message: "missing_user" as const };
    }
    return handleMaxLink(update, token, userId);
  }

  if (isStartEvent(update)) {
    await reply(update, welcomeText());
    return { ok: true as const, welcome: true as const };
  }

  if (!isTelegramLookupCodeRequest(updateText(update))) {
    return { ok: true as const, skipped: "unsupported_update" as const };
  }

  if (!userId) {
    await reply(update, "Не удалось понять MAX-пользователя. Откройте чат с ботом и попробуйте ещё раз.");
    return { ok: false as const, message: "missing_user" as const };
  }

  const user = await prisma.user.findUnique({
    where: { maxId: userId },
    select: { id: true, accountStatus: true },
  });

  if (!user) {
    await reply(update, loginText());
    return { ok: false as const, message: "max_not_linked" as const };
  }

  if (user.accountStatus !== "ACTIVE") {
    await reply(update, "Аккаунт NearLoy сейчас не активен. Быстрый код временно недоступен.");
    return { ok: false as const, message: "account_not_active" as const };
  }

  const lookupCode = await createTelegramCustomerLookupCode(user.id);
  await reply(
    update,
    [
      "Ваш код NearLoy для компании:",
      "",
      lookupCode.code.split("").join(" "),
      "",
      "Код действует 15 минут. Покажите его сотруднику компании вместо QR.",
    ].join("\n"),
  );

  return { ok: true as const, lookupCode: true as const, expiresAt: lookupCode.expiresAt };
}
