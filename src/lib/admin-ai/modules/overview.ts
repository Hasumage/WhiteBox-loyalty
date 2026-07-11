import { prisma } from "@/lib/prisma";
import type { AdminAiModule } from "@/lib/admin-ai/types";
import { formatRub, hasAny, lines } from "@/lib/admin-ai/modules/shared";

export const adminAiOverviewModule: AdminAiModule = {
  id: "overview",
  description: "Короткий операционный обзор по разрешенным разделам.",
  async handle({ actor, message }) {
    if (!hasAny(message, ["сводк", "обзор", "что сейчас", "пульс", "статистик", "главное"])) return null;

    const pieces: string[] = [];

    if (actor.can("USERS")) {
      const [total, active] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { accountStatus: "ACTIVE" } }),
      ]);
      pieces.push(`Пользователи: ${active}/${total} активны.`);
    }

    if (actor.can("COMPANIES")) {
      const [companies, billingRisk] = await Promise.all([
        prisma.company.count({ where: { isActive: true } }),
        prisma.company.count({
          where: {
            OR: [
              { billingAccount: { is: null } },
              { billingAccount: { is: { status: { in: ["PAST_DUE", "SUSPENDED"] } } } },
              { billingAccount: { is: { currentPeriodEndsAt: { lt: new Date() } } } },
            ],
          },
        }),
      ]);
      pieces.push(`Компании: ${companies} активных, рисков по NearLoy-подписке — ${billingRisk}.`);
    }

    if (actor.can("FINANCE")) {
      const [pending, approved, paid] = await Promise.all([
        prisma.financeOperation.aggregate({ where: { status: "PENDING_APPROVAL" }, _count: true, _sum: { amount: true } }),
        prisma.financeOperation.aggregate({ where: { status: "APPROVED" }, _count: true, _sum: { amount: true } }),
        prisma.payment.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amount: true }, _count: true }),
      ]);
      pieces.push(`Финансы: апрув ${pending._count} / ${formatRub(pending._sum.amount ?? 0)}, к выплате ${approved._count} / ${formatRub(approved._sum.amount ?? 0)}.`);
      pieces.push(`Оплаты: успешно ${paid._count} / ${formatRub(paid._sum.amount ?? 0)}.`);
    }

    if (actor.can("COMPANY_VERIFICATIONS")) {
      const verifications = await prisma.companyVerificationApplication.count({ where: { status: { in: ["SUBMITTED", "REVIEWING"] } } });
      pieces.push(`Верификация: ${verifications} заявок ждут решения.`);
    }

    if (actor.can("AUDIT")) {
      const critical = await prisma.adminTask.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] }, priority: "CRITICAL" } });
      pieces.push(`Критичные задачи: ${critical}.`);
    }

    return {
      intent: "overview",
      reply: pieces.length
        ? lines(["Коротко по вашей зоне доступа:", ...pieces.map((piece) => `• ${piece}`)])
        : "У вашего аккаунта почти нет доступных разделов, поэтому обзор пустой.",
      suggestions: ["Что сейчас горит?", "Какие выплаты ждут решения?", "Покажи компании без активной подписки"],
    };
  },
};
