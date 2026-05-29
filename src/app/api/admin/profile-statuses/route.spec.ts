jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    profileStatus: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    auditEvent: {
      create: jest.fn(),
    },
  },
}));

jest.mock("@/lib/admin/require-admin-session", () => ({
  requireAdminSession: jest.fn(),
  isAuthResponse: (value: unknown) => value instanceof Response,
}));

jest.mock("@/lib/admin/require-admin-scope", () => ({
  requireAdminScope: jest.fn(),
}));

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { GET, POST } from "./route";

const mockedPrisma = jest.mocked(prisma, { shallow: false });
const mockedRequireAdminSession = jest.mocked(requireAdminSession);
const mockedRequireAdminScope = jest.mocked(requireAdminScope);

const now = new Date("2026-05-29T10:00:00.000Z");
const status = {
  id: "status-1",
  slug: "top-100",
  title: "Топ 100",
  description: "Первые реальные пользователи WhiteBox.",
  rarity: "LEGENDARY",
  icon: "Trophy",
  isActive: true,
  isSystem: true,
  createdAt: now,
  updatedAt: now,
  _count: { unlocks: 7 },
};

describe("admin profile statuses route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireAdminSession.mockResolvedValue({ userId: 1, email: "admin@test.local", role: "ADMIN" });
    mockedRequireAdminScope.mockResolvedValue({ ok: true, actor: { id: 1, email: "admin@test.local" } } as never);
  });

  it("returns status unlock data for a target user", async () => {
    mockedPrisma.profileStatus.findMany.mockResolvedValue([status] as never);
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 42,
      uuid: "user-uuid",
      selectedProfileStatusId: status.id,
      profileStatusUnlocks: [{ id: "unlock-1", statusId: status.id, source: "TOP_100", unlockedAt: now, seenAt: null, status }],
    } as never);

    const res = await GET(new NextRequest("http://localhost/api/admin/profile-statuses?userUuid=user-uuid"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.statuses[0]).toMatchObject({
      id: status.id,
      unlocked: true,
      selected: true,
      source: "TOP_100",
      unlockCount: 7,
    });
    expect(body.userFound).toBe(true);
  });

  it("creates a profile status and writes audit", async () => {
    mockedPrisma.profileStatus.findUnique.mockResolvedValue(null);
    mockedPrisma.profileStatus.create.mockResolvedValue({ ...status, isSystem: false, _count: undefined } as never);
    mockedPrisma.auditEvent.create.mockResolvedValue({ id: "audit-1" } as never);

    const res = await POST(new NextRequest("http://localhost/api/admin/profile-statuses", {
      method: "POST",
      body: JSON.stringify({ title: "Топ 100", description: "Первые реальные пользователи.", rarity: "LEGENDARY", icon: "Trophy" }),
    }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.title).toBe("Топ 100");
    expect(mockedPrisma.profileStatus.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ title: "Топ 100", rarity: "LEGENDARY", icon: "Trophy" }),
    });
    expect(mockedPrisma.auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "Profile status created" }) });
  });
});
