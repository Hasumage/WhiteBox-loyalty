import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessageQueued } from "@/lib/telegram/telegram-queue";
import { escapeTelegramHtml } from "@/lib/telegram/telegram-service";

type TelegramUserRecipient = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  telegramId: bigint | null;
};

function botToken() {
  if (process.env.NODE_ENV === "production") {
    return process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_DEV_BOT_TOKEN || "";
  }
  return process.env.TELEGRAM_DEV_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
}

function appOrigin() {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.FRONTEND_ORIGIN ||
    process.env.NEXT_PUBLIC_FRONTEND_URL ||
    process.env.RAILWAY_PUBLIC_DOMAIN;

  if (!configured) return "";
  const value = configured.replace(/\/$/, "");
  return value.startsWith("http") ? value : `https://${value}`;
}

function chatId(value: bigint | null | undefined) {
  return value == null ? "" : value.toString();
}

function recipientLabel(user: Pick<TelegramUserRecipient, "name" | "email">) {
  return `${user.name || user.email} · ${user.email}`;
}

function formatRub(value: number) {
  return `${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ₽`;
}

async function sendToUsers(params: {
  users: TelegramUserRecipient[];
  text: string;
  source: string;
  sourceId: string;
  priority?: number;
}) {
  const token = botToken();
  const recipients = params.users.filter((user) => user.telegramId);
  if (!token || recipients.length === 0) {
    return { sent: 0, failed: recipients.length, skipped: params.users.length - recipients.length };
  }

  const results = await Promise.all(
    recipients.map((user) =>
      sendTelegramMessageQueued({
        botToken: token,
        chatId: chatId(user.telegramId),
        text: params.text,
        parseMode: "HTML",
        recipientRole: user.role,
        recipientLabel: recipientLabel(user),
        source: params.source,
        sourceId: params.sourceId,
        priority: params.priority ?? 10,
        proxyUrl: process.env.TELEGRAM_PROXY_URL,
        throwOnFailure: false,
      }),
    ),
  );

  return {
    sent: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    skipped: params.users.length - recipients.length,
  };
}

export async function notifySuperAdminsPrPayoutCreated(operationUuid: string) {
  const operation = await prisma.financeOperation.findUnique({
    where: { uuid: operationUuid },
    include: {
      requestedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          prPayoutBankName: true,
          prPayoutPhone: true,
          prPayoutCardLast4: true,
        },
      },
    },
  });
  if (!operation?.requestedBy) return { sent: 0, failed: 0, skipped: 0 };

  const superAdmins = await prisma.user.findMany({
    where: { role: "SUPER_ADMIN", telegramId: { not: null }, accountStatus: "ACTIVE" },
    select: { id: true, name: true, email: true, role: true, telegramId: true },
  });

  const origin = appOrigin();
  const requisites = [
    operation.requestedBy.prPayoutBankName,
    operation.requestedBy.prPayoutPhone ? `телефон ${operation.requestedBy.prPayoutPhone}` : null,
    operation.requestedBy.prPayoutCardLast4 ? `карта •••• ${operation.requestedBy.prPayoutCardLast4}` : null,
  ].filter(Boolean);

  const text = [
    "💸 <b>Новая PR-заявка на выплату</b>",
    "",
    `PR: <b>${escapeTelegramHtml(operation.requestedBy.name || operation.requestedBy.email)}</b>`,
    `Сумма: <b>${escapeTelegramHtml(formatRub(Number(operation.amount)))}</b>`,
    `Реквизиты: ${escapeTelegramHtml(requisites.join(", ") || "не указаны")}`,
    origin ? `Открыть: ${origin}/admin/finance` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return sendToUsers({
    users: superAdmins,
    text,
    source: "pr-payout-request",
    sourceId: operation.uuid,
    priority: 30,
  });
}

export async function notifyCompaniesBillingExpiringSoon(now = new Date()) {
  const target = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const dayStart = new Date(target);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const accounts = await prisma.companyBillingAccount.findMany({
    where: {
      status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] },
      currentPeriodEndsAt: { gte: dayStart, lt: dayEnd },
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          slug: true,
          owner: { select: { id: true, name: true, email: true, role: true, telegramId: true } },
          members: {
            where: { isActive: true, role: { in: ["OWNER", "MANAGER"] } },
            select: { user: { select: { id: true, name: true, email: true, role: true, telegramId: true } } },
          },
        },
      },
    },
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const origin = appOrigin();

  for (const account of accounts) {
    const usersById = new Map<number, TelegramUserRecipient>();
    if (account.company.owner) usersById.set(account.company.owner.id, account.company.owner);
    for (const member of account.company.members) usersById.set(member.user.id, member.user);

    const endsAt = account.currentPeriodEndsAt.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Moscow",
    });
    const text = [
      "⏳ <b>Подписка NearLoy скоро закончится</b>",
      "",
      `Компания: <b>${escapeTelegramHtml(account.company.name)}</b>`,
      `Дата окончания: ${escapeTelegramHtml(endsAt)}`,
      "Продлите подписку заранее, чтобы доступ команды не прерывался.",
      origin ? `Открыть оплату: ${origin}/company/subscription` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await sendToUsers({
      users: [...usersById.values()],
      text,
      source: "company-billing-expiring",
      sourceId: `${account.companyId}:${account.currentPeriodEndsAt.toISOString().slice(0, 10)}`,
      priority: 15,
    });
    sent += result.sent;
    failed += result.failed;
    skipped += result.skipped;
  }

  return { sent, failed, skipped, companies: accounts.length };
}

export async function sendTelegramDoneNotice(text: string) {
  const token = botToken();
  const adminChat = process.env.TELEGRAM_ADMIN_CHAT_ID || "3977200071";
  if (!token || !adminChat) return { ok: false, message: "Telegram bot/admin chat is not configured." };

  return sendTelegramMessageQueued({
    botToken: token,
    chatId: adminChat.startsWith("-") ? adminChat : adminChat,
    text,
    parseMode: "HTML",
    recipientRole: "admin_chat",
    recipientLabel: "NearLoy admin chat",
    source: "codex-task-done",
    sourceId: new Date().toISOString(),
    priority: 40,
    proxyUrl: process.env.TELEGRAM_PROXY_URL,
    throwOnFailure: false,
  });
}
