jest.mock("@/lib/prisma", () => ({
  prisma: {
    telegramLinkToken: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    $transaction: jest.fn((operations: unknown[]) => Promise.all(operations)),
  },
}));

jest.mock("@/lib/telegram/telegram-service", () => ({
  answerTelegramCallbackQuery: jest.fn(),
}));

jest.mock("@/lib/telegram/telegram-queue", () => ({
  sendTelegramMessageQueued: jest.fn(),
}));

jest.mock("@/lib/leads/landing-leads", () => ({ updateLandingLeadStatus: jest.fn() }));
jest.mock("@/lib/telegram/telegram-webhook", () => ({
  extractLeadUuidFromText: jest.fn(),
  labelFromLeadAction: jest.fn(),
  parseLeadCallbackData: jest.fn(),
  statusFromLeadAction: jest.fn(),
}));

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessageQueued } from "@/lib/telegram/telegram-queue";
import { POST } from "@/app/api/telegram/webhook/route";

const mockedPrisma = jest.mocked(prisma, { shallow: false });
const mockedSend = jest.mocked(sendTelegramMessageQueued);

describe("telegram admin link webhook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    mockedSend.mockResolvedValue({ ok: true, queued: false, result: { ok: true, result: { message_id: 1 } } });
  });

  it("links admin when Telegram strips deep-link payload and exactly one token is active", async () => {
    const token = {
      id: 10,
      token: "abc",
      userId: 7,
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 7 },
    };
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedPrisma.telegramLinkToken.findMany.mockResolvedValue([token] as never);
    mockedPrisma.user.findFirst.mockResolvedValue(null);
    mockedPrisma.user.update.mockResolvedValue({} as never);
    mockedPrisma.telegramLinkToken.update.mockResolvedValue({} as never);

    const res = await POST(new NextRequest("http://localhost/api/telegram/webhook", {
      method: "POST",
      body: JSON.stringify({ message: { text: "/start", from: { id: 1348887499 }, chat: { id: 1348887499 } } }),
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockedPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { telegramId: BigInt(1348887499) },
    });
  });

  it("rejects link when Telegram id is already connected to another account", async () => {
    const token = {
      id: 10,
      token: "abc",
      userId: 7,
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 7, accountStatus: "ACTIVE" },
    };
    mockedPrisma.telegramLinkToken.findUnique.mockResolvedValue(token as never);
    mockedPrisma.user.findFirst.mockResolvedValue({ id: 99 } as never);

    const res = await POST(new NextRequest("http://localhost/api/telegram/webhook", {
      method: "POST",
      body: JSON.stringify({ message: { text: "/start link_abc", from: { id: 1348887499 }, chat: { id: 1348887499, type: "private" } } }),
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toBe("telegram_already_linked");
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
    expect(mockedSend).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining("уже привязан"),
    }));
  });

  it("shows the welcome menu when plain start has ambiguous active tokens", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedPrisma.telegramLinkToken.findMany.mockResolvedValue([
      { id: 1 },
      { id: 2 },
    ] as never);

    const res = await POST(new NextRequest("http://localhost/api/telegram/webhook", {
      method: "POST",
      body: JSON.stringify({ message: { text: "/start", from: { id: 1348887499 }, chat: { id: 1348887499 } } }),
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, welcome: true });
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
    expect(mockedSend).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("Добро пожаловать в NearLoy"),
      }),
    );
  });
});
