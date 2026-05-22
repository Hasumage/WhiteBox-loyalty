import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { LoyaltyTransactionStatus, LoyaltyTransactionType, Prisma, PromoCodeRewardType, ReferralInviteStatus, SubscriptionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class RegisteredService {
  constructor(private readonly prisma: PrismaService) {}

  private decimalToNumber(value: Prisma.Decimal | number | string | null | undefined) {
    if (value === null || value === undefined) return 0;
    return Number(value);
  }

  private decimalToMoney(value: Prisma.Decimal | number | string) {
    return this.decimalToNumber(value).toFixed(2);
  }

  private normalizeCode(code: string) {
    return code.trim().toUpperCase().replace(/\s+/g, "");
  }

  private async ensurePreferences(userId: number) {
    return this.prisma.userProfilePreference.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  private async getReferralCampaign() {
    const existing = await this.prisma.referralCampaign.findFirst({ orderBy: { id: "asc" } });
    if (existing) return existing;
    return this.prisma.referralCampaign.create({ data: {} });
  }

  private async ensureReferralInvite(userId: number) {
    const existing = await this.prisma.referralInvite.findFirst({
      where: { inviterUserId: userId },
      orderBy: { id: "asc" },
    });
    if (existing) return existing;

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { uuid: true } });
    const base = `WB-${(user?.uuid ?? String(userId)).replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    let candidate = base;
    let suffix = 2;
    while (await this.prisma.referralInvite.findUnique({ where: { code: candidate }, select: { id: true } })) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    return this.prisma.referralInvite.create({ data: { inviterUserId: userId, code: candidate } });
  }

  private async addCompanyPoints(
    tx: Prisma.TransactionClient,
    userId: number,
    companyId: number | null | undefined,
    points: number,
    description: string,
  ) {
    if (points <= 0) return;
    if (!companyId) throw new BadRequestException("Point reward must be linked to a company.");
    await tx.userCompany.upsert({
      where: { userId_companyId: { userId, companyId } },
      update: { balance: { increment: points } },
      create: { userId, companyId, balance: points },
    });
    await tx.loyaltyTransaction.create({
      data: {
        userId,
        companyId,
        type: LoyaltyTransactionType.EARN,
        status: LoyaltyTransactionStatus.ACTIVE,
        amount: points,
        description,
      },
    });
  }

  private addSubscriptionPeriod(base: Date, value: number, unit: string, promoBonusDays: number) {
    const result = new Date(base);
    const safeValue = Math.max(1, Number(value) || 1);
    const normalizedUnit = unit.toLowerCase();

    if (normalizedUnit === "week") {
      result.setDate(result.getDate() + safeValue * 7);
    } else if (normalizedUnit === "year") {
      result.setFullYear(result.getFullYear() + safeValue);
    } else {
      result.setMonth(result.getMonth() + safeValue);
    }

    if (promoBonusDays > 0) {
      result.setDate(result.getDate() + promoBonusDays);
    }

    return result;
  }

  private resolveLevel(
    totalSpentPoints: number,
    rules: Array<{
      id: number;
      levelName: string;
      minTotalSpend: Prisma.Decimal | number | string;
      cashbackPercent: Prisma.Decimal | number | string;
      sortOrder: number;
    }>,
  ) {
    const orderedRules = [...rules].sort(
      (a, b) => this.decimalToNumber(a.minTotalSpend) - this.decimalToNumber(b.minTotalSpend),
    );
    let current = orderedRules[0] ?? null;
    let next = null as (typeof orderedRules)[number] | null;

    for (const rule of orderedRules) {
      if (totalSpentPoints >= this.decimalToNumber(rule.minTotalSpend)) {
        current = rule;
      } else {
        next = rule;
        break;
      }
    }

    const currentMin = current ? this.decimalToNumber(current.minTotalSpend) : 0;
    const nextMin = next ? this.decimalToNumber(next.minTotalSpend) : null;
    const progressPercent = nextMin
      ? Math.min(100, Math.max(0, ((totalSpentPoints - currentMin) / (nextMin - currentMin)) * 100))
      : 100;

    return {
      current: current
        ? {
            id: current.id,
            levelName: current.levelName,
            minTotalSpend: currentMin,
            cashbackPercent: this.decimalToNumber(current.cashbackPercent),
            sortOrder: current.sortOrder,
          }
        : null,
      next: next
        ? {
            id: next.id,
            levelName: next.levelName,
            minTotalSpend: nextMin ?? 0,
            cashbackPercent: this.decimalToNumber(next.cashbackPercent),
            sortOrder: next.sortOrder,
            pointsToNext: Math.max(0, (nextMin ?? 0) - totalSpentPoints),
          }
        : null,
      totalSpentPoints,
      progressPercent,
      ladder: orderedRules.map((rule) => ({
        id: rule.id,
        levelName: rule.levelName,
        minTotalSpend: this.decimalToNumber(rule.minTotalSpend),
        cashbackPercent: this.decimalToNumber(rule.cashbackPercent),
        sortOrder: rule.sortOrder,
      })),
    };
  }

  private serializeSubscriptionPlan(plan: {
    uuid: string;
    slug: string;
    name: string;
    description: string;
    price: Prisma.Decimal | number | string;
    renewalPeriod: string;
    renewalValue: number;
    renewalUnit: string;
    promoBonusDays: number;
    promoEndsAt: Date | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    company: { id: number; slug: string; name: string; isActive: boolean } | null;
    category: { id: number; slug: string; name: string; icon: string } | null;
  }) {
    return {
      uuid: plan.uuid,
      slug: plan.slug,
      name: plan.name,
      description: plan.description,
      price: this.decimalToMoney(plan.price),
      renewalPeriod: plan.renewalPeriod,
      renewalValue: plan.renewalValue,
      renewalUnit: plan.renewalUnit,
      promoBonusDays: plan.promoBonusDays,
      promoEndsAt: plan.promoEndsAt,
      isActive: plan.isActive,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      company: plan.company,
      category: plan.category,
    };
  }

  async listCategories(userId: number) {
    const [categories, favorites] = await Promise.all([
      this.prisma.category.findMany({
        orderBy: { name: "asc" },
        select: { id: true, slug: true, name: true, icon: true },
      }),
      this.prisma.userFavoriteCategory.findMany({
        where: { userId },
        include: { category: { select: { slug: true } } },
        orderBy: { id: "asc" },
      }),
    ]);

    const favoriteSet = new Set(favorites.map((f) => f.category.slug));
    return categories.map((c) => ({ ...c, isFavorite: favoriteSet.has(c.slug) }));
  }

  async userQr(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { uuid: true },
    });
    if (!user) throw new NotFoundException("User not found.");

    const payload = `whitebox:user:${user.uuid}`;
    return {
      payload,
      generatedAt: new Date(),
    };
  }

  async profile(userId: number) {
    const [user, preferences, favoriteCategories, wallet, activeSubscriptions, history, referral] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { uuid: true, name: true, email: true, createdAt: true },
      }),
      this.ensurePreferences(userId),
      this.prisma.userFavoriteCategory.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        include: { category: { select: { id: true, slug: true, name: true, icon: true } } },
      }),
      this.wallet(userId),
      this.listActiveSubscriptions(userId),
      this.history(userId),
      this.referralStatus(userId),
    ]);
    if (!user) throw new NotFoundException("User not found.");

    const earned = history.transactions.filter((tx) => tx.type === "EARN").reduce((sum, tx) => sum + tx.amount, 0);
    const spent = history.transactions.filter((tx) => tx.type === "SPEND").reduce((sum, tx) => sum + tx.amount, 0);
    return {
      user,
      preferences,
      onboarding: {
        completed: Boolean(preferences.onboardingCompletedAt || preferences.onboardingSkippedAt),
        completedAt: preferences.onboardingCompletedAt,
        skippedAt: preferences.onboardingSkippedAt,
      },
      stats: {
        totalBalance: wallet.totalBalance,
        partnerCount: wallet.companies.length,
        activeSubscriptions: activeSubscriptions.length,
        favoriteCategories: favoriteCategories.length,
        earnedPoints: earned,
        spentPoints: spent,
        activityScore: Math.min(100, Math.round((earned + activeSubscriptions.length * 250 + favoriteCategories.length * 50) / 100)),
      },
      favoriteCategories: favoriteCategories.map((row) => row.category),
      referral,
    };
  }

  async completeOnboarding(userId: number) {
    const now = new Date();
    const preferences = await this.prisma.userProfilePreference.upsert({
      where: { userId },
      update: { onboardingCompletedAt: now, geolocationPromptedAt: now },
      create: { userId, onboardingCompletedAt: now, geolocationPromptedAt: now },
    });
    return { success: true as const, preferences };
  }

  async skipOnboarding(userId: number) {
    const now = new Date();
    const preferences = await this.prisma.userProfilePreference.upsert({
      where: { userId },
      update: { onboardingSkippedAt: now },
      create: { userId, onboardingSkippedAt: now },
    });
    return { success: true as const, preferences };
  }

  async updateProfilePreferences(userId: number, dto: {
    profileVisibility?: "PRIVATE" | "FRIENDS" | "PUBLIC";
    marketingOptIn?: boolean;
    showActivityStats?: boolean;
  }) {
    return this.prisma.userProfilePreference.upsert({
      where: { userId },
      update: {
        ...(dto.profileVisibility !== undefined ? { profileVisibility: dto.profileVisibility } : {}),
        ...(dto.marketingOptIn !== undefined ? { marketingOptIn: dto.marketingOptIn } : {}),
        ...(dto.showActivityStats !== undefined ? { showActivityStats: dto.showActivityStats } : {}),
      },
      create: {
        userId,
        profileVisibility: dto.profileVisibility ?? "PRIVATE",
        marketingOptIn: dto.marketingOptIn ?? false,
        showActivityStats: dto.showActivityStats ?? true,
      },
    });
  }

  async referralStatus(userId: number) {
    const [campaign, invite, redeemedCount] = await Promise.all([
      this.getReferralCampaign(),
      this.ensureReferralInvite(userId),
      this.prisma.referralInvite.count({ where: { inviterUserId: userId, status: ReferralInviteStatus.REWARDED } }),
    ]);
    return {
      code: invite.code,
      title: campaign.title,
      inviterBonusPoints: campaign.inviterBonusPoints,
      invitedBonusPoints: campaign.invitedBonusPoints,
      isActive: campaign.isActive,
      redeemedCount,
    };
  }

  async redeemReferralCode(userId: number, rawCode: string) {
    const code = this.normalizeCode(rawCode);
    const [campaign, invite] = await Promise.all([
      this.getReferralCampaign(),
      this.prisma.referralInvite.findUnique({ where: { code } }),
    ]);
    if (!campaign.isActive) throw new BadRequestException("Referral campaign is not active.");
    if (!invite) throw new NotFoundException("Referral code not found.");
    if (invite.inviterUserId === userId) throw new BadRequestException("You cannot redeem your own referral code.");
    if (invite.invitedUserId) throw new BadRequestException("Referral code was already redeemed.");

    await this.prisma.$transaction(async (tx) => {
      await tx.referralInvite.update({
        where: { id: invite.id },
        data: { invitedUserId: userId, status: ReferralInviteStatus.REWARDED, rewardedAt: new Date() },
      });
      await this.addCompanyPoints(tx, invite.inviterUserId, campaign.bonusCompanyId, campaign.inviterBonusPoints, `Referral bonus for inviting user ${userId}`);
      await this.addCompanyPoints(tx, userId, campaign.bonusCompanyId, campaign.invitedBonusPoints, `Referral bonus for code ${code}`);
    });

    return {
      success: true as const,
      code,
      message: `Referral activated. You received ${campaign.invitedBonusPoints} points.`,
      inviterBonusPoints: campaign.inviterBonusPoints,
      invitedBonusPoints: campaign.invitedBonusPoints,
    };
  }

  async redeemPromoCode(userId: number, rawCode: string) {
    const code = this.normalizeCode(rawCode);
    const promo = await this.prisma.promoCode.findUnique({
      where: { code },
      include: {
        company: { select: { id: true, slug: true, name: true, isActive: true } },
        subscription: {
          include: {
            company: { select: { id: true, slug: true, name: true, isActive: true } },
            category: { select: { id: true, slug: true, name: true, icon: true } },
          },
        },
        redemptions: { select: { userId: true } },
      },
    });
    if (!promo || !promo.isActive) throw new NotFoundException("Promo code not found.");
    if (promo.expiresAt && promo.expiresAt < new Date()) throw new BadRequestException("Promo code expired.");
    if (promo.redemptions.some((row) => row.userId === userId)) throw new BadRequestException("Promo code already redeemed.");
    if (promo.maxRedemptions != null && promo.redemptions.length >= promo.maxRedemptions) {
      throw new BadRequestException("Promo code redemption limit reached.");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.promoCodeRedemption.create({ data: { promoCodeId: promo.id, userId } });
      if (promo.rewardType === PromoCodeRewardType.POINTS) {
        await this.addCompanyPoints(tx, userId, promo.companyId, promo.points, `Promo code ${promo.code}: ${promo.title}`);
        return { type: "POINTS" as const, points: promo.points };
      }

      if (!promo.subscription) throw new BadRequestException("Promo subscription is not available.");
      const now = new Date();
      const existing = await tx.userSubscription.findFirst({
        where: {
          userId,
          subscriptionId: promo.subscription.id,
          status: SubscriptionStatus.ACTIVE,
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
        },
      });
      if (existing) throw new BadRequestException("Subscription is already active.");
      if (promo.subscription.companyId) {
        await tx.userCompany.upsert({
          where: { userId_companyId: { userId, companyId: promo.subscription.companyId } },
          update: {},
          create: { userId, companyId: promo.subscription.companyId },
        });
      }
      const created = await tx.userSubscription.create({
        data: {
          userId,
          subscriptionId: promo.subscription.id,
          status: SubscriptionStatus.ACTIVE,
          activatedAt: now,
          expiresAt: this.addSubscriptionPeriod(now, promo.subscription.renewalValue, promo.subscription.renewalUnit, 0),
          willAutoRenew: false,
        },
        include: {
          subscription: {
            include: {
              company: { select: { id: true, slug: true, name: true, isActive: true } },
              category: { select: { id: true, slug: true, name: true, icon: true } },
            },
          },
        },
      });
      return { type: "SUBSCRIPTION" as const, subscription: this.serializeSubscriptionPlan(created.subscription) };
    });

    return {
      success: true as const,
      code,
      reward: result,
      type: result.type,
      message:
        result.type === "POINTS"
          ? `Promo activated: ${result.points} points added.`
          : "Promo activated: subscription is now active.",
    };
  }

  private async listMarketplaceCategories(userId: number) {
    const [categories, favorites] = await Promise.all([
      this.prisma.category.findMany({
        where: {
          subscriptions: {
            some: {
              isActive: true,
              OR: [{ companyId: null }, { company: { isActive: true } }],
            },
          },
        },
        orderBy: { name: "asc" },
        select: { id: true, slug: true, name: true, icon: true },
      }),
      this.prisma.userFavoriteCategory.findMany({
        where: { userId },
        include: { category: { select: { slug: true } } },
        orderBy: { id: "asc" },
      }),
    ]);

    const favoriteSet = new Set(favorites.map((f) => f.category.slug));
    return categories.map((c) => ({ ...c, isFavorite: favoriteSet.has(c.slug) }));
  }

  async listFavoriteCategorySlugs(userId: number): Promise<string[]> {
    const rows = await this.prisma.userFavoriteCategory.findMany({
      where: { userId },
      include: { category: { select: { slug: true } } },
      orderBy: { id: "asc" },
    });
    return rows.map((r) => r.category.slug);
  }

  async replaceFavoriteCategories(userId: number, categorySlugs: string[]) {
    const uniqueSlugs = [...new Set(categorySlugs.map((s) => s.trim().toLowerCase()).filter(Boolean))];
    if (uniqueSlugs.length === 0) {
      throw new BadRequestException("At least one category is required.");
    }

    const categories = await this.prisma.category.findMany({
      where: { slug: { in: uniqueSlugs } },
      select: { id: true, slug: true },
    });

    if (categories.length !== uniqueSlugs.length) {
      throw new BadRequestException("One or more categories do not exist.");
    }

    const orderMap = new Map(uniqueSlugs.map((slug, idx) => [slug, idx]));
    const ordered = categories.sort(
      (a, b) => (orderMap.get(a.slug) ?? 0) - (orderMap.get(b.slug) ?? 0),
    );

    await this.prisma.$transaction([
      this.prisma.userFavoriteCategory.deleteMany({ where: { userId } }),
      this.prisma.userFavoriteCategory.createMany({
        data: ordered.map((c) => ({ userId, categoryId: c.id })),
      }),
    ]);

    return { favoriteCategorySlugs: ordered.map((c) => c.slug) };
  }

  async marketplace(userId: number, categorySlug?: string) {
    const categories = await this.listMarketplaceCategories(userId);
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        isActive: true,
        ...(categorySlug ? { category: { slug: categorySlug } } : {}),
        OR: [{ companyId: null }, { company: { isActive: true } }],
      },
      orderBy: [{ createdAt: "desc" }, { name: "asc" }],
      include: {
        company: { select: { id: true, slug: true, name: true, isActive: true } },
        category: { select: { id: true, slug: true, name: true, icon: true } },
      },
    });

    const activeRows = await this.listActiveSubscriptions(userId);
    const activePlanIds = new Set(activeRows.map((row) => row.subscription.uuid));

    return {
      categories,
      subscriptions: subscriptions.map((plan) => ({
        ...this.serializeSubscriptionPlan(plan),
        isOwned: activePlanIds.has(plan.uuid),
      })),
    };
  }

  async listCompanies(userId: number) {
    const [companies, transactions] = await Promise.all([
      this.prisma.company.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        include: {
          category: { select: { id: true, slug: true, name: true, icon: true } },
          categories: {
            select: {
              categoryId: true,
              category: { select: { id: true, slug: true, name: true, icon: true } },
            },
            orderBy: { id: "asc" },
          },
          levelRules: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              levelName: true,
              minTotalSpend: true,
              cashbackPercent: true,
              sortOrder: true,
            },
          },
          locations: {
            where: { isActive: true },
            orderBy: [{ isMain: "desc" }, { createdAt: "asc" }],
            select: {
              uuid: true,
              title: true,
              address: true,
              city: true,
              latitude: true,
              longitude: true,
              precision: true,
              openTime: true,
              closeTime: true,
              workingDays: true,
              isMain: true,
            },
          },
          userLinks: {
            where: { userId },
            select: {
              balance: true,
              pointsToNextReward: true,
              expiringPoints: true,
              expiringDate: true,
              updatedAt: true,
            },
            take: 1,
          },
        },
      }),
      this.prisma.loyaltyTransaction.groupBy({
        by: ["companyId", "type"],
        where: { userId },
        _sum: { amount: true },
      }),
    ]);

    const spentByCompany = new Map<number, number>();
    const earnedByCompany = new Map<number, number>();
    for (const row of transactions) {
      const amount = row._sum.amount ?? 0;
      if (row.type === "SPEND") spentByCompany.set(row.companyId, amount);
      if (row.type === "EARN") earnedByCompany.set(row.companyId, amount);
    }

    return companies.map((company) => {
      const link = company.userLinks[0] ?? null;
      const totalSpentPoints = spentByCompany.get(company.id) ?? 0;
      const totalEarnedPoints = earnedByCompany.get(company.id) ?? 0;
      return {
        id: company.id,
        slug: company.slug,
        name: company.name,
        description: company.description,
        isActive: company.isActive,
        operatesOnline: company.operatesOnline,
        category: company.category,
        categories: company.categories.map((row) => row.category),
        locations: (company.locations ?? []).map((location) => ({
          uuid: location.uuid,
          title: location.title,
          address: location.address,
          city: location.city,
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
          precision: location.precision,
          openTime: location.openTime,
          closeTime: location.closeTime,
          workingDays: location.workingDays,
          isMain: location.isMain,
        })),
        points: {
          balance: link?.balance ?? 0,
          totalEarnedPoints,
          totalSpentPoints,
          pointsToNextReward: link?.pointsToNextReward ?? null,
          expiringPoints: link?.expiringPoints ?? null,
          expiringDate: link?.expiringDate ?? null,
          updatedAt: link?.updatedAt ?? null,
        },
        level: this.resolveLevel(totalEarnedPoints, company.levelRules),
      };
    });
  }

  async wallet(userId: number) {
    const companies = await this.listCompanies(userId);
    return {
      totalBalance: companies.reduce((sum, company) => sum + company.points.balance, 0),
      companies: companies.filter(
        (company) =>
          company.points.balance > 0 ||
          company.points.totalEarnedPoints > 0 ||
          company.points.totalSpentPoints > 0,
      ),
    };
  }

  async listActiveSubscriptions(userId: number) {
    const now = new Date();
    const rows = await this.prisma.userSubscription.findMany({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
      orderBy: { activatedAt: "desc" },
      include: {
        subscription: {
          include: {
            company: { select: { id: true, slug: true, name: true, isActive: true } },
            category: { select: { id: true, slug: true, name: true, icon: true } },
          },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      activatedAt: row.activatedAt,
      expiresAt: row.expiresAt,
      willAutoRenew: row.willAutoRenew,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      subscription: this.serializeSubscriptionPlan(row.subscription),
    }));
  }

  async listArchivedSubscriptions(userId: number) {
    const now = new Date();
    const rows = await this.prisma.userSubscription.findMany({
      where: {
        userId,
        OR: [
          { status: { in: [SubscriptionStatus.EXPIRED, SubscriptionStatus.CANCELED] } },
          { status: SubscriptionStatus.ACTIVE, expiresAt: { lt: now } },
        ],
      },
      orderBy: [{ expiresAt: "desc" }, { activatedAt: "desc" }],
      include: {
        subscription: {
          include: {
            company: { select: { id: true, slug: true, name: true, isActive: true } },
            category: { select: { id: true, slug: true, name: true, icon: true } },
          },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      status: row.expiresAt && row.expiresAt < now && row.status === SubscriptionStatus.ACTIVE
        ? SubscriptionStatus.EXPIRED
        : row.status,
      activatedAt: row.activatedAt,
      expiresAt: row.expiresAt,
      willAutoRenew: row.willAutoRenew,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      subscription: this.serializeSubscriptionPlan(row.subscription),
    }));
  }

  async history(userId: number) {
    const [transactions, archivedSubscriptions] = await Promise.all([
      this.prisma.loyaltyTransaction.findMany({
        where: { userId },
        orderBy: { occurredAt: "desc" },
        take: 100,
        include: {
          company: {
            select: {
              id: true,
              slug: true,
              name: true,
              category: { select: { id: true, slug: true, name: true, icon: true } },
            },
          },
        },
      }),
      this.listArchivedSubscriptions(userId),
    ]);

    return {
      transactions: transactions.map((transaction) => ({
        uuid: transaction.uuid,
        type: transaction.type,
        status: transaction.status,
        amount: transaction.amount,
        description: transaction.description,
        occurredAt: transaction.occurredAt,
        company: transaction.company,
      })),
      archivedSubscriptions,
    };
  }

  async dashboard(userId: number) {
    const [wallet, activeSubscriptions, marketplace] = await Promise.all([
      this.wallet(userId),
      this.listActiveSubscriptions(userId),
      this.marketplace(userId),
    ]);

    return {
      wallet,
      activeSubscriptions,
      recommendedSubscriptions: marketplace.subscriptions.slice(0, 8),
      favoriteCategories: marketplace.categories.filter((category) => category.isFavorite),
    };
  }

  async activateSubscription(userId: number, subscriptionUuid: string) {
    const plan = await this.prisma.subscription.findUnique({
      where: { uuid: subscriptionUuid },
      include: {
        company: { select: { id: true, slug: true, name: true, isActive: true } },
        category: { select: { id: true, slug: true, name: true, icon: true } },
      },
    });
    if (!plan || !plan.isActive || (plan.company && !plan.company.isActive)) {
      throw new NotFoundException("Active subscription not found.");
    }

    const now = new Date();
    const existing = await this.prisma.userSubscription.findFirst({
      where: {
        userId,
        subscriptionId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException("Subscription is already active.");
    }

    const promoActive = !plan.promoEndsAt || plan.promoEndsAt >= now;
    const expiresAt = this.addSubscriptionPeriod(
      now,
      plan.renewalValue,
      plan.renewalUnit,
      promoActive ? plan.promoBonusDays : 0,
    );

    const created = await this.prisma.$transaction(async (tx) => {
      if (plan.companyId) {
        await tx.userCompany.upsert({
          where: { userId_companyId: { userId, companyId: plan.companyId } },
          update: {},
          create: { userId, companyId: plan.companyId },
        });
      }

      return tx.userSubscription.create({
        data: {
          userId,
          subscriptionId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          activatedAt: now,
          expiresAt,
          willAutoRenew: true,
        },
        include: {
          subscription: {
            include: {
              company: { select: { id: true, slug: true, name: true, isActive: true } },
              category: { select: { id: true, slug: true, name: true, icon: true } },
            },
          },
        },
      });
    });

    return {
      id: created.id,
      status: created.status,
      activatedAt: created.activatedAt,
      expiresAt: created.expiresAt,
      willAutoRenew: created.willAutoRenew,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      subscription: this.serializeSubscriptionPlan(created.subscription),
    };
  }
}
