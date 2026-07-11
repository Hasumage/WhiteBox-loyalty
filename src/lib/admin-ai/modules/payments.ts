import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AdminAiModule } from "@/lib/admin-ai/types";
import { denied } from "@/lib/admin-ai/permissions";
import { compactText, formatRub, hasAny, lines } from "@/lib/admin-ai/modules/shared";

export const adminAiPaymentsModule: AdminAiModule = {
  id: "payments",
  description: "Платежи YooKassa, ошибки, pending, истёкшие ссылки оплаты.",
  async handle({ actor, message }) {
    if (!hasAny(message, ["оплат", "платеж", "платёж", "yookassa", "юкас", "ошиб", "failed", "pending"])) return null;
    if (!actor.can("FINANCE") && !actor.can("COMPANIES")) return denied("FINANCE");

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [summaryRows, failed, pending] = await Promise.all([
      prisma.payment.groupBy({ by: ["status"], _count: true, _sum: { amount: true } }),
      prisma.payment.findMany({
        where: {
          status: { in: [PaymentStatus.FAILED, PaymentStatus.CANCELED] },
          updatedAt: { gte: since },
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: { user: { select: { email: true, name: true } }, company: { select: { name: true } } },
      }),
      prisma.payment.count({
        where: {
          status: { in: [PaymentStatus.PENDING, PaymentStatus.WAITING_FOR_CAPTURE] },
          createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
        },
      }),
    ]);

    const byStatus = Object.fromEntries(summaryRows.map((row) => [row.status, row]));
    const succeeded = byStatus[PaymentStatus.SUCCEEDED]?._sum.amount ?? 0;
    const attention =
      (byStatus[PaymentStatus.FAILED]?._count ?? 0) +
      (byStatus[PaymentStatus.REFUNDED]?._count ?? 0);

    return {
      intent: "payments_summary",
      reply: lines([
        `Платежи: успешно оплачено ${formatRub(succeeded)}, живых ссылок до 15 минут — ${pending}.`,
        `Требуют внимания: ${attention} записей в статусах ошибок/возвратов.`,
        failed.length ? "Последние проблемные за 24 часа:" : "За сутки свежих ошибок оплаты не вижу.",
        ...failed.map((item) => `• ${item.status}: ${compactText(item.description)} · ${item.user.email}${item.company ? ` · ${item.company.name}` : ""}`),
      ]),
      suggestions: ["Открой /admin/payments", "Покажи ошибки оплат за сутки", "Найди платёж по ID"],
    };
  },
};
