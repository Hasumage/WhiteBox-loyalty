import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CompanyMemberRole,
  FinanceOperationStatus,
  FinanceOperationType,
  LoyaltyTransactionType,
  Prisma,
  SubscriptionEntitlementWindow,
  SubscriptionStatus,
  UserRole,
} from "@prisma/client";
import * as bcrypt from "bcrypt";
import { CreateCompanySubscriptionDto } from "../admin/dto/create-company-subscription.dto";
import { PrismaService } from "../prisma/prisma.service";
import {
  AwardCompanyPointsDto,
  CreateCompanyMemberDto,
  CreateSubscriptionEntitlementDto,
  RedeemSubscriptionEntitlementDto,
  RequestCompanyPayoutDto,
  UpdateCompanyMemberRoleDto,
  UpdateCompanyMemberStatusDto,
} from "./dto/company-workspace.dto";

const MANAGEMENT_ROLES = new Set<CompanyMemberRole>([
  CompanyMemberRole.OWNER,
  CompanyMemberRole.MANAGER,
]);

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  private subscriptionSlug(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  }

  private async uniqueSubscriptionSlug(value: string) {
    const base = this.subscriptionSlug(value) || `plan-${Date.now()}`;
    let candidate = base;
    let suffix = 2;
    while (await this.prisma.subscription.findUnique({ where: { slug: candidate }, select: { id: true } })) {
      candidate = `${base.slice(0, Math.max(1, 60 - String(suffix).length - 1))}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  private async membership(userId: number) {
    let member = await this.prisma.companyMember.findFirst({
      where: { userId, isActive: true },
      include: {
        user: { select: { uuid: true, name: true, email: true } },
        company: {
          include: {
            categories: { include: { category: true } },
            levelRules: { orderBy: { sortOrder: "asc" } },
            verificationApplications: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { uuid: true, status: true, createdAt: true, identityVerificationMode: true },
            },
          },
        },
      },
    });

    // Existing owners receive their independent company membership on first visit
    // even before a deployment has run the data backfill migration.
    if (!member) {
      const ownedCompany = await this.prisma.company.findFirst({
        where: { ownerUserId: userId },
        select: { id: true },
      });
      if (ownedCompany) {
        await this.prisma.companyMember.upsert({
          where: { companyId_userId: { companyId: ownedCompany.id, userId } },
          update: { role: CompanyMemberRole.OWNER, isActive: true },
          create: { companyId: ownedCompany.id, userId, role: CompanyMemberRole.OWNER },
        });
        member = await this.prisma.companyMember.findFirst({
          where: { userId, isActive: true },
          include: {
            user: { select: { uuid: true, name: true, email: true } },
            company: {
              include: {
                categories: { include: { category: true } },
                levelRules: { orderBy: { sortOrder: "asc" } },
                verificationApplications: {
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  select: { uuid: true, status: true, createdAt: true, identityVerificationMode: true },
                },
              },
            },
          },
        });
      }
    }

    if (!member) {
      throw new ForbiddenException("Active company membership is required.");
    }
    return member;
  }

  private requireManager(member: { role: CompanyMemberRole }) {
    if (!MANAGEMENT_ROLES.has(member.role)) {
      throw new ForbiddenException("Only a company manager can perform this action.");
    }
  }

  private requireTradingEnabled(member: { company: { isActive: boolean; identityVerificationCompleted: boolean } }) {
    if (!member.company.identityVerificationCompleted || !member.company.isActive) {
      throw new ForbiddenException("Company verification must be completed before operations are enabled.");
    }
  }

  private resolveLevel(
    totalSpend: number,
    rules: Array<{ levelName: string; minTotalSpend: Prisma.Decimal; cashbackPercent: Prisma.Decimal }>,
  ) {
    const rule = [...rules]
      .sort((a, b) => Number(b.minTotalSpend) - Number(a.minTotalSpend))
      .find((candidate) => totalSpend >= Number(candidate.minTotalSpend));
    return rule
      ? {
          name: rule.levelName,
          minimumSpend: Number(rule.minTotalSpend),
          cashbackPercent: Number(rule.cashbackPercent),
        }
      : { name: "Базовый", minimumSpend: 0, cashbackPercent: 0 };
  }

  private monthlySubscriptionValue(subscription: { price: Prisma.Decimal; renewalValue: number; renewalUnit: string }) {
    const price = Number(subscription.price);
    const value = Math.max(1, subscription.renewalValue || 1);
    switch (subscription.renewalUnit.toLowerCase()) {
      case "week":
        return (price * 52) / 12 / value;
      case "year":
        return price / 12 / value;
      default:
        return price / value;
    }
  }

  async profile(userId: number) {
    const member = await this.membership(userId);
    return {
      member: {
        uuid: member.uuid,
        role: member.role,
        name: member.user.name,
        email: member.user.email,
      },
      company: {
        uuid: member.company.slug,
        slug: member.company.slug,
        name: member.company.name,
        description: member.company.description,
        isActive: member.company.isActive,
        verificationStatus: member.company.verificationStatus,
        identityVerificationCompleted: member.company.identityVerificationCompleted,
        verificationApplication: member.company.verificationApplications?.[0] ?? null,
        operatesOnline: member.company.operatesOnline,
        categories: member.company.categories.map((item) => item.category),
        levels: member.company.levelRules.map((rule) => ({
          name: rule.levelName,
          minimumSpend: Number(rule.minTotalSpend),
          cashbackPercent: Number(rule.cashbackPercent),
        })),
      },
    };
  }

  async dashboard(userId: number) {
    const member = await this.membership(userId);
    const companyId = member.companyId;
    const [customerCount, activePlans, purchaseTotals, pendingPayouts, recentPurchases, activeEntitlements] =
      await Promise.all([
        this.prisma.userCompany.count({ where: { companyId, user: { role: UserRole.CLIENT } } }),
        this.prisma.userSubscription.findMany({
          where: { status: SubscriptionStatus.ACTIVE, subscription: { companyId } },
          select: { subscription: { select: { price: true, renewalValue: true, renewalUnit: true } } },
        }),
        this.prisma.companyPurchase.aggregate({
          where: { companyId },
          _sum: { amount: true, pointsAwarded: true },
        }),
        this.prisma.financeOperation.count({
          where: { companyId, status: FinanceOperationStatus.PENDING_APPROVAL },
        }),
        this.prisma.companyPurchase.findMany({
          where: { companyId },
          take: 6,
          orderBy: { createdAt: "desc" },
          include: { user: { select: { name: true } } },
        }),
        this.prisma.subscriptionEntitlement.count({
          where: { subscription: { companyId }, isActive: true },
        }),
      ]);

    return {
      memberRole: member.role,
      company: { name: member.company.name, verificationStatus: member.company.verificationStatus },
      metrics: {
        customers: customerCount,
        activeSubscribers: activePlans.length,
        subscriptionGross: activePlans.reduce((sum, plan) => sum + Number(plan.subscription.price), 0),
        monthlyRecurringRevenue: activePlans.reduce(
          (sum, plan) => sum + this.monthlySubscriptionValue(plan.subscription),
          0,
        ),
        purchaseRevenue: Number(purchaseTotals._sum.amount ?? 0),
        pointsAwarded: purchaseTotals._sum.pointsAwarded ?? 0,
        pendingPayouts,
        activeEntitlements,
      },
      recentPurchases: recentPurchases.map((purchase) => ({
        uuid: purchase.uuid,
        customer: purchase.user.name,
        amount: Number(purchase.amount),
        pointsAwarded: purchase.pointsAwarded,
        createdAt: purchase.createdAt,
      })),
    };
  }

  async clients(userId: number, query?: string) {
    const member = await this.membership(userId);
    const q = query?.trim();
    const companyId = member.companyId;
    const visibleToCompany = {
      OR: [
        { companyLinks: { some: { companyId } } },
        { companyPurchases: { some: { companyId } } },
        { subscriptions: { some: { subscription: { companyId } } } },
      ],
    };
    const customers = await this.prisma.user.findMany({
      where: {
        role: UserRole.CLIENT,
        AND: [
          visibleToCompany,
          ...(q
            ? [
                {
                  OR: [
                    { name: { contains: q, mode: "insensitive" as const } },
                    { email: { contains: q, mode: "insensitive" as const } },
                  ],
                },
              ]
            : []),
        ],
      },
      take: 20,
      orderBy: { name: "asc" },
      include: {
        companyLinks: { where: { companyId }, take: 1 },
        companyPurchases: { where: { companyId }, select: { amount: true } },
      },
    });

    return customers.map((customer) => {
      const totalSpend = customer.companyPurchases.reduce((sum, purchase) => sum + Number(purchase.amount), 0);
      return {
        uuid: customer.uuid,
        name: customer.name,
        email: customer.email,
        balance: customer.companyLinks[0]?.balance ?? 0,
        totalSpend,
        level: this.resolveLevel(totalSpend, member.company.levelRules),
      };
    });
  }

  async client(userId: number, uuid: string) {
    const member = await this.membership(userId);
    const customer = await this.prisma.user.findFirst({
      where: { uuid, role: UserRole.CLIENT },
      include: {
        companyLinks: { where: { companyId: member.companyId }, take: 1 },
        companyPurchases: { where: { companyId: member.companyId }, orderBy: { createdAt: "desc" }, take: 10 },
        subscriptions: {
          where: { status: SubscriptionStatus.ACTIVE, subscription: { companyId: member.companyId } },
          include: { subscription: { include: { entitlements: { where: { isActive: true } } } } },
        },
      },
    });
    if (!customer) throw new NotFoundException("Customer not found.");
    const totalSpend = customer.companyPurchases.reduce((sum, purchase) => sum + Number(purchase.amount), 0);
    const isKnownCustomer =
      customer.companyLinks.length > 0 || customer.companyPurchases.length > 0 || customer.subscriptions.length > 0;
    return {
      uuid: customer.uuid,
      name: customer.name,
      email: isKnownCustomer ? customer.email : null,
      balance: customer.companyLinks[0]?.balance ?? 0,
      totalSpend,
      level: this.resolveLevel(totalSpend, member.company.levelRules),
      recentPurchases: customer.companyPurchases.map((purchase) => ({
        uuid: purchase.uuid,
        amount: Number(purchase.amount),
        pointsAwarded: purchase.pointsAwarded,
        createdAt: purchase.createdAt,
      })),
      activeSubscriptions: customer.subscriptions,
    };
  }

  async awardPoints(userId: number, dto: AwardCompanyPointsDto) {
    const member = await this.membership(userId);
    this.requireTradingEnabled(member);
    const customer = await this.prisma.user.findFirst({
      where: { uuid: dto.userUuid, role: UserRole.CLIENT },
      select: { id: true, uuid: true, name: true },
    });
    if (!customer) throw new NotFoundException("Customer not found.");

    let points = dto.points ?? 0;
    let level: ReturnType<CompanyService["resolveLevel"]> | null = null;
    let purchaseAmount: number | null = null;
    if (dto.mode === "MANUAL") {
      if (!dto.points) throw new BadRequestException("Points are required for manual award.");
    } else {
      if (!dto.purchaseAmount) throw new BadRequestException("Purchase amount is required for cashback award.");
      purchaseAmount = dto.purchaseAmount;
    }

    try {
      await this.prisma.$transaction(
        async (tx) => {
          if (dto.mode === "PURCHASE" && purchaseAmount !== null) {
            const totals = await tx.companyPurchase.aggregate({
              where: { companyId: member.companyId, userId: customer.id },
              _sum: { amount: true },
            });
            const totalSpend = Number(totals._sum.amount ?? 0) + purchaseAmount;
            level = this.resolveLevel(totalSpend, member.company.levelRules);
            points = Math.round((purchaseAmount * level.cashbackPercent) / 100);
            await tx.companyPurchase.create({
              data: {
                companyId: member.companyId,
                userId: customer.id,
                processedById: userId,
                amount: new Prisma.Decimal(purchaseAmount),
                cashbackPercent: new Prisma.Decimal(level.cashbackPercent),
                pointsAwarded: points,
                description: dto.description?.trim() || null,
              },
            });
          }
          if (points > 0) {
            await tx.userCompany.upsert({
              where: { userId_companyId: { userId: customer.id, companyId: member.companyId } },
              update: { balance: { increment: points } },
              create: { userId: customer.id, companyId: member.companyId, balance: points },
            });
            await tx.loyaltyTransaction.create({
              data: {
                userId: customer.id,
                companyId: member.companyId,
                type: LoyaltyTransactionType.EARN,
                amount: points,
                description:
                  dto.description?.trim() ||
                  (dto.mode === "PURCHASE" ? `Cashback for purchase at ${member.company.name}` : "Manual points award"),
              },
            });
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if ((error as { code?: string }).code === "P2034") {
        throw new ConflictException("Another purchase was recorded at the same time. Please retry.");
      }
      throw error;
    }

    return { customer, mode: dto.mode, pointsAwarded: points, purchaseAmount, level };
  }

  async team(userId: number) {
    const member = await this.membership(userId);
    this.requireManager(member);
    return this.prisma.companyMember.findMany({
      where: { companyId: member.companyId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      include: { user: { select: { uuid: true, name: true, email: true, accountStatus: true } } },
    });
  }

  async createTeamMember(userId: number, dto: CreateCompanyMemberDto) {
    const member = await this.membership(userId);
    this.requireManager(member);
    if (dto.role === CompanyMemberRole.OWNER) throw new BadRequestException("A second owner cannot be assigned.");
    if (member.role === CompanyMemberRole.MANAGER && dto.role !== CompanyMemberRole.CASHIER) {
      throw new ForbiddenException("Managers can add cashiers only.");
    }
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("An account with this email already exists.");
    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: dto.name.trim(), email: dto.email.trim(), passwordHash, role: UserRole.COMPANY },
      });
      return tx.companyMember.create({
        data: { companyId: member.companyId, userId: user.id, role: dto.role },
        include: { user: { select: { uuid: true, name: true, email: true, accountStatus: true } } },
      });
    });
  }

  async updateTeamMemberRole(userId: number, memberUuid: string, dto: UpdateCompanyMemberRoleDto) {
    const actor = await this.membership(userId);
    this.requireManager(actor);
    const target = await this.prisma.companyMember.findUnique({ where: { uuid: memberUuid } });
    if (!target || target.companyId !== actor.companyId) throw new NotFoundException("Company member not found.");
    if (target.role === CompanyMemberRole.OWNER || dto.role === CompanyMemberRole.OWNER) {
      throw new ForbiddenException("Owner role cannot be reassigned here.");
    }
    if (actor.role === CompanyMemberRole.MANAGER && (target.role !== CompanyMemberRole.CASHIER || dto.role !== CompanyMemberRole.CASHIER)) {
      throw new ForbiddenException("Managers cannot manage other managers.");
    }
    return this.prisma.companyMember.update({
      where: { uuid: memberUuid },
      data: { role: dto.role },
      include: { user: { select: { uuid: true, name: true, email: true, accountStatus: true } } },
    });
  }

  async updateTeamMemberStatus(userId: number, memberUuid: string, dto: UpdateCompanyMemberStatusDto) {
    const actor = await this.membership(userId);
    this.requireManager(actor);
    const target = await this.prisma.companyMember.findUnique({ where: { uuid: memberUuid } });
    if (!target || target.companyId !== actor.companyId) throw new NotFoundException("Company member not found.");
    if (target.role === CompanyMemberRole.OWNER) {
      throw new ForbiddenException("The company owner cannot be disabled.");
    }
    if (actor.role === CompanyMemberRole.MANAGER && target.role !== CompanyMemberRole.CASHIER) {
      throw new ForbiddenException("Managers can disable cashiers only.");
    }
    return this.prisma.companyMember.update({
      where: { uuid: memberUuid },
      data: { isActive: dto.isActive },
      include: { user: { select: { uuid: true, name: true, email: true, accountStatus: true } } },
    });
  }

  async finance(userId: number) {
    const member = await this.membership(userId);
    this.requireManager(member);
    const [operations, activePlans] = await Promise.all([
      this.prisma.financeOperation.findMany({
        where: { companyId: member.companyId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      this.prisma.userSubscription.findMany({
        where: { status: SubscriptionStatus.ACTIVE, subscription: { companyId: member.companyId } },
        select: { subscription: { select: { price: true, renewalValue: true, renewalUnit: true } } },
      }),
    ]);
    return {
      subscriptionGross: activePlans.reduce((sum, plan) => sum + Number(plan.subscription.price), 0),
      monthlyRecurringRevenue: activePlans.reduce(
        (sum, plan) => sum + this.monthlySubscriptionValue(plan.subscription),
        0,
      ),
      activeSubscribers: activePlans.length,
      operations: operations.map((operation) => ({ ...operation, amount: Number(operation.amount) })),
    };
  }

  async requestPayout(userId: number, dto: RequestCompanyPayoutDto) {
    const member = await this.membership(userId);
    this.requireManager(member);
    this.requireTradingEnabled(member);
    return this.prisma.financeOperation.create({
      data: {
        type: FinanceOperationType.PAYOUT_REQUEST,
        status: FinanceOperationStatus.PENDING_APPROVAL,
        amount: new Prisma.Decimal(dto.amount),
        companyId: member.companyId,
        requestedById: userId,
        requestedAt: new Date(),
        title: `Запрос выплаты: ${member.company.name}`,
        details: dto.details?.trim() || null,
      },
    });
  }

  async subscriptions(userId: number) {
    const member = await this.membership(userId);
    return this.prisma.subscription.findMany({
      where: { companyId: member.companyId },
      orderBy: { createdAt: "desc" },
      include: { entitlements: { orderBy: { createdAt: "asc" } } },
    });
  }

  async createSubscription(userId: number, dto: CreateCompanySubscriptionDto) {
    const member = await this.membership(userId);
    this.requireManager(member);
    this.requireTradingEnabled(member);
    const slug = await this.uniqueSubscriptionSlug(dto.slug || dto.name);
    const renewalValue = dto.renewalValue ?? 1;
    const renewalUnit = dto.renewalUnit ?? "month";
    const promoBonusDays = Math.max(0, dto.promoBonusDays ?? 0);
    const renewalPeriod =
      dto.renewalPeriod?.trim() ||
      `${renewalValue} ${renewalUnit}${promoBonusDays > 0 ? ` + ${promoBonusDays} days` : ""}`;

    return this.prisma.subscription.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description.trim(),
        price: new Prisma.Decimal(dto.price),
        renewalPeriod,
        renewalValue,
        renewalUnit,
        promoBonusDays,
        promoEndsAt: dto.promoEndsAt ? new Date(dto.promoEndsAt) : null,
        companyId: member.companyId,
        categoryId: dto.categoryId ?? member.company.categoryId,
      },
      include: { entitlements: true },
    });
  }

  async createEntitlement(userId: number, subscriptionUuid: string, dto: CreateSubscriptionEntitlementDto) {
    const member = await this.membership(userId);
    this.requireManager(member);
    this.requireTradingEnabled(member);
    const subscription = await this.prisma.subscription.findUnique({ where: { uuid: subscriptionUuid } });
    if (!subscription || subscription.companyId !== member.companyId) {
      throw new NotFoundException("Subscription not found for this company.");
    }
    const unlimited = dto.windowUnit === SubscriptionEntitlementWindow.UNLIMITED;
    return this.prisma.subscriptionEntitlement.create({
      data: {
        subscriptionId: subscription.id,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        allowance: unlimited ? 1 : dto.allowance,
        windowValue: unlimited ? 1 : dto.windowValue,
        windowUnit: dto.windowUnit,
      },
    });
  }

  private redemptionWindowStart(
    unit: SubscriptionEntitlementWindow,
    value: number,
    subscriptionStartedAt: Date,
    now = new Date(),
  ) {
    if (unit === SubscriptionEntitlementWindow.UNLIMITED) return subscriptionStartedAt;
    if (unit === SubscriptionEntitlementWindow.TERM) return subscriptionStartedAt;
    if (unit === SubscriptionEntitlementWindow.MONTH) {
      const bucket = Math.floor((now.getUTCFullYear() * 12 + now.getUTCMonth()) / value) * value;
      return new Date(Date.UTC(Math.floor(bucket / 12), bucket % 12, 1));
    }
    const unitMs = unit === SubscriptionEntitlementWindow.WEEK ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const bucketMs = unitMs * value;
    return new Date(Math.floor(now.getTime() / bucketMs) * bucketMs);
  }

  async redeemEntitlement(userId: number, dto: RedeemSubscriptionEntitlementDto) {
    const member = await this.membership(userId);
    this.requireTradingEnabled(member);
    const entitlement = await this.prisma.subscriptionEntitlement.findUnique({
      where: { uuid: dto.entitlementUuid },
      include: { subscription: true },
    });
    if (!entitlement || !entitlement.isActive || entitlement.subscription.companyId !== member.companyId) {
      throw new NotFoundException("Subscription benefit not found.");
    }
    const customer = await this.prisma.user.findFirst({ where: { uuid: dto.userUuid, role: UserRole.CLIENT } });
    if (!customer) throw new NotFoundException("Customer not found.");
    const plan = await this.prisma.userSubscription.findFirst({
      where: {
        userId: customer.id,
        subscriptionId: entitlement.subscriptionId,
        status: SubscriptionStatus.ACTIVE,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    if (!plan) throw new BadRequestException("Customer does not have an active subscription for this benefit.");

    const quantity = dto.quantity ?? 1;
    const unlimited = entitlement.windowUnit === SubscriptionEntitlementWindow.UNLIMITED;
    const from = unlimited
      ? null
      : this.redemptionWindowStart(entitlement.windowUnit, entitlement.windowValue, plan.activatedAt);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          let alreadyUsed: number | null = null;
          if (!unlimited && from) {
            const total = await tx.subscriptionRedemption.aggregate({
              where: { userSubscriptionId: plan.id, entitlementId: entitlement.id, redeemedAt: { gte: from } },
              _sum: { quantity: true },
            });
            alreadyUsed = total._sum.quantity ?? 0;
            if (alreadyUsed + quantity > entitlement.allowance) {
              throw new ConflictException("Benefit limit has already been reached for this period.");
            }
          }
          const redemption = await tx.subscriptionRedemption.create({
            data: {
              userSubscriptionId: plan.id,
              entitlementId: entitlement.id,
              companyId: member.companyId,
              processedById: userId,
              quantity,
              note: dto.note?.trim() || null,
            },
          });
          return {
            redemption,
            benefit: entitlement.title,
            unlimited,
            used: unlimited ? null : (alreadyUsed ?? 0) + quantity,
            allowance: unlimited ? null : entitlement.allowance,
            windowUnit: entitlement.windowUnit,
            windowValue: entitlement.windowValue,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if ((error as { code?: string }).code === "P2034") {
        throw new ConflictException("This benefit is being redeemed at another checkout. Refresh and retry.");
      }
      throw error;
    }
  }
}
