jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn(), count: jest.fn() },
    company: { count: jest.fn() },
    userSubscription: { count: jest.fn() },
    companyVerificationApplication: { count: jest.fn() },
    financeOperation: { count: jest.fn() },
    adminTask: { count: jest.fn(), findMany: jest.fn() },
  },
}));

jest.mock("@/lib/admin/require-admin-session", () => ({
  requireAdminSession: jest.fn(),
  isAuthResponse: (value: unknown) => value instanceof Response,
}));

jest.mock("@/lib/admin/admin-tasks", () => ({
  ACTIVE_ADMIN_TASK_STATUSES: ["OPEN", "IN_PROGRESS"],
  syncAdminTasksFromSignals: jest.fn(),
}));

import { NextRequest } from "next/server";
import { syncAdminTasksFromSignals } from "@/lib/admin/admin-tasks";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import { prisma } from "@/lib/prisma";
import { GET } from "./route";

const mockedPrisma = jest.mocked(prisma, { shallow: false });
const mockedRequireAdminSession = jest.mocked(requireAdminSession);
const mockedSyncTasks = jest.mocked(syncAdminTasksFromSignals);

describe("admin dashboard route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireAdminSession.mockResolvedValue({ userId: 1, email: "admin@test.local", role: "ADMIN" });
    mockedSyncTasks.mockResolvedValue(undefined);
    mockedPrisma.user.findUnique.mockResolvedValue({ role: "ADMIN", permissions: [] } as never);
    mockedPrisma.user.count.mockResolvedValueOnce(40).mockResolvedValueOnce(38);
    mockedPrisma.company.count.mockResolvedValue(6);
    mockedPrisma.userSubscription.count.mockResolvedValue(17);
    mockedPrisma.companyVerificationApplication.count.mockResolvedValue(2);
    mockedPrisma.adminTask.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    mockedPrisma.adminTask.findMany
      .mockResolvedValueOnce([
        {
          uuid: "task-1",
          source: "COMPANY_VERIFICATION",
          sourceKey: "verification:company-1",
          title: "Verify partner",
          priority: "HIGH",
          status: "OPEN",
          createdAt: new Date("2026-05-24T10:00:00.000Z"),
          updatedAt: new Date("2026-05-24T10:00:00.000Z"),
          assignedAt: null,
          resolvedAt: null,
          assignedTo: null,
        },
      ] as never)
      .mockResolvedValueOnce([{ createdAt: new Date("2026-05-24T10:00:00.000Z") }] as never);
  });

  it("returns live dashboard tasks and does not expose finance metrics without finance permission", async () => {
    const response = await GET(new NextRequest("http://localhost/api/admin/dashboard"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedSyncTasks).toHaveBeenCalled();
    expect(body.metrics).toMatchObject({
      usersTotal: 40,
      usersActive: 38,
      companiesActive: 6,
      subscriptionsActive: 17,
      verificationOpen: 2,
      pendingFinance: 0,
      openTasks: 3,
      criticalTasks: 1,
    });
    expect(body.permittedSources).toEqual(["AUDIT", "COMPANY_VERIFICATION"]);
    expect(body.tasks[0]).toMatchObject({ uuid: "task-1", source: "COMPANY_VERIFICATION" });
    expect(mockedPrisma.financeOperation.count).not.toHaveBeenCalled();
  });
});
