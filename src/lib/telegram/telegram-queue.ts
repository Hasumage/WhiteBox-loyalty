import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram/telegram-service";

const TELEGRAM_QUEUE_DEFAULT_LIMIT = 30;
const TELEGRAM_FIRE_WINDOW_MS = 10 * 60 * 1000;
const TELEGRAM_FIRE_COOLDOWN_MS = 15 * 60 * 1000;
const TELEGRAM_FIRE_THRESHOLD_ENV = Number(process.env.TELEGRAM_FAILURE_FIRE_THRESHOLD ?? 5);
const TELEGRAM_FIRE_THRESHOLD =
  Number.isFinite(TELEGRAM_FIRE_THRESHOLD_ENV) && TELEGRAM_FIRE_THRESHOLD_ENV > 0
    ? TELEGRAM_FIRE_THRESHOLD_ENV
    : 5;

type QueuedTelegramMessageInput = {
  botToken: string;
  chatId: string;
  text: string;
  parseMode?: "HTML";
  replyMarkup?: unknown;
  proxyUrl?: string;
  recipientRole?: string;
  recipientLabel?: string;
  source?: string;
  sourceId?: string;
  priority?: number;
  throwOnFailure?: boolean;
};

function telegramQueueNextRetryAt(attempts: number, now = new Date()) {
  const minutes = attempts <= 1 ? 1 : attempts === 2 ? 5 : attempts === 3 ? 15 : 60;
  return new Date(now.getTime() + minutes * 60 * 1000);
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.length > 1800 ? `${message.slice(0, 1800)}...` : message;
}

function jsonOrUndefined(value: unknown) {
  return value === undefined ? undefined : (value as Prisma.InputJsonValue);
}

async function createTelegramFailureIncidentIfNeeded(now = new Date()) {
  const windowSince = new Date(now.getTime() - TELEGRAM_FIRE_WINDOW_MS);
  const cooldownSince = new Date(now.getTime() - TELEGRAM_FIRE_COOLDOWN_MS);

  const [queueFailures, leadFailures, recentIncident] = await Promise.all([
    prisma.telegramMessageQueue.count({
      where: {
        status: "FAILED",
        createdAt: { gte: windowSince },
      },
    }),
    prisma.notificationDelivery.count({
      where: {
        channel: "telegram",
        status: "FAILED",
        createdAt: { gte: windowSince },
      },
    }),
    prisma.auditEvent.count({
      where: {
        workspace: "DEVELOPER",
        tags: { has: "TELEGRAM_FIRE" },
        createdAt: { gte: cooldownSince },
      },
    }),
  ]);

  const totalFailures = queueFailures + leadFailures;
  if (totalFailures < TELEGRAM_FIRE_THRESHOLD || recentIncident > 0) return;

  await prisma.auditEvent.create({
    data: {
      workspace: "DEVELOPER",
      level: "CRITICAL",
      category: "SYSTEM",
      action: "Telegram delivery fire",
      details: [
        `Telegram delivery failures reached ${totalFailures} in the last 10 minutes.`,
        `Queued message failures: ${queueFailures}. Landing lead delivery failures: ${leadFailures}.`,
        "Check bot token, proxy, webhook/polling and Telegram API availability.",
      ].join("\n"),
      actorLabel: "WhiteBox Telegram Queue",
      result: "SUCCESS",
      tags: ["TELEGRAM", "TELEGRAM_FIRE", "DEVELOPER"],
    },
  });
}

export async function checkTelegramDeliveryFire(now = new Date()) {
  await createTelegramFailureIncidentIfNeeded(now);
}

export async function recordTelegramMessageFailure(params: {
  chatId: string;
  text: string;
  parseMode?: "HTML";
  replyMarkup?: unknown;
  recipientRole?: string;
  recipientLabel?: string;
  source?: string;
  sourceId?: string;
  priority?: number;
  error: unknown;
  attempts?: number;
}) {
  const attempts = params.attempts ?? 1;

  const row = await prisma.telegramMessageQueue.create({
    data: {
      recipientChatId: params.chatId,
      recipientRole: params.recipientRole,
      recipientLabel: params.recipientLabel,
      text: params.text,
      parseMode: params.parseMode,
      replyMarkup: jsonOrUndefined(params.replyMarkup),
      status: "FAILED",
      attempts,
      lastError: errorMessage(params.error),
      nextRetryAt: telegramQueueNextRetryAt(attempts),
      source: params.source,
      sourceId: params.sourceId,
      priority: params.priority ?? 0,
    },
  });

  await createTelegramFailureIncidentIfNeeded().catch(() => undefined);
  return row;
}

export async function sendTelegramMessageQueued(params: QueuedTelegramMessageInput) {
  try {
    const result = await sendTelegramMessage({
      botToken: params.botToken,
      chatId: params.chatId,
      text: params.text,
      parseMode: params.parseMode,
      replyMarkup: params.replyMarkup,
      proxyUrl: params.proxyUrl,
    });

    return { ok: true as const, queued: false as const, result };
  } catch (error) {
    const queueRow = await recordTelegramMessageFailure({
      chatId: params.chatId,
      text: params.text,
      parseMode: params.parseMode,
      replyMarkup: params.replyMarkup,
      recipientRole: params.recipientRole,
      recipientLabel: params.recipientLabel,
      source: params.source,
      sourceId: params.sourceId,
      priority: params.priority,
      error,
    }).catch(() => null);

    if (params.throwOnFailure ?? true) throw error;

    return {
      ok: false as const,
      queued: Boolean(queueRow),
      queueId: queueRow?.id ?? null,
      message: errorMessage(error),
    };
  }
}

export async function processTelegramMessageQueue(now = new Date(), limit = TELEGRAM_QUEUE_DEFAULT_LIMIT) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const rows = await prisma.telegramMessageQueue.findMany({
    where: {
      status: "FAILED",
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: limit,
  });

  const results: Array<{ id: string; ok: boolean; message?: string }> = [];

  for (const row of rows) {
    const attempts = row.attempts + 1;

    try {
      if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN is not configured.");

      const response = await sendTelegramMessage({
        botToken,
        chatId: row.recipientChatId,
        text: row.text,
        parseMode: row.parseMode === "HTML" ? "HTML" : undefined,
        replyMarkup: row.replyMarkup ?? undefined,
        proxyUrl: process.env.TELEGRAM_PROXY_URL,
      });

      await prisma.telegramMessageQueue.update({
        where: { id: row.id },
        data: {
          status: "SENT",
          attempts,
          telegramMessageId: response.result.message_id,
          lastError: null,
          nextRetryAt: null,
          sentAt: new Date(),
        },
      });
      results.push({ id: row.id, ok: true });
    } catch (error) {
      const message = errorMessage(error);
      await prisma.telegramMessageQueue.update({
        where: { id: row.id },
        data: {
          status: "FAILED",
          attempts,
          lastError: message,
          nextRetryAt: telegramQueueNextRetryAt(attempts),
        },
      });
      await createTelegramFailureIncidentIfNeeded().catch(() => undefined);
      results.push({ id: row.id, ok: false, message });
    }
  }

  return {
    processed: results.length,
    sent: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    results,
  };
}

export const telegramQueueInternals = {
  telegramQueueNextRetryAt,
  createTelegramFailureIncidentIfNeeded,
};
