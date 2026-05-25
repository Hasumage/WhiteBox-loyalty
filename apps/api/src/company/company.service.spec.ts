import { ConflictException, ForbiddenException } from "@nestjs/common";
import { CompanyMemberRole, SubscriptionEntitlementWindow } from "@prisma/client";
import { CompanyService } from "./company.service";

describe("CompanyService", () => {
  const membership = {
    id: 1,
    uuid: "member-1",
    userId: 50,
    companyId: 7,
    role: CompanyMemberRole.OWNER,
    isActive: true,
    user: { uuid: "owner", name: "Owner", email: "owner@whitebox.test" },
    company: {
      id: 7,
      slug: "coffee",
      name: "Coffee",
      isActive: true,
      identityVerificationCompleted: true,
      verificationStatus: "APPROVED",
      operatesOnline: false,
      description: null,
      categories: [],
      verificationApplications: [],
      levelRules: [
        { levelName: "Bronze", minTotalSpend: 0, cashbackPercent: 1 },
        { levelName: "Silver", minTotalSpend: 1000, cashbackPercent: 5 },
      ],
    },
  };

  let tx: {
    companyPurchase: { aggregate: jest.Mock; create: jest.Mock };
    userCompany: { upsert: jest.Mock };
    loyaltyTransaction: { create: jest.Mock };
    subscriptionRedemption: { aggregate: jest.Mock; create: jest.Mock };
  };
  let prisma: {
    companyMember: { findFirst: jest.Mock; findUnique: jest.Mock; upsert: jest.Mock; create: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    company: { findFirst: jest.Mock };
    user: { findFirst: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock };
    companyPurchase: { aggregate: jest.Mock };
    financeOperation: { findMany: jest.Mock };
    userSubscription: { findFirst: jest.Mock; findMany: jest.Mock };
    subscriptionEntitlement: { findUnique: jest.Mock };
    subscriptionRedemption: { aggregate: jest.Mock; create: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: CompanyService;

  beforeEach(() => {
    tx = {
      companyPurchase: { aggregate: jest.fn(), create: jest.fn() },
      userCompany: { upsert: jest.fn() },
      loyaltyTransaction: { create: jest.fn() },
      subscriptionRedemption: { aggregate: jest.fn(), create: jest.fn() },
    };
    prisma = {
      companyMember: {
        findFirst: jest.fn().mockResolvedValue(membership),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      company: { findFirst: jest.fn() },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 99, uuid: "client-uuid", name: "Client" }),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
      companyPurchase: { aggregate: tx.companyPurchase.aggregate },
      financeOperation: { findMany: jest.fn() },
      userSubscription: { findFirst: jest.fn(), findMany: jest.fn() },
      subscriptionEntitlement: { findUnique: jest.fn() },
      subscriptionRedemption: tx.subscriptionRedemption,
      $transaction: jest.fn(async (handler: (client: typeof tx) => unknown) => handler(tx)),
    };
    service = new CompanyService(prisma as never);
  });

  it("returns the actual latest verification application in the company profile", async () => {
    prisma.companyMember.findFirst.mockResolvedValue({
      ...membership,
      company: {
        ...membership.company,
        verificationApplications: [
          {
            uuid: "verification-request",
            status: "SUBMITTED",
            createdAt: new Date("2026-05-24T12:00:00Z"),
            identityVerificationMode: "FULL",
          },
        ],
      },
    });

    const result = await service.profile(50);

    expect(result.company.verificationApplication).toEqual(
      expect.objectContaining({ uuid: "verification-request", status: "SUBMITTED" }),
    );
  });

  it("awards a manual number of points without recording a purchase", async () => {
    const result = await service.awardPoints(50, {
      userUuid: "client-uuid",
      mode: "MANUAL",
      points: 80,
    });

    expect(result.pointsAwarded).toBe(80);
    expect(tx.companyPurchase.create).not.toHaveBeenCalled();
    expect(tx.userCompany.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { balance: { increment: 80 } } }),
    );
    expect(tx.loyaltyTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 80 }) }),
    );
  });

  it("uses the customer spend tier for purchase cashback", async () => {
    tx.companyPurchase.aggregate.mockResolvedValue({ _sum: { amount: 900 } });

    const result = await service.awardPoints(50, {
      userUuid: "client-uuid",
      mode: "PURCHASE",
      purchaseAmount: 100,
    });

    expect(result.level).toEqual(expect.objectContaining({ name: "Silver", cashbackPercent: 5 }));
    expect(result.pointsAwarded).toBe(5);
    expect(tx.companyPurchase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyId: 7, userId: 99, processedById: 50, pointsAwarded: 5 }),
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
  });

  it("records a subscription redemption while the periodic allowance remains", async () => {
    prisma.subscriptionEntitlement.findUnique.mockResolvedValue({
      id: 10,
      uuid: "coffee-day",
      title: "Coffee",
      allowance: 1,
      windowValue: 1,
      windowUnit: SubscriptionEntitlementWindow.DAY,
      isActive: true,
      subscriptionId: 22,
      subscription: { id: 22, companyId: 7 },
    });
    prisma.userSubscription.findFirst.mockResolvedValue({ id: 31, activatedAt: new Date("2026-05-01T00:00:00Z") });
    tx.subscriptionRedemption.aggregate.mockResolvedValue({ _sum: { quantity: 0 } });
    tx.subscriptionRedemption.create.mockResolvedValue({ uuid: "redemption" });

    const result = await service.redeemEntitlement(50, {
      userUuid: "client-uuid",
      entitlementUuid: "coffee-day",
    });

    expect(result.used).toBe(1);
    expect(tx.subscriptionRedemption.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ quantity: 1, processedById: 50 }) }),
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
  });

  it("prevents a second daily redemption after the allowance is exhausted", async () => {
    prisma.subscriptionEntitlement.findUnique.mockResolvedValue({
      id: 10,
      uuid: "coffee-day",
      title: "Coffee",
      allowance: 1,
      windowValue: 1,
      windowUnit: SubscriptionEntitlementWindow.DAY,
      isActive: true,
      subscriptionId: 22,
      subscription: { id: 22, companyId: 7 },
    });
    prisma.userSubscription.findFirst.mockResolvedValue({ id: 31, activatedAt: new Date("2026-05-01T00:00:00Z") });
    tx.subscriptionRedemption.aggregate.mockResolvedValue({ _sum: { quantity: 1 } });

    await expect(
      service.redeemEntitlement(50, { userUuid: "client-uuid", entitlementUuid: "coffee-day" }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.subscriptionRedemption.create).not.toHaveBeenCalled();
  });

  it("records unlimited access repeatedly without applying a usage cap", async () => {
    prisma.subscriptionEntitlement.findUnique.mockResolvedValue({
      id: 11,
      uuid: "fitness-access",
      title: "Gym entry",
      allowance: 1,
      windowValue: 1,
      windowUnit: SubscriptionEntitlementWindow.UNLIMITED,
      isActive: true,
      subscriptionId: 23,
      subscription: { id: 23, companyId: 7 },
    });
    prisma.userSubscription.findFirst.mockResolvedValue({ id: 32, activatedAt: new Date("2026-05-01T00:00:00Z") });
    tx.subscriptionRedemption.create.mockResolvedValue({ uuid: "unlimited-redemption" });

    const result = await service.redeemEntitlement(50, {
      userUuid: "client-uuid",
      entitlementUuid: "fitness-access",
    });

    expect(tx.subscriptionRedemption.aggregate).not.toHaveBeenCalled();
    expect(tx.subscriptionRedemption.create).toHaveBeenCalled();
    expect(result).toMatchObject({ unlimited: true, used: null, allowance: null });
  });

  it("converts a concurrent redemption collision into a safe retry message", async () => {
    prisma.subscriptionEntitlement.findUnique.mockResolvedValue({
      id: 10,
      uuid: "coffee-day",
      title: "Coffee",
      allowance: 1,
      windowValue: 1,
      windowUnit: SubscriptionEntitlementWindow.DAY,
      isActive: true,
      subscriptionId: 22,
      subscription: { id: 22, companyId: 7 },
    });
    prisma.userSubscription.findFirst.mockResolvedValue({ id: 31, activatedAt: new Date("2026-05-01T00:00:00Z") });
    prisma.$transaction.mockRejectedValueOnce({ code: "P2034" });

    await expect(
      service.redeemEntitlement(50, { userUuid: "client-uuid", entitlementUuid: "coffee-day" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("does not allow a cashier to create subscription plans", async () => {
    prisma.companyMember.findFirst.mockResolvedValue({
      ...membership,
      role: CompanyMemberRole.CASHIER,
    });

    await expect(
      service.createSubscription(50, {
        name: "Coffee every day",
        description: "One coffee every day",
        price: 990,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("limits text search to customers already related to the company", async () => {
    await service.clients(50, "alice@example.com");

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: "CLIENT",
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                { companyLinks: { some: { companyId: 7 } } },
                { companyPurchases: { some: { companyId: 7 } } },
                { subscriptions: { some: { subscription: { companyId: 7 } } } },
              ]),
            }),
          ]),
        }),
      }),
    );
  });

  it("does not expose contact data when an unknown customer is opened from QR", async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 99,
      uuid: "client-uuid",
      name: "Client",
      email: "private@example.com",
      companyLinks: [],
      companyPurchases: [],
      subscriptions: [],
    });

    const result = await service.client(50, "client-uuid");

    expect(result.email).toBeNull();
  });

  it("allows an owner to suspend a cashier without changing platform roles", async () => {
    prisma.companyMember.findUnique.mockResolvedValue({
      uuid: "cashier-member",
      companyId: 7,
      role: CompanyMemberRole.CASHIER,
    });

    await service.updateTeamMemberStatus(50, "cashier-member", { isActive: false });

    expect(prisma.companyMember.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { uuid: "cashier-member" },
        data: { isActive: false },
      }),
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("does not allow a manager to suspend another manager", async () => {
    prisma.companyMember.findFirst.mockResolvedValue({
      ...membership,
      role: CompanyMemberRole.MANAGER,
    });
    prisma.companyMember.findUnique.mockResolvedValue({
      uuid: "manager-member",
      companyId: 7,
      role: CompanyMemberRole.MANAGER,
    });

    await expect(
      service.updateTeamMemberStatus(50, "manager-member", { isActive: false }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.companyMember.update).not.toHaveBeenCalled();
  });

  it("normalizes recurring subscription income into a monthly forecast", async () => {
    prisma.financeOperation.findMany.mockResolvedValue([]);
    prisma.userSubscription.findMany.mockResolvedValue([
      { subscription: { price: 100, renewalValue: 1, renewalUnit: "week" } },
      { subscription: { price: 1200, renewalValue: 1, renewalUnit: "year" } },
      { subscription: { price: 500, renewalValue: 1, renewalUnit: "month" } },
    ]);

    const result = await service.finance(50);

    expect(result.subscriptionGross).toBe(1800);
    expect(result.activeSubscribers).toBe(3);
    expect(result.monthlyRecurringRevenue).toBeCloseTo((100 * 52) / 12 + 100 + 500);
  });
});
