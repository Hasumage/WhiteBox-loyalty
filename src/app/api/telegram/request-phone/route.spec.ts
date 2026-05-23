jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
  },
}));

jest.mock("@/lib/auth/require-user-session", () => ({
  requireUserSession: jest.fn(),
  isUserAuthResponse: (value: unknown) => value instanceof Response,
}));

jest.mock("@/lib/telegram/telegram-queue", () => ({
  sendTelegramMessageQueued: jest.fn(),
}));

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserSession } from "@/lib/auth/require-user-session";
import { sendTelegramMessageQueued } from "@/lib/telegram/telegram-queue";
import { POST } from "./route";

const mockedRequireUserSession = jest.mocked(requireUserSession);
const mockedPrisma = jest.mocked(prisma, { shallow: false });
const mockedSendTelegramMessage = jest.mocked(sendTelegramMessageQueued);

describe("user telegram phone request route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = "bot-token";
  });

  it("sends request_contact keyboard to linked active user", async () => {
    mockedRequireUserSession.mockResolvedValue({ userId: 7, email: "client@test.local", role: "CLIENT" });
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 7,
      email: "client@test.local",
      accountStatus: "ACTIVE",
      telegramId: BigInt(1348887499),
      phoneNumber: null,
    } as never);
    mockedSendTelegramMessage.mockResolvedValue({ ok: true, queued: false, result: { ok: true, result: { message_id: 10 } } });

    const res = await POST(new NextRequest("http://localhost/api/telegram/request-phone", { method: "POST" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sent).toBe(true);
    expect(mockedSendTelegramMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1348887499",
        replyMarkup: expect.objectContaining({
          keyboard: [[expect.objectContaining({ request_contact: true })]],
        }),
      }),
    );
  });

  it("requires Telegram to be connected first", async () => {
    mockedRequireUserSession.mockResolvedValue({ userId: 7, email: "client@test.local", role: "CLIENT" });
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 7,
      email: "client@test.local",
      accountStatus: "ACTIVE",
      telegramId: null,
      phoneNumber: null,
    } as never);

    const res = await POST(new NextRequest("http://localhost/api/telegram/request-phone", { method: "POST" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.message).toContain("Сначала подключите Telegram");
    expect(mockedSendTelegramMessage).not.toHaveBeenCalled();
  });

  it("falls back when the active Prisma client has no phone fields yet", async () => {
    mockedRequireUserSession.mockResolvedValue({ userId: 7, email: "client@test.local", role: "CLIENT" });
    mockedPrisma.user.findUnique
      .mockRejectedValueOnce(new Error("Unknown field `phoneNumber` for select statement on model User."))
      .mockResolvedValueOnce({
        id: 7,
        email: "client@test.local",
        accountStatus: "ACTIVE",
        telegramId: BigInt(1348887499),
      } as never);
    mockedSendTelegramMessage.mockResolvedValue({ ok: true, queued: false, result: { ok: true, result: { message_id: 11 } } });

    const res = await POST(new NextRequest("http://localhost/api/telegram/request-phone", { method: "POST" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sent).toBe(true);
    expect(mockedSendTelegramMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1348887499",
        text: expect.stringContaining("Поделиться телефоном"),
      }),
    );
  });
});
