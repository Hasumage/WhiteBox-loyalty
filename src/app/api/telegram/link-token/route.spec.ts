jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    telegramLinkToken: { updateMany: jest.fn(), create: jest.fn() },
    $transaction: jest.fn((operations: unknown[]) => Promise.all(operations)),
  },
}));

jest.mock("@/lib/auth/require-user-session", () => ({
  requireUserSession: jest.fn(),
  isUserAuthResponse: (value: unknown) => value instanceof Response,
}));

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserSession } from "@/lib/auth/require-user-session";
import { POST } from "./route";

const mockedRequireUserSession = jest.mocked(requireUserSession);
const mockedPrisma = jest.mocked(prisma, { shallow: false });

describe("user telegram link token route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TELEGRAM_BOT_USERNAME = "NearLoy_Loyalty_bot";
  });

  it("creates a one-time Telegram link for any active user", async () => {
    mockedRequireUserSession.mockResolvedValue({ userId: 7, email: "client@test.local", role: "CLIENT" });
    mockedPrisma.user.findUnique.mockResolvedValue({ id: 7, email: "client@test.local", accountStatus: "ACTIVE" } as never);
    mockedPrisma.telegramLinkToken.updateMany.mockResolvedValue({ count: 1 } as never);
    mockedPrisma.telegramLinkToken.create.mockResolvedValue({} as never);

    const res = await POST(new NextRequest("http://localhost/api/telegram/link-token", { method: "POST" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.deepLink).toContain("https://t.me/NearLoy_Loyalty_bot?start=link_");
    expect(mockedPrisma.telegramLinkToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 7, usedAt: null, expiresAt: { gt: expect.any(Date) } },
      data: { usedAt: expect.any(Date) },
    });
    expect(mockedPrisma.telegramLinkToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 7, token: expect.any(String), expiresAt: expect.any(Date) }),
    });
  });

  it("does not create links for frozen or blocked accounts", async () => {
    mockedRequireUserSession.mockResolvedValue({ userId: 7, email: "client@test.local", role: "CLIENT" });
    mockedPrisma.user.findUnique.mockResolvedValue({ id: 7, email: "client@test.local", accountStatus: "BLOCKED" } as never);

    const res = await POST(new NextRequest("http://localhost/api/telegram/link-token", { method: "POST" }));
    const body = await res.json();

    expect(res.status).toBe(423);
    expect(body.message).toContain("active account");
    expect(mockedPrisma.telegramLinkToken.create).not.toHaveBeenCalled();
  });
});
