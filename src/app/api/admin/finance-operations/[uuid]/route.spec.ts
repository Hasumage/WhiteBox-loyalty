jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    financeOperation: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    userSubscription: { findMany: jest.fn() },
    auditEvent: { create: jest.fn() },
    adminTask: { updateMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/admin/require-admin-session", () => ({
  requireAdminSession: jest.fn(),
  isAuthResponse: (value: unknown) => value instanceof Response,
}));

import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import { prisma } from "@/lib/prisma";
import { PATCH } from "./route";

const mockedPrisma = jest.mocked(prisma, { shallow: false });
const mockedRequireAdminSession = jest.mocked(requireAdminSession);

describe("admin finance approval route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireAdminSession.mockResolvedValue({ userId: 1, email: "owner@test.local", role: "SUPER_ADMIN" });
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      role: "SUPER_ADMIN",
      email: "owner@test.local",
      permissions: [],
    } as never);
    (mockedPrisma.$transaction as unknown as jest.Mock).mockImplementation(
      async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma),
    );
  });

  it("blocks approval of a company payout not covered by recognized earnings", async () => {
    mockedPrisma.financeOperation.findUnique.mockResolvedValue({
      uuid: "payout-1",
      companyId: 7,
      type: "PAYOUT_REQUEST",
      status: "PENDING_APPROVAL",
      amount: 200,
    } as never);
    mockedPrisma.userSubscription.findMany.mockResolvedValue([
      {
        status: "EXPIRED",
        activatedAt: new Date("2026-05-01T00:00:00.000Z"),
        expiresAt: new Date("2026-05-02T00:00:00.000Z"),
        subscription: { companyId: 7, name: "One-day pass", price: 100 },
      },
    ] as never);
    mockedPrisma.financeOperation.findMany.mockResolvedValue([
      { companyId: 7, type: "PAYOUT_REQUEST", status: "PENDING_APPROVAL", amount: 200 },
    ] as never);

    const response = await PATCH(
      new NextRequest("http://localhost/api/admin/finance-operations/payout-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "APPROVED" }),
      }),
      { params: { uuid: "payout-1" } },
    );

    expect(response.status).toBe(409);
    expect(mockedPrisma.financeOperation.update).not.toHaveBeenCalled();
  });
});
