import type { TelegramRecipient } from "@/lib/telegram/telegram-service";

export const DEFAULT_TELEGRAM_ADMIN_CHAT_ID = "3977200071";

export function normalizeTelegramAdminChatId(value = process.env.TELEGRAM_ADMIN_CHAT_ID || DEFAULT_TELEGRAM_ADMIN_CHAT_ID) {
  const chatId = value.trim();
  if (!chatId) return "";

  if (chatId.startsWith("-")) return chatId;

  // Telegram supergroup ids are sent to Bot API as -100<internal id>.
  // We store the readable internal id in env to avoid repeating the prefix by hand.
  if (/^\d{10,}$/.test(chatId)) return `-100${chatId}`;

  return chatId;
}

export function adminTelegramRecipients(): TelegramRecipient[] {
  const chatId = normalizeTelegramAdminChatId();
  if (!chatId) return [];

  return [
    {
      chatId,
      role: "admin_chat",
      label: "NearLoy admin chat",
    },
  ];
}
