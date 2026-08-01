import { BadRequestException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { SubscriptionStatus } from "@prisma/client";
import { calculateCompanyRecommendationScore, recommendationBoostMultiplier } from "./company-recommendation-score";
import { RegisteredService } from "./registered.service";

describe("RegisteredService", () => {
  const originalSubscriptionsEnabled = process.env.SUBSCRIPTIONS_ENABLED;
  let service: RegisteredService;
  let prisma: {
    category: { findMany: jest.Mock };
    userFavoriteCategory: { findMany: jest.Mock; deleteMany: jest.Mock; createMany: jest.Mock };
    subscription: { findMany: jest.Mock; findUnique: jest.Mock };
    subscriptionBundle: { findMany: jest.Mock; findUnique: jest.Mock };
    userSubscription: { findMany: jest.Mock; findFirst: jest.Mock; create: jest.Mock };
    userSubscriptionBundle: { findMany: jest.Mock; findFirst: jest.Mock; create: jest.Mock };
    subscriptionRedemption: { findMany: jest.Mock };
    subscriptionBundleRedemption: { findMany: jest.Mock };
    company: { findMany: jest.Mock; findFirst: jest.Mock };
    loyaltyTransaction: { findMany: jest.Mock; groupBy: jest.Mock; create: jest.Mock };
    userCompany: { upsert: jest.Mock; updateMany: jest.Mock };
    user: { findUnique: jest.Mock; update: jest.Mock };
    userProfilePreference: { upsert: jest.Mock };
    promoCode: { findUnique: jest.Mock };
    promoCodeRedemption: { create: jest.Mock };
    referralCampaign: { findFirst: jest.Mock; create: jest.Mock };
    referralInvite: { findFirst: jest.Mock; findUnique: jest.Mock; create: jest.Mock; count: jest.Mock };
    customerLookupCode: { findFirst: jest.Mock; updateMany: jest.Mock; create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    process.env.SUBSCRIPTIONS_ENABLED = "true";
    prisma = {
      category: { findMany: jest.fn() },
      userFavoriteCategory: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      subscription: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      subscriptionBundle: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
      userSubscription: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      userSubscriptionBundle: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      subscriptionRedemption: { findMany: jest.fn().mockResolvedValue([]) },
      subscriptionBundleRedemption: { findMany: jest.fn().mockResolvedValue([]) },
      company: { findMany: jest.fn(), findFirst: jest.fn() },
      loyaltyTransaction: {
        findMany: jest.fn(),
        groupBy: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
      userCompany: { upsert: jest.fn(), updateMany: jest.fn() },
      user: { findUnique: jest.fn(), update: jest.fn() },
      userProfilePreference: { upsert: jest.fn() },
      promoCode: { findUnique: jest.fn() },
      promoCodeRedemption: { create: jest.fn() },
      referralCampaign: { findFirst: jest.fn(), create: jest.fn() },
      referralInvite: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      customerLookupCode: { findFirst: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
      $transaction: jest.fn(async (input) => {
        if (typeof input === "function") {
          return input({
            loyaltyTransaction: prisma.loyaltyTransaction,
            promoCodeRedemption: prisma.promoCodeRedemption,
            userCompany: prisma.userCompany,
            userSubscription: prisma.userSubscription,
            userSubscriptionBundle: prisma.userSubscriptionBundle,
          });
        }
        return Promise.all(input);
      }),
    };
    service = new RegisteredService(prisma as never);
  });

  afterAll(() => {
    if (originalSubscriptionsEnabled === undefined) {
      delete process.env.SUBSCRIPTIONS_ENABLED;
    } else {
      process.env.SUBSCRIPTIONS_ENABLED = originalSubscriptionsEnabled;
    }
  });

  it("rejects direct subscription activation while subscriptions are disabled", async () => {
    process.env.SUBSCRIPTIONS_ENABLED = "false";

    await expect(service.activateSubscription(9, "sub-30")).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.subscription.findUnique).not.toHaveBeenCalled();
  });

  it("allows setting birth date for the first time", async () => {
    const currentUser = { birthDate: null, birthDateChangedAt: null };
    prisma.user.findUnique
      .mockResolvedValueOnce(currentUser)
      .mockResolvedValueOnce({
        uuid: "user-1",
        name: "User",
        email: "user@example.com",
        birthDate: new Date("2000-01-01T00:00:00.000Z"),
        birthDateChangedAt: new Date("2026-07-30T00:00:00.000Z"),
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
    prisma.user.update.mockResolvedValue({});
    prisma.userProfilePreference.upsert.mockResolvedValue({
      onboardingCompletedAt: null,
      onboardingSkippedAt: null,
      geolocationPromptedAt: null,
    });
    prisma.userFavoriteCategory.findMany.mockResolvedValue([]);
    prisma.company.findMany.mockResolvedValue([]);
    prisma.loyaltyTransaction.findMany.mockResolvedValue([]);
    prisma.userSubscription.findMany.mockResolvedValue([]);
    prisma.referralCampaign.findFirst.mockResolvedValue({ uuid: "campaign-1" });
    prisma.referralInvite.findFirst.mockResolvedValue(null);
    prisma.referralInvite.findUnique.mockResolvedValue(null);
    prisma.referralInvite.create.mockResolvedValue({ code: "WB-USER" });

    await service.updateProfile(7, { birthDate: "2000-01-01" });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { birthDate: new Date("2000-01-01T00:00:00.000Z"), birthDateChangedAt: expect.any(Date) },
    });
  });

  it("rejects birth date changes before one year passes", async () => {
    prisma.user.findUnique.mockResolvedValue({
      birthDate: new Date("2000-01-01T00:00:00.000Z"),
      birthDateChangedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    });

    await expect(service.updateProfile(7, { birthDate: "2001-02-03" })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("marketplace returns active DB subscriptions with ownership flags", async () => {
    prisma.category.findMany.mockResolvedValue([
      { id: 1, slug: "coffee", name: "Coffee", icon: "Coffee" },
    ]);
    prisma.userFavoriteCategory.findMany.mockResolvedValue([
      { category: { slug: "coffee" } },
    ]);
    prisma.subscription.findMany.mockResolvedValue([
      {
        uuid: "sub-1",
        slug: "coffee-plus",
        name: "Coffee Plus",
        description: "Daily coffee benefits",
        price: "12.5",
        renewalPeriod: "month",
        renewalValue: 1,
        renewalUnit: "month",
        promoBonusDays: 0,
        promoEndsAt: null,
        isActive: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        company: { id: 10, slug: "aurora", name: "Aurora", isActive: true },
        category: { id: 1, slug: "coffee", name: "Coffee", icon: "Coffee" },
      },
    ]);
    prisma.userSubscription.findMany.mockResolvedValue([
      {
        id: 99,
        status: SubscriptionStatus.ACTIVE,
        activatedAt: new Date(),
        expiresAt: null,
        willAutoRenew: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        subscription: {
          uuid: "sub-1",
          slug: "coffee-plus",
          name: "Coffee Plus",
          description: "Daily coffee benefits",
          price: "12.5",
          renewalPeriod: "month",
          renewalValue: 1,
          renewalUnit: "month",
          promoBonusDays: 0,
          promoEndsAt: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          company: { id: 10, slug: "aurora", name: "Aurora", isActive: true },
          category: { id: 1, slug: "coffee", name: "Coffee", icon: "Coffee" },
        },
      },
    ]);

    const result = await service.marketplace(7, "coffee");

    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      }),
    );
    expect(prisma.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          category: { slug: "coffee" },
          OR: expect.arrayContaining([
            { companyId: null },
            {
              company: expect.objectContaining({
                isActive: true,
                billingAccount: {
                  is: expect.objectContaining({
                    currentPeriodEndsAt: { gt: expect.any(Date) },
                    status: { in: ["ACTIVE", "TRIAL"] },
                  }),
                },
              }),
            },
          ]),
        }),
      }),
    );
    expect(result.categories[0].isFavorite).toBe(true);
    expect(result.subscriptions[0]).toMatchObject({
      uuid: "sub-1",
      price: "12.50",
      isOwned: true,
    });
  });

  it("userQr returns a fresh payload based on user uuid", async () => {
    prisma.user.findUnique.mockResolvedValue({
      uuid: "11111111-1111-4111-8111-111111111111",
    });

    const first = await service.userQr(7);
    const second = await service.userQr(7);

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
    expect(first.payload).toBe("nearloy:user:11111111-1111-4111-8111-111111111111");
    expect(second.payload).toBe(first.payload);
    expect(first.generatedAt).toBeInstanceOf(Date);
  });

  it("creates a five digit single-use lookup code and keeps it reusable until it expires", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 7 });
    prisma.customerLookupCode.findFirst.mockResolvedValue(null);
    prisma.customerLookupCode.updateMany.mockResolvedValue({ count: 1 });
    prisma.customerLookupCode.create.mockResolvedValue({ id: "code-1" });

    const result = await service.createCustomerLookupCode(7);

    expect(result.code).toMatch(/^\d{5}$/);
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(prisma.customerLookupCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 7, usedAt: null }) }),
    );
    expect(prisma.customerLookupCode.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 7, expiresAt: result.expiresAt }),
    });
    expect(prisma.customerLookupCode.create.mock.calls[0][0].data.codeHash).not.toBe(result.code);
    expect(prisma.customerLookupCode.create.mock.calls[0][0].data.code).toBe(result.code);
  });

  it("returns an active lookup code instead of creating a duplicate", async () => {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    prisma.user.findUnique.mockResolvedValue({ id: 7 });
    prisma.customerLookupCode.findFirst.mockResolvedValue({ code: "23826", expiresAt });

    const result = await service.createCustomerLookupCode(7);

    expect(result).toEqual({ code: "23826", expiresAt });
    expect(prisma.customerLookupCode.updateMany).not.toHaveBeenCalled();
    expect(prisma.customerLookupCode.create).not.toHaveBeenCalled();
  });

  it("completeOnboarding persists completion and geolocation prompt timestamps", async () => {
    prisma.userProfilePreference.upsert.mockResolvedValue({
      userId: 7,
      onboardingCompletedAt: new Date("2026-04-30T10:00:00.000Z"),
      geolocationPromptedAt: new Date("2026-04-30T10:00:00.000Z"),
    });

    const result = await service.completeOnboarding(7);

    expect(result.success).toBe(true);
    expect(prisma.userProfilePreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 7 },
        update: expect.objectContaining({
          onboardingCompletedAt: expect.any(Date),
          geolocationPromptedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("redeemPromoCode grants points and creates a redemption record", async () => {
    prisma.promoCode.findUnique.mockResolvedValue({
      id: 5,
      code: "WELCOME500",
      title: "Welcome bonus",
      rewardType: "POINTS",
      points: 500,
      companyId: 77,
      isActive: true,
      expiresAt: null,
      maxRedemptions: null,
      subscription: null,
      redemptions: [],
    });

    const result = await service.redeemPromoCode(7, " welcome500 ");

    expect(prisma.promoCodeRedemption.create).toHaveBeenCalledWith({
      data: { promoCodeId: 5, userId: 7 },
    });
    expect(prisma.userCompany.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_companyId: { userId: 7, companyId: 77 } },
        update: { balance: { increment: 500 } },
      }),
    );
    expect(prisma.loyaltyTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 500 }),
      }),
    );
    expect(result).toMatchObject({
      success: true,
      type: "POINTS",
      message: "Promo activated: 500 points added.",
    });
  });

  it("redeemPromoCode rejects duplicate user redemption", async () => {
    prisma.promoCode.findUnique.mockResolvedValue({
      id: 5,
      code: "WELCOME500",
      title: "Welcome bonus",
      rewardType: "POINTS",
      points: 500,
      companyId: 77,
      isActive: true,
      expiresAt: null,
      maxRedemptions: null,
      subscription: null,
      redemptions: [{ userId: 7 }],
    });

    await expect(service.redeemPromoCode(7, "WELCOME500")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("listCompanies calculates balances and level progress from earned points", async () => {
    prisma.company.findMany.mockResolvedValue([
      {
        id: 5,
        slug: "pulse",
        name: "Pulse Fitness",
        description: null,
        isActive: true,
        operatesOnline: false,
        category: { id: 2, slug: "fitness", name: "Fitness", icon: "Dumbbell" },
        categories: [],
        locations: [],
        userLinks: [
          {
            balance: 120,
            pointsToNextReward: 80,
            expiringPoints: null,
            expiringDate: null,
            isFavorite: true,
            favoritedAt: new Date("2026-07-04T09:00:00.000Z"),
            updatedAt: null,
          },
        ],
        levelRules: [
          { id: 1, levelName: "Bronze", minTotalSpend: "0", cashbackPercent: "1", sortOrder: 1 },
          { id: 2, levelName: "Silver", minTotalSpend: "1000", cashbackPercent: "3", sortOrder: 2 },
        ],
      },
    ]);
    prisma.loyaltyTransaction.groupBy.mockResolvedValue([
      { companyId: 5, type: "EARN", _sum: { amount: 500 } },
      { companyId: 5, type: "SPEND", _sum: { amount: 400 } },
    ]);

    const result = await service.listCompanies(11);

    expect(prisma.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          billingAccount: {
            is: expect.objectContaining({
              currentPeriodEndsAt: { gt: expect.any(Date) },
              status: { in: ["ACTIVE", "TRIAL"] },
            }),
          },
        }),
      }),
    );
    expect(result[0].points.balance).toBe(120);
    expect(result[0].points.totalEarnedPoints).toBe(500);
    expect(result[0].isFavorite).toBe(true);
    expect(result[0].level.current?.levelName).toBe("Bronze");
    expect(result[0].level.next?.pointsToNext).toBe(500);
    expect(result[0].level.progressPercent).toBe(50);
  });

  it("ranks company recommendations with manual boost and forced priority", async () => {
    const category = { id: 1, slug: "coffee", name: "Coffee", icon: "Coffee" };
    const company = (id: number, slug: string, boostPercent: number, recommendForEveryone = false) => ({
      id,
      slug,
      name: slug,
      description: null,
      isActive: true,
      operatesOnline: false,
      recommendationBoostPercent: boostPercent,
      recommendForEveryone,
      category,
      categories: [],
      locations: [],
      mediaAssets: [],
      userLinks: [],
      levelRules: [],
    });
    prisma.company.findMany.mockResolvedValue([
      company(1, "plain", 0),
      company(2, "boosted", 100),
      company(3, "everyone", 0, true),
    ]);
    prisma.loyaltyTransaction.groupBy.mockResolvedValue([]);

    const result = await service.recommendations(11, 3);

    expect(result.map((row) => row.company.slug)).toEqual(["everyone", "boosted", "plain"]);
    expect(result[0].reason).toBe("manual_priority");
    expect(result[1].reason).toBe("manual_boost");
    expect(result[1].effectiveMultiplier).toBe(2);
  });

  it("calculates recommendation boost multipliers safely", () => {
    expect(recommendationBoostMultiplier(20)).toBe(1.2);
    expect(recommendationBoostMultiplier(50)).toBe(1.5);
    expect(recommendationBoostMultiplier(100)).toBe(2);
    expect(recommendationBoostMultiplier(-50)).toBe(1);
    expect(calculateCompanyRecommendationScore({ baseScore: 100, boostPercent: 100 })).toBe(200);
    expect(
      calculateCompanyRecommendationScore({
        baseScore: 100,
        boostPercent: 0,
        recommendForEveryone: true,
      }),
    ).toBeGreaterThan(1_000_000);
  });

  it("wallet keeps user cards from history even when company is hidden from public discovery", async () => {
    prisma.company.findMany.mockResolvedValue([
      {
        id: 6,
        slug: "aurora",
        name: "Aurora Coffee",
        description: null,
        isActive: true,
        operatesOnline: false,
        category: { id: 1, slug: "coffee", name: "Coffee", icon: "Coffee" },
        categories: [],
        locations: [],
        mediaAssets: [],
        userLinks: [],
        levelRules: [],
      },
    ]);
    prisma.loyaltyTransaction.groupBy.mockResolvedValue([
      { companyId: 6, type: "EARN", _sum: { amount: 120 } },
    ]);

    const result = await service.wallet(11);

    expect(prisma.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
      }),
    );
    expect(result.companies).toHaveLength(1);
    expect(result.companies[0]).toMatchObject({
      slug: "aurora",
      points: expect.objectContaining({ totalEarnedPoints: 120 }),
    });
  });

  it("setCompanyFavorite toggles favorite without a separate favorites table", async () => {
    const favoritedAt = new Date("2026-07-04T09:00:00.000Z");
    prisma.company.findFirst.mockResolvedValue({ id: 5, slug: "pulse", name: "Pulse Fitness" });
    prisma.userCompany.upsert.mockResolvedValue({ isFavorite: true, favoritedAt });

    const result = await service.setCompanyFavorite(11, "5", true);

    expect(prisma.company.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          billingAccount: {
            is: expect.objectContaining({
              currentPeriodEndsAt: { gt: expect.any(Date) },
              status: { in: ["ACTIVE", "TRIAL"] },
            }),
          },
        }),
      }),
    );
    expect(prisma.userCompany.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_companyId: { userId: 11, companyId: 5 } },
        update: expect.objectContaining({ isFavorite: true, favoritedAt: expect.any(Date) }),
        create: expect.objectContaining({ userId: 11, companyId: 5, isFavorite: true, favoritedAt: expect.any(Date) }),
      }),
    );
    expect(result).toMatchObject({ companyId: 5, slug: "pulse", isFavorite: true });

    await service.setCompanyFavorite(11, "pulse", false);

    expect(prisma.userCompany.updateMany).toHaveBeenCalledWith({
      where: { userId: 11, companyId: 5 },
      data: { isFavorite: false, favoritedAt: null },
    });
  });

  it("activateSubscription creates active user subscription and company link", async () => {
    prisma.subscription.findUnique.mockResolvedValue({
      id: 30,
      uuid: "sub-30",
      slug: "starter",
      name: "Starter",
      description: "Starter plan",
      price: "10",
      renewalPeriod: "month",
      renewalValue: 1,
      renewalUnit: "month",
      promoBonusDays: 7,
      promoEndsAt: null,
      isActive: true,
      companyId: 12,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      company: { id: 12, slug: "aurora", name: "Aurora", isActive: true },
      category: { id: 1, slug: "coffee", name: "Coffee", icon: "Coffee" },
      entitlements: [
        {
          uuid: "benefit-1",
          title: "Coffee",
          description: null,
          allowance: 1,
          windowValue: 1,
          windowUnit: "DAY",
          isActive: true,
        },
      ],
    });
    prisma.userSubscription.findFirst.mockResolvedValue(null);
    prisma.userSubscription.create.mockResolvedValue({
      id: 44,
      status: SubscriptionStatus.ACTIVE,
      activatedAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: new Date("2026-02-08T00:00:00.000Z"),
      willAutoRenew: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      subscription: {
        id: 30,
        uuid: "sub-30",
        slug: "starter",
        name: "Starter",
        description: "Starter plan",
        price: "10",
        renewalPeriod: "month",
        renewalValue: 1,
        renewalUnit: "month",
        promoBonusDays: 7,
        promoEndsAt: null,
        isActive: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        company: { id: 12, slug: "aurora", name: "Aurora", isActive: true },
        category: { id: 1, slug: "coffee", name: "Coffee", icon: "Coffee" },
        entitlements: [
          {
            uuid: "benefit-1",
            title: "Coffee",
            description: null,
            allowance: 1,
            windowValue: 1,
            windowUnit: "DAY",
            isActive: true,
          },
        ],
      },
    });

    const result = await service.activateSubscription(9, "sub-30");

    expect(prisma.userCompany.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_companyId: { userId: 9, companyId: 12 } },
      }),
    );
    expect(result).toMatchObject({
      id: 44,
      status: SubscriptionStatus.ACTIVE,
      subscription: { uuid: "sub-30", price: "10.00" },
    });
  });

  it("activateSubscription rejects duplicate active subscription", async () => {
    prisma.subscription.findUnique.mockResolvedValue({
      id: 30,
      uuid: "sub-30",
      isActive: true,
      company: null,
      entitlements: [{ uuid: "benefit-1" }],
    });
    prisma.userSubscription.findFirst.mockResolvedValue({ id: 1 });

    await expect(service.activateSubscription(9, "sub-30")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("activateSubscription rejects plans without active services", async () => {
    prisma.subscription.findUnique.mockResolvedValue({
      id: 30,
      uuid: "sub-30",
      isActive: true,
      company: null,
      entitlements: [],
    });

    await expect(service.activateSubscription(9, "sub-30")).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.userSubscription.create).not.toHaveBeenCalled();
  });

  it("activateSubscription rejects inactive or missing plans", async () => {
    prisma.subscription.findUnique.mockResolvedValue(null);

    await expect(service.activateSubscription(9, "missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});
