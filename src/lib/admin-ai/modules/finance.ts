import { PaymentPurpose, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AdminAiModule } from "@/lib/admin-ai/types";
import { denied } from "@/lib/admin-ai/permissions";
import { formatRub, hasAny, lines } from "@/lib/admin-ai/modules/shared";

const MOSCOW_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;

function startOfMoscowMonth(now = new Date()) {
  const moscowDate = new Date(now.getTime() + MOSCOW_UTC_OFFSET_MS);
  return new Date(Date.UTC(moscowDate.getUTCFullYear(), moscowDate.getUTCMonth(), 1) - MOSCOW_UTC_OFFSET_MS);
}

function formatPeriod(start: Date, end: Date) {
  const formatter = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    timeZone: "Europe/Moscow",
  });
  return `${formatter.format(start)} — ${formatter.format(end)}`;
}

function numberValue(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function isMonthlyRevenueQuestion(message: string) {
  return hasAny(message, ["прибыл", "выруч", "доход", "марж", "оборот", "заработ", "сколько денег"]) &&
    hasAny(message, ["месяц", "текущ", "июн", "июл", "январ", "феврал", "март", "апрел", "май", "август", "сентябр", "октябр", "ноябр", "декабр"]);
}

export const adminAiFinanceModule: AdminAiModule = {
  id: "finance",
  description: "Финансы, месячная выручка, управленческая прибыль, выплаты, заявки компаний и PR-агентов.",
  async handle({ actor, message }) {
    const wantsMonthlyRevenue = isMonthlyRevenueQuestion(message);
    if (!wantsMonthlyRevenue && !hasAny(message, ["выплат", "финанс", "деньг", "апрув", "approve", "ожида", "вывод"])) return null;
    if (!actor.can("FINANCE")) return denied("FINANCE");

    const now = new Date();
    const monthStart = startOfMoscowMonth(now);
    const [pending, approved, paidToday, risks, latest, paidMonth, companyAccessMonth, clientSubscriptionsMonth, payoutMonth, clientSubscriptionPayments] = await Promise.all([
      prisma.financeOperation.findMany({
        where: { status: "PENDING_APPROVAL" },
        orderBy: { createdAt: "asc" },
        take: 8,
        include: { company: { select: { name: true } }, requestedBy: { select: { name: true, email: true } } },
      }),
      prisma.financeOperation.findMany({
        where: { status: "APPROVED" },
        orderBy: { approvedAt: "asc" },
        take: 8,
        include: { company: { select: { name: true } }, requestedBy: { select: { name: true, email: true } } },
      }),
      prisma.financeOperation.aggregate({
        where: {
          status: "PAID",
          processedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.financeOperation.count({
        where: {
          type: "PAYOUT_REQUEST",
          status: { in: ["PENDING_APPROVAL", "APPROVED"] },
          OR: [{ companyId: null }, { requestedById: null }],
        },
      }),
      prisma.financeOperation.findMany({
        orderBy: { createdAt: "desc" },
        take: 3,
        include: { company: { select: { name: true } }, requestedBy: { select: { name: true, email: true } } },
      }),
      prisma.payment.aggregate({
        where: { status: PaymentStatus.SUCCEEDED, paidAt: { gte: monthStart, lte: now } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: {
          status: PaymentStatus.SUCCEEDED,
          purpose: PaymentPurpose.COMPANY_NEARLOY_SUBSCRIPTION,
          paidAt: { gte: monthStart, lte: now },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: {
          status: PaymentStatus.SUCCEEDED,
          purpose: { in: [PaymentPurpose.USER_SUBSCRIPTION, PaymentPurpose.USER_SUBSCRIPTION_BUNDLE] },
          paidAt: { gte: monthStart, lte: now },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.financeOperation.aggregate({
        where: { status: "PAID", processedAt: { gte: monthStart, lte: now } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.findMany({
        where: {
          status: PaymentStatus.SUCCEEDED,
          purpose: PaymentPurpose.USER_SUBSCRIPTION,
          paidAt: { gte: monthStart, lte: now },
          subscription: { companyId: { not: null } },
        },
        select: {
          amount: true,
          subscription: {
            select: {
              company: {
                select: {
                  name: true,
                  platformCommissionPercent: true,
                  supportManagerId: true,
                  currentReferral: { select: { status: true, referralPercent: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    const pendingAmount = pending.reduce((sum, item) => sum + Number(item.amount), 0);
    const approvedAmount = approved.reduce((sum, item) => sum + Number(item.amount), 0);
    const companyAccessRevenue = numberValue(companyAccessMonth._sum.amount);
    const clientSubscriptionsGross = numberValue(clientSubscriptionsMonth._sum.amount);
    const paidGross = numberValue(paidMonth._sum.amount);
    const paidPayouts = numberValue(payoutMonth._sum.amount);
    const platformCommissionEstimate = clientSubscriptionPayments.reduce((sum, item) => {
      const company = item.subscription?.company;
      const commissionPercent = numberValue(company?.platformCommissionPercent ?? 12);
      const referralPercent =
        company?.currentReferral?.status === "ACTIVE" ? numberValue(company.currentReferral.referralPercent) : 0;
      const supportPercent = company?.supportManagerId ? 1 : 0;
      return sum + Math.max(0, numberValue(item.amount) * ((commissionPercent - referralPercent - supportPercent) / 100));
    }, 0);
    const managementProfitEstimate = companyAccessRevenue + platformCommissionEstimate - paidPayouts;

    if (wantsMonthlyRevenue) {
      return {
        intent: "monthly_profit_summary",
        reply: lines([
          `За текущий месяц (${formatPeriod(monthStart, now)}) по доступным данным:`,
          `• Оплачено через YooKassa всего: ${formatRub(paidGross)} (${paidMonth._count} платежей).`,
          `• Подписки NearLoy компаний: ${formatRub(companyAccessRevenue)} (${companyAccessMonth._count} платежей).`,
          `• Клиентские подписки внутри сервиса: ${formatRub(clientSubscriptionsGross)} (${clientSubscriptionsMonth._count} платежей).`,
          `• Оценка комиссии NearLoy с клиентских подписок: ${formatRub(platformCommissionEstimate)}.`,
          `• Выплачено компаниям/PR за месяц: ${formatRub(paidPayouts)} (${payoutMonth._count} операций).`,
          `• Управленческий остаток до общих расходов: ${formatRub(managementProfitEstimate)}.`,
          "",
          "Важно: это не бухгалтерская чистая прибыль после зарплат, налогов, инфраструктуры и маркетинга. Это быстрый финансовый снимок из оплат, комиссий и выплат.",
        ]),
        data: {
          period: { from: monthStart.toISOString(), to: now.toISOString(), timezone: "Europe/Moscow" },
          paidGross,
          companyAccessRevenue,
          clientSubscriptionsGross,
          platformCommissionEstimate,
          paidPayouts,
          managementProfitEstimate,
        },
        suggestions: ["Покажи платежи за месяц", "Покажи выплаты за месяц", "Где просадка по выручке?"],
      };
    }

    return {
      intent: "finance_summary",
      reply: lines([
        `Выплаты: на апруве — ${pending.length} (${formatRub(pendingAmount)}), к выплате — ${approved.length} (${formatRub(approvedAmount)}).`,
        `Закрыто сегодня: ${paidToday._count} операций на ${formatRub(paidToday._sum.amount ?? 0)}.`,
        risks ? `Риски: ${risks} операций без нормального источника или реквизитов.` : "Критичных финансовых дыр по текущей выборке не вижу.",
        latest.length ? "" : null,
        ...latest.map((item) => `• ${item.status}: ${item.title} — ${formatRub(item.amount)}${item.company ? ` · ${item.company.name}` : ""}`),
      ]),
      suggestions: ["Открой /admin/finance", "Покажи выплаты к ручному закрытию", "Покажи рисковые выплаты"],
    };
  },
};
