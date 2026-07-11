import { prisma } from "@/lib/prisma";
import type { AdminAiModule } from "@/lib/admin-ai/types";
import { denied } from "@/lib/admin-ai/permissions";
import { compactText, formatDate, hasAny, lines } from "@/lib/admin-ai/modules/shared";

export const adminAiAuditModule: AdminAiModule = {
  id: "audit",
  description: "Аудит, системные события и критические инциденты.",
  async handle({ actor, message }) {
    if (!hasAny(message, ["аудит", "лог", "событ", "систем", "инцидент", "ошибк"])) return null;
    if (!actor.can("AUDIT")) return denied("AUDIT");

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [critical, blocked, latest] = await Promise.all([
      prisma.auditEvent.count({ where: { level: "CRITICAL", createdAt: { gte: since } } }),
      prisma.auditEvent.count({ where: { result: "BLOCKED", createdAt: { gte: since } } }),
      prisma.auditEvent.findMany({
        where: { OR: [{ level: "CRITICAL" }, { result: "BLOCKED" }] },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    return {
      intent: "audit_summary",
      reply: lines([
        `Аудит за 24 часа: критичных событий — ${critical}, заблокированных действий — ${blocked}.`,
        latest.length ? "Последние важные события:" : "Критичных событий в выборке нет.",
        ...latest.map((event) => `• ${event.level}/${event.result}: ${compactText(event.action, "Событие")} · ${formatDate(event.createdAt)}`),
      ]),
      suggestions: ["Открой /admin/audit", "Покажи критические задачи", "Покажи ошибки Telegram"],
    };
  },
};
