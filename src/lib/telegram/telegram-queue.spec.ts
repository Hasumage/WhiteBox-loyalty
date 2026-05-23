jest.mock("@/lib/prisma", () => ({
  prisma: {
    telegramMessageQueue: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    notificationDelivery: {
      count: jest.fn(),
    },
    auditEvent: {
      count: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock("@/lib/telegram/telegram-service", () => ({
  sendTelegramMessage: jest.fn(),
}));

import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram/telegram-service";
import { processTelegramMessageQueue, sendTelegramMessageQueued } from "./telegram-queue";

const mockedPrisma = jest.mocked(prisma, { shallow: false });
const mockedSendTelegramMessage = jest.mocked(sendTelegramMessage);

describe("telegram message queue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = "bot-token";
    mockedPrisma.telegramMessageQueue.count.mockResolvedValue(5);
    mockedPrisma.notificationDelivery.count.mockResolvedValue(0);
    mockedPrisma.auditEvent.count.mockResolvedValue(0);
    mockedPrisma.auditEvent.create.mockResolvedValue({} as never);
  });

  it("stores failed Telegram sends and raises a developer incident when failures spike", async () => {
    mockedSendTelegramMessage.mockRejectedValue(new Error("ECONNRESET"));
    mockedPrisma.telegramMessageQueue.create.mockResolvedValue({ id: "queue-1" } as never);

    const result = await sendTelegramMessageQueued({
      botToken: "bot-token",
      chatId: "8074263460",
      text: "ping",
      source: "test",
      sourceId: "case-1",
      throwOnFailure: false,
    });

    expect(result).toMatchObject({ ok: false, queued: true, queueId: "queue-1" });
    expect(mockedPrisma.telegramMessageQueue.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recipientChatId: "8074263460",
        text: "ping",
        status: "FAILED",
        attempts: 1,
        source: "test",
        sourceId: "case-1",
        lastError: "ECONNRESET",
      }),
    });
    expect(mockedPrisma.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspace: "DEVELOPER",
        level: "CRITICAL",
        action: "Telegram delivery fire",
        tags: ["TELEGRAM", "TELEGRAM_FIRE", "DEVELOPER"],
      }),
    });
  });

  it("drains due queued messages and marks them sent", async () => {
    mockedPrisma.telegramMessageQueue.findMany.mockResolvedValue([
      {
        id: "queue-1",
        recipientChatId: "8074263460",
        text: "queued ping",
        parseMode: null,
        replyMarkup: null,
        attempts: 1,
      },
    ] as never);
    mockedSendTelegramMessage.mockResolvedValue({ ok: true, result: { message_id: 77 } });
    mockedPrisma.telegramMessageQueue.update.mockResolvedValue({} as never);

    const result = await processTelegramMessageQueue();

    expect(result).toMatchObject({ processed: 1, sent: 1, failed: 0 });
    expect(mockedSendTelegramMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        botToken: "bot-token",
        chatId: "8074263460",
        text: "queued ping",
      }),
    );
    expect(mockedPrisma.telegramMessageQueue.update).toHaveBeenCalledWith({
      where: { id: "queue-1" },
      data: expect.objectContaining({
        status: "SENT",
        attempts: 2,
        telegramMessageId: 77,
        lastError: null,
      }),
    });
  });
});
