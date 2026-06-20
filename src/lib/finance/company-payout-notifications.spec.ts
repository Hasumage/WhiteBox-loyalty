jest.mock("@/lib/prisma", () => ({
  prisma: {
    financeOperation: { findUnique: jest.fn() },
  },
}));

jest.mock("@/lib/telegram/telegram-queue", () => ({
  sendTelegramMessageQueued: jest.fn(),
}));
jest.mock("@/lib/telegram/admin-chat", () => ({
  adminTelegramRecipients: jest.fn(() => [
    { chatId: "-1003977200071", role: "admin_chat", label: "NearLoy admin chat" },
  ]),
}));

import { prisma } from "@/lib/prisma";
import { sendTelegramMessageQueued } from "@/lib/telegram/telegram-queue";
import { notifyAdminsAboutCompanyPayout } from "./company-payout-notifications";

const mockedPrisma = jest.mocked(prisma, { shallow: false });
const mockedSendTelegramMessage = jest.mocked(sendTelegramMessageQueued);

describe("company payout Telegram notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = "bot-token";
    process.env.NEXT_PUBLIC_APP_URL = "https://nearloy.example";
    mockedPrisma.financeOperation.findUnique.mockResolvedValue({
      uuid: "payout-1",
      amount: { toString: () => "1250.00" },
      currency: "RUB",
      company: { name: "Aurora Coffee" },
    } as never);
    mockedSendTelegramMessage.mockResolvedValue({
      ok: true,
      queued: false,
      result: { ok: true, result: { message_id: 10 } },
    });
  });

  it("notifies the shared admin chat about a payout request", async () => {
    const result = await notifyAdminsAboutCompanyPayout("payout-1");

    expect(mockedSendTelegramMessage).toHaveBeenCalledTimes(1);
    expect(mockedSendTelegramMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "-1003977200071",
        recipientRole: "admin_chat",
        recipientLabel: "NearLoy admin chat",
        source: "company-payout",
        sourceId: "payout-1",
        priority: 30,
        text: expect.stringContaining("Aurora Coffee"),
      }),
    );
    expect(result).toEqual({ sent: 1, admins: 1 });
  });
});
