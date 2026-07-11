jest.mock("@/lib/telegram/telegram-queue", () => ({
  sendTelegramMessageQueued: jest.fn(),
}));
jest.mock("@/lib/telegram/admin-chat", () => ({
  adminTelegramRecipients: jest.fn(() => [
    { chatId: "-1003977200071", role: "admin_chat", label: "NearLoy admin chat" },
  ]),
}));

import { sendTelegramMessageQueued } from "@/lib/telegram/telegram-queue";
import { notifyAdminsAboutFinanceOperationStatusChange } from "./finance-operation-notifications";

const mockedSendTelegramMessage = jest.mocked(sendTelegramMessageQueued);

describe("finance operation Telegram notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = "bot-token";
    process.env.NEXT_PUBLIC_APP_URL = "https://nearloy.example";
    mockedSendTelegramMessage.mockResolvedValue({
      ok: true,
      queued: false,
      result: { ok: true, result: { message_id: 10 } },
    });
  });

  it("notifies the shared admin chat without creating a fire task", async () => {
    const result = await notifyAdminsAboutFinanceOperationStatusChange({
      operation: {
        uuid: "finance-1",
        title: "Aurora payout",
        amount: { toString: () => "1500.00" },
        currency: "RUB",
      },
      status: "PAID",
      actorEmail: "admin@nearloy.test",
      manualReference: "bank-42",
    });

    expect(mockedSendTelegramMessage).toHaveBeenCalledTimes(1);
    expect(mockedSendTelegramMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "-1003977200071",
        recipientRole: "admin_chat",
        recipientLabel: "NearLoy admin chat",
        source: "finance-operation-status",
        sourceId: "finance-1",
        priority: 20,
        text: expect.stringContaining("Финансовая операция обновлена"),
      }),
    );
    expect(result).toEqual({ sent: 1, admins: 1 });
  });
});
