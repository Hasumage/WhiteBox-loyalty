jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    profileStatus: {
      findMany: jest.fn(),
    },
    userProfileStatusUnlock: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock("@/lib/auth/require-user-session", () => ({
  requireUserSession: jest.fn(),
  isUserAuthResponse: (value: unknown) => value instanceof Response,
}));

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserSession } from "@/lib/auth/require-user-session";
import { GET, PATCH } from "./route";
import { POST as markSeen } from "./seen/route";

const mockedPrisma = jest.mocked(prisma, { shallow: false });
const mockedRequireUserSession = jest.mocked(requireUserSession);

const now = new Date("2026-05-29T10:00:00.000Z");
const rareStatus = {
  id: "status-rare",
  slug: "early-spark",
  title: "Early spark",
  description: "First beautiful status.",
  rarity: "RARE",
  icon: "Sparkles",
  isActive: true,
  isSystem: false,
  createdAt: now,
  updatedAt: now,
};
const legendaryStatus = {
  ...rareStatus,
  id: "status-legend",
  slug: "top-100",
  title: "Top 100",
  rarity: "LEGENDARY",
};

describe("user profile statuses route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireUserSession.mockResolvedValue({ userId: 42, email: "client@test.local", role: "CLIENT" });
    mockedPrisma.user.findUnique.mockResolvedValue({ selectedProfileStatusId: rareStatus.id, selectedProfileStatus: rareStatus } as never);
    mockedPrisma.profileStatus.findMany.mockResolvedValue([rareStatus, legendaryStatus] as never);
    mockedPrisma.userProfileStatusUnlock.findMany.mockResolvedValue([
      { id: "unlock-1", userId: 42, statusId: rareStatus.id, status: rareStatus, source: "ADMIN_GRANT", unlockedAt: now, seenAt: null },
    ] as never);
    mockedPrisma.user.update.mockResolvedValue({ id: 42 } as never);
  });

  it("returns unlocked, selected and newly unlocked status state", async () => {
    const res = await GET(new NextRequest("http://localhost/api/user/profile-statuses"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.selectedStatusId).toBe(rareStatus.id);
    expect(body.summary).toEqual({ total: 2, unlocked: 1, new: 1 });
    expect(body.statuses.find((status: { id: string }) => status.id === rareStatus.id).unlocked).toBe(true);
    expect(body.statuses.find((status: { id: string }) => status.id === legendaryStatus.id).unlocked).toBe(false);
  });

  it("does not allow selecting a locked status", async () => {
    mockedPrisma.userProfileStatusUnlock.findUnique.mockResolvedValue(null);

    const res = await PATCH(new NextRequest("http://localhost/api/user/profile-statuses", {
      method: "PATCH",
      body: JSON.stringify({ statusId: legendaryStatus.id }),
    }));

    expect(res.status).toBe(403);
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
  });

  it("marks all new status unlocks as seen", async () => {
    mockedPrisma.userProfileStatusUnlock.updateMany.mockResolvedValue({ count: 3 } as never);

    const res = await markSeen(new NextRequest("http://localhost/api/user/profile-statuses/seen", { method: "POST" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.updated).toBe(3);
    expect(mockedPrisma.userProfileStatusUnlock.updateMany).toHaveBeenCalledWith({
      where: { userId: 42, seenAt: null },
      data: { seenAt: expect.any(Date) },
    });
  });
});
