jest.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    user: { findUnique: jest.fn(), update: jest.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { createCompanyReferralPayoutRequest } from "./company-referrals";

const mockedPrisma = jest.mocked(prisma, { shallow: false });

describe("createCompanyReferralPayoutRequest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("serializes referral payout reservations before calculating available balance", async () => {
    const calls: string[] = [];
    const operation = { uuid: "finance-1", title: "Company referral payout request: 5000 RUB" };
    const tx = {
      $executeRaw: jest.fn(async () => {
        calls.push("lock");
        return 1;
      }),
      companyReferral: {
        findMany: jest.fn(async () => {
          calls.push("load-referrals");
          return [
            {
              companyId: 10,
              referrerUserId: 7,
              referralPercent: 1,
              status: "ACTIVE",
              pipelineStatus: "CONNECTED",
              startedAt: new Date("2026-06-01T00:00:00.000Z"),
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
                subscriptions: [
                  {
                    id: 1,
                    price: 560000,
                    userPlans: [
                      {
                        status: "EXPIRED",
                        activatedAt: new Date("2026-06-01T00:00:00.000Z"),
                        expiresAt: new Date("2026-06-02T00:00:00.000Z"),
                      },
                    ],
                  },
                ],
              },
            },
          ];
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

    mockedPrisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) as never);

    await expect(createCompanyReferralPayoutRequest(7, 5000)).resolves.toBe(operation);

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(calls[0]).toBe("lock");
    expect(calls).toEqual(["lock", "load-referrals", "load-payouts", "create-payout", "audit"]);
  });
});
