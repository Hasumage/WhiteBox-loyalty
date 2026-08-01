import { NextResponse, type NextRequest } from "next/server";
import { updateLandingLeadStatus } from "@/lib/leads/landing-leads";
import { prisma } from "@/lib/prisma";
import {
  createTelegramCustomerLookupCode,
  isTelegramLookupCodeRequest,
} from "@/lib/telegram/customer-lookup-code";
import { answerTelegramCallbackQuery } from "@/lib/telegram/telegram-service";
import { sendTelegramMessageQueued } from "@/lib/telegram/telegram-queue";
import {
  extractLeadUuidFromText,
  labelFromLeadAction,
  parseLeadCallbackData,
  statusFromLeadAction,
} from "@/lib/telegram/telegram-webhook";

export const runtime = "nodejs";

type TelegramCallbackQuery = {
  id?: string;
  data?: string;
  from?: { id?: number; username?: string; first_name?: string };
  message?: { text?: string; caption?: string; chat?: { id?: number | string }; message_id?: number };
};

type TelegramMessage = {
  text?: string;
  from?: { id?: number; username?: string; first_name?: string };
  chat?: { id?: number | string; type?: string };
  contact?: {
    phone_number?: string;
    user_id?: number;
    first_name?: string;
    last_name?: string;
  };
};

type TelegramUpdate = { update_id?: number; callback_query?: TelegramCallbackQuery; message?: TelegramMessage };

type TelegramBotRuntime = {
  token: string | undefined;
  source: "telegram-webhook" | "telegram-webhook-dev";
  webAppBase: string | undefined;
};

function nearloyWebAppUrl(base: string | undefined, path = "/app") {
  const configured = base || process.env.TELEGRAM_WEB_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://nearloy.up.railway.app/";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  try {
    const url = new URL(configured);
    return new URL(normalizedPath, url.origin).toString();
  } catch {
    return `${configured.replace(/\/$/, "")}${normalizedPath}`;
  }
}

function phoneKeyboard(telegram: TelegramBotRuntime) {
  return {
    keyboard: [
      [{ text: "Поделиться телефоном", request_contact: true }],
      [{ text: "Открыть NearLoy", web_app: { url: nearloyWebAppUrl(telegram.webAppBase) } }],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

function nearloyInlineKeyboard(telegram: TelegramBotRuntime) {
  return {
    inline_keyboard: [[{ text: "Открыть NearLoy", web_app: { url: nearloyWebAppUrl(telegram.webAppBase) } }]],
  };
}

function nearloyStartKeyboard(telegram: TelegramBotRuntime) {
  return {
    inline_keyboard: [
      [{ text: "Открыть NearLoy", web_app: { url: nearloyWebAppUrl(telegram.webAppBase) } }],
      [{ text: "Помощь", web_app: { url: nearloyWebAppUrl(telegram.webAppBase, "/help") } }],
    ],
  };
}

function isSecretValid(request: NextRequest) {
  const isDevBot = request.nextUrl.searchParams.get("bot") === "dev";
  const expected = isDevBot
    ? process.env.TELEGRAM_DEV_WEBHOOK_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET
    : process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return true;
  return request.headers.get("x-telegram-bot-api-secret-token") === expected;
}

function resolveTelegramRuntime(request: NextRequest): TelegramBotRuntime {
  if (request.nextUrl.searchParams.get("bot") === "dev") {
    return {
      token: process.env.TELEGRAM_DEV_BOT_TOKEN,
      source: "telegram-webhook-dev",
      webAppBase: process.env.TELEGRAM_DEV_WEB_APP_URL || process.env.TELEGRAM_WEB_APP_URL,
    };
  }

  return {
    token: process.env.TELEGRAM_BOT_TOKEN,
    source: "telegram-webhook",
    webAppBase: process.env.TELEGRAM_WEB_APP_URL,
  };
}

function normalizeTelegramPhone(value: string | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (!digits) return null;
  return `+${digits}`;
}

function isPhoneFieldUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return message.includes("phoneNumber") || message.includes("phoneVerifiedAt");
}

async function answer(telegram: TelegramBotRuntime, callbackQueryId: string | undefined, text: string, showAlert = false) {
  const botToken = telegram.token;
  if (!botToken || !callbackQueryId) return;
  await answerTelegramCallbackQuery({ botToken, callbackQueryId, text, showAlert, proxyUrl: process.env.TELEGRAM_PROXY_URL });
}

async function reply(telegram: TelegramBotRuntime, chatId: string | number | undefined, text: string, replyMarkup?: unknown) {
  const botToken = telegram.token;
  if (!botToken || chatId === undefined) return;
  await sendTelegramMessageQueued({
    botToken,
    chatId: String(chatId),
    text,
    replyMarkup,
    proxyUrl: process.env.TELEGRAM_PROXY_URL,
    source: telegram.source,
    sourceId: String(chatId),
    priority: 10,
    throwOnFailure: false,
  });
}

async function safeReply(telegram: TelegramBotRuntime, chatId: string | number | undefined, text: string, replyMarkup?: unknown) {
  try {
    await reply(telegram, chatId, text, replyMarkup);
  } catch {
    // Telegram errors are persisted by the queue and should not expose internals in webhook responses.
  }
}

async function findFallbackStartToken() {
  const tokens = await prisma.telegramLinkToken.findMany({
    where: { usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: 2,
    include: { user: true },
  });
  return tokens.length === 1 ? tokens[0] : null;
}

async function findUserLinkedToPhone(phoneNumber: string, excludedUserId: number) {
  try {
    return await prisma.user.findFirst({
      where: { phoneNumber, id: { not: excludedUserId } },
      select: { id: true },
    });
  } catch (error) {
    if (!isPhoneFieldUnavailable(error)) throw error;
    const rows = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id
      FROM "User"
      WHERE "phoneNumber" = ${phoneNumber}
        AND id <> ${excludedUserId}
      LIMIT 1
    `;
    return rows[0] ?? null;
  }
}

async function updateUserTelegramPhone(userId: number, phoneNumber: string) {
  const phoneVerifiedAt = new Date();
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { phoneNumber, phoneVerifiedAt },
    });
  } catch (error) {
    if (!isPhoneFieldUnavailable(error)) throw error;
    await prisma.$executeRaw`
      UPDATE "User"
      SET "phoneNumber" = ${phoneNumber},
          "phoneVerifiedAt" = ${phoneVerifiedAt},
          "updatedAt" = ${phoneVerifiedAt}
      WHERE id = ${userId}
    `;
  }
}

async function replyTelegramAlreadyConnected(telegram: TelegramBotRuntime, chatId: string | number | undefined) {
  await reply(
    telegram,
    chatId,
    "Telegram уже подключён к аккаунту NearLoy. Если телефон ещё не привязан, нажмите кнопку «Поделиться телефоном».",
    phoneKeyboard(telegram),
  );
}

async function replyTelegramWelcome(telegram: TelegramBotRuntime, chatId: string | number | undefined) {
  await reply(
    telegram,
    chatId,
    [
      "Добро пожаловать в NearLoy.",
      "",
      // #SubNearloyCode: клиентские подписки убраны из публичного Telegram-приветствия до запуска.
      "NearLoy — приложение для QR-карт, бонусов, уровней и партнёрских программ.",
      "Здесь можно копить баллы, находить компании рядом и быстро открывать NearLoy.",
      "",
      "Если аккаунт уже привязан к Telegram, NearLoy откроется без ввода пароля.",
    ].join("\n"),
    nearloyStartKeyboard(telegram),
  );
}

async function findUserByTelegramId(telegramId: bigint) {
  return prisma.user.findUnique({
    where: { telegramId },
    select: { id: true, accountStatus: true },
  });
}

async function handleTelegramContact(telegram: TelegramBotRuntime, message: TelegramMessage) {
  if (!message.contact) return { skipped: "not_contact" };
  if (!message.from?.id) return { ok: false, message: "missing_sender" };

  if (message.chat?.type && message.chat.type !== "private") {
    await reply(telegram, message.chat?.id, "Телефон можно привязать только в личном чате с ботом NearLoy.");
    return { ok: false, message: "private_chat_required" };
  }

  if (message.contact.user_id !== message.from.id) {
    await reply(telegram, message.chat?.id, "Отправьте именно свой контакт через кнопку «Поделиться телефоном». Чужие контакты не привязываются.");
    return { ok: false, message: "contact_owner_mismatch" };
  }

  const phoneNumber = normalizeTelegramPhone(message.contact.phone_number);
  if (!phoneNumber) {
    await reply(telegram, message.chat?.id, "Telegram не передал номер телефона. Попробуйте нажать кнопку «Поделиться телефоном» ещё раз.");
    return { ok: false, message: "missing_phone" };
  }

  const telegramId = BigInt(message.from.id);
  const user = await findUserByTelegramId(telegramId);
  if (!user) {
    await reply(telegram, message.chat?.id, "Сначала подключите Telegram к аккаунту NearLoy, а потом отправьте телефон.", nearloyInlineKeyboard(telegram));
    return { ok: false, message: "telegram_not_linked" };
  }
  if (user.accountStatus !== "ACTIVE") {
    await reply(telegram, message.chat?.id, "Этот аккаунт NearLoy сейчас не активен. Привязка телефона недоступна.");
    return { ok: false, message: "account_not_active" };
  }

  const linkedToAnotherUser = await findUserLinkedToPhone(phoneNumber, user.id);
  if (linkedToAnotherUser) {
    await reply(telegram, message.chat?.id, "Этот телефон уже привязан к другому аккаунту NearLoy.");
    return { ok: false, message: "phone_already_linked" };
  }

  await updateUserTelegramPhone(user.id, phoneNumber);
  await reply(telegram, message.chat?.id, "Телефон подтверждён и привязан к аккаунту NearLoy.", { remove_keyboard: true });
    await reply(telegram, message.chat?.id, "Можно открыть NearLoy и продолжить работу.", nearloyInlineKeyboard(telegram));
  return { ok: true, phoneLinked: true };
}

async function handleTelegramLookupCode(telegram: TelegramBotRuntime, message: TelegramMessage) {
  if (!isTelegramLookupCodeRequest(message.text)) return { skipped: "not_lookup_code_request" };
  if (!message.from?.id) return { ok: false, message: "missing_sender" };

  if (message.chat?.type && message.chat.type !== "private") {
    await reply(telegram, message.chat?.id, "Код клиента можно получить только в личном чате с ботом NearLoy.");
    return { ok: false, message: "private_chat_required" };
  }

  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(message.from.id) },
    select: { id: true, accountStatus: true },
  });

  if (!user) {
    await reply(
      telegram,
      message.chat?.id,
      "Сначала подключите Telegram к аккаунту NearLoy. После этого напишите «код», и я сразу пришлю код для кассы.",
      nearloyInlineKeyboard(telegram),
    );
    return { ok: false, message: "telegram_not_linked" };
  }

  if (user.accountStatus !== "ACTIVE") {
    await reply(telegram, message.chat?.id, "Аккаунт NearLoy сейчас не активен. Быстрый код временно недоступен.");
    return { ok: false, message: "account_not_active" };
  }

  const lookupCode = await createTelegramCustomerLookupCode(user.id);
  await reply(
    telegram,
    message.chat?.id,
    [
      "Ваш код NearLoy для компании:",
      "",
      lookupCode.code.split("").join(" "),
      "",
      "Код действует 15 минут. Покажите его сотруднику компании вместо QR.",
    ].join("\n"),
  );

  return { ok: true, lookupCode: true, expiresAt: lookupCode.expiresAt };
}

async function handleTelegramLink(telegram: TelegramBotRuntime, message: TelegramMessage) {
  if (!message.from?.id) return { skipped: "not_link_start" };

  const match = message.text?.trim().match(/^\/start(?:\s+link_([a-zA-Z0-9_-]+))?$/);
  if (!match) return { skipped: "not_link_start" };

  if (message.chat?.type && message.chat.type !== "private") {
    await reply(telegram, message.chat?.id, "Откройте ссылку подключения в личном чате с ботом NearLoy.");
    return { ok: false, message: "private_chat_required" };
  }

  const telegramId = BigInt(message.from.id);
  if (!match[1]) {
    const linkedUser = await findUserByTelegramId(telegramId);
    if (linkedUser) {
      await replyTelegramWelcome(telegram, message.chat?.id);
      return { ok: true, welcome: true, alreadyLinked: true, linkedUserId: linkedUser.id };
    }
  }

  const token = match[1]
    ? await prisma.telegramLinkToken.findUnique({ where: { token: match[1] }, include: { user: true } })
    : await findFallbackStartToken();

  if (!token && !match[1]) {
    await replyTelegramWelcome(telegram, message.chat?.id);
    return { ok: true, welcome: true };
  }

  if (!token) {
    await reply(telegram, message.chat?.id, "Ссылка NearLoy устарела. Создайте новую ссылку в приложении.", nearloyInlineKeyboard(telegram));
    return { ok: false, message: "expired" };
  }

  if (token.usedAt || token.expiresAt <= new Date()) {
    const linkedUser = await findUserByTelegramId(telegramId);
    if (linkedUser?.id === token.userId) {
      await replyTelegramAlreadyConnected(telegram, message.chat?.id);
      return { ok: true, alreadyLinked: true, linkedUserId: token.userId };
    }
    await reply(telegram, message.chat?.id, "Ссылка NearLoy устарела. Создайте новую ссылку в приложении.", nearloyInlineKeyboard(telegram));
    return { ok: false, message: "expired" };
  }

  const linkedToAnotherUser = await prisma.user.findFirst({
    where: { telegramId, id: { not: token.userId } },
    select: { id: true },
  });
  if (linkedToAnotherUser) {
    await reply(telegram, message.chat?.id, "Этот Telegram уже привязан к другому аккаунту NearLoy. Один Telegram можно подключить только к одному аккаунту.");
    return { ok: false, message: "telegram_already_linked" };
  }

  if ("accountStatus" in token.user && token.user.accountStatus !== "ACTIVE") {
    await reply(telegram, message.chat?.id, "Этот аккаунт NearLoy сейчас не активен. Подключение Telegram недоступно.");
    return { ok: false, message: "account_not_active" };
  }

  try {
    await prisma.$transaction([
      prisma.user.update({ where: { id: token.userId }, data: { telegramId } }),
      prisma.telegramLinkToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
    ]);
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      await reply(telegram, message.chat?.id, "Этот Telegram уже привязан к другому аккаунту NearLoy. Один Telegram можно подключить только к одному аккаунту.");
      return { ok: false, message: "telegram_already_linked" };
    }
    throw error;
  }

  await reply(
    telegram,
    message.chat?.id,
    "Готово: Telegram успешно привязан к аккаунту NearLoy. Теперь нажмите кнопку «Поделиться телефоном», чтобы подтвердить номер.",
    phoneKeyboard(telegram),
  );
  return { ok: true, linkedUserId: token.userId };
}

export async function POST(request: NextRequest) {
  if (!isSecretValid(request)) return NextResponse.json({ ok: false, message: "Invalid Telegram secret" }, { status: 401 });

  const telegram = resolveTelegramRuntime(request);
  if (!telegram.token) {
    return NextResponse.json({ ok: false, message: "Telegram bot token is not configured" }, { status: 503 });
  }

  const update = (await request.json().catch(() => ({}))) as TelegramUpdate;

  if (update.message) {
    try {
      const contactResult = await handleTelegramContact(telegram, update.message);
      if (!("skipped" in contactResult)) return NextResponse.json(contactResult);
      const lookupCodeResult = await handleTelegramLookupCode(telegram, update.message);
      if (!("skipped" in lookupCodeResult)) return NextResponse.json(lookupCodeResult);
      return NextResponse.json(await handleTelegramLink(telegram, update.message));
    } catch {
      await safeReply(
        telegram,
        update.message.chat?.id,
        "Не удалось обработать сообщение. Попробуйте ещё раз позже или откройте NearLoy.",
      );
      return NextResponse.json({ ok: false, message: "telegram_message_processing_failed" });
    }
  }

  const callback = update.callback_query;
  if (!callback) return NextResponse.json({ ok: true, skipped: "not_callback_query" });

  const parsed = parseLeadCallbackData(callback.data);
  if (!parsed) {
    await answer(telegram, callback.id, "Неизвестное действие NearLoy", true);
    return NextResponse.json({ ok: true, skipped: "unknown_callback" });
  }

  const leadUuid = parsed.leadUuid || extractLeadUuidFromText(callback.message?.text) || extractLeadUuidFromText(callback.message?.caption);
  if (!leadUuid) {
    await answer(telegram, callback.id, "ID заявки не найден. Откройте админку.", true);
    return NextResponse.json({ ok: false, message: "Lead uuid not found" }, { status: 400 });
  }

  try {
    const status = statusFromLeadAction(parsed.action);
    const actor = callback.from?.username ? `@${callback.from.username}` : callback.from?.first_name || callback.from?.id || "неизвестно";
    await updateLandingLeadStatus({
      leadUuid,
      status,
      notes: `Быстрое действие из Telegram: ${labelFromLeadAction(parsed.action)}. Исполнитель: ${actor}`,
    });
    await answer(telegram, callback.id, `Заявка отмечена как ${labelFromLeadAction(parsed.action)}.`);
    return NextResponse.json({ ok: true, leadUuid, status });
  } catch (error) {
    await answer(telegram, callback.id, "Не удалось обновить заявку. Проверьте админку.", true);
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Failed to update lead" }, { status: 500 });
  }
}
