jest.mock("@/lib/prisma", () => ({
  prisma: {
    auditEvent: { findMany: jest.fn() },
    companyVerificationApplication: { findMany: jest.fn() },
    financeOperation: { findMany: jest.fn() },
    adminTask: { upsert: jest.fn(), updateMany: jest.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { syncAdminTasksFromSignals, upsertAdminTaskForAuditEvent } from "./admin-tasks";

const mockedPrisma = jest.mocked(prisma, { shallow: false });

describe("admin task signal routing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.adminTask.upsert.mockResolvedValue({ uuid: "task-1", sourceKey: "audit:event-1" } as never);
    mockedPrisma.adminTask.updateMany.mockResolvedValue({ count: 0 } as never);
  });

  it("deduplicates an alert into a task keyed by the audit event", async () => {
    await upsertAdminTaskForAuditEvent({
      id: "event-1",
      workspace: "DEVELOPER",
      level: "CRITICAL",
      category: "SYSTEM",
      action: "Telegram delivery fire",
      details: "Five sends failed.",
      linkUrl: null,
      linkLabel: null,
      createdAt: new Date(),
    });

    expect(mockedPrisma.adminTask.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceKey: "audit:event-1" },
        create: expect.objectContaining({
          source: "AUDIT",
          priority: "CRITICAL",
          targetUrl: "/admin/system-health",
        }),
      }),
    );
  });

  it("creates workflow tasks and automatically resolves tasks whose source is no longer open", async () => {
    mockedPrisma.auditEvent.findMany.mockResolvedValue([]);
    mockedPrisma.companyVerificationApplication.findMany.mockResolvedValue([
      { uuid: "verify-1", companyName: "Coffee Co", contactName: "Anna", status: "SUBMITTED" },
    ] as never);
    mockedPrisma.financeOperation.findMany.mockResolvedValue([
      { uuid: "finance-1", title: "Payout Coffee Co", amount: { toString: () => "1200.00" }, currency: "RUB" },
    ] as never);

    await syncAdminTasksFromSignals();

    expect(mockedPrisma.adminTask.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceKey: "verification:verify-1" },
        create: expect.objectContaining({ source: "COMPANY_VERIFICATION", priority: "HIGH" }),
      }),
    );
    expect(mockedPrisma.adminTask.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceKey: "finance:finance-1" },
        create: expect.objectContaining({ source: "FINANCE", priority: "CRITICAL" }),
      }),
    );
    expect(mockedPrisma.adminTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: "COMPANY_VERIFICATION",
          sourceKey: { notIn: ["verification:verify-1"] },
        }),
      }),
    );
  });
});
