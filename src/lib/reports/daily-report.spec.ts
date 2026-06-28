jest.mock("@/lib/prisma", () => ({ prisma: {} }));
jest.mock("@/lib/telegram/admin-chat", () => ({ adminTelegramRecipients: jest.fn(() => []) }));
jest.mock("@/lib/telegram/telegram-queue", () => ({ sendTelegramMessageQueued: jest.fn() }));

import { formatDailyReport, formatRub, type DailyReportSnapshot } from "./daily-report";

function snapshot(overrides: Partial<DailyReportSnapshot> = {}): DailyReportSnapshot {
  return {
    generatedAt: new Date("2026-06-27T09:30:00.000Z"),
    usersTotal: 120,
    usersCreatedToday: 4,
    usersActive: 112,
    usersBlocked: 2,
    staffUsers: 8,
    usersWithTelegram: 37,
    usersWithVerifiedPhone: 19,
    loginEventsToday: 44,
    companiesTotal: 18,
    companiesActive: 15,
    companiesOnline: 5,
    companyLocationsActive: 24,
    companiesAwaitingVerification: 3,
    companyVerificationSubmittedToday: 2,
    companyVerificationApprovedToday: 1,
    companyVerificationRejectedToday: 0,
    companyBillingTrial: 4,
    companyBillingActive: 9,
    companyBillingPastDue: 2,
    companyBillingSuspended: 1,
    companyBillingExpiringSoon: 3,
    companyInvoicesOpen: 6,
    companyInvoicesOpenAmount: 29940,
    companyInvoicesOverdue: 1,
    paymentsSucceededToday: 7,
    paymentsSucceededAmountToday: 6720,
    paymentsSucceededMonth: 28,
    paymentsSucceededAmountMonth: 84650,
    paymentsPending: 2,
    paymentsPendingAmount: 9980,
    paymentsFailedToday: 1,
    financePayoutsPending: 2,
    financePayoutsPendingAmount: 15000,
    financePayoutsPaidToday: 1,
    financePayoutsPaidAmountToday: 5000,
    activeUserSubscriptions: 42,
    userSubscriptionsCreatedToday: 3,
    userSubscriptionsExpiringSoon: 6,
    subscriptionRedemptionsToday: 11,
    bundleRedemptionsToday: 2,
    companyPurchasesToday: 9,
    companyPurchasesAmountToday: 12400,
    pointsAwardedToday: 930,
    loyaltyEarnedToday: 1010,
    loyaltySpentToday: 250,
    openAdminTasks: 5,
    criticalAdminTasks: 1,
    adminTasksCreatedToday: 2,
    auditWarningsToday: 4,
    criticalAuditEventsToday: 0,
    telegramQueuePending: 2,
    telegramQueueFailed: 1,
    telegramQueueSentToday: 18,
    ...overrides,
  };
}

describe("daily report", () => {
  it("formats rubles with Russian grouping and currency", () => {
    expect(formatRub(6720)).toMatch(/^6[\s\u00a0\u202f]720,00 ₽$/);
  });

  it("renders a readable Russian Telegram report without mojibake", () => {
    const text = formatDailyReport(snapshot());

    expect(text).toContain("✨ NearLoy | Ежедневный отчёт");
    expect(text).toContain("🔥 Требует внимания");
    expect(text).toContain("🚨 Критичные задачи: 1");
    expect(text).toContain("📨 Ошибки Telegram-очереди: 1");
    expect(text).toContain("👥 Пользователи");
    expect(text).toContain("• Всего: 120 | активных: 112 | заблокировано: 2");
    expect(text).toContain("🏢 Компании");
    expect(text).toContain("• Всего: 18 | активных: 15 | онлайн: 5");
    expect(text).toContain("🎟️ Подписка NearLoy для компаний");
    expect(text).toMatch(/• Открытые счета: 6 на 29[\s\u00a0\u202f]940,00 ₽/);
    expect(text).toContain("💰 Платежи и финансы");
    expect(text).toMatch(/• Сегодня оплачено: 7 на 6[\s\u00a0\u202f]720,00 ₽/);
    expect(text).toContain("🎁 Клиентские подписки и баллы");
    expect(text).toContain("• Погашения услуг: 11 обычных | 2 парных");
    expect(text).toContain("🧭 Операционный контроль");
    expect(text).toContain("• Telegram-очередь: 2 ждут | 1 с ошибкой | 18 отправлено");
    expect(text).toContain("━━━━━━━━━━━━━━━━━━━━");
    expect(text).not.toMatch(/[�]|Рџ|Рђ|Рµ|СЃ|Ð|Ñ/);
  });
});
