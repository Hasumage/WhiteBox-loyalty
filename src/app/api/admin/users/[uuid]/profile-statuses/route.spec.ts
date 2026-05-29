jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    profileStatus: { findUnique: jest.fn() },
    userProfileStatusUnlock: { upsert: jest.fn() },
    auditEvent: { create: jest.fn() },
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
import { POST } from "./route";

const mockedPrisma = jest.mocked(prisma, { shallow: false });
const mockedRequireAdminSession = jest.mocked(requireAdminSession);
const mockedRequireAdminScope = jest.mocked(requireAdminScope);

const now = new Date("2026-05-29T10:00:00.000Z");
const targetUser = {
  id: 42,
  uuid: "user-uuid",
  email: "client@test.local",
  name: "Client",
};
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
};

describe("admin user profile status grant route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireAdminSession.mockResolvedValue({ userId: 1, email: "admin@test.local", role: "ADMIN" });
    mockedRequireAdminScope.mockResolvedValue({ ok: true, actor: { id: 1, email: "admin@test.local" } } as never);
  });

  it("grants an active profile status to the user and writes audit", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(targetUser as never);
    mockedPrisma.profileStatus.findUnique.mockResolvedValue(status as never);
    mockedPrisma.userProfileStatusUnlock.upsert.mockResolvedValue({
      id: "unlock-1",
      userId: targetUser.id,
      statusId: status.id,
      source: "ADMIN_GRANT",
      unlockedAt: now,
      seenAt: null,
      status,
    } as never);
    mockedPrisma.auditEvent.create.mockResolvedValue({ id: "audit-1" } as never);

    const res = await POST(
      new NextRequest("http://localhost/api/admin/users/user-uuid/profile-statuses", {
        method: "POST",
        body: JSON.stringify({ statusId: status.id }),
      }),
      { params: { uuid: "user-uuid" } },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      id: "unlock-1",
      statusId: status.id,
      source: "ADMIN_GRANT",
      unlockedAt: now.toISOString(),
      seenAt: null,
      status: {
        id: status.id,
        slug: status.slug,
        title: status.title,
        description: status.description,
        rarity: status.rarity,
        icon: status.icon,
      },
    });
    expect(mockedPrisma.userProfileStatusUnlock.upsert).toHaveBeenCalledWith({
      where: { userId_statusId: { userId: targetUser.id, statusId: status.id } },
      create: {
        userId: targetUser.id,
        statusId: status.id,
        source: "ADMIN_GRANT",
        unlockedById: 1,
      },
      update: {
        unlockedById: 1,
      },
      include: { status: true },
    });
    expect(mockedPrisma.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspace: "MANAGER",
        level: "INFO",
        category: "USER",
        action: "Profile status granted",
        actorUserId: 1,
        actorLabel: "admin@test.local",
        targetUserId: targetUser.id,
        targetEmail: targetUser.email,
        targetUuid: targetUser.uuid,
        tags: ["#USER", "#STATUS"],
      }),
    });
  });

  it("rejects inactive statuses and does not create unlocks", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(targetUser as never);
    mockedPrisma.profileStatus.findUnique.mockResolvedValue({ ...status, isActive: false } as never);

    const res = await POST(
      new NextRequest("http://localhost/api/admin/users/user-uuid/profile-statuses", {
        method: "POST",
        body: JSON.stringify({ statusId: status.id }),
      }),
      { params: { uuid: "user-uuid" } },
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.message).toBe("Status not found");
    expect(mockedPrisma.userProfileStatusUnlock.upsert).not.toHaveBeenCalled();
    expect(mockedPrisma.auditEvent.create).not.toHaveBeenCalled();
  });
});
