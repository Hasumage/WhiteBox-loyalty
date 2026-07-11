import type { CompanyBillingAccount, CompanyBillingInvoice } from "@prisma/client";
import { CompanyBillingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { escapeTelegramHtml } from "@/lib/telegram/telegram-service";
import { sendTelegramMessageQueued } from "@/lib/telegram/telegram-queue";

export const DEFAULT_COMPANY_BILLING_EXTENSION_TEMPLATE = [
  "✨ <b>Подписка NearLoy продлена</b>",
  "",
  "Компания: <b>{companyName}</b>",
  "Доступ действует до <b>{periodEndsAt}</b>.",
  "{commentLine}",
].join("\n");

type BillingExtensionActor = {
  id: number;
  email: string;
  name: string;
  role: string;
};

export type CompanyBillingExtensionInput = {
  ownerUserUuid: string;
  actor: BillingExtensionActor;
  months?: number;
  days?: number;
  comment?: string;
  notificationText?: string;
  notifyTelegram?: boolean;
};

export class CompanyBillingExtensionError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

function money(value: unknown) {
  return Number(value ?? 0).toFixed(2);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  const day = next.getDate();
  next.setMonth(next.getMonth() + months);
  if (next.getDate() !== day) next.setDate(0);
  return next;
}

function clampWholeNumber(value: number | undefined, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value!)));
}

function formatRuDateTime(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function renderTemplate(template: string, params: { companyName: string; periodEndsAt: Date; comment?: string }) {
  const safeComment = params.comment?.trim();
  return template
    .replaceAll("{companyName}", escapeTelegramHtml(params.companyName))
    .replaceAll("{periodEndsAt}", escapeTelegramHtml(formatRuDateTime(params.periodEndsAt)))
    .replaceAll(
      "{commentLine}",
      safeComment ? `Комментарий: ${escapeTelegramHtml(safeComment)}` : "",
    )
    .trim();
}

async function uniqueInvoiceStart(companyId: number, preferred: Date) {
  let candidate = new Date(preferred);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const existing = await prisma.companyBillingInvoice.findFirst({
      where: { companyId, periodStartsAt: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = new Date(candidate.getTime() + 1000);
  }
  return new Date();
}

function serializeAccount(account: CompanyBillingAccount) {
  return {
    status: account.status,
    trialStartedAt: account.trialStartedAt?.toISOString() ?? null,
    trialEndsAt: account.trialEndsAt?.toISOString() ?? null,
    currentPeriodStartsAt: account.currentPeriodStartsAt.toISOString(),
    currentPeriodEndsAt: account.currentPeriodEndsAt.toISOString(),
  };
}

function serializeInvoice(invoice: CompanyBillingInvoice) {
  return {
    uuid: invoice.uuid,
    status: invoice.status,
    periodStartsAt: invoice.periodStartsAt.toISOString(),
    periodEndsAt: invoice.periodEndsAt.toISOString(),
    baseFee: money(invoice.baseFee),
    promoDiscountAmount: money(invoice.promoDiscountAmount),
    commissionCreditAmount: money(invoice.commissionCreditAmount),
    amountDue: money(invoice.amountDue),
    paidAmount: money(invoice.paidAmount),
    paidAt: invoice.paidAt?.toISOString() ?? null,
  };
}

async function notifyCompanyLeaders(params: {
  companyId: number;
  companyName: string;
  text: string;
}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return { attempted: 0, delivered: 0, queued: 0, skipped: 0 };

  const company = await prisma.company.findUnique({
    where: { id: params.companyId },
    select: {
      owner: { select: { telegramId: true, name: true, email: true } },
      members: {
        where: { isActive: true, role: { in: ["OWNER", "MANAGER"] } },
        select: {
          role: true,
          user: { select: { telegramId: true, name: true, email: true } },
        },
      },
    },
  });

  const recipients = [
    company?.owner ? { ...company.owner, role: "OWNER" } : null,
    ...(company?.members.map((member) => ({ ...member.user, role: member.role })) ?? []),
  ]
    .filter((recipient): recipient is { telegramId: bigint; name: string; email: string; role: string } => Boolean(recipient?.telegramId))
    .filter((recipient, index, rows) => rows.findIndex((row) => row.telegramId === recipient.telegramId) === index);

  let delivered = 0;
  let queued = 0;
  for (const recipient of recipients) {
    const result = await sendTelegramMessageQueued({
      botToken,
      chatId: recipient.telegramId.toString(),
      text: params.text,
      parseMode: "HTML",
      proxyUrl: process.env.TELEGRAM_PROXY_URL,
      recipientRole: recipient.role,
      recipientLabel: recipient.name || recipient.email,
      source: "company_billing_extension",
      sourceId: String(params.companyId),
      priority: 3,
      throwOnFailure: false,
    });
    if (result.ok) delivered += 1;
    if (!result.ok && result.queued) queued += 1;
  }

  return {
    attempted: recipients.length,
    delivered,
    queued,
    skipped: Math.max(0, recipients.length - delivered - queued),
  };
}

export async function extendCompanyBillingWithoutPayment(input: CompanyBillingExtensionInput) {
  const months = input.days ? 0 : clampWholeNumber(input.months, 1, 1, 24);
  const days = input.days ? clampWholeNumber(input.days, 30, 1, 730) : 0;
  const now = new Date();

  const owner = await prisma.user.findUnique({
    where: { uuid: input.ownerUserUuid },
    select: {
      id: true,
      uuid: true,
      name: true,
      email: true,
      managedCompany: {
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          platformMonthlyFee: true,
          monthlyFeeOverride: true,
          billingAccount: true,
        },
      },
    },
  });

  const company = owner?.managedCompany;
  if (!owner || !company) {
    throw new CompanyBillingExtensionError("Company owner was not found.", 404);
  }

  const currentEnd =
    company.billingAccount?.currentPeriodEndsAt && company.billingAccount.currentPeriodEndsAt > now
      ? company.billingAccount.currentPeriodEndsAt
      : now;
  const currentStart =
    company.billingAccount?.currentPeriodStartsAt && company.billingAccount.currentPeriodEndsAt > now
      ? company.billingAccount.currentPeriodStartsAt
      : now;
  const nextEnd = days > 0 ? addDays(currentEnd, days) : addMonths(currentEnd, months);
  const invoiceStart = await uniqueInvoiceStart(company.id, currentEnd);
  const baseFee = company.monthlyFeeOverride ?? company.platformMonthlyFee;
  const comment = input.comment?.trim().slice(0, 1000) || "";

  const result = await prisma.$transaction(async (tx) => {
    await tx.companyBillingInvoice.updateMany({
      where: {
        companyId: company.id,
        status: "OPEN",
        periodStartsAt: { lt: nextEnd },
      },
      data: {
        status: "CANCELED",
        paidAt: null,
      },
    });

    const account = await tx.companyBillingAccount.upsert({
      where: { companyId: company.id },
      update: {
        status: CompanyBillingStatus.ACTIVE,
        trialEndsAt: null,
        currentPeriodStartsAt: currentStart,
        currentPeriodEndsAt: nextEnd,
      },
      create: {
        companyId: company.id,
        status: CompanyBillingStatus.ACTIVE,
        currentPeriodStartsAt: currentStart,
        currentPeriodEndsAt: nextEnd,
      },
    });

    const invoice = await tx.companyBillingInvoice.create({
      data: {
        companyId: company.id,
        status: "WAIVED",
        periodStartsAt: invoiceStart,
        periodEndsAt: nextEnd,
        baseFee,
        promoDiscountAmount: 0,
        commissionCreditAmount: 0,
        amountDue: 0,
        paidAmount: 0,
        paidAt: now,
      },
    });

    await tx.auditEvent.create({
      data: {
        workspace: "MANAGER",
        level: "INFO",
        category: "BILLING",
        action: "Company NearLoy subscription extended without payment",
        details: [
          `Company: ${company.name} (${company.slug})`,
          `Extended until: ${nextEnd.toISOString()}`,
          `Duration: ${days > 0 ? `${days} days` : `${months} months`}`,
          comment ? `Comment: ${comment}` : null,
        ].filter(Boolean).join("\n"),
        actorUserId: input.actor.id,
        actorLabel: input.actor.name || input.actor.email,
        targetUserId: owner.id,
        targetLabel: company.name,
        targetEmail: owner.email,
        targetUuid: owner.uuid,
        result: "SUCCESS",
        tags: ["COMPANY_BILLING", "MANUAL_EXTENSION", "WAIVED_INVOICE"],
      },
    });

    return { account, invoice };
  });

  const notificationText = renderTemplate(
    input.notificationText?.trim() || DEFAULT_COMPANY_BILLING_EXTENSION_TEMPLATE,
    { companyName: company.name, periodEndsAt: nextEnd, comment },
  );
  const telegram = input.notifyTelegram === false
    ? { attempted: 0, delivered: 0, queued: 0, skipped: 0 }
    : await notifyCompanyLeaders({ companyId: company.id, companyName: company.name, text: notificationText }).catch(() => ({
        attempted: 0,
        delivered: 0,
        queued: 0,
        skipped: 0,
      }));

  return {
    company: {
      owner: { uuid: owner.uuid, name: owner.name, email: owner.email },
      profile: { id: company.id, name: company.name, slug: company.slug, isActive: company.isActive },
    },
    billing: {
      account: serializeAccount(result.account),
      invoice: serializeInvoice(result.invoice),
    },
    notification: {
      text: notificationText,
      telegram,
    },
  };
}
