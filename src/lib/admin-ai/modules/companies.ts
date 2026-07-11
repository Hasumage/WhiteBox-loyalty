import { prisma } from "@/lib/prisma";
import type { AdminAiModule } from "@/lib/admin-ai/types";
import { denied } from "@/lib/admin-ai/permissions";
import { compactText, formatDate, hasAny, lines } from "@/lib/admin-ai/modules/shared";

const stopWords = new Set([
  "продли", "продлить", "подписку", "компании", "компанию", "без", "оплаты", "месяц", "месяца",
  "месяцев", "найди", "покажи", "статус", "nearloy", "на", "и", "для", "какие", "без",
]);

function extractMonths(message: string) {
  const match = message.match(/(?:на\s+)?(\d{1,2})\s*(?:мес|месяц|месяца|месяцев)/i);
  const months = match ? Number(match[1]) : 1;
  return Number.isFinite(months) ? Math.min(24, Math.max(1, months)) : 1;
}

function quoted(message: string) {
  return message.match(/[«"]([^»"]{2,80})[»"]/)?.[1]?.trim() ?? null;
}

function searchCandidate(message: string) {
  const fromQuotes = quoted(message);
  if (fromQuotes) return fromQuotes;
  const normalized = message
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !stopWords.has(word.toLowerCase()));
  return normalized.slice(-4).join(" ").trim();
}

async function findCompany(candidate: string) {
  const query = candidate.trim();
  if (!query) return null;
  const byFull = await prisma.company.findFirst({
    where: {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { slug: { contains: query.toLowerCase().replace(/\s+/g, "-"), mode: "insensitive" } },
      ],
    },
    include: {
      owner: { select: { uuid: true, name: true, email: true } },
      billingAccount: true,
      billingInvoices: { orderBy: { periodStartsAt: "desc" }, take: 1 },
      _count: { select: { members: true, locations: true, subscriptions: true } },
    },
  });
  if (byFull) return byFull;

  const tokens = query.split(/\s+/).filter((token) => token.length > 2).slice(0, 4);
  if (!tokens.length) return null;
  return prisma.company.findFirst({
    where: { AND: tokens.map((token) => ({ name: { contains: token, mode: "insensitive" } })) },
    include: {
      owner: { select: { uuid: true, name: true, email: true } },
      billingAccount: true,
      billingInvoices: { orderBy: { periodStartsAt: "desc" }, take: 1 },
      _count: { select: { members: true, locations: true, subscriptions: true } },
    },
  });
}

export const adminAiCompaniesModule: AdminAiModule = {
  id: "companies",
  description: "Поиск компании, статус биллинга, ручное продление подписки NearLoy.",
  async handle({ actor, message }) {
    if (!hasAny(message, ["компан", "подписк", "продли", "биллинг", "nearloy"])) return null;
    if (!actor.can("COMPANIES")) return denied("COMPANIES");

    if (hasAny(message, ["без актив", "неактив", "просроч", "past_due", "suspended", "без подпис"])) {
      const companies = await prisma.company.findMany({
        where: {
          OR: [
            { billingAccount: { is: null } },
            { billingAccount: { is: { status: { in: ["PAST_DUE", "SUSPENDED"] } } } },
            { billingAccount: { is: { currentPeriodEndsAt: { lt: new Date() } } } },
          ],
        },
        orderBy: { updatedAt: "desc" },
        take: 8,
        include: { owner: { select: { uuid: true, email: true } }, billingAccount: true },
      });
      return {
        intent: "companies_billing_risks",
        reply: lines([
          `Компаний без нормальной активной подписки в выборке: ${companies.length}.`,
          ...companies.map((company) => `• ${company.name} — ${company.billingAccount?.status ?? "нет биллинга"}, до ${formatDate(company.billingAccount?.currentPeriodEndsAt)}`),
        ]),
        suggestions: ["Открой /admin/companies", "Продли подписку выбранной компании", "Покажи платежи компании"],
      };
    }

    const candidate = searchCandidate(message);
    const company = await findCompany(candidate);
    if (!company) {
      return {
        intent: "company_not_found",
        reply: "Не нашёл компанию по запросу. Напишите название точнее или пришлите slug.",
        suggestions: ["Найди компанию по slug", "Покажи компании без активной подписки"],
      };
    }

    if (hasAny(message, ["продли", "продлить", "продление"])) {
      if (!actor.can("COMPANIES", "canApprove") || (actor.role !== "SUPER_ADMIN" && actor.role !== "ADMIN")) {
        return {
          intent: "company_billing_extend_denied",
          reply: "Я нашёл компанию, но продление без оплаты доступно только ADMIN/SUPER_ADMIN с правом approve по компаниям.",
        };
      }
      if (!company.owner) {
        return {
          intent: "company_billing_extend_no_owner",
          reply: `У компании ${company.name} нет владельца, поэтому безопасно продлить через AI нельзя. Сначала привяжите владельца.`,
        };
      }
      const months = extractMonths(message);
      return {
        intent: "company_billing_extend_prepare",
        reply: `Могу продлить подписку NearLoy для «${company.name}» на ${months} мес. без оплаты. После подтверждения создам waived-инвойс и отправлю Telegram-уведомление руководителям, если они подключены.`,
        pendingAction: {
          type: "EXTEND_COMPANY_BILLING",
          title: "Продлить подписку без оплаты",
          description: `${company.name}: +${months} мес., уведомление руководителям включено.`,
          payload: {
            ownerUserUuid: company.owner.uuid,
            companyName: company.name,
            months,
            comment: `Продление через admin AI: ${compactText(message, "", 220)}`,
            notifyTelegram: true,
          },
        },
      };
    }

    return {
      intent: "company_lookup",
      reply: lines([
        `Компания: ${company.name} (${company.slug}).`,
        `Статус профиля: ${company.isActive ? "активна" : "неактивна"}. Биллинг: ${company.billingAccount?.status ?? "нет аккаунта"}.`,
        `Период NearLoy до: ${formatDate(company.billingAccount?.currentPeriodEndsAt)}. Последний инвойс: ${company.billingInvoices[0]?.status ?? "нет"}.`,
        `Владелец: ${company.owner?.name || company.owner?.email || "не назначен"}. Локации: ${company._count.locations}, сотрудники: ${company._count.members}, подписки клиентов: ${company._count.subscriptions}.`,
      ]),
      suggestions: [`Открыть /admin/companies/${company.owner?.uuid ?? ""}`, "Продлить подписку без оплаты", "Показать платежи компании"],
    };
  },
};
