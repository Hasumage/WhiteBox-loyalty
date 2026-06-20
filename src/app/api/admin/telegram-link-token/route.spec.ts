jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    telegramLinkToken: { create: jest.fn() },
  },
}));

jest.mock("@/lib/admin/require-admin-session", () => ({
  requireAdminSession: jest.fn(),
  isAuthResponse: (value: unknown) => value instanceof Response,
}));

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import { POST } from "./route";

const mockedRequireAdminSession = jest.mocked(requireAdminSession);
const mockedPrisma = jest.mocked(prisma, { shallow: false });
const adminRow = { id: 1, role: "ADMIN" } as Awaited<ReturnType<typeof prisma.user.findUnique>>;

describe("admin telegram link token route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TELEGRAM_BOT_USERNAME = "NearLoy_Loyalty_bot";
  });

  it("creates one-time telegram deep link for existing admin", async () => {
    mockedRequireAdminSession.mockResolvedValue({ userId: 1, email: "admin@test.local", role: "ADMIN" });
    mockedPrisma.user.findUnique.mockResolvedValue(adminRow);
    mockedPrisma.telegramLinkToken.create.mockResolvedValue({} as never);

    const res = await POST(new NextRequest("http://localhost/api/admin/telegram-link-token", { method: "POST" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.deepLink).toContain("https://t.me/NearLoy_Loyalty_bot?start=link_");
    expect(mockedPrisma.telegramLinkToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 1, token: expect.any(String), expiresAt: expect.any(Date) }),
    });
  });

  it("falls back to admin email when JWT subject id is stale", async () => {
    mockedRequireAdminSession.mockResolvedValue({ userId: 999, email: "admin@test.local", role: "ADMIN" });
    mockedPrisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(adminRow);
    mockedPrisma.telegramLinkToken.create.mockResolvedValue({} as never);

    const res = await POST(new NextRequest("http://localhost/api/admin/telegram-link-token", { method: "POST" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.deepLink).toContain("https://t.me/NearLoy_Loyalty_bot?start=link_");
    expect(mockedPrisma.telegramLinkToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 1 }),
    });
  });

  it("returns readable error when JWT user is absent in database", async () => {
    mockedRequireAdminSession.mockResolvedValue({ userId: 999, email: "ghost@test.local", role: "ADMIN" });
    mockedPrisma.user.findUnique.mockResolvedValue(null);

    const res = await POST(new NextRequest("http://localhost/api/admin/telegram-link-token", { method: "POST" }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.message).toContain("Admin user was not found");
  });

  it("returns readable error when active Prisma client is stale", async () => {
    mockedRequireAdminSession.mockResolvedValue({ userId: 1, email: "admin@test.local", role: "ADMIN" });
    mockedPrisma.user.findUnique.mockResolvedValue(adminRow);
    const previousDelegate = (mockedPrisma as unknown as { telegramLinkToken?: unknown }).telegramLinkToken;
    delete (mockedPrisma as unknown as { telegramLinkToken?: unknown }).telegramLinkToken;

    try {
      const res = await POST(new NextRequest("http://localhost/api/admin/telegram-link-token", { method: "POST" }));
      const body = await res.json();

      expect(res.status).toBe(503);
      expect(body.message).toContain("active Prisma client");
    } finally {
      (mockedPrisma as unknown as { telegramLinkToken?: unknown }).telegramLinkToken = previousDelegate;
    }
  });
});
