import { prisma } from "@/lib/prisma";
import { adminTelegramRecipients } from "@/lib/telegram/admin-chat";
import { sendTelegramMessageQueued } from "@/lib/telegram/telegram-queue";

export type DailyReportSnapshot = {
  generatedAt: Date;
  usersTotal: number;
  usersCreatedToday: number;
  usersActive: number;
  usersBlocked: number;
  staffUsers: number;
  usersWithTelegram: number;
  usersWithVerifiedPhone: number;
  loginEventsToday: number;
  companiesTotal: number;
  companiesActive: number;
  companiesOnline: number;
  companyLocationsActive: number;
  companiesAwaitingVerification: number;
  companyVerificationSubmittedToday: number;
  companyVerificationApprovedToday: number;
  companyVerificationRejectedToday: number;
  companyBillingTrial: number;
  companyBillingActive: number;
  companyBillingPastDue: number;
  companyBillingSuspended: number;
  companyBillingExpiringSoon: number;
  companyInvoicesOpen: number;
  companyInvoicesOpenAmount: number;
  companyInvoicesOverdue: number;
  paymentsSucceededToday: number;
  paymentsSucceededAmountToday: number;
  paymentsSucceededMonth: number;
  paymentsSucceededAmountMonth: number;
  paymentsPending: number;
  paymentsPendingAmount: number;
  paymentsFailedToday: number;
  financePayoutsPending: number;
  financePayoutsPendingAmount: number;
  financePayoutsPaidToday: number;
  financePayoutsPaidAmountToday: number;
  activeUserSubscriptions: number;
  userSubscriptionsCreatedToday: number;
  userSubscriptionsExpiringSoon: number;
  subscriptionRedemptionsToday: number;
  bundleRedemptionsToday: number;
  companyPurchasesToday: number;
  companyPurchasesAmountToday: number;
  pointsAwardedToday: number;
  loyaltyEarnedToday: number;
  loyaltySpentToday: number;
  openAdminTasks: number;
  criticalAdminTasks: number;
  adminTasksCreatedToday: number;
  auditWarningsToday: number;
  criticalAuditEventsToday: number;
  telegramQueuePending: number;
  telegramQueueFailed: number;
  telegramQueueSentToday: number;
};

export type DailyReportDelivery = {
  ok: boolean;
  text: string;
  recipients: number;
  sent: number;
  failed: number;
  errors: string[];
};

function startOfLocalDay(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function toNumber(value: unknown) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value === "object" && "toString" in value) return Number(value.toString());
  return 0;
}

export function formatRub(value: number) {
  return `${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ₽`;
}

export function formatDailyReport(snapshot: DailyReportSnapshot) {
  const generatedAt = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Moscow",
  }).format(snapshot.generatedAt);

  const attention = [
    snapshot.criticalAdminTasks > 0 ? `🚨 Критичные задачи: ${snapshot.criticalAdminTasks}` : null,
    snapshot.paymentsFailedToday > 0 ? `💳 Ошибки платежей сегодня: ${snapshot.paymentsFailedToday}` : null,
    snapshot.telegramQueueFailed > 0 ? `📨 Ошибки Telegram-очереди: ${snapshot.telegramQueueFailed}` : null,
    snapshot.companyInvoicesOverdue > 0 ? `⏳ Просроченные счета компаний: ${snapshot.companyInvoicesOverdue}` : null,
    snapshot.companiesAwaitingVerification > 0 ? `🛂 Компании ждут проверки: ${snapshot.companiesAwaitingVerification}` : null,
  ].filter(Boolean);

  return [
    "✨ NearLoy | Ежедневный отчёт",
    `🕒 Сформирован: ${generatedAt}`,
    "━━━━━━━━━━━━━━━━━━━━",
    "",
    attention.length > 0 ? "🔥 Требует внимания" : "✅ Критичных проблем не видно",
    ...(attention.length > 0 ? attention : ["Очереди, платежи и задачи без красных флагов."]),
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "👥 Пользователи",
    `• Всего: ${snapshot.usersTotal} | активных: ${snapshot.usersActive} | заблокировано: ${snapshot.usersBlocked}`,
    `• Новые сегодня: ${snapshot.usersCreatedToday} | команда: ${snapshot.staffUsers}`,
    `• Telegram: ${snapshot.usersWithTelegram} | телефон подтверждён: ${snapshot.usersWithVerifiedPhone}`,
    `• Входы сегодня: ${snapshot.loginEventsToday}`,
    "",
    "🏢 Компании",
    `• Всего: ${snapshot.companiesTotal} | активных: ${snapshot.companiesActive} | онлайн: ${snapshot.companiesOnline}`,
    `• Физические точки: ${snapshot.companyLocationsActive}`,
    `• Верификация: ${snapshot.companiesAwaitingVerification} ждут | +${snapshot.companyVerificationSubmittedToday} заявок сегодня`,
    `• Решения сегодня: ${snapshot.companyVerificationApprovedToday} одобрено | ${snapshot.companyVerificationRejectedToday} отклонено`,
    "",
    "🎟️ Подписка NearLoy для компаний",
    `• Trial: ${snapshot.companyBillingTrial} | active: ${snapshot.companyBillingActive}`,
    `• Past due: ${snapshot.companyBillingPastDue} | suspended: ${snapshot.companyBillingSuspended}`,
    `• Заканчивается за 3 дня: ${snapshot.companyBillingExpiringSoon}`,
    `• Открытые счета: ${snapshot.companyInvoicesOpen} на ${formatRub(snapshot.companyInvoicesOpenAmount)}`,
    `• Просрочено счетов: ${snapshot.companyInvoicesOverdue}`,
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "💰 Платежи и финансы",
    `• Сегодня оплачено: ${snapshot.paymentsSucceededToday} на ${formatRub(snapshot.paymentsSucceededAmountToday)}`,
    `• За месяц: ${snapshot.paymentsSucceededMonth} платежей на ${formatRub(snapshot.paymentsSucceededAmountMonth)}`,
    `• Ожидают оплаты: ${snapshot.paymentsPending} на ${formatRub(snapshot.paymentsPendingAmount)}`,
    `• Ошибки платежей сегодня: ${snapshot.paymentsFailedToday}`,
    `• Заявки на вывод: ${snapshot.financePayoutsPending} на ${formatRub(snapshot.financePayoutsPendingAmount)}`,
    `• Выплачено сегодня: ${snapshot.financePayoutsPaidToday} на ${formatRub(snapshot.financePayoutsPaidAmountToday)}`,
    "",
    "🎁 Клиентские подписки и баллы",
    `• Активные подписки: ${snapshot.activeUserSubscriptions} | новых сегодня: ${snapshot.userSubscriptionsCreatedToday}`,
    `• Истекают за 3 дня: ${snapshot.userSubscriptionsExpiringSoon}`,
    `• Погашения услуг: ${snapshot.subscriptionRedemptionsToday} обычных | ${snapshot.bundleRedemptionsToday} парных`,
    `• Покупки в компаниях: ${snapshot.companyPurchasesToday} на ${formatRub(snapshot.companyPurchasesAmountToday)}`,
    `• Баллы: +${snapshot.loyaltyEarnedToday} начислено | -${snapshot.loyaltySpentToday} списано`,
    `• Через покупки начислено: ${snapshot.pointsAwardedToday}`,
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "🧭 Операционный контроль",
    `• Задачи админов: ${snapshot.openAdminTasks} открытых | ${snapshot.criticalAdminTasks} критичных | +${snapshot.adminTasksCreatedToday} сегодня`,
    `• Аудит: ${snapshot.auditWarningsToday} предупреждений | ${snapshot.criticalAuditEventsToday} критичных событий`,
    `• Telegram-очередь: ${snapshot.telegramQueuePending} ждут | ${snapshot.telegramQueueFailed} с ошибкой | ${snapshot.telegramQueueSentToday} отправлено`,
    "",
    "NearLoy на связи. Если где-то горит — тушим, если растёт — масштабируем.",
  ].join("\n");
}

export async function buildDailyReportSnapshot(now = new Date()): Promise<DailyReportSnapshot> {
  const dayStart = startOfLocalDay(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const [
    usersTotal,
    usersCreatedToday,
    usersActive,
    usersBlocked,
    staffUsers,
    usersWithTelegram,
    usersWithVerifiedPhone,
    loginEventsToday,
    companiesTotal,
    companiesActive,
    companiesOnline,
    companyLocationsActive,
    companiesAwaitingVerification,
    companyVerificationSubmittedToday,
    companyVerificationApprovedToday,
    companyVerificationRejectedToday,
    companyBillingTrial,
    companyBillingActive,
    companyBillingPastDue,
    companyBillingSuspended,
    companyBillingExpiringSoon,
    companyInvoicesOpen,
    companyInvoicesOverdue,
    paymentsSucceededToday,
    paymentsSucceededMonth,
    paymentsPending,
    paymentsFailedToday,
    financePayoutsPending,
    financePayoutsPaidToday,
    activeUserSubscriptions,
    userSubscriptionsCreatedToday,
    userSubscriptionsExpiringSoon,
    subscriptionRedemptionsToday,
    bundleRedemptionsToday,
    companyPurchasesToday,
    loyaltyEarnedToday,
    loyaltySpentToday,
    openAdminTasks,
    criticalAdminTasks,
    adminTasksCreatedToday,
    auditWarningsToday,
    criticalAuditEventsToday,
    telegramQueuePending,
    telegramQueueFailed,
    telegramQueueSentToday,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: dayStart } } }),
    prisma.user.count({ where: { accountStatus: "ACTIVE" } }),
    prisma.user.count({ where: { accountStatus: "BLOCKED" } }),
    prisma.user.count({ where: { role: { in: ["ADMIN", "SUPER_ADMIN", "MANAGER", "SUPPORT", "COMPANY"] } } }),
    prisma.user.count({ where: { telegramId: { not: null } } }),
    prisma.user.count({ where: { phoneVerifiedAt: { not: null } } }),
    prisma.loginEvent.count({ where: { createdAt: { gte: dayStart } } }),
    prisma.company.count(),
    prisma.company.count({ where: { isActive: true } }),
    prisma.company.count({ where: { operatesOnline: true } }),
    prisma.companyLocation.count({ where: { isActive: true } }),
    prisma.company.count({ where: { verificationStatus: { in: ["SUBMITTED", "REVIEWING"] } } }),
    prisma.companyVerificationApplication.count({ where: { status: "SUBMITTED", createdAt: { gte: dayStart } } }),
    prisma.companyVerificationApplication.count({ where: { status: "APPROVED", updatedAt: { gte: dayStart } } }),
    prisma.companyVerificationApplication.count({ where: { status: "REJECTED", updatedAt: { gte: dayStart } } }),
    prisma.companyBillingAccount.count({ where: { status: "TRIAL" } }),
    prisma.companyBillingAccount.count({ where: { status: "ACTIVE" } }),
    prisma.companyBillingAccount.count({ where: { status: "PAST_DUE" } }),
    prisma.companyBillingAccount.count({ where: { status: "SUSPENDED" } }),
    prisma.companyBillingAccount.count({ where: { status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] }, currentPeriodEndsAt: { gte: now, lte: soon } } }),
    prisma.companyBillingInvoice.aggregate({
      where: { status: "OPEN" },
      _count: { _all: true },
      _sum: { amountDue: true },
    }),
    prisma.companyBillingInvoice.count({ where: { status: "OPEN", periodEndsAt: { lt: now } } }),
    prisma.payment.aggregate({
      where: { status: "SUCCEEDED", paidAt: { gte: dayStart } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: "SUCCEEDED", paidAt: { gte: monthStart } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: "PENDING" },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.payment.count({ where: { status: { in: ["FAILED", "CANCELED"] }, updatedAt: { gte: dayStart } } }),
    prisma.financeOperation.aggregate({
      where: { type: "PAYOUT_REQUEST", status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED"] } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.financeOperation.aggregate({
      where: { type: "PAYOUT_REQUEST", status: "PAID", processedAt: { gte: dayStart } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.userSubscription.count({ where: { status: "ACTIVE" } }),
    prisma.userSubscription.count({ where: { createdAt: { gte: dayStart } } }),
    prisma.userSubscription.count({ where: { status: "ACTIVE", expiresAt: { gte: now, lte: soon } } }),
    prisma.subscriptionRedemption.count({ where: { redeemedAt: { gte: dayStart } } }),
    prisma.subscriptionBundleRedemption.count({ where: { redeemedAt: { gte: dayStart } } }),
    prisma.companyPurchase.aggregate({
      where: { createdAt: { gte: dayStart } },
      _count: { _all: true },
      _sum: { amount: true, pointsAwarded: true },
    }),
    prisma.loyaltyTransaction.aggregate({
      where: { type: "EARN", occurredAt: { gte: dayStart } },
      _sum: { amount: true },
    }),
    prisma.loyaltyTransaction.aggregate({
      where: { type: "SPEND", occurredAt: { gte: dayStart } },
      _sum: { amount: true },
    }),
    prisma.adminTask.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.adminTask.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] }, priority: "CRITICAL" } }),
    prisma.adminTask.count({ where: { createdAt: { gte: dayStart } } }),
    prisma.auditEvent.count({ where: { level: "WARN", createdAt: { gte: dayStart } } }),
    prisma.auditEvent.count({ where: { level: "CRITICAL", createdAt: { gte: dayStart } } }),
    prisma.telegramMessageQueue.count({ where: { status: "PENDING" } }),
    prisma.telegramMessageQueue.count({ where: { status: "FAILED" } }),
    prisma.telegramMessageQueue.count({ where: { status: "SENT", sentAt: { gte: dayStart } } }),
  ]);

  return {
    generatedAt: now,
    usersTotal,
    usersCreatedToday,
    usersActive,
    usersBlocked,
    staffUsers,
    usersWithTelegram,
    usersWithVerifiedPhone,
    loginEventsToday,
    companiesTotal,
    companiesActive,
    companiesOnline,
    companyLocationsActive,
    companiesAwaitingVerification,
    companyVerificationSubmittedToday,
    companyVerificationApprovedToday,
    companyVerificationRejectedToday,
    companyBillingTrial,
    companyBillingActive,
    companyBillingPastDue,
    companyBillingSuspended,
    companyBillingExpiringSoon,
    companyInvoicesOpen: companyInvoicesOpen._count._all,
    companyInvoicesOpenAmount: toNumber(companyInvoicesOpen._sum.amountDue),
    companyInvoicesOverdue,
    paymentsSucceededToday: paymentsSucceededToday._count._all,
    paymentsSucceededAmountToday: toNumber(paymentsSucceededToday._sum.amount),
    paymentsSucceededMonth: paymentsSucceededMonth._count._all,
    paymentsSucceededAmountMonth: toNumber(paymentsSucceededMonth._sum.amount),
    paymentsPending: paymentsPending._count._all,
    paymentsPendingAmount: toNumber(paymentsPending._sum.amount),
    paymentsFailedToday,
    financePayoutsPending: financePayoutsPending._count._all,
    financePayoutsPendingAmount: toNumber(financePayoutsPending._sum.amount),
    financePayoutsPaidToday: financePayoutsPaidToday._count._all,
    financePayoutsPaidAmountToday: toNumber(financePayoutsPaidToday._sum.amount),
    activeUserSubscriptions,
    userSubscriptionsCreatedToday,
    userSubscriptionsExpiringSoon,
    subscriptionRedemptionsToday,
    bundleRedemptionsToday,
    companyPurchasesToday: companyPurchasesToday._count._all,
    companyPurchasesAmountToday: toNumber(companyPurchasesToday._sum.amount),
    pointsAwardedToday: toNumber(companyPurchasesToday._sum.pointsAwarded),
    loyaltyEarnedToday: toNumber(loyaltyEarnedToday._sum.amount),
    loyaltySpentToday: toNumber(loyaltySpentToday._sum.amount),
    openAdminTasks,
    criticalAdminTasks,
    adminTasksCreatedToday,
    auditWarningsToday,
    criticalAuditEventsToday,
    telegramQueuePending,
    telegramQueueFailed,
    telegramQueueSentToday,
  };
}

export async function sendDailyReport(now = new Date()): Promise<DailyReportDelivery> {
  const snapshot = await buildDailyReportSnapshot(now);
  const text = formatDailyReport(snapshot);
  const recipients = adminTelegramRecipients();
  const botToken = process.env.TELEGRAM_DEV_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return {
      ok: false,
      text,
      recipients: recipients.length,
      sent: 0,
      failed: recipients.length,
      errors: ["Telegram bot token is not configured."],
    };
  }

  if (recipients.length === 0) {
    return {
      ok: false,
      text,
      recipients: 0,
      sent: 0,
      failed: 0,
      errors: ["Telegram admin chat is not configured."],
    };
  }

  const results = await Promise.all(
    recipients.map((recipient) =>
      sendTelegramMessageQueued({
        botToken,
        chatId: recipient.chatId,
        text,
        recipientRole: recipient.role,
        recipientLabel: recipient.label,
        source: "daily-report",
        sourceId: snapshot.generatedAt.toISOString().slice(0, 10),
        priority: 20,
        proxyUrl: process.env.TELEGRAM_PROXY_URL,
        throwOnFailure: false,
      }),
    ),
  );

  const sent = results.filter((result) => result.ok).length;
  const errors = results.filter((result) => !result.ok).map((result) => result.message ?? "Telegram delivery failed.");

  return {
    ok: sent === recipients.length,
    text,
    recipients: recipients.length,
    sent,
    failed: recipients.length - sent,
    errors,
  };
}
