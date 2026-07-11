import { prisma } from "@/lib/prisma";
import type { AdminAiModule } from "@/lib/admin-ai/types";
import { denied } from "@/lib/admin-ai/permissions";
import { formatDate, hasAny, lines } from "@/lib/admin-ai/modules/shared";

function extractEmail(message: string) {
  return message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
}

export const adminAiUsersModule: AdminAiModule = {
  id: "users",
  description: "Поиск пользователей по email/имени и безопасная сводка аккаунта.",
  async handle({ actor, message }) {
    if (!hasAny(message, ["польз", "юзер", "email", "аккаунт", "клиент"])) return null;
    if (!actor.can("USERS")) return denied("USERS");

    const email = extractEmail(message);
    if (!email && !hasAny(message, ["найди", "покажи", "статус"])) return null;

    const user = email
      ? await prisma.user.findUnique({
          where: { email },
          include: {
            managedCompany: { select: { name: true, slug: true, isActive: true } },
            companyMemberships: { where: { isActive: true }, include: { company: { select: { name: true, slug: true } } }, take: 5 },
            _count: { select: { subscriptions: true, payments: true, loyaltyTransactions: true } },
          },
        })
      : null;

    if (!user) {
      const total = await prisma.user.count();
      const active = await prisma.user.count({ where: { accountStatus: "ACTIVE" } });
      return {
        intent: "users_summary",
        reply: email ? `Пользователь ${email} не найден.` : `Пользователей всего: ${total}, активных аккаунтов: ${active}. Для поиска пришлите email.`,
        suggestions: ["Найди пользователя по email", "Открой /admin/users"],
      };
    }

    return {
      intent: "user_lookup",
      reply: lines([
        `${user.name} · ${user.email}`,
        `Роль: ${user.role}, статус: ${user.accountStatus}, создан: ${formatDate(user.createdAt)}.`,
        `Telegram: ${user.telegramId ? "подключён" : "не подключён"}, email: ${user.emailVerifiedAt ? "подтверждён" : "не подтверждён"}.`,
        user.managedCompany ? `Владеет компанией: ${user.managedCompany.name} (${user.managedCompany.slug}).` : null,
        user.companyMemberships.length
          ? `Сотрудник в: ${user.companyMemberships.map((link) => `${link.company.name} · ${link.role}`).join(", ")}.`
          : null,
        `Подписки: ${user._count.subscriptions}, платежи: ${user._count.payments}, операции лояльности: ${user._count.loyaltyTransactions}.`,
      ]),
      suggestions: [`Открыть /admin/users/${user.uuid}`, "Проверить права пользователя", "Показать компанию пользователя"],
    };
  },
};
