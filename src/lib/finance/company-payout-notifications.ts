import { prisma } from "@/lib/prisma";
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

export async function notifyAdminsAboutCompanyPayout(operationUuid: string) {
  const operation = await prisma.financeOperation.findUnique({
    where: { uuid: operationUuid },
    include: { company: { select: { name: true } } },
  });
  if (!operation) throw new Error("Payout request not found.");

  const recipients = adminTelegramRecipients();

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || recipients.length === 0) return { sent: 0, admins: recipients.length };

  const url = adminFinanceUrl();
  const text = [
    "\u{1F4B8} <b>Новая заявка на вывод средств NearLoy</b>",
    `<code>${escapeTelegramHtml(operation.uuid)}</code>`,
    "",
    `<b>Компания:</b> ${escapeTelegramHtml(operation.company?.name || "Не указана")}`,
    `<b>Сумма:</b> ${escapeTelegramHtml(operation.amount.toString())} ${escapeTelegramHtml(operation.currency)}`,
    "",
    "Проверьте заработанный баланс, резерв и активные подписки компании перед одобрением.",
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
      source: "company-payout",
      sourceId: operation.uuid,
      priority: 30,
      throwOnFailure: false,
    });
    if (delivery.ok) sent += 1;
  }

  return { sent, admins: recipients.length };
}
