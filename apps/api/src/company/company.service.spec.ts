import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import {
  CompanyMemberRole,
  FinanceOperationStatus,
  SubscriptionBundleParticipantStatus,
  SubscriptionBundleStatus,
  SubscriptionEntitlementWindow,
  SubscriptionSpendPolicy,
  SubscriptionStatus,
} from "@prisma/client";
import { CompanyService } from "./company.service";

const DAY_MS = 24 * 60 * 60 * 1000;

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
      categoryId: 1,
      slug: "coffee",
      name: "Coffee",
      isActive: true,
      identityVerificationCompleted: true,
      verificationStatus: "APPROVED",
      operatesOnline: false,
      description: null,
      subscriptionSpendPolicy: SubscriptionSpendPolicy.EXCLUDE,
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
    userCompany: { upsert: jest.Mock; updateMany: jest.Mock; findUnique: jest.Mock };
    loyaltyTransaction: { create: jest.Mock };
    subscriptionRedemption: { aggregate: jest.Mock; create: jest.Mock };
    company: { update: jest.Mock; findUnique: jest.Mock; findUniqueOrThrow: jest.Mock };
    companyCategory: { deleteMany: jest.Mock; createMany: jest.Mock };
    companyLevelRule: { deleteMany: jest.Mock; createMany: jest.Mock };
    financeOperation: { aggregate: jest.Mock; create: jest.Mock };
    companyBillingInvoice: { aggregate: jest.Mock; findFirst: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock; upsert: jest.Mock; update: jest.Mock };
    companyBillingAccount: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    companyBillingPromoCode: { findUnique: jest.Mock; update: jest.Mock };
    companyBillingPromoRedemption: { findUnique: jest.Mock; create: jest.Mock };
    userSubscription: { findMany: jest.Mock };
    subscriptionBundle: { findUnique: jest.Mock; findUniqueOrThrow: jest.Mock; update: jest.Mock };
    subscriptionBundleParticipant: { update: jest.Mock };
    subscriptionBundleRedemption: { aggregate: jest.Mock; create: jest.Mock };
    userSubscriptionBundle: { findFirst: jest.Mock };
  };
  let prisma: {
    companyMember: { findFirst: jest.Mock; findUnique: jest.Mock; upsert: jest.Mock; create: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    company: { findFirst: jest.Mock; findUnique: jest.Mock; findUniqueOrThrow: jest.Mock; update: jest.Mock };
    category: { findMany: jest.Mock; findUnique: jest.Mock };
    companyCategory: { deleteMany: jest.Mock; createMany: jest.Mock };
    companyLevelRule: { deleteMany: jest.Mock; createMany: jest.Mock };
    user: { findFirst: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock };
    companyPurchase: { aggregate: jest.Mock };
    financeOperation: { findMany: jest.Mock; aggregate: jest.Mock; create: jest.Mock };
    companyBillingInvoice: { aggregate: jest.Mock; findFirst: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock; upsert: jest.Mock; update: jest.Mock };
    companyBillingAccount: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    companyBillingPromoCode: { findUnique: jest.Mock; update: jest.Mock };
    companyBillingPromoRedemption: { findUnique: jest.Mock; create: jest.Mock };
    userSubscription: { findFirst: jest.Mock; findMany: jest.Mock; count: jest.Mock };
    subscription: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    userSubscriptionBundle: { findFirst: jest.Mock; findMany: jest.Mock; create: jest.Mock };
    subscriptionBundle: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock };
    subscriptionBundleParticipant: { findUnique: jest.Mock };
    subscriptionBundleRedemption: { aggregate: jest.Mock; create: jest.Mock };
    companyLocation: {
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findFirst: jest.Mock;
    };
    subscriptionEntitlement: { findUnique: jest.Mock; update: jest.Mock };
    subscriptionRedemption: { aggregate: jest.Mock; create: jest.Mock };
    customerLookupCode: { findFirst: jest.Mock; updateMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: CompanyService;

  beforeEach(() => {
    tx = {
      companyPurchase: { aggregate: jest.fn(), create: jest.fn() },
      userCompany: { upsert: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn() },
      loyaltyTransaction: { create: jest.fn() },
      subscriptionRedemption: { aggregate: jest.fn(), create: jest.fn() },
      company: { update: jest.fn(), findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
      companyCategory: { deleteMany: jest.fn(), createMany: jest.fn() },
      companyLevelRule: { deleteMany: jest.fn(), createMany: jest.fn() },
      financeOperation: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }), create: jest.fn() },
      companyBillingInvoice: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { paidAmount: null } }),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      companyBillingAccount: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      companyBillingPromoCode: { findUnique: jest.fn(), update: jest.fn() },
      companyBillingPromoRedemption: { findUnique: jest.fn(), create: jest.fn() },
      userSubscription: { findMany: jest.fn().mockResolvedValue([]) },
      subscriptionBundle: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      subscriptionBundleParticipant: { update: jest.fn() },
      subscriptionBundleRedemption: { aggregate: jest.fn(), create: jest.fn() },
      userSubscriptionBundle: { findFirst: jest.fn() },
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
      company: {
        findFirst: jest.fn(),
        findUnique: tx.company.findUnique,
        findUniqueOrThrow: tx.company.findUniqueOrThrow,
        update: tx.company.update,
      },
      category: { findMany: jest.fn(), findUnique: jest.fn() },
      companyCategory: tx.companyCategory,
      companyLevelRule: tx.companyLevelRule,
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 99, uuid: "client-uuid", name: "Client" }),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
      companyPurchase: { aggregate: tx.companyPurchase.aggregate },
      financeOperation: { findMany: jest.fn(), aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }), create: jest.fn() },
      companyBillingInvoice: tx.companyBillingInvoice,
      companyBillingAccount: tx.companyBillingAccount,
      companyBillingPromoCode: tx.companyBillingPromoCode,
      companyBillingPromoRedemption: tx.companyBillingPromoRedemption,
      userSubscription: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn().mockResolvedValue(0) },
      subscription: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      userSubscriptionBundle: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
      subscriptionBundle: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
      subscriptionBundleParticipant: { findUnique: jest.fn() },
      subscriptionBundleRedemption: tx.subscriptionBundleRedemption,
      companyLocation: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn(),
      },
      subscriptionEntitlement: { findUnique: jest.fn(), update: jest.fn() },
      subscriptionRedemption: tx.subscriptionRedemption,
      customerLookupCode: { findFirst: jest.fn(), updateMany: jest.fn() },
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

  it("uses a short-lived lookup code once to open an unknown customer at checkout", async () => {
    prisma.customerLookupCode.findFirst.mockResolvedValue({
      id: "lookup-1",
      user: { uuid: "client-uuid" },
    });
    prisma.customerLookupCode.updateMany.mockResolvedValue({ count: 1 });
    const clientSpy = jest.spyOn(service, "client").mockResolvedValue({ uuid: "client-uuid", name: "Client" } as never);

    const result = await service.lookupClientByCode(50, { code: "42107" });

    expect(result).toEqual(expect.objectContaining({ uuid: "client-uuid" }));
    expect(prisma.customerLookupCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "lookup-1", usedAt: null }) }),
    );
    expect(clientSpy).toHaveBeenCalledWith(50, "client-uuid");
  });

  it("debits customer points and records a spend operation without allowing a negative balance", async () => {
    tx.userCompany.updateMany.mockResolvedValue({ count: 1 });
    tx.userCompany.findUnique.mockResolvedValue({ balance: 30 });

    const result = await service.spendPoints(50, { userUuid: "client-uuid", points: 20 });

    expect(result).toEqual(expect.objectContaining({ pointsSpent: 20, balance: 30 }));
    expect(tx.userCompany.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ balance: { gte: 20 } }) }),
    );
    expect(tx.loyaltyTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "SPEND", amount: 20 }) }),
    );
  });

  it("rejects spending points when the customer balance is insufficient", async () => {
    tx.userCompany.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.spendPoints(50, { userUuid: "client-uuid", points: 20 })).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.loyaltyTransaction.create).not.toHaveBeenCalled();
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

  it("still links a customer after a purchase with zero cashback", async () => {
    prisma.companyMember.findFirst.mockResolvedValue({
      ...membership,
      company: {
        ...membership.company,
        levelRules: [{ levelName: "Starter", minTotalSpend: 0, cashbackPercent: 0 }],
      },
    });
    tx.companyPurchase.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

    const result = await service.awardPoints(50, {
      userUuid: "client-uuid",
      mode: "PURCHASE",
      purchaseAmount: 100,
    });

    expect(result.pointsAwarded).toBe(0);
    expect(tx.userCompany.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {},
        create: expect.objectContaining({ balance: 0 }),
      }),
    );
    expect(tx.loyaltyTransaction.create).not.toHaveBeenCalled();
  });

  it("saves company loyalty levels and subscription spend policy", async () => {
    const result = await service.updateLoyaltySettings(50, {
      subscriptionSpendPolicy: SubscriptionSpendPolicy.INCLUDE_WITH_BONUS,
      levelRules: [
        { levelName: "Gold", minTotalSpend: 1000, cashbackPercent: 5 },
        { levelName: "Bronze", minTotalSpend: 0, cashbackPercent: 1 },
      ],
    });

    expect(tx.company.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { subscriptionSpendPolicy: SubscriptionSpendPolicy.INCLUDE_WITH_BONUS },
    });
    expect(tx.companyLevelRule.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ levelName: "Bronze", sortOrder: 1 }),
          expect.objectContaining({ levelName: "Gold", sortOrder: 2 }),
        ]),
      }),
    );
    expect(result.levelRules.map((rule) => rule.levelName)).toEqual(["Bronze", "Gold"]);
  });

  it("lets a company owner add a map-picked physical location without admin access", async () => {
    prisma.companyLocation.create.mockResolvedValue({
      id: 44,
      uuid: "location-uuid",
      companyId: 7,
      title: "Main point",
      address: "Россия, Москва, Тверская улица, 7",
      city: "Москва",
      latitude: "55.761244",
      longitude: "37.618423",
      precision: "manual",
      isMain: true,
      isActive: true,
      workingDays: [1, 2, 3, 4, 5],
      openTime: "09:00",
      closeTime: "21:00",
    });

    const result = await service.createLocation(50, {
      title: "Main point",
      city: "Москва",
      address: "Россия, Москва, Тверская улица, 7",
      latitude: 55.761244,
      longitude: 37.618423,
      openTime: "09:00",
      closeTime: "21:00",
      workingDays: [1, 2, 3, 4, 5],
      isMain: true,
    });

    expect(result).toEqual(expect.objectContaining({ uuid: "location-uuid", isMain: true }));
    expect(prisma.companyLocation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: 7,
          title: "Main point",
          address: "Россия, Москва, Тверская улица, 7",
          city: "Москва",
          precision: "manual",
          geocoderResponse: expect.objectContaining({
            source: "company-map-picker",
            latitude: 55.761244,
            longitude: 37.618423,
          }),
          workingDays: [1, 2, 3, 4, 5],
          isMain: true,
        }),
      }),
    );
    expect(prisma.companyLocation.updateMany).toHaveBeenCalledWith({
      where: { companyId: 7, id: { not: 44 } },
      data: { isMain: false },
    });
  });

  it("does not allow a company cashier to manage physical locations", async () => {
    prisma.companyMember.findFirst.mockResolvedValue({
      ...membership,
      role: CompanyMemberRole.CASHIER,
    });

    await expect(
      service.createLocation(50, {
        address: "Россия, Москва, Тверская улица, 7",
        latitude: 55.761244,
        longitude: 37.618423,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.companyLocation.create).not.toHaveBeenCalled();
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

  it("adds revenue and benefit usage stats to company subscriptions", async () => {
    const now = Date.now();
    prisma.subscription.findMany.mockResolvedValue([
      {
        id: 22,
        uuid: "plan-uuid",
        companyId: 7,
        name: "Coffee Plus",
        description: "Daily coffee",
        price: 400,
        renewalPeriod: "2 day",
        renewalValue: 2,
        renewalUnit: "day",
        promoBonusDays: 0,
        isActive: true,
        entitlements: [
          {
            id: 10,
            uuid: "coffee-day",
            title: "Coffee",
            description: null,
            allowance: 2,
            windowValue: 1,
            windowUnit: SubscriptionEntitlementWindow.DAY,
            isActive: true,
          },
          {
            id: 11,
            uuid: "gym",
            title: "Gym",
            description: null,
            allowance: 1,
            windowValue: 1,
            windowUnit: SubscriptionEntitlementWindow.UNLIMITED,
            isActive: true,
          },
        ],
        userPlans: [
          {
            status: SubscriptionStatus.ACTIVE,
            activatedAt: new Date(now - DAY_MS * 2),
            expiresAt: new Date(now + DAY_MS * 2),
            redemptions: [{ entitlementId: 10, quantity: 1, redeemedAt: new Date(now) }],
          },
        ],
      },
    ]);

    const result = await service.subscriptions(50);

    expect(result[0]).toMatchObject({
      uuid: "plan-uuid",
      stats: expect.objectContaining({
        activeSubscribers: 1,
        dailyRevenue: 100,
        futureRevenue: 200,
        totalRedemptions: 1,
        usageCapacity: 2,
        usagePercent: 50,
      }),
    });
    expect((result[0] as { userPlans?: unknown }).userPlans).toBeUndefined();
  });

  it("creates a paired club subscription as a pending two-sided proposal", async () => {
    prisma.subscriptionBundle.findUnique.mockResolvedValue(null);
    prisma.company.findFirst.mockResolvedValue({ id: 8 });
    prisma.subscriptionBundle.create.mockResolvedValue({
      id: 90,
      uuid: "bundle-uuid",
      slug: "coffee-fitness",
      name: "Coffee + Fitness",
      description: "Daily coffee and unlimited gym access.",
      price: 3490,
      renewalPeriod: "1 month",
      renewalValue: 1,
      renewalUnit: "month",
      promoBonusDays: 0,
      status: SubscriptionBundleStatus.DRAFT,
      isActive: false,
      activatedAt: null,
      createdAt: new Date("2026-05-01T00:00:00Z"),
      updatedAt: new Date("2026-05-01T00:00:00Z"),
      category: null,
      proposedByCompany: { id: 7, slug: "coffee", name: "Coffee" },
      participants: [
        {
          id: 1,
          uuid: "coffee-benefit",
          companyId: 7,
          benefitTitle: "Daily tonic drink",
          benefitDescription: "One drink per day.",
          fulfillmentNote: null,
          revenueSharePercent: 40,
          allowance: 1,
          windowValue: 1,
          windowUnit: SubscriptionEntitlementWindow.DAY,
          approvalStatus: SubscriptionBundleParticipantStatus.APPROVED,
          approvedAt: new Date("2026-05-01T00:00:00Z"),
          rejectedAt: null,
          sortOrder: 1,
          company: { id: 7, slug: "coffee", name: "Coffee", isActive: true },
        },
        {
          id: 2,
          uuid: "fitness-benefit",
          companyId: 8,
          benefitTitle: "Unlimited gym entry",
          benefitDescription: "Unlimited access during the subscription term.",
          fulfillmentNote: null,
          revenueSharePercent: 60,
          allowance: 1,
          windowValue: 1,
          windowUnit: SubscriptionEntitlementWindow.UNLIMITED,
          approvalStatus: SubscriptionBundleParticipantStatus.PENDING,
          approvedAt: null,
          rejectedAt: null,
          sortOrder: 2,
          company: { id: 8, slug: "fitness", name: "Fitness", isActive: true },
        },
      ],
    });

    const result = await service.createClubBundleProposal(50, {
      name: "Coffee + Fitness",
      description: "Daily coffee and unlimited gym access.",
      price: 3490,
      partnerCompanyId: 8,
      myBenefitTitle: "Daily tonic drink",
      myBenefitDescription: "One drink per day.",
      myRevenueSharePercent: 40,
      myWindowUnit: SubscriptionEntitlementWindow.DAY,
      partnerBenefitTitle: "Unlimited gym entry",
      partnerBenefitDescription: "Unlimited access during the subscription term.",
      partnerRevenueSharePercent: 60,
      partnerWindowUnit: SubscriptionEntitlementWindow.UNLIMITED,
    });

    expect(prisma.subscriptionBundle.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: SubscriptionBundleStatus.DRAFT,
          isActive: false,
          proposedByCompanyId: 7,
          participants: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({
                companyId: 7,
                approvalStatus: SubscriptionBundleParticipantStatus.APPROVED,
                windowUnit: SubscriptionEntitlementWindow.DAY,
              }),
              expect.objectContaining({
                companyId: 8,
                approvalStatus: SubscriptionBundleParticipantStatus.PENDING,
                windowUnit: SubscriptionEntitlementWindow.UNLIMITED,
              }),
            ]),
          }),
        }),
      }),
    );
    expect(result.participants.map((participant) => participant.approvalStatus)).toEqual(["APPROVED", "PENDING"]);
  });

  it("activates a club subscription only after the second company approves it", async () => {
    const now = new Date("2026-05-02T00:00:00Z");
    tx.subscriptionBundle.findUnique.mockResolvedValue({
      id: 90,
      uuid: "bundle-uuid",
      participants: [
        { id: 1, companyId: 7, approvalStatus: SubscriptionBundleParticipantStatus.PENDING },
        { id: 2, companyId: 8, approvalStatus: SubscriptionBundleParticipantStatus.APPROVED },
      ],
    });
    tx.subscriptionBundle.findUniqueOrThrow.mockResolvedValue({
      id: 90,
      uuid: "bundle-uuid",
      slug: "coffee-fitness",
      name: "Coffee + Fitness",
      description: "Daily coffee and unlimited gym access.",
      price: 3490,
      renewalPeriod: "1 month",
      renewalValue: 1,
      renewalUnit: "month",
      promoBonusDays: 0,
      status: SubscriptionBundleStatus.ACTIVE,
      isActive: true,
      activatedAt: now,
      createdAt: now,
      updatedAt: now,
      category: null,
      proposedByCompany: { id: 8, slug: "fitness", name: "Fitness" },
      participants: [
        {
          id: 1,
          uuid: "coffee-benefit",
          companyId: 7,
          benefitTitle: "Daily tonic drink",
          benefitDescription: "One drink per day.",
          fulfillmentNote: null,
          revenueSharePercent: 40,
          allowance: 1,
          windowValue: 1,
          windowUnit: SubscriptionEntitlementWindow.DAY,
          approvalStatus: SubscriptionBundleParticipantStatus.APPROVED,
          approvedAt: now,
          rejectedAt: null,
          sortOrder: 1,
          company: { id: 7, slug: "coffee", name: "Coffee", isActive: true },
        },
        {
          id: 2,
          uuid: "fitness-benefit",
          companyId: 8,
          benefitTitle: "Unlimited gym entry",
          benefitDescription: "Unlimited access.",
          fulfillmentNote: null,
          revenueSharePercent: 60,
          allowance: 1,
          windowValue: 1,
          windowUnit: SubscriptionEntitlementWindow.UNLIMITED,
          approvalStatus: SubscriptionBundleParticipantStatus.APPROVED,
          approvedAt: now,
          rejectedAt: null,
          sortOrder: 2,
          company: { id: 8, slug: "fitness", name: "Fitness", isActive: true },
        },
      ],
    });

    const result = await service.approveClubBundle(50, "bundle-uuid");

    expect(tx.subscriptionBundleParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ approvalStatus: SubscriptionBundleParticipantStatus.APPROVED, approvedById: 50 }),
      }),
    );
    expect(tx.subscriptionBundle.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 90 },
        data: expect.objectContaining({ status: SubscriptionBundleStatus.ACTIVE, isActive: true }),
      }),
    );
    expect(result.status).toBe(SubscriptionBundleStatus.ACTIVE);
  });

  it("lets a company redeem only its own club subscription benefit", async () => {
    prisma.subscriptionBundleParticipant.findUnique.mockResolvedValue({
      id: 20,
      uuid: "coffee-benefit",
      companyId: 7,
      bundleId: 90,
      benefitTitle: "Daily tonic drink",
      allowance: 1,
      windowValue: 1,
      windowUnit: SubscriptionEntitlementWindow.DAY,
      approvalStatus: SubscriptionBundleParticipantStatus.APPROVED,
      bundle: { id: 90, name: "Coffee + Fitness", isActive: true, status: SubscriptionBundleStatus.ACTIVE },
      company: { id: 7 },
    });
    prisma.userSubscriptionBundle.findFirst.mockResolvedValue({
      id: 77,
      activatedAt: new Date("2026-05-01T00:00:00Z"),
    });
    tx.subscriptionBundleRedemption.aggregate.mockResolvedValue({ _sum: { quantity: 0 } });
    tx.subscriptionBundleRedemption.create.mockResolvedValue({ uuid: "bundle-redemption" });

    const result = await service.redeemBundleBenefit(50, {
      userUuid: "client-uuid",
      participantUuid: "coffee-benefit",
    });

    expect(result).toMatchObject({ benefit: "Daily tonic drink", bundle: "Coffee + Fitness", used: 1, allowance: 1 });
    expect(tx.subscriptionBundleRedemption.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userSubscriptionBundleId: 77, participantId: 20, companyId: 7, processedById: 50 }),
      }),
    );
  });

  it("rejects a club benefit redemption from the wrong partner company", async () => {
    prisma.subscriptionBundleParticipant.findUnique.mockResolvedValue({
      id: 21,
      uuid: "fitness-benefit",
      companyId: 8,
      bundleId: 90,
      approvalStatus: SubscriptionBundleParticipantStatus.APPROVED,
      bundle: { id: 90, name: "Coffee + Fitness", isActive: true, status: SubscriptionBundleStatus.ACTIVE },
      company: { id: 8 },
    });

    await expect(
      service.redeemBundleBenefit(50, { userUuid: "client-uuid", participantUuid: "fitness-benefit" }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.subscriptionBundleRedemption.create).not.toHaveBeenCalled();
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
        entitlements: [
          {
            title: "Coffee",
            allowance: 1,
            windowValue: 1,
            windowUnit: SubscriptionEntitlementWindow.DAY,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("requires at least one service when creating a subscription plan", async () => {
    await expect(
      service.createSubscription(50, {
        name: "Coffee every day",
        description: "One coffee every day",
        price: 990,
        entitlements: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it("rejects subscription plans below the minimum price", async () => {
    await expect(
      service.createSubscription(50, {
        name: "Coffee every day",
        description: "One coffee every day",
        price: 298,
        entitlements: [
          {
            title: "Coffee",
            allowance: 1,
            windowValue: 1,
            windowUnit: SubscriptionEntitlementWindow.DAY,
          },
        ],
      }),
    ).rejects.toThrow("Subscription price must be at least 299 RUB.");

    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it("creates a subscription together with its first service", async () => {
    prisma.subscription.findMany.mockResolvedValue([]);
    prisma.subscription.create.mockResolvedValue({ uuid: "plan-uuid", entitlements: [{ uuid: "coffee-day" }] });

    await service.createSubscription(50, {
      name: "Coffee every day",
      description: "One coffee every day",
      price: 990,
      entitlements: [
        {
          title: "Coffee",
          description: "Any classic coffee",
          allowance: 1,
          windowValue: 1,
          windowUnit: SubscriptionEntitlementWindow.DAY,
        },
        {
          title: "Fitness entrance",
          allowance: 12,
          windowValue: 30,
          windowUnit: SubscriptionEntitlementWindow.UNLIMITED,
        },
      ],
    });

    expect(prisma.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Coffee every day",
          companyId: 7,
          entitlements: {
            create: [
              {
                title: "Coffee",
                description: "Any classic coffee",
                allowance: 1,
                windowValue: 1,
                windowUnit: SubscriptionEntitlementWindow.DAY,
              },
              {
                title: "Fitness entrance",
                description: null,
                allowance: 1,
                windowValue: 1,
                windowUnit: SubscriptionEntitlementWindow.UNLIMITED,
              },
            ],
          },
        }),
        include: { entitlements: { orderBy: { createdAt: "asc" } } },
      }),
    );
  });

  it("requires refund-policy acknowledgement before editing a subscription with active customers", async () => {
    prisma.subscription.findUnique.mockResolvedValue({
      id: 22,
      uuid: "plan-uuid",
      companyId: 7,
      renewalValue: 1,
      renewalUnit: "month",
      promoBonusDays: 0,
      entitlements: [],
    });
    prisma.userSubscription.count.mockResolvedValue(2);

    await expect(
      service.updateSubscription(50, "plan-uuid", {
        name: "Coffee Annual",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it("updates an entitlement after acknowledgement and normalizes unlimited usage", async () => {
    prisma.subscriptionEntitlement.findUnique.mockResolvedValue({
      id: 10,
      uuid: "benefit-uuid",
      subscriptionId: 22,
      title: "Coffee",
      description: null,
      allowance: 2,
      windowValue: 1,
      windowUnit: SubscriptionEntitlementWindow.DAY,
      isActive: true,
      subscription: { id: 22, uuid: "plan-uuid", companyId: 7, entitlements: [{ id: 10 }, { id: 11 }] },
    });
    prisma.userSubscription.count.mockResolvedValue(4);
    prisma.subscriptionEntitlement.update.mockResolvedValue({ uuid: "benefit-uuid" });

    await service.updateEntitlement(50, "plan-uuid", "benefit-uuid", {
      title: "Unlimited club access",
      windowUnit: SubscriptionEntitlementWindow.UNLIMITED,
      acknowledgeSubscriberRefundPolicy: true,
    });

    expect(prisma.subscriptionEntitlement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { uuid: "benefit-uuid" },
        data: expect.objectContaining({
          title: "Unlimited club access",
          allowance: 1,
          windowValue: 1,
          windowUnit: SubscriptionEntitlementWindow.UNLIMITED,
        }),
      }),
    );
  });

  it("does not allow disabling the last active subscription service", async () => {
    prisma.subscriptionEntitlement.findUnique.mockResolvedValue({
      id: 10,
      uuid: "benefit-uuid",
      subscriptionId: 22,
      title: "Coffee",
      description: null,
      allowance: 1,
      windowValue: 1,
      windowUnit: SubscriptionEntitlementWindow.DAY,
      isActive: true,
      subscription: { id: 22, uuid: "plan-uuid", companyId: 7, entitlements: [{ id: 10 }] },
    });
    prisma.userSubscription.count.mockResolvedValue(0);

    await expect(
      service.updateEntitlement(50, "plan-uuid", "benefit-uuid", {
        isActive: false,
        acknowledgeSubscriberRefundPolicy: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.subscriptionEntitlement.update).not.toHaveBeenCalled();
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
      loyaltyTransactions: [],
      subscriptions: [],
      subscriptionBundles: [],
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

  it("recognizes active subscription income day by day and keeps the remaining potential", async () => {
    const day = 24 * 60 * 60 * 1000;
    const startedAt = new Date(Date.now() - day - 1000);
    prisma.financeOperation.findMany.mockResolvedValue([]);
    prisma.userSubscription.findMany.mockResolvedValue([
      { status: SubscriptionStatus.ACTIVE, activatedAt: startedAt, expiresAt: new Date(startedAt.getTime() + day * 10), subscription: { price: 1000 } },
      { status: SubscriptionStatus.ACTIVE, activatedAt: startedAt, expiresAt: new Date(startedAt.getTime() + day * 365), subscription: { price: 365000 } },
    ]);

    const result = await service.finance(50);

    expect(result.subscriptionGross).toBe(366000);
    expect(result.activeSubscribers).toBe(2);
    expect(result.dailySubscriptionRevenue).toBe(1100);
    expect(result.recognizedSubscriptionRevenue).toBe(1100);
    expect(result.potentialSubscriptionRevenue).toBe(364900);
  });

  it("keeps expired subscription earnings withdrawable and subtracts payout reservations", async () => {
    const day = 24 * 60 * 60 * 1000;
    const startedAt = new Date(Date.now() - day * 12);
    prisma.financeOperation.findMany.mockResolvedValue([]);
    prisma.financeOperation.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 300 } })
      .mockResolvedValueOnce({ _sum: { amount: 200 } });
    prisma.userSubscription.findMany.mockResolvedValue([
      {
        status: SubscriptionStatus.EXPIRED,
        activatedAt: startedAt,
        expiresAt: new Date(startedAt.getTime() + day * 10),
        subscription: { price: 1000 },
      },
    ]);

    const result = await service.finance(50);

    expect(result.activeSubscribers).toBe(0);
    expect(result.recognizedSubscriptionRevenue).toBe(1000);
    expect(result.reservedPayouts).toBe(300);
    expect(result.paidPayouts).toBe(200);
    expect(result.availableForPayout).toBe(500);
  });

  it("subtracts paid WhiteBox billing fees from the company withdrawable balance", async () => {
    const day = 24 * 60 * 60 * 1000;
    const startedAt = new Date(Date.now() - day * 12);
    prisma.financeOperation.findMany.mockResolvedValue([]);
    prisma.financeOperation.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 300 } })
      .mockResolvedValueOnce({ _sum: { amount: 200 } });
    prisma.companyBillingInvoice.aggregate.mockResolvedValue({ _sum: { paidAmount: 100 } });
    prisma.userSubscription.findMany.mockResolvedValue([
      {
        status: SubscriptionStatus.EXPIRED,
        activatedAt: startedAt,
        expiresAt: new Date(startedAt.getTime() + day * 10),
        subscription: { price: 1000 },
      },
    ]);

    const result = await service.finance(50);

    expect(result.paidPayouts).toBe(200);
    expect(result.paidBillingFees).toBe(100);
    expect(result.availableForPayout).toBe(400);
  });

  it("keeps an overdue monthly invoice payable instead of silently replacing it", async () => {
    const now = new Date();
    const account = {
      companyId: 7,
      status: "ACTIVE",
      trialEndsAt: new Date(now.getTime() - DAY_MS),
      currentPeriodStartsAt: new Date(now.getTime() - DAY_MS * 30),
      currentPeriodEndsAt: new Date(now.getTime() + DAY_MS * 20),
      appliedPromoCode: null,
    };
    const overdueInvoice = {
      uuid: "overdue-invoice",
      status: "OPEN",
      periodStartsAt: new Date(now.getTime() - DAY_MS * 60),
      periodEndsAt: new Date(now.getTime() - DAY_MS * 30),
      baseFee: 4990,
      promoDiscountPercent: 0,
      promoDiscountAmount: 0,
      commissionCreditAmount: 0,
      amountDue: 4990,
      paidAmount: 0,
    };
    prisma.companyBillingAccount.findUnique.mockResolvedValue(account);
    prisma.companyBillingAccount.update.mockResolvedValue({ ...account, status: "PAST_DUE" });
    prisma.companyBillingInvoice.findFirst.mockResolvedValue(overdueInvoice);
    prisma.companyBillingInvoice.findMany.mockResolvedValue([overdueInvoice]);
    prisma.userSubscription.findMany.mockResolvedValue([]);

    const result = await service.billing(50);

    expect(result.invoice).toEqual(overdueInvoice);
    expect(prisma.companyBillingAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 7 }, data: { status: "PAST_DUE" } }),
    );
  });

  it("rejects a payout above the earned unreserved balance", async () => {
    const day = 24 * 60 * 60 * 1000;
    const startedAt = new Date(Date.now() - day - 1000);
    tx.userSubscription.findMany.mockResolvedValue([
      {
        status: SubscriptionStatus.ACTIVE,
        activatedAt: startedAt,
        expiresAt: new Date(startedAt.getTime() + day * 10),
        subscription: { price: 100000 },
      },
    ]);
    tx.financeOperation.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 20 } })
      .mockResolvedValueOnce({ _sum: { amount: 0 } });

    await expect(service.requestPayout(50, { amount: 9981 })).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.financeOperation.create).not.toHaveBeenCalled();
  });

  it("rejects a payout below the 5000 RUB minimum before reserving funds", async () => {
    await expect(service.requestPayout(50, { amount: 4999 })).rejects.toThrow("Минимальная сумма вывода");

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.financeOperation.create).not.toHaveBeenCalled();
  });

  it("reserves an eligible payout in a serializable transaction", async () => {
    const day = 24 * 60 * 60 * 1000;
    const startedAt = new Date(Date.now() - day - 1000);
    tx.userSubscription.findMany.mockResolvedValue([
      {
        status: SubscriptionStatus.ACTIVE,
        activatedAt: startedAt,
        expiresAt: new Date(startedAt.getTime() + day * 10),
        subscription: { price: 100000 },
      },
    ]);
    tx.financeOperation.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 20 } })
      .mockResolvedValueOnce({ _sum: { amount: 0 } });
    tx.financeOperation.create.mockResolvedValue({ status: FinanceOperationStatus.PENDING_APPROVAL });

    await service.requestPayout(50, { amount: 5000 });

    expect(tx.financeOperation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: expect.anything(), status: FinanceOperationStatus.PENDING_APPROVAL }),
      }),
    );
  });
});
