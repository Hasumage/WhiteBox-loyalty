import type { FinanceOperationStatus } from "@prisma/client";
import { adminTelegramRecipients } from "@/lib/telegram/admin-chat";
import { sendTelegramMessageQueued } from "@/lib/telegram/telegram-queue";
import { escapeTelegramHtml } from "@/lib/telegram/telegram-service";

function adminFinanceUrl() {
  const origin = process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_ORIGIN || process.env.NEXT_PUBLIC_FRONTEND_URL;
  if (!origin) return null;
  try {
    const url = new URL(origin);
    if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return null;
    return `${origin.replace(/\/$/, "")}/admin/finance`;
  } catch {
    return null;
  }
}

function statusLabel(status: FinanceOperationStatus) {
  const labels: Record<FinanceOperationStatus, string> = {
    DRAFT: "черновик",
    PENDING_APPROVAL: "ожидает решения",
    APPROVED: "одобрена",
    REJECTED: "отклонена",
    PAID: "закрыта как выплаченная",
    CANCELED: "отменена",
  };
  return labels[status] ?? status;
}

export async function notifyAdminsAboutFinanceOperationStatusChange(params: {
  operation: {
    uuid: string;
    title: string;
    amount: { toString(): string };
    currency: string;
  };
  status: FinanceOperationStatus;
  actorEmail: string;
  manualReference?: string | null;
  providerPayoutId?: string | null;
}) {
  const recipients = adminTelegramRecipients();
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || recipients.length === 0) return { sent: 0, admins: recipients.length };

  const url = adminFinanceUrl();
  const text = [
    "💳 <b>Финансовая операция обновлена</b>",
    `<code>${escapeTelegramHtml(params.operation.uuid)}</code>`,
    "",
    `<b>Операция:</b> ${escapeTelegramHtml(params.operation.title)}`,
    `<b>Статус:</b> ${escapeTelegramHtml(statusLabel(params.status))}`,
    `<b>Сумма:</b> ${escapeTelegramHtml(params.operation.amount.toString())} ${escapeTelegramHtml(params.operation.currency)}`,
    `<b>Администратор:</b> ${escapeTelegramHtml(params.actorEmail)}`,
    params.manualReference ? `<b>Референс:</b> ${escapeTelegramHtml(params.manualReference)}` : null,
    params.providerPayoutId ? `<b>YooKassa:</b> ${escapeTelegramHtml(params.providerPayoutId)}` : null,
    url ? `\n<a href="${escapeTelegramHtml(url)}">Открыть финансовые операции</a>` : null,
  ]
    .filter(Boolean)
    .join("\n");

  let sent = 0;
  for (const recipient of recipients) {
    const delivery = await sendTelegramMessageQueued({
      botToken,
      chatId: recipient.chatId,
      text,
      parseMode: "HTML",
      proxyUrl: process.env.TELEGRAM_PROXY_URL,
      recipientRole: recipient.role ?? "admin_chat",
      recipientLabel: recipient.label ?? "NearLoy admin chat",
      source: "finance-operation-status",
      sourceId: params.operation.uuid,
      priority: 20,
      throwOnFailure: false,
    });
    if (delivery.ok) sent += 1;
  }

  return { sent, admins: recipients.length };
}
