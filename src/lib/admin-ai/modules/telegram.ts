import { prisma } from "@/lib/prisma";
import type { AdminAiModule } from "@/lib/admin-ai/types";
import { denied } from "@/lib/admin-ai/permissions";
import { hasAny, lines } from "@/lib/admin-ai/modules/shared";

export const adminAiTelegramModule: AdminAiModule = {
  id: "telegram",
  description: "Telegram-инфраструктура, очередь и подключенные админы.",
  async handle({ actor, message }) {
    if (!hasAny(message, ["telegram", "телеграм", "бот", "тг", "уведомлен", "очередь"])) return null;
    if (!actor.can("TELEGRAM")) return denied("TELEGRAM");

    const [admins, linked, failed, retryDue, recent] = await Promise.all([
      prisma.user.count({ where: { role: { in: ["SUPER_ADMIN", "ADMIN", "MANAGER", "SUPPORT"] } } }),
      prisma.user.count({ where: { role: { in: ["SUPER_ADMIN", "ADMIN", "MANAGER", "SUPPORT"] }, telegramId: { not: null } } }),
      prisma.telegramMessageQueue.count({ where: { status: "FAILED" } }),
      prisma.telegramMessageQueue.count({
        where: { status: "FAILED", OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }] },
      }),
      prisma.telegramMessageQueue.findMany({
        where: { status: "FAILED" },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { recipientLabel: true, source: true, lastError: true },
      }),
    ]);

    return {
      intent: "telegram_summary",
      reply: lines([
        `Telegram: подключено ${linked}/${admins} админских аккаунтов.`,
        `Очередь ошибок: ${failed}, можно повторить сейчас: ${retryDue}.`,
        recent.length ? "Последние сбои:" : "Серьёзных очередей Telegram сейчас не вижу.",
        ...recent.map((row) => `• ${row.source ?? "source"} · ${row.recipientLabel ?? "получатель"} · ${row.lastError?.slice(0, 90) ?? "ошибка"}`),
      ]),
      suggestions: ["Открой /admin/telegram", "Повтори очередь Telegram", "Проверь системные алерты"],
    };
  },
};
