jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/lib/telegram/customer-lookup-code", () => ({
  createTelegramCustomerLookupCode: jest.fn(),
  isTelegramLookupCodeRequest: jest.fn((text?: string) => {
    const normalized = text?.trim().toLowerCase();
    return normalized === "код" || normalized === "code";
  }),
}));

jest.mock("./max-service", () => ({
  sendMaxMessage: jest.fn(),
}));

import { prisma } from "@/lib/prisma";
import { createTelegramCustomerLookupCode } from "@/lib/telegram/customer-lookup-code";
import { sendMaxMessage } from "./max-service";
import { handleMaxUpdate } from "./max-bot";

const mockedPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock };
};
const mockedCreateCode = createTelegramCustomerLookupCode as jest.Mock;
const mockedSendMaxMessage = sendMaxMessage as jest.Mock;

describe("MAX bot", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends a welcome message when the bot starts", async () => {
    await expect(
      handleMaxUpdate({
        update_type: "bot_started",
        user: { id: "max-user-1" },
        chat: { chat_id: "chat-1" },
      }),
    ).resolves.toMatchObject({ ok: true, welcome: true });

    expect(mockedSendMaxMessage).toHaveBeenCalledWith({
      userId: "max-user-1",
      chatId: "chat-1",
      text: expect.stringContaining("Добро пожаловать в NearLoy"),
    });
  });

  it("returns a lookup code for a linked active MAX account", async () => {
    const expiresAt = new Date("2026-08-01T12:15:00.000Z");
    mockedPrisma.user.findUnique.mockResolvedValue({ id: 24, accountStatus: "ACTIVE" });
    mockedCreateCode.mockResolvedValue({ code: "23826", expiresAt });

    const result = await handleMaxUpdate({
      update_type: "message_created",
      message: {
        text: "код",
        sender: { user_id: "max-user-1" },
        recipient: { chat_id: "chat-1" },
      },
    });

    expect(result).toMatchObject({ ok: true, lookupCode: true, expiresAt });
    expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { maxId: "max-user-1" },
      select: { id: true, accountStatus: true },
    });
    expect(mockedCreateCode).toHaveBeenCalledWith(24);
    expect(mockedSendMaxMessage).toHaveBeenCalledWith({
      userId: "max-user-1",
      chatId: "chat-1",
      text: expect.stringContaining("2 3 8 2 6"),
    });
  });

  it("asks to link MAX before sending a lookup code", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      handleMaxUpdate({
        update_type: "message_created",
        message: {
          body: { text: "code" },
          sender: { id: "max-user-1" },
          chat: { id: "chat-1" },
        },
      }),
    ).resolves.toMatchObject({ ok: false, message: "max_not_linked" });

    expect(mockedCreateCode).not.toHaveBeenCalled();
    expect(mockedSendMaxMessage).toHaveBeenCalledWith({
      userId: "max-user-1",
      chatId: "chat-1",
      text: expect.stringContaining("MAX ещё не привязан"),
    });
  });
});
