jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    telegramLinkToken: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/leads/landing-leads", () => ({
  updateLandingLeadStatus: jest.fn(),
}));

jest.mock("@/lib/telegram/telegram-service", () => ({
  answerTelegramCallbackQuery: jest.fn(),
}));

jest.mock("@/lib/telegram/telegram-queue", () => ({
  sendTelegramMessageQueued: jest.fn(),
}));

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessageQueued } from "@/lib/telegram/telegram-queue";
import { POST } from "./route";

const mockedPrisma = jest.mocked(prisma, { shallow: false });
const mockedSendTelegramMessage = jest.mocked(sendTelegramMessageQueued);

describe("telegram webhook phone binding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = "bot-token";
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
  });

  it("binds phone only from the sender's own Telegram contact", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({ id: 7, accountStatus: "ACTIVE" } as never);
    mockedPrisma.user.findFirst.mockResolvedValue(null);
    mockedPrisma.user.update.mockResolvedValue({} as never);
    mockedSendTelegramMessage.mockResolvedValue({ ok: true, queued: false, result: { ok: true, result: { message_id: 1 } } });

    const res = await POST(
      new NextRequest("http://localhost/api/telegram/webhook", {
        method: "POST",
        body: JSON.stringify({
          message: {
            from: { id: 1348887499 },
            chat: { id: 1348887499, type: "private" },
            contact: { user_id: 1348887499, phone_number: "79990001122" },
          },
        }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, phoneLinked: true });
    expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { telegramId: BigInt(1348887499) } }),
    );
    expect(mockedPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { phoneNumber: "+79990001122", phoneVerifiedAt: expect.any(Date) },
    });
  });

  it("rejects forwarded or foreign contacts", async () => {
    mockedSendTelegramMessage.mockResolvedValue({ ok: true, queued: false, result: { ok: true, result: { message_id: 1 } } });

    const res = await POST(
      new NextRequest("http://localhost/api/telegram/webhook", {
        method: "POST",
        body: JSON.stringify({
          message: {
            from: { id: 1348887499 },
            chat: { id: 1348887499, type: "private" },
            contact: { user_id: 555, phone_number: "79990001122" },
          },
        }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: false, message: "contact_owner_mismatch" });
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
  });

  it("binds phone through raw SQL fallback when Prisma client is stale", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({ id: 13, accountStatus: "ACTIVE" } as never);
    mockedPrisma.user.findFirst.mockRejectedValue(new Error("Unknown field `phoneNumber` for where statement on model User."));
    mockedPrisma.$queryRaw.mockResolvedValue([] as never);
    mockedPrisma.user.update.mockRejectedValue(new Error("Unknown field `phoneNumber` for data statement on model User."));
    mockedPrisma.$executeRaw.mockResolvedValue(1 as never);
    mockedSendTelegramMessage.mockResolvedValue({ ok: true, queued: false, result: { ok: true, result: { message_id: 5 } } });

    const res = await POST(
      new NextRequest("http://localhost/api/telegram/webhook", {
        method: "POST",
        body: JSON.stringify({
          message: {
            from: { id: 8074263460 },
            chat: { id: 8074263460, type: "private" },
            contact: { user_id: 8074263460, phone_number: "+79253684667" },
          },
        }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, phoneLinked: true });
    expect(mockedPrisma.$queryRaw).toHaveBeenCalled();
    expect(mockedPrisma.$executeRaw).toHaveBeenCalled();
  });

  it("links Telegram and immediately asks for phone via Telegram keyboard", async () => {
    mockedPrisma.telegramLinkToken.findUnique.mockResolvedValue({
      id: "link-token-id",
      token: "abc",
      userId: 7,
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { accountStatus: "ACTIVE" },
    } as never);
    mockedPrisma.user.findFirst.mockResolvedValue(null);
    mockedPrisma.user.update.mockResolvedValue({} as never);
    mockedPrisma.telegramLinkToken.update.mockResolvedValue({} as never);
    mockedPrisma.$transaction.mockResolvedValue([{}, {}] as never);
    mockedSendTelegramMessage.mockResolvedValue({ ok: true, queued: false, result: { ok: true, result: { message_id: 2 } } });

    const res = await POST(
      new NextRequest("http://localhost/api/telegram/webhook", {
        method: "POST",
        body: JSON.stringify({
          message: {
            text: "/start link_abc",
            from: { id: 1348887499 },
            chat: { id: 1348887499, type: "private" },
          },
        }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, linkedUserId: 7 });
    expect(mockedSendTelegramMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1348887499",
        text: expect.stringContaining("Telegram успешно привязан"),
        replyMarkup: expect.objectContaining({
          keyboard: [
            [expect.objectContaining({ request_contact: true })],
            [expect.objectContaining({ web_app: { url: "https://nearloy.app/" } })],
          ],
        }),
      }),
    );
  });

  it("uses the only active fallback token when Telegram sends plain /start", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedPrisma.telegramLinkToken.findMany.mockResolvedValue([
      {
        id: "fallback-token-id",
        token: "fallback",
        userId: 13,
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
        user: { accountStatus: "ACTIVE" },
      },
    ] as never);
    mockedPrisma.user.findFirst.mockResolvedValue(null);
    mockedPrisma.user.update.mockResolvedValue({} as never);
    mockedPrisma.telegramLinkToken.update.mockResolvedValue({} as never);
    mockedPrisma.$transaction.mockResolvedValue([{}, {}] as never);
    mockedSendTelegramMessage.mockResolvedValue({ ok: true, queued: false, result: { ok: true, result: { message_id: 4 } } });

    const res = await POST(
      new NextRequest("http://localhost/api/telegram/webhook", {
        method: "POST",
        body: JSON.stringify({
          message: {
            text: "/start",
            from: { id: 8074263460 },
            chat: { id: 8074263460, type: "private" },
          },
        }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, linkedUserId: 13 });
    expect(mockedPrisma.telegramLinkToken.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ usedAt: null }),
        take: 2,
      }),
    );
  });

  it("shows a welcome menu for plain /start when there is no active link token", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedPrisma.telegramLinkToken.findMany.mockResolvedValue([] as never);
    mockedSendTelegramMessage.mockResolvedValue({ ok: true, queued: false, result: { ok: true, result: { message_id: 10 } } });

    const res = await POST(
      new NextRequest("http://localhost/api/telegram/webhook", {
        method: "POST",
        body: JSON.stringify({
          message: {
            text: "/start",
            from: { id: 1348887499 },
            chat: { id: 1348887499, type: "private" },
          },
        }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, welcome: true });
    expect(mockedSendTelegramMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1348887499",
        text: expect.stringContaining("Добро пожаловать в NearLoy"),
        replyMarkup: {
          inline_keyboard: [
            [{ text: "Открыть NearLoy", web_app: { url: "https://nearloy.app/" } }],
            [{ text: "Помощь", web_app: { url: "https://nearloy.app/help" } }],
          ],
        },
      }),
    );
  });

  it("treats repeated /start for an already linked account as idempotent", async () => {
    mockedPrisma.telegramLinkToken.findUnique.mockResolvedValue({
      id: "used-token-id",
      token: "abc",
      userId: 13,
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      user: { accountStatus: "ACTIVE" },
    } as never);
    mockedPrisma.user.findUnique.mockResolvedValue({ id: 13, accountStatus: "ACTIVE" } as never);
    mockedSendTelegramMessage.mockResolvedValue({ ok: true, queued: false, result: { ok: true, result: { message_id: 6 } } });

    const res = await POST(
      new NextRequest("http://localhost/api/telegram/webhook", {
        method: "POST",
        body: JSON.stringify({
          message: {
            text: "/start link_abc",
            from: { id: 8074263460 },
            chat: { id: 8074263460, type: "private" },
          },
        }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, alreadyLinked: true, linkedUserId: 13 });
    expect(mockedSendTelegramMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "8074263460",
        text: expect.stringContaining("Telegram уже подключён"),
        replyMarkup: expect.objectContaining({
          keyboard: [
            [expect.objectContaining({ request_contact: true })],
            [expect.objectContaining({ web_app: { url: "https://nearloy.app/" } })],
          ],
        }),
      }),
    );
  });

  it("adds a NearLoy Web App button when the link is expired", async () => {
    mockedPrisma.telegramLinkToken.findUnique.mockResolvedValue(null);
    mockedSendTelegramMessage.mockResolvedValue({ ok: true, queued: false, result: { ok: true, result: { message_id: 8 } } });

    const res = await POST(
      new NextRequest("http://localhost/api/telegram/webhook", {
        method: "POST",
        body: JSON.stringify({
          message: {
            text: "/start link_expired",
            from: { id: 1348887499 },
            chat: { id: 1348887499, type: "private" },
          },
        }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: false, message: "expired" });
    expect(mockedSendTelegramMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("Ссылка NearLoy устарела"),
        replyMarkup: {
          inline_keyboard: [[{ text: "Открыть NearLoy", web_app: { url: "https://nearloy.app/" } }]],
        },
      }),
    );
  });

  it("sends a safe Telegram error instead of leaking stack traces", async () => {
    mockedPrisma.telegramLinkToken.findUnique.mockRejectedValue(new Error("database exploded"));
    mockedSendTelegramMessage.mockResolvedValue({ ok: true, queued: false, result: { ok: true, result: { message_id: 3 } } });

    const res = await POST(
      new NextRequest("http://localhost/api/telegram/webhook", {
        method: "POST",
        body: JSON.stringify({
          message: {
            text: "/start link_abc",
            from: { id: 1348887499 },
            chat: { id: 1348887499, type: "private" },
          },
        }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toMatchObject({ ok: false, message: "telegram_message_processing_failed" });
    expect(mockedSendTelegramMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1348887499",
        text: expect.stringContaining("Не удалось обработать привязку Telegram"),
      }),
    );
  });
});

