import { adminTelegramRecipients, normalizeTelegramAdminChatId } from "./admin-chat";

describe("admin Telegram chat routing", () => {
  const originalAdminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  afterEach(() => {
    if (originalAdminChatId === undefined) {
      delete process.env.TELEGRAM_ADMIN_CHAT_ID;
    } else {
      process.env.TELEGRAM_ADMIN_CHAT_ID = originalAdminChatId;
    }
  });

  it("normalizes a readable supergroup id to the Bot API chat id", () => {
    expect(normalizeTelegramAdminChatId("3977200071")).toBe("-1003977200071");
  });

  it("keeps an already-prefixed Telegram chat id", () => {
    expect(normalizeTelegramAdminChatId("-1003977200071")).toBe("-1003977200071");
  });

  it("builds the shared admin recipient from env", () => {
    process.env.TELEGRAM_ADMIN_CHAT_ID = "3977200071";

    expect(adminTelegramRecipients()).toEqual([
      {
        chatId: "-1003977200071",
        role: "admin_chat",
        label: "NearLoy admin chat",
      },
    ]);
  });
});
