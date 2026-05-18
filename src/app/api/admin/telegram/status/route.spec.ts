jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock("@/lib/admin/require-admin-session", () => ({
  requireAdminSession: jest.fn(),
  isAuthResponse: (value: unknown) => value instanceof Response,
}));

import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import { prisma } from "@/lib/prisma";
import { GET } from "./route";

const mockedRequireAdminSession = jest.mocked(requireAdminSession);
const mockedPrisma = jest.mocked(prisma, { shallow: false });

describe("admin telegram status route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireAdminSession.mockResolvedValue({ userId: 25, email: "super@test.local", role: "SUPER_ADMIN" });
  });

  it("returns current connection and DB-backed admin routing list", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 25,
      email: "super@test.local",
      name: "Super",
      role: "SUPER_ADMIN",
      telegramId: BigInt(1348887499),
    } as never);
    mockedPrisma.user.findMany.mockResolvedValue([
      {
        uuid: "super-uuid",
        email: "super@test.local",
        name: "Super",
        role: "SUPER_ADMIN",
        accountStatus: "ACTIVE",
        telegramId: BigInt(1348887499),
        updatedAt: new Date("2026-05-17T00:00:00.000Z"),
      },
      {
        uuid: "support-uuid",
        email: "support@test.local",
        name: "Support",
        role: "SUPPORT",
        accountStatus: "ACTIVE",
        telegramId: BigInt(1000000001),
        updatedAt: new Date("2026-05-17T00:00:00.000Z"),
      },
    ] as never);

    const res = await GET(new NextRequest("http://localhost/api/admin/telegram/status"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.connected).toBe(true);
    expect(body.telegramId).toBe("1348887499");
    expect(body.admins).toEqual([
      expect.objectContaining({
        uuid: "super-uuid",
        role: "SUPER_ADMIN",
        connected: true,
        receivesNotifications: true,
        telegramId: "1348887499",
      }),
      expect.objectContaining({
        uuid: "support-uuid",
        role: "SUPPORT",
        connected: true,
        receivesNotifications: false,
        telegramId: "1000000001",
      }),
    ]);
    expect(mockedPrisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN", "MANAGER", "SUPPORT"] } },
    }));
  });
});
