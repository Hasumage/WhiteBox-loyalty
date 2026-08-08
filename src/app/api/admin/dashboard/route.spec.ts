jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    company: { count: jest.fn() },
    companyReferral: { findMany: jest.fn() },
    companyBillingInvoice: { findMany: jest.fn() },
    userSubscription: { count: jest.fn() },
    companyVerificationApplication: { count: jest.fn() },
    financeOperation: { count: jest.fn(), findMany: jest.fn() },
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
    mockedPrisma.user.findMany.mockResolvedValue([]);
    mockedPrisma.companyReferral.findMany.mockResolvedValue([]);
    mockedPrisma.companyBillingInvoice.findMany.mockResolvedValue([]);
    mockedPrisma.financeOperation.findMany.mockResolvedValue([]);
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
    expect(body.pr).toMatchObject({
      scope: "ALL",
      totals: {
        companies: 0,
        activeCompanies: 0,
        recognizedGross: 0,
        futureGross: 0,
        whiteBoxNetCommission: 0,
        referralCommission: 0,
        supportManagerCommission: 0,
      },
    });
    expect(mockedPrisma.financeOperation.count).not.toHaveBeenCalled();
  });

  it("returns an empty dashboard when task signal sync fails on a fresh database", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      mockedSyncTasks.mockRejectedValueOnce(new Error("fresh database has no signal rows yet"));
      mockedPrisma.user.findUnique.mockResolvedValueOnce({ role: "ADMIN", permissions: [] } as never);
      mockedPrisma.user.count.mockReset().mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      mockedPrisma.company.count.mockResolvedValueOnce(0);
      mockedPrisma.userSubscription.count.mockResolvedValueOnce(0);
      mockedPrisma.companyVerificationApplication.count.mockResolvedValueOnce(0);
      mockedPrisma.adminTask.count.mockReset().mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      mockedPrisma.adminTask.findMany.mockReset().mockResolvedValueOnce([] as never).mockResolvedValueOnce([] as never);
      mockedPrisma.user.findMany.mockResolvedValue([]);
      mockedPrisma.companyReferral.findMany.mockResolvedValue([]);
      mockedPrisma.companyBillingInvoice.findMany.mockResolvedValue([]);
      mockedPrisma.financeOperation.findMany.mockResolvedValue([]);

      const response = await GET(new NextRequest("http://localhost/api/admin/dashboard"));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.syncError).toBe(true);
      expect(body.metrics).toMatchObject({
        usersTotal: 0,
        usersActive: 0,
        companiesActive: 0,
        subscriptionsActive: 0,
        verificationOpen: 0,
        pendingFinance: 0,
        openTasks: 0,
        criticalTasks: 0,
      });
      expect(body.tasks).toEqual([]);
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("returns PR dashboard rows when a referral has a missing referrer relation", async () => {
    const orphanReferral = {
      uuid: "ref-1",
      companyId: 12,
      company: {
        id: 12,
        name: "Cafe",
        slug: "cafe",
        isActive: true,
        billingInvoices: [],
      },
      status: "ACTIVE",
      pipelineStatus: "CONNECTED",
      referralPercent: 30,
      source: "PUBLIC_REFERRAL",
      referrerUserId: 77,
      referrer: null,
    };
    mockedPrisma.companyReferral.findMany
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([orphanReferral] as never);

    const response = await GET(new NextRequest("http://localhost/api/admin/dashboard"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pr.companies[0].referrer).toMatchObject({
      id: 77,
      uuid: "missing-user-77",
      name: "Deleted PR user #77",
      email: "deleted-pr-user@deleted.nearloy.local",
    });
  });

  it("returns PR dashboard rows when a referral has a missing company relation", async () => {
    const orphanReferral = {
      uuid: "ref-2",
      companyId: 404,
      company: null,
      status: "ACTIVE",
      pipelineStatus: "CONNECTED",
      referralPercent: 30,
      source: "PUBLIC_REFERRAL",
      referrerUserId: 77,
      referrer: { id: 77, uuid: "agent-77", name: "PR Agent", email: "agent@test.local", role: "MANAGER" },
    };
    mockedPrisma.companyReferral.findMany
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([orphanReferral] as never);

    const response = await GET(new NextRequest("http://localhost/api/admin/dashboard"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pr.totals.activeCompanies).toBe(0);
    expect(body.pr.companies[0]).toMatchObject({
      companyId: 404,
      companyName: "Deleted company #404",
      companySlug: "missing-company-404",
      companyActive: false,
    });
  });
});
