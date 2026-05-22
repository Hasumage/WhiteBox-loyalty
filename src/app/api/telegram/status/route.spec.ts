jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
  },
}));

jest.mock("@/lib/auth/require-user-session", () => ({
  requireUserSession: jest.fn(),
  isUserAuthResponse: (value: unknown) => value instanceof Response,
}));

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserSession } from "@/lib/auth/require-user-session";
import { GET } from "./route";

const mockedRequireUserSession = jest.mocked(requireUserSession);
const mockedPrisma = jest.mocked(prisma, { shallow: false });

describe("user telegram status route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns current user's Telegram connection", async () => {
    mockedRequireUserSession.mockResolvedValue({ userId: 7, email: "client@test.local", role: "CLIENT" });
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 7,
      email: "client@test.local",
      name: "Client",
        role: "CLIENT",
        accountStatus: "ACTIVE",
        telegramId: BigInt(1348887499),
        phoneNumber: "+79990001122",
        phoneVerifiedAt: new Date("2026-05-22T10:01:00.000Z"),
        updatedAt: new Date("2026-05-22T10:00:00.000Z"),
      } as never);

    const res = await GET(new NextRequest("http://localhost/api/telegram/status"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      connected: true,
      telegramId: "1348887499",
      phoneNumber: "+79990001122",
      phoneVerifiedAt: "2026-05-22T10:01:00.000Z",
      canConnect: true,
      role: "CLIENT",
    });
  });

  it("falls back to email when token subject is stale", async () => {
    mockedRequireUserSession.mockResolvedValue({ userId: 999, email: "client@test.local", role: "CLIENT" });
    mockedPrisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 7,
        email: "client@test.local",
        name: "Client",
        role: "CLIENT",
        accountStatus: "ACTIVE",
        telegramId: null,
        phoneNumber: null,
        phoneVerifiedAt: null,
        updatedAt: new Date("2026-05-22T10:00:00.000Z"),
      } as never);

    const res = await GET(new NextRequest("http://localhost/api/telegram/status"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.connected).toBe(false);
    expect(mockedPrisma.user.findUnique).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { email: "client@test.local" } }),
    );
  });

  it("falls back to legacy Telegram status when Prisma client is stale", async () => {
    mockedRequireUserSession.mockResolvedValue({ userId: 7, email: "client@test.local", role: "CLIENT" });
    mockedPrisma.user.findUnique
      .mockRejectedValueOnce(new Error("Unknown field `phoneNumber` for select statement on model User."))
      .mockResolvedValueOnce({
        id: 7,
        email: "client@test.local",
        name: "Client",
        role: "CLIENT",
        accountStatus: "ACTIVE",
        telegramId: BigInt(1348887499),
        updatedAt: new Date("2026-05-22T10:00:00.000Z"),
      } as never);

    const res = await GET(new NextRequest("http://localhost/api/telegram/status"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      connected: true,
      telegramId: "1348887499",
      phoneNumber: null,
      phoneVerifiedAt: null,
    });
  });
});
