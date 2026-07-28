jest.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    user: { findUnique: jest.fn(), update: jest.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { createCompanyReferralPayoutRequest } from "./company-referrals";

const mockedPrisma = jest.mocked(prisma, { shallow: false });

function paidCompanyReferral(overrides: Record<string, unknown> = {}) {
  return {
    companyId: 10,
    referrerUserId: 7,
    referralPercent: 1,
    status: "ACTIVE",
    source: "PUBLIC_REFERRAL",
    pipelineStatus: "CONNECTED",
    startedAt: new Date("2026-06-01T00:00:00.000Z"),
    referrer: { role: "MANAGER" },
    company: {
      id: 10,
      slug: "test-company",
      name: "Test Company",
      isActive: true,
      verificationStatus: "APPROVED",
      platformCommissionPercent: 12,
      commissionFreeMonthlyTurnover: 50000,
      commissionGraceEndsAt: null,
      supportManagerId: null,
      subscriptions: [],
      billingInvoices: [{ status: "PAID", paidAmount: 4990 }],
    },
    ...overrides,
  };
}

function payoutTx(referrals: unknown[], operation: unknown, calls: string[] = []) {
  return {
    $executeRaw: jest.fn(async () => {
      calls.push("lock");
      return 1;
    }),
    companyReferral: {
      findMany: jest.fn(async () => {
        calls.push("load-referrals");
        return referrals;
      }),
    },
    financeOperation: {
      findMany: jest.fn(async () => {
        calls.push("load-payouts");
        return [];
      }),
      create: jest.fn(async () => {
        calls.push("create-payout");
        return operation;
      }),
    },
    auditEvent: {
      create: jest.fn(async () => {
        calls.push("audit");
        return {};
      }),
    },
  };
}

describe("createCompanyReferralPayoutRequest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.user.findUnique.mockResolvedValue({
      prPayoutBankName: "Sberbank",
      prPayoutPhone: "+79991234567",
      prPayoutCardLast4: null,
    } as never);
  });

  it("serializes referral payout reservations before calculating available balance", async () => {
    const calls: string[] = [];
    const operation = { uuid: "finance-1", title: "Company referral payout request: 5000 RUB" };
    const tx = payoutTx([paidCompanyReferral({ company: { ...paidCompanyReferral().company, billingInvoices: [{ status: "PAID", paidAmount: 20000 }] } })], operation, calls);

    mockedPrisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) as never);

    await expect(createCompanyReferralPayoutRequest(7, 5000)).resolves.toBe(operation);

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(calls[0]).toBe("lock");
    expect(calls).toEqual(["lock", "load-referrals", "load-payouts", "create-payout", "audit"]);
  });

  it("allows a PR manager to request 30 percent of paid NearLoy company subscription", async () => {
    const operation = { uuid: "finance-2", title: "Company referral payout request: 1500 RUB" };
    const tx = payoutTx([paidCompanyReferral()], operation);

    mockedPrisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) as never);

    await expect(createCompanyReferralPayoutRequest(7, 1500)).resolves.toBe(operation);
  });

  it("does not reserve payout balance for a system super-admin fallback referral", async () => {
    const tx = payoutTx(
      [
        paidCompanyReferral({
          referrerUserId: 1,
          source: "SYSTEM_SUPER_ADMIN",
          referralPercent: 0,
          referrer: { role: "SUPER_ADMIN" },
        }),
      ],
      { uuid: "finance-3" },
    );

    mockedPrisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) as never);

    await expect(createCompanyReferralPayoutRequest(1, 1000)).rejects.toThrow("Доступно к выплате 0 ₽.");
    expect(tx.financeOperation.create).not.toHaveBeenCalled();
  });
});
