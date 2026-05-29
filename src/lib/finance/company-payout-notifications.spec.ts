jest.mock("@/lib/prisma", () => ({
  prisma: {
    financeOperation: { findUnique: jest.fn() },
    user: { findMany: jest.fn() },
  },
}));

jest.mock("@/lib/telegram/telegram-queue", () => ({
  sendTelegramMessageQueued: jest.fn(),
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
    process.env.NEXT_PUBLIC_APP_URL = "https://whitebox.example";
    mockedPrisma.financeOperation.findUnique.mockResolvedValue({
      uuid: "payout-1",
      amount: { toString: () => "1250.00" },
      currency: "RUB",
      company: { name: "Aurora Coffee" },
    } as never);
    mockedPrisma.user.findMany.mockResolvedValue([
      { telegramId: BigInt(101), email: "admin@whitebox.test", name: "Admin" },
      { telegramId: BigInt(202), email: "root@whitebox.test", name: "Root" },
    ] as never);
    mockedSendTelegramMessage.mockResolvedValue({
      ok: true,
      queued: false,
      result: { ok: true, result: { message_id: 10 } },
    });
  });

  it("notifies active linked administrators about a payout request", async () => {
    const result = await notifyAdminsAboutCompanyPayout("payout-1");

    expect(mockedPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: { in: ["ADMIN", "SUPER_ADMIN"] },
          accountStatus: "ACTIVE",
          telegramId: { not: null },
        }),
      }),
    );
    expect(mockedSendTelegramMessage).toHaveBeenCalledTimes(2);
    expect(mockedSendTelegramMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "101",
        source: "company-payout",
        sourceId: "payout-1",
        priority: 30,
        text: expect.stringContaining("Aurora Coffee"),
      }),
    );
    expect(result).toEqual({ sent: 2, admins: 2 });
  });
});
