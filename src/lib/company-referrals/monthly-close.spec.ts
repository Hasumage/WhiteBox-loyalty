jest.mock("@/lib/prisma", () => ({
  prisma: {},
}));

import {
  closePreviousCompanyReferralMonth,
  getCompanyReferralMonthlyReport,
  getMoscowMonthPeriod,
  monthlyPayoutTitle,
} from "@/lib/company-referrals/monthly-close";

function createMockDb() {
  return {
    user: { findMany: jest.fn() },
    companyReferral: { findMany: jest.fn() },
    financeOperation: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    auditEvent: { create: jest.fn() },
  };
}

describe("company referral monthly close", () => {
  it("builds monthly PR totals by agent and subtracts already closed operations", async () => {
    const db = createMockDb();
    const period = getMoscowMonthPeriod(2026, 7);
    db.user.findMany.mockResolvedValue([
      { id: 10, uuid: "agent-10", name: "Anna PR", email: "anna@test.local", companyReferralCode: "ANNA" },
    ]);
    db.companyReferral.findMany.mockResolvedValue([
      {
        referrerUserId: 10,
        status: "ACTIVE",
        referrer: { id: 10, uuid: "agent-10", name: "Anna PR", email: "anna@test.local", role: "MANAGER" },
        company: {
          id: 101,
          slug: "coffee",
          name: "Coffee",
          isActive: true,
          billingInvoices: [{ paidAmount: 4990, paidAt: new Date("2026-07-12T10:00:00.000Z"), createdAt: new Date("2026-07-12T09:00:00.000Z") }],
        },
      },
    ]);
    db.financeOperation.findMany.mockResolvedValue([{ requestedById: 10, amount: 500, status: "PENDING_APPROVAL" }]);

    const report = await getCompanyReferralMonthlyReport({ scope: "ALL", period, db: db as never });

    expect(report.totals).toMatchObject({
      agents: 1,
      companies: 1,
      activeCompanies: 1,
      monthlyGross: 4990,
      monthlyReferralCommission: 1500,
      closedAmount: 500,
      pendingAmount: 500,
      availableToClose: 1000,
    });
    expect(report.agents[0]).toMatchObject({ userId: 10, availableToClose: 1000 });
  });

  it("keeps monthly report available when a referral points to a missing user", async () => {
    const db = createMockDb();
    db.user.findMany.mockResolvedValue([]);
    db.companyReferral.findMany.mockResolvedValue([
      {
        referrerUserId: 77,
        status: "ACTIVE",
        source: "PUBLIC_REFERRAL",
        referrer: null,
        company: {
          id: 101,
          slug: "coffee",
          name: "Coffee",
          isActive: true,
          billingInvoices: [{ paidAmount: 1000 }],
        },
      },
    ]);
    db.financeOperation.findMany.mockResolvedValue([]);

    const report = await getCompanyReferralMonthlyReport({
      scope: "ALL",
      period: getMoscowMonthPeriod(2026, 8),
      db: db as never,
    });

    expect(report.agents[0]).toMatchObject({
      userId: 77,
      uuid: "missing-user-77",
      name: "Deleted PR user #77",
      email: "deleted-pr-user@deleted.nearloy.local",
      monthlyGross: 1000,
      monthlyReferralCommission: 300,
    });
  });

  it("keeps monthly report available when a referral points to a missing company", async () => {
    const db = createMockDb();
    db.user.findMany.mockResolvedValue([
      { id: 10, uuid: "agent-10", name: "Anna PR", email: "anna@test.local", companyReferralCode: "ANNA" },
    ]);
    db.companyReferral.findMany.mockResolvedValue([
      {
        companyId: 404,
        referrerUserId: 10,
        status: "ACTIVE",
        source: "PUBLIC_REFERRAL",
        referrer: { id: 10, uuid: "agent-10", name: "Anna PR", email: "anna@test.local", role: "MANAGER" },
        company: null,
      },
    ]);
    db.financeOperation.findMany.mockResolvedValue([]);

    const report = await getCompanyReferralMonthlyReport({
      scope: "ALL",
      period: getMoscowMonthPeriod(2026, 8),
      db: db as never,
    });

    expect(report.agents[0]).toMatchObject({
      userId: 10,
      companies: 1,
      activeCompanies: 0,
      monthlyGross: 0,
      monthlyReferralCommission: 0,
    });
  });

  it("creates finance operations for the previous Moscow month on close", async () => {
    const db = createMockDb();
    db.user.findMany.mockResolvedValue([
      { id: 10, uuid: "agent-10", name: "Anna PR", email: "anna@test.local", companyReferralCode: "ANNA" },
    ]);
    db.companyReferral.findMany.mockResolvedValue([
      {
        referrerUserId: 10,
        status: "ACTIVE",
        referrer: { id: 10, uuid: "agent-10", name: "Anna PR", email: "anna@test.local", role: "MANAGER" },
        company: {
          id: 101,
          slug: "coffee",
          name: "Coffee",
          isActive: true,
          billingInvoices: [{ paidAmount: 10000, paidAt: new Date("2026-07-20T10:00:00.000Z"), createdAt: new Date("2026-07-20T09:00:00.000Z") }],
        },
      },
    ]);
    db.financeOperation.findMany.mockResolvedValue([]);
    db.financeOperation.findFirst.mockResolvedValue(null);
    db.financeOperation.create.mockResolvedValue({
      uuid: "operation-1",
      amount: 3000,
      status: "PENDING_APPROVAL",
      createdAt: new Date("2026-08-01T06:00:00.000Z"),
    });
    db.auditEvent.create.mockResolvedValue({});

    const result = await closePreviousCompanyReferralMonth({
      actorUserId: 1,
      now: new Date("2026-08-01T06:00:00.000Z"),
      db: db as never,
    });

    expect(result).toMatchObject({ generated: 1, skippedExisting: 0, totalAmount: 3000 });
    expect(db.financeOperation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 3000,
          requestedById: 10,
          title: expect.stringContaining(monthlyPayoutTitle("2026-07")),
        }),
      }),
    );
    const details = JSON.parse(db.financeOperation.create.mock.calls[0][0].data.details);
    expect(details).toMatchObject({
      kind: "PR_MONTHLY_CLOSE",
      period: { key: "2026-07" },
      agent: { userId: 10, email: "anna@test.local" },
      amount: 3000,
    });
  });
});
