import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CompanyMemberRole,
  FinanceOperationStatus,
  FinanceOperationType,
  LoyaltyTransactionType,
  Prisma,
  SubscriptionBundleParticipantStatus,
  SubscriptionBundleStatus,
  SubscriptionEntitlementWindow,
  SubscriptionSpendPolicy,
  SubscriptionStatus,
  UserRole,
} from "@prisma/client";
import * as bcrypt from "bcrypt";
import { createHash } from "node:crypto";
import { UpsertCompanyLocationDto } from "../admin/dto/upsert-company-location.dto";
import { CreateCompanySubscriptionDto } from "../admin/dto/create-company-subscription.dto";
import { PrismaService } from "../prisma/prisma.service";
import {
  AwardCompanyPointsDto,
  CreateCompanyClubBundleDto,
  CreateCompanyMemberDto,
  CreateSubscriptionEntitlementDto,
  LookupCompanyClientCodeDto,
  RedeemSubscriptionBundleBenefitDto,
  RedeemSubscriptionEntitlementDto,
  RequestCompanyPayoutDto,
  SpendCompanyPointsDto,
  UpdateCompanyOwnedSubscriptionDto,
  UpdateCompanyLoyaltySettingsDto,
  UpdateCompanyMemberRoleDto,
  UpdateCompanyMemberStatusDto,
  UpdateCompanyProfileDto,
  UpdateSubscriptionEntitlementDto,
} from "./dto/company-workspace.dto";

const MANAGEMENT_ROLES = new Set<CompanyMemberRole>([
  CompanyMemberRole.OWNER,
  CompanyMemberRole.MANAGER,
]);
const DAY_MS = 24 * 60 * 60 * 1000;
const MINIMUM_PAYOUT_RUB = 5_000;

@Injectable()
export class CompanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config?: ConfigService,
  ) {}

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

  private async uniqueBundleSlug(value: string) {
    const base = this.subscriptionSlug(value) || `club-${Date.now()}`;
    let candidate = base;
    let suffix = 2;
    while (await this.prisma.subscriptionBundle.findUnique({ where: { slug: candidate }, select: { id: true } })) {
      candidate = `${base.slice(0, Math.max(1, 60 - String(suffix).length - 1))}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  private renewalLabel(value: number, unit: "week" | "month" | "year", bonusDays = 0) {
    return `${value} ${unit}${bonusDays > 0 ? ` + ${bonusDays} days` : ""}`;
  }

  private async assertSubscriptionEditAcknowledged(subscriptionId: number, acknowledged?: boolean) {
    if (acknowledged) return;
    const activeSubscribers = await this.prisma.userSubscription.count({
      where: {
        subscriptionId,
        status: SubscriptionStatus.ACTIVE,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    if (activeSubscribers > 0) {
      throw new BadRequestException(
        "This subscription already has active customers. Confirm that customers may cancel and receive a refund for the remaining value before changing terms.",
      );
    }
  }

  private customerLookupHash(code: string) {
    return createHash("sha256").update(code).digest("hex");
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

  private subscriptionRevenue(
    rows: Array<{
      activatedAt: Date;
      expiresAt: Date | null;
      subscription: { price: Prisma.Decimal };
    }>,
    now = new Date(),
  ) {
    const values = rows.reduce(
      (total, row) => {
        const value = Number(row.subscription.price);
        const startedAt = row.activatedAt.getTime();
        const expiresAt = row.expiresAt?.getTime() ?? startedAt + DAY_MS;
        const durationDays = Math.max(1, Math.ceil((expiresAt - startedAt) / DAY_MS));
        const elapsedDays = Math.min(durationDays, Math.max(0, Math.floor((now.getTime() - startedAt) / DAY_MS)));
        const daily = value / durationDays;
        total.committed += value;
        total.daily += daily;
        total.recognized += daily * elapsedDays;
        total.potential += value - daily * elapsedDays;
        return total;
      },
      { committed: 0, daily: 0, recognized: 0, potential: 0 },
    );
    return Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, Math.round(value * 100) / 100]),
    ) as typeof values;
  }

  private async financialSnapshot(
    db: Pick<PrismaService, "userSubscription" | "financeOperation"> | Pick<Prisma.TransactionClient, "userSubscription" | "financeOperation">,
    companyId: number,
    now = new Date(),
  ) {
    const [subscriptionPurchases, reservedResult, paidResult] = await Promise.all([
      db.userSubscription.findMany({
        where: {
          status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.EXPIRED] },
          subscription: { companyId },
        },
        select: { status: true, activatedAt: true, expiresAt: true, subscription: { select: { price: true } } },
      }),
      db.financeOperation.aggregate({
        where: {
          companyId,
          type: FinanceOperationType.PAYOUT_REQUEST,
          status: { in: [FinanceOperationStatus.PENDING_APPROVAL, FinanceOperationStatus.APPROVED] },
        },
        _sum: { amount: true },
      }),
      db.financeOperation.aggregate({
        where: {
          companyId,
          type: FinanceOperationType.PAYOUT_REQUEST,
          status: FinanceOperationStatus.PAID,
        },
        _sum: { amount: true },
      }),
    ]);
    // Earnings remain withdrawable after a paid subscription period ends.
    const revenue = this.subscriptionRevenue(subscriptionPurchases, now);
    const reservedPayouts = Number(reservedResult._sum.amount ?? 0);
    const paidPayouts = Number(paidResult._sum.amount ?? 0);
    const availableForPayout = Math.max(
      0,
      Math.round((revenue.recognized - reservedPayouts - paidPayouts) * 100) / 100,
    );
    return {
      ...revenue,
      reservedPayouts,
      paidPayouts,
      availableForPayout,
      activeSubscribers: subscriptionPurchases.filter(
        (row) => row.status === SubscriptionStatus.ACTIVE && (!row.expiresAt || row.expiresAt > now),
      ).length,
    };
  }

  private normalizeLevelRules(
    rules: Array<{ levelName: string; minTotalSpend: number; cashbackPercent: number }>,
  ) {
    if (!rules.length) throw new BadRequestException("At least one loyalty level is required.");
    const sorted = rules
      .map((rule, index) => ({
        levelName: rule.levelName.trim() || `Level ${index + 1}`,
        minTotalSpend: Number(rule.minTotalSpend),
        cashbackPercent: Number(rule.cashbackPercent),
      }))
      .sort((a, b) => a.minTotalSpend - b.minTotalSpend);
    for (let index = 0; index < sorted.length; index += 1) {
      const current = sorted[index];
      if (!Number.isFinite(current.minTotalSpend) || current.minTotalSpend < 0) {
        throw new BadRequestException("Level minimum spend must be zero or greater.");
      }
      if (!Number.isFinite(current.cashbackPercent) || current.cashbackPercent < 0 || current.cashbackPercent > 100) {
        throw new BadRequestException("Cashback percent must be between 0 and 100.");
      }
      if (index > 0 && current.minTotalSpend === sorted[index - 1].minTotalSpend) {
        throw new BadRequestException("Level spend thresholds must be unique.");
      }
      if (index > 0 && current.cashbackPercent < sorted[index - 1].cashbackPercent) {
        throw new BadRequestException("Higher levels cannot have a lower cashback percent.");
      }
    }
    return sorted;
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
        subscriptionSpendPolicy: member.company.subscriptionSpendPolicy,
        categories: member.company.categories.map((item) => item.category),
        levels: member.company.levelRules.map((rule) => ({
          name: rule.levelName,
          minimumSpend: Number(rule.minTotalSpend),
          cashbackPercent: Number(rule.cashbackPercent),
        })),
      },
    };
  }

  async categories(userId: number) {
    await this.membership(userId);
    return this.prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, slug: true, name: true, icon: true },
    });
  }

  async locations(userId: number) {
    const member = await this.membership(userId);
    return this.prisma.companyLocation.findMany({
      where: { companyId: member.companyId },
      orderBy: [{ isMain: "desc" }, { createdAt: "asc" }],
    });
  }

  private async geocodeCompanyAddress(address: string) {
    const apiKey =
      this.config?.get<string>("YANDEX_GEOCODER_API_KEY") ??
      this.config?.get<string>("NEXT_PUBLIC_YANDEX_MAPS_API_KEY");
    if (!apiKey) {
      throw new BadRequestException("YANDEX_GEOCODER_API_KEY is not configured.");
    }

    const params = new URLSearchParams({
      apikey: apiKey,
      geocode: address,
      format: "json",
      lang: "ru_RU",
      results: "1",
    });
    const referer = this.config?.get<string>("FRONTEND_ORIGIN") ?? "http://localhost:3000";
    const response = await fetch(`https://geocode-maps.yandex.ru/v1/?${params.toString()}`, {
      headers: { Referer: referer },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new BadRequestException(`Yandex geocoder failed (${response.status}): ${body.slice(0, 240)}`);
    }

    const payload = (await response.json()) as {
      response?: {
        GeoObjectCollection?: {
          featureMember?: Array<{
            GeoObject?: {
              Point?: { pos?: string };
              metaDataProperty?: {
                GeocoderMetaData?: {
                  precision?: string;
                  text?: string;
                  Address?: { formatted?: string };
                };
              };
            };
          }>;
        };
      };
    };
    const geoObject = payload.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
    const pos = geoObject?.Point?.pos;
    if (!pos) {
      throw new BadRequestException("Yandex geocoder did not find coordinates for this address.");
    }

    const [longitudeRaw, latitudeRaw] = pos.split(" ");
    const longitude = Number(longitudeRaw);
    const latitude = Number(latitudeRaw);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new BadRequestException("Yandex geocoder returned invalid coordinates.");
    }

    const meta = geoObject.metaDataProperty?.GeocoderMetaData;
    return {
      latitude,
      longitude,
      precision: meta?.precision ?? null,
      formattedAddress: meta?.Address?.formatted ?? meta?.text ?? address,
      raw: geoObject as Prisma.InputJsonValue,
    };
  }

  private mapPickedCompanyAddress(dto: UpsertCompanyLocationDto) {
    if (dto.latitude == null || dto.longitude == null) return null;
    const latitude = Number(dto.latitude);
    const longitude = Number(dto.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new BadRequestException("Map coordinates are invalid.");
    }
    return {
      latitude,
      longitude,
      precision: "manual",
      formattedAddress: dto.address.trim(),
      raw: {
        source: "company-map-picker",
        latitude,
        longitude,
        address: dto.address.trim(),
        city: dto.city?.trim() || null,
      } as Prisma.InputJsonValue,
    };
  }

  private normalizeLocationAddress(address: string) {
    return address
      .trim()
      .toLowerCase()
      .replace(/[.,]/g, "")
      .replace(/\s+/g, " ");
  }

  private normalizeWorkingDays(days?: number[]) {
    const uniqueDays = [...new Set((days?.length ? days : [0, 1, 2, 3, 4, 5, 6]).map(Number))]
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      .sort((a, b) => a - b);
    if (uniqueDays.length === 0) {
      throw new BadRequestException("Working days must include at least one day.");
    }
    return uniqueDays;
  }

  private assertValidLocationTime(value: string, label: string) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      throw new BadRequestException(`${label} must be in HH:mm format.`);
    }
  }

  private async ensureSingleMainLocation(companyId: number, locationId: number) {
    await this.prisma.companyLocation.updateMany({
      where: { companyId, id: { not: locationId } },
      data: { isMain: false },
    });
  }

  private async assertUniqueCompanyLocationAddress(companyId: number, address: string, excludeLocationId?: number) {
    const normalizedAddress = this.normalizeLocationAddress(address);
    const locations = await this.prisma.companyLocation.findMany({
      where: { companyId, ...(excludeLocationId ? { id: { not: excludeLocationId } } : {}) },
      select: { address: true },
    });
    const exists = locations.some((location) => this.normalizeLocationAddress(location.address) === normalizedAddress);
    if (exists) {
      throw new ConflictException("This company already has this address.");
    }
  }

  async createLocation(userId: number, dto: UpsertCompanyLocationDto) {
    const member = await this.membership(userId);
    this.requireManager(member);
    const address = dto.address.trim();
    const geocoded = this.mapPickedCompanyAddress(dto) ?? (await this.geocodeCompanyAddress(address));
    await this.assertUniqueCompanyLocationAddress(member.companyId, geocoded.formattedAddress);
    const openTime = dto.openTime ?? "09:00";
    const closeTime = dto.closeTime ?? "21:00";
    this.assertValidLocationTime(openTime, "Open time");
    this.assertValidLocationTime(closeTime, "Close time");
    const shouldBeMain =
      dto.isMain ??
      ((await this.prisma.companyLocation.count({ where: { companyId: member.companyId } })) === 0);
    const location = await this.prisma.companyLocation.create({
      data: {
        companyId: member.companyId,
        title: dto.title?.trim() || null,
        address: geocoded.formattedAddress,
        city: dto.city?.trim() || null,
        latitude: new Prisma.Decimal(geocoded.latitude),
        longitude: new Prisma.Decimal(geocoded.longitude),
        precision: geocoded.precision,
        geocoderResponse: geocoded.raw,
        openTime,
        closeTime,
        workingDays: this.normalizeWorkingDays(dto.workingDays),
        isMain: shouldBeMain,
        isActive: dto.isActive ?? true,
      },
    });
    if (location.isMain) await this.ensureSingleMainLocation(member.companyId, location.id);
    return location;
  }

  async updateLocation(userId: number, locationUuid: string, dto: UpsertCompanyLocationDto) {
    const member = await this.membership(userId);
    this.requireManager(member);
    const existing = await this.prisma.companyLocation.findUnique({ where: { uuid: locationUuid } });
    if (!existing || existing.companyId !== member.companyId) {
      throw new NotFoundException("Company location not found.");
    }

    const nextAddress = dto.address.trim();
    const geocoded = this.mapPickedCompanyAddress(dto) ?? (nextAddress !== existing.address ? await this.geocodeCompanyAddress(nextAddress) : null);
    const nextFormattedAddress = geocoded?.formattedAddress ?? nextAddress;
    await this.assertUniqueCompanyLocationAddress(member.companyId, nextFormattedAddress, existing.id);
    const openTime = dto.openTime ?? existing.openTime;
    const closeTime = dto.closeTime ?? existing.closeTime;
    this.assertValidLocationTime(openTime, "Open time");
    this.assertValidLocationTime(closeTime, "Close time");
    const location = await this.prisma.companyLocation.update({
      where: { uuid: locationUuid },
      data: {
        title: dto.title?.trim() || null,
        address: nextFormattedAddress,
        city: dto.city?.trim() || null,
        ...(geocoded
          ? {
              latitude: new Prisma.Decimal(geocoded.latitude),
              longitude: new Prisma.Decimal(geocoded.longitude),
              precision: geocoded.precision,
              geocoderResponse: geocoded.raw,
            }
          : {}),
        openTime,
        closeTime,
        workingDays: this.normalizeWorkingDays(dto.workingDays ?? existing.workingDays),
        isMain: dto.isMain ?? existing.isMain,
        isActive: dto.isActive ?? existing.isActive,
      },
    });
    if (location.isMain) await this.ensureSingleMainLocation(member.companyId, location.id);
    return location;
  }

  async deleteLocation(userId: number, locationUuid: string) {
    const member = await this.membership(userId);
    this.requireManager(member);
    const existing = await this.prisma.companyLocation.findUnique({ where: { uuid: locationUuid } });
    if (!existing || existing.companyId !== member.companyId) {
      throw new NotFoundException("Company location not found.");
    }
    await this.prisma.companyLocation.delete({ where: { uuid: locationUuid } });
    if (existing.isMain) {
      const nextMain = await this.prisma.companyLocation.findFirst({
        where: { companyId: member.companyId, isActive: true },
        orderBy: { createdAt: "asc" },
      });
      if (nextMain) {
        await this.prisma.companyLocation.update({ where: { id: nextMain.id }, data: { isMain: true } });
      }
    }
    return { success: true as const };
  }

  async updateProfile(userId: number, dto: UpdateCompanyProfileDto) {
    const member = await this.membership(userId);
    this.requireManager(member);
    const categoryIds = [...new Set(dto.categoryIds)];
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true },
    });
    if (categories.length !== categoryIds.length) {
      throw new BadRequestException("One or more selected categories do not exist.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: member.companyId },
        data: {
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          operatesOnline: dto.operatesOnline,
          categoryId: categoryIds[0],
        },
      });
      await tx.companyCategory.deleteMany({ where: { companyId: member.companyId } });
      await tx.companyCategory.createMany({
        data: categoryIds.map((categoryId) => ({ companyId: member.companyId, categoryId })),
      });
    });
    return this.profile(userId);
  }

  async dashboard(userId: number) {
    const member = await this.membership(userId);
    const companyId = member.companyId;
    const now = new Date();
    const [customerCount, activePlans, purchaseTotals, pointsTotals, pendingPayouts, recentPoints, recentSubscriptions, activeEntitlements] =
      await Promise.all([
        this.prisma.userCompany.count({ where: { companyId, user: { role: UserRole.CLIENT } } }),
        this.prisma.userSubscription.findMany({
          where: {
            status: SubscriptionStatus.ACTIVE,
            subscription: { companyId },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          select: { activatedAt: true, expiresAt: true, subscription: { select: { price: true } } },
        }),
        this.prisma.companyPurchase.aggregate({
          where: { companyId },
          _sum: { amount: true, pointsAwarded: true },
        }),
        this.prisma.loyaltyTransaction.aggregate({
          where: { companyId, type: LoyaltyTransactionType.EARN },
          _sum: { amount: true },
        }),
        this.prisma.financeOperation.count({
          where: { companyId, status: FinanceOperationStatus.PENDING_APPROVAL },
        }),
        this.prisma.loyaltyTransaction.findMany({
          where: { companyId },
          take: 10,
          orderBy: { occurredAt: "desc" },
          include: { user: { select: { name: true } } },
        }),
        this.prisma.userSubscription.findMany({
          where: { subscription: { companyId } },
          take: 10,
          orderBy: { activatedAt: "desc" },
          include: {
            user: { select: { name: true } },
            subscription: { select: { name: true, price: true } },
          },
        }),
        this.prisma.subscriptionEntitlement.count({
          where: { subscription: { companyId }, isActive: true },
        }),
      ]);
    const revenue = this.subscriptionRevenue(activePlans, now);
    const recentOperations = [
      ...recentPoints.map((operation) => ({
        uuid: operation.uuid,
        kind: "POINTS" as const,
        direction: operation.type,
        customer: operation.user.name,
        title: operation.description || (operation.type === LoyaltyTransactionType.EARN ? "Начисление баллов" : "Списание баллов"),
        points: operation.amount,
        amount: null,
        createdAt: operation.occurredAt,
      })),
      ...recentSubscriptions.map((operation) => ({
        uuid: `subscription-${operation.id}`,
        kind: "SUBSCRIPTION" as const,
        direction: "PURCHASE" as const,
        customer: operation.user.name,
        title: operation.subscription.name,
        points: null,
        amount: Number(operation.subscription.price),
        createdAt: operation.activatedAt,
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);

    return {
      memberRole: member.role,
      company: { name: member.company.name, verificationStatus: member.company.verificationStatus },
      metrics: {
        customers: customerCount,
        activeSubscribers: activePlans.length,
        subscriptionGross: revenue.committed,
        recognizedSubscriptionRevenue: revenue.recognized,
        potentialSubscriptionRevenue: revenue.potential,
        dailySubscriptionRevenue: revenue.daily,
        purchaseRevenue: Number(purchaseTotals._sum.amount ?? 0),
        pointsAwarded: pointsTotals._sum.amount ?? 0,
        pendingPayouts,
        activeEntitlements,
      },
      recentOperations,
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
        {
          subscriptionBundles: {
            some: { bundle: { participants: { some: { companyId } } } },
          },
        },
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
                    { uuid: { contains: q, mode: "insensitive" as const } },
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
        loyaltyTransactions: { where: { companyId: member.companyId }, orderBy: { occurredAt: "desc" }, take: 10 },
        subscriptions: {
          where: { status: SubscriptionStatus.ACTIVE, subscription: { companyId: member.companyId } },
          include: { subscription: { include: { entitlements: { where: { isActive: true } } } } },
        },
        subscriptionBundles: {
          where: {
            status: SubscriptionStatus.ACTIVE,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            bundle: { participants: { some: { companyId: member.companyId } } },
          },
          include: {
            bundle: {
              include: {
                category: { select: { id: true, slug: true, name: true, icon: true } },
                participants: {
                  where: { companyId: member.companyId, approvalStatus: SubscriptionBundleParticipantStatus.APPROVED },
                  include: { company: { select: { id: true, slug: true, name: true } } },
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
          },
        },
      },
    });
    if (!customer) throw new NotFoundException("Customer not found.");
    const totalSpend = customer.companyPurchases.reduce((sum, purchase) => sum + Number(purchase.amount), 0);
    const isKnownCustomer =
      customer.companyLinks.length > 0 ||
      customer.companyPurchases.length > 0 ||
      customer.subscriptions.length > 0 ||
      customer.subscriptionBundles.length > 0;
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
      recentPointOperations: customer.loyaltyTransactions.map((operation) => ({
        uuid: operation.uuid,
        type: operation.type,
        amount: operation.amount,
        description: operation.description,
        occurredAt: operation.occurredAt,
      })),
      activeSubscriptions: customer.subscriptions,
      activeBundleSubscriptions: customer.subscriptionBundles,
    };
  }

  async lookupClientByCode(userId: number, dto: LookupCompanyClientCodeDto) {
    const member = await this.membership(userId);
    this.requireTradingEnabled(member);
    const now = new Date();
    const lookup = await this.prisma.customerLookupCode.findFirst({
      where: {
        codeHash: this.customerLookupHash(dto.code),
        usedAt: null,
        expiresAt: { gt: now },
      },
      include: { user: { select: { uuid: true } } },
    });
    if (!lookup) {
      throw new NotFoundException("Код не найден или истёк. Попросите клиента создать новый.");
    }
    const consumed = await this.prisma.customerLookupCode.updateMany({
      where: { id: lookup.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (consumed.count !== 1) {
      throw new ConflictException("Этот код уже был использован. Попросите клиента создать новый.");
    }
    return this.client(userId, lookup.user.uuid);
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
          await tx.userCompany.upsert({
            where: { userId_companyId: { userId: customer.id, companyId: member.companyId } },
            update: points > 0 ? { balance: { increment: points } } : {},
            create: { userId: customer.id, companyId: member.companyId, balance: Math.max(0, points) },
          });
          if (points > 0) {
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

  async spendPoints(userId: number, dto: SpendCompanyPointsDto) {
    const member = await this.membership(userId);
    this.requireTradingEnabled(member);
    const customer = await this.prisma.user.findFirst({
      where: { uuid: dto.userUuid, role: UserRole.CLIENT },
      select: { id: true, uuid: true, name: true },
    });
    if (!customer) throw new NotFoundException("Customer not found.");

    return this.prisma.$transaction(
      async (tx) => {
        const debited = await tx.userCompany.updateMany({
          where: { userId: customer.id, companyId: member.companyId, balance: { gte: dto.points } },
          data: { balance: { decrement: dto.points } },
        });
        if (debited.count !== 1) {
          throw new BadRequestException("Недостаточно баллов для списания или клиент ещё не участвует в программе.");
        }
        await tx.loyaltyTransaction.create({
          data: {
            userId: customer.id,
            companyId: member.companyId,
            type: LoyaltyTransactionType.SPEND,
            amount: dto.points,
            description: dto.description?.trim() || `Списание баллов в ${member.company.name}`,
          },
        });
        const link = await tx.userCompany.findUnique({
          where: { userId_companyId: { userId: customer.id, companyId: member.companyId } },
          select: { balance: true },
        });
        return { customer, pointsSpent: dto.points, balance: link?.balance ?? 0 };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async updateLoyaltySettings(userId: number, dto: UpdateCompanyLoyaltySettingsDto) {
    const member = await this.membership(userId);
    this.requireManager(member);
    const levelRules = this.normalizeLevelRules(dto.levelRules);
    const subscriptionSpendPolicy = dto.subscriptionSpendPolicy as SubscriptionSpendPolicy;
    await this.prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: member.companyId },
        data: { subscriptionSpendPolicy },
      });
      await tx.companyLevelRule.deleteMany({ where: { companyId: member.companyId } });
      await tx.companyLevelRule.createMany({
        data: levelRules.map((rule, index) => ({
          companyId: member.companyId,
          levelName: rule.levelName,
          minTotalSpend: new Prisma.Decimal(rule.minTotalSpend),
          cashbackPercent: new Prisma.Decimal(rule.cashbackPercent),
          sortOrder: index + 1,
        })),
      });
    });
    return { subscriptionSpendPolicy, levelRules };
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
    const [operations, snapshot] = await Promise.all([
      this.prisma.financeOperation.findMany({
        where: { companyId: member.companyId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      this.financialSnapshot(this.prisma, member.companyId),
    ]);
    return {
      subscriptionGross: snapshot.committed,
      recognizedSubscriptionRevenue: snapshot.recognized,
      potentialSubscriptionRevenue: snapshot.potential,
      dailySubscriptionRevenue: snapshot.daily,
      reservedPayouts: snapshot.reservedPayouts,
      paidPayouts: snapshot.paidPayouts,
      availableForPayout: snapshot.availableForPayout,
      activeSubscribers: snapshot.activeSubscribers,
      operations: operations.map((operation) => ({ ...operation, amount: Number(operation.amount) })),
    };
  }

  async requestPayout(userId: number, dto: RequestCompanyPayoutDto) {
    const member = await this.membership(userId);
    this.requireManager(member);
    this.requireTradingEnabled(member);
    if (dto.amount < MINIMUM_PAYOUT_RUB) {
      throw new BadRequestException(`Минимальная сумма вывода - ${MINIMUM_PAYOUT_RUB.toLocaleString("ru-RU")} ₽.`);
    }
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const snapshot = await this.financialSnapshot(tx, member.companyId);
          if (dto.amount > snapshot.availableForPayout) {
            throw new BadRequestException(
              `Недостаточно доступных средств. Можно запросить не более ${snapshot.availableForPayout.toFixed(2)} RUB.`,
            );
          }
          return tx.financeOperation.create({
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
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        throw new ConflictException("Баланс одновременно изменился. Обновите страницу и повторите заявку.");
      }
      throw error;
    }
  }

  private serializeClubBundle(bundle: {
    id: number;
    uuid: string;
    slug: string;
    name: string;
    description: string;
    price: Prisma.Decimal | string | number;
    renewalPeriod: string;
    renewalValue: number;
    renewalUnit: string;
    promoBonusDays: number;
    status: SubscriptionBundleStatus;
    isActive: boolean;
    activatedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
    category?: { id: number; slug: string; name: string; icon: string } | null;
    proposedByCompany?: { id: number; slug: string; name: string } | null;
    participants: Array<{
      id: number;
      uuid: string;
      companyId: number;
      benefitTitle: string;
      benefitDescription: string;
      fulfillmentNote: string | null;
      revenueSharePercent: Prisma.Decimal | string | number;
      allowance: number;
      windowValue: number;
      windowUnit: SubscriptionEntitlementWindow;
      approvalStatus: SubscriptionBundleParticipantStatus;
      approvedAt: Date | null;
      rejectedAt: Date | null;
      sortOrder: number;
      company: { id: number; slug: string; name: string; isActive?: boolean };
    }>;
  }) {
    return {
      uuid: bundle.uuid,
      slug: bundle.slug,
      name: bundle.name,
      description: bundle.description,
      price: Number(bundle.price),
      renewalPeriod: bundle.renewalPeriod,
      renewalValue: bundle.renewalValue,
      renewalUnit: bundle.renewalUnit,
      promoBonusDays: bundle.promoBonusDays,
      status: bundle.status,
      isActive: bundle.isActive,
      activatedAt: bundle.activatedAt ?? null,
      createdAt: bundle.createdAt,
      updatedAt: bundle.updatedAt,
      category: bundle.category ?? null,
      proposedByCompany: bundle.proposedByCompany ?? null,
      participants: bundle.participants.map((participant) => ({
        uuid: participant.uuid,
        companyId: participant.companyId,
        company: participant.company,
        benefitTitle: participant.benefitTitle,
        benefitDescription: participant.benefitDescription,
        fulfillmentNote: participant.fulfillmentNote,
        revenueSharePercent: Number(participant.revenueSharePercent),
        allowance: participant.allowance,
        windowValue: participant.windowValue,
        windowUnit: participant.windowUnit,
        approvalStatus: participant.approvalStatus,
        approvedAt: participant.approvedAt,
        rejectedAt: participant.rejectedAt,
        sortOrder: participant.sortOrder,
      })),
    };
  }

  async club(userId: number) {
    const member = await this.membership(userId);
    const [companies, bundles] = await Promise.all([
      this.prisma.company.findMany({
        where: {
          id: { not: member.companyId },
          isActive: true,
          identityVerificationCompleted: true,
        },
        orderBy: { name: "asc" },
        take: 80,
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          operatesOnline: true,
          category: { select: { id: true, slug: true, name: true, icon: true } },
          categories: {
            select: { category: { select: { id: true, slug: true, name: true, icon: true } } },
            orderBy: { id: "asc" },
          },
        },
      }),
      this.prisma.subscriptionBundle.findMany({
        where: { participants: { some: { companyId: member.companyId } } },
        orderBy: { updatedAt: "desc" },
        include: {
          category: { select: { id: true, slug: true, name: true, icon: true } },
          proposedByCompany: { select: { id: true, slug: true, name: true } },
          participants: {
            include: { company: { select: { id: true, slug: true, name: true, isActive: true } } },
            orderBy: { sortOrder: "asc" },
          },
        },
      }),
    ]);

    const serializedBundles = bundles.map((bundle) => this.serializeClubBundle(bundle));
    const currentCompanyId = member.companyId;
    return {
      memberRole: member.role,
      company: { id: member.company.id, slug: member.company.slug, name: member.company.name },
      companies: companies.map((company) => ({
        ...company,
        categories: company.categories.map((row) => row.category),
      })),
      bundles: serializedBundles,
      incoming: serializedBundles.filter((bundle) =>
        bundle.participants.some((participant) => participant.companyId === currentCompanyId && participant.approvalStatus === SubscriptionBundleParticipantStatus.PENDING),
      ),
      active: serializedBundles.filter((bundle) => bundle.status === SubscriptionBundleStatus.ACTIVE && bundle.isActive),
    };
  }

  async createClubBundleProposal(userId: number, dto: CreateCompanyClubBundleDto) {
    const member = await this.membership(userId);
    this.requireManager(member);
    this.requireTradingEnabled(member);
    if (dto.partnerCompanyId === member.companyId) {
      throw new BadRequestException("Выберите другую компанию для коллаборации.");
    }
    const shareTotal = Number(dto.myRevenueSharePercent) + Number(dto.partnerRevenueSharePercent);
    if (Math.round(shareTotal * 100) !== 10000) {
      throw new BadRequestException("Доли дохода двух компаний должны давать ровно 100%.");
    }
    const [partner, category] = await Promise.all([
      this.prisma.company.findFirst({
        where: { id: dto.partnerCompanyId, isActive: true, identityVerificationCompleted: true },
        select: { id: true },
      }),
      dto.categoryId ? this.prisma.category.findUnique({ where: { id: dto.categoryId }, select: { id: true } }) : Promise.resolve(null),
    ]);
    if (!partner) throw new NotFoundException("Компания-партнёр не найдена или ещё не верифицирована.");
    if (dto.categoryId && !category) throw new NotFoundException("Категория не найдена.");

    const slug = await this.uniqueBundleSlug(dto.name);
    const renewalValue = dto.renewalValue ?? 1;
    const renewalUnit = dto.renewalUnit ?? "month";
    const promoBonusDays = Math.max(0, dto.promoBonusDays ?? 0);
    const now = new Date();
    const myWindowUnit = dto.myWindowUnit ?? SubscriptionEntitlementWindow.DAY;
    const partnerWindowUnit = dto.partnerWindowUnit ?? SubscriptionEntitlementWindow.UNLIMITED;
    const myUnlimited = myWindowUnit === SubscriptionEntitlementWindow.UNLIMITED;
    const partnerUnlimited = partnerWindowUnit === SubscriptionEntitlementWindow.UNLIMITED;

    const bundle = await this.prisma.subscriptionBundle.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description.trim(),
        price: new Prisma.Decimal(dto.price),
        renewalPeriod: this.renewalLabel(renewalValue, renewalUnit, promoBonusDays),
        renewalValue,
        renewalUnit,
        promoBonusDays,
        status: SubscriptionBundleStatus.DRAFT,
        isActive: false,
        categoryId: dto.categoryId ?? member.company.categoryId,
        proposedByCompanyId: member.companyId,
        proposedByUserId: userId,
        participants: {
          create: [
            {
              companyId: member.companyId,
              benefitTitle: dto.myBenefitTitle.trim(),
              benefitDescription: dto.myBenefitDescription.trim(),
              fulfillmentNote: dto.myFulfillmentNote?.trim() || null,
              revenueSharePercent: new Prisma.Decimal(dto.myRevenueSharePercent),
              allowance: myUnlimited ? 1 : dto.myAllowance ?? 1,
              windowValue: myUnlimited ? 1 : dto.myWindowValue ?? 1,
              windowUnit: myWindowUnit,
              approvalStatus: SubscriptionBundleParticipantStatus.APPROVED,
              approvedAt: now,
              approvedById: userId,
              sortOrder: 1,
            },
            {
              companyId: dto.partnerCompanyId,
              benefitTitle: dto.partnerBenefitTitle.trim(),
              benefitDescription: dto.partnerBenefitDescription.trim(),
              fulfillmentNote: dto.partnerFulfillmentNote?.trim() || null,
              revenueSharePercent: new Prisma.Decimal(dto.partnerRevenueSharePercent),
              allowance: partnerUnlimited ? 1 : dto.partnerAllowance ?? 1,
              windowValue: partnerUnlimited ? 1 : dto.partnerWindowValue ?? 1,
              windowUnit: partnerWindowUnit,
              approvalStatus: SubscriptionBundleParticipantStatus.PENDING,
              sortOrder: 2,
            },
          ],
        },
      },
      include: {
        category: { select: { id: true, slug: true, name: true, icon: true } },
        proposedByCompany: { select: { id: true, slug: true, name: true } },
        participants: {
          include: { company: { select: { id: true, slug: true, name: true, isActive: true } } },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    return this.serializeClubBundle(bundle);
  }

  async approveClubBundle(userId: number, bundleUuid: string) {
    const member = await this.membership(userId);
    this.requireManager(member);
    this.requireTradingEnabled(member);
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const bundle = await tx.subscriptionBundle.findUnique({
        where: { uuid: bundleUuid },
        include: { participants: true },
      });
      if (!bundle || !bundle.participants.some((participant) => participant.companyId === member.companyId)) {
        throw new NotFoundException("Предложение коллаборации не найдено.");
      }
      const participant = bundle.participants.find((row) => row.companyId === member.companyId);
      if (!participant) throw new NotFoundException("Компания не участвует в этой коллаборации.");
      if (participant.approvalStatus === SubscriptionBundleParticipantStatus.REJECTED) {
        throw new BadRequestException("Отклонённую коллаборацию нельзя подтвердить. Создайте новое предложение.");
      }

      await tx.subscriptionBundleParticipant.update({
        where: { id: participant.id },
        data: {
          approvalStatus: SubscriptionBundleParticipantStatus.APPROVED,
          approvedAt: now,
          rejectedAt: null,
          approvedById: userId,
        },
      });

      const allParticipants = bundle.participants.map((row) =>
        row.id === participant.id
          ? { ...row, approvalStatus: SubscriptionBundleParticipantStatus.APPROVED }
          : row,
      );
      const allApproved = allParticipants.every((row) => row.approvalStatus === SubscriptionBundleParticipantStatus.APPROVED);
      await tx.subscriptionBundle.update({
        where: { id: bundle.id },
        data: allApproved
          ? { status: SubscriptionBundleStatus.ACTIVE, isActive: true, activatedAt: now }
          : { status: SubscriptionBundleStatus.DRAFT, isActive: false },
      });

      const fresh = await tx.subscriptionBundle.findUniqueOrThrow({
        where: { id: bundle.id },
        include: {
          category: { select: { id: true, slug: true, name: true, icon: true } },
          proposedByCompany: { select: { id: true, slug: true, name: true } },
          participants: {
            include: { company: { select: { id: true, slug: true, name: true, isActive: true } } },
            orderBy: { sortOrder: "asc" },
          },
        },
      });
      return this.serializeClubBundle(fresh);
    });
  }

  async rejectClubBundle(userId: number, bundleUuid: string) {
    const member = await this.membership(userId);
    this.requireManager(member);
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const bundle = await tx.subscriptionBundle.findUnique({
        where: { uuid: bundleUuid },
        include: { participants: true },
      });
      if (!bundle || !bundle.participants.some((participant) => participant.companyId === member.companyId)) {
        throw new NotFoundException("Предложение коллаборации не найдено.");
      }
      const participant = bundle.participants.find((row) => row.companyId === member.companyId);
      if (!participant) throw new NotFoundException("Компания не участвует в этой коллаборации.");
      await tx.subscriptionBundleParticipant.update({
        where: { id: participant.id },
        data: {
          approvalStatus: SubscriptionBundleParticipantStatus.REJECTED,
          rejectedAt: now,
          approvedAt: null,
          approvedById: null,
        },
      });
      const fresh = await tx.subscriptionBundle.update({
        where: { id: bundle.id },
        data: { status: SubscriptionBundleStatus.ARCHIVED, isActive: false },
        include: {
          category: { select: { id: true, slug: true, name: true, icon: true } },
          proposedByCompany: { select: { id: true, slug: true, name: true } },
          participants: {
            include: { company: { select: { id: true, slug: true, name: true, isActive: true } } },
            orderBy: { sortOrder: "asc" },
          },
        },
      });
      return this.serializeClubBundle(fresh);
    });
  }

  async subscriptions(userId: number) {
    const member = await this.membership(userId);
    const now = new Date();
    const subscriptions = await this.prisma.subscription.findMany({
      where: { companyId: member.companyId },
      orderBy: { createdAt: "desc" },
      include: {
        entitlements: { orderBy: { createdAt: "asc" } },
        userPlans: {
          where: {
            status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.EXPIRED] },
          },
          select: {
            status: true,
            activatedAt: true,
            expiresAt: true,
            redemptions: {
              select: {
                entitlementId: true,
                quantity: true,
                redeemedAt: true,
              },
            },
          },
        },
      },
    });

    return subscriptions.map(({ userPlans, ...subscription }) => {
      const activePlans = userPlans.filter(
        (plan) => plan.status === SubscriptionStatus.ACTIVE && (!plan.expiresAt || plan.expiresAt > now),
      );
      const activeRevenue = this.subscriptionRevenue(
        activePlans.map((plan) => ({
          activatedAt: plan.activatedAt,
          expiresAt: plan.expiresAt,
          subscription: { price: subscription.price },
        })),
        now,
      );
      const allRevenue = this.subscriptionRevenue(
        userPlans.map((plan) => ({
          activatedAt: plan.activatedAt,
          expiresAt: plan.expiresAt,
          subscription: { price: subscription.price },
        })),
        now,
      );
      const limitedEntitlements = subscription.entitlements.filter(
        (entitlement) => entitlement.isActive && entitlement.windowUnit !== SubscriptionEntitlementWindow.UNLIMITED,
      );
      const entitlementIds = new Set(limitedEntitlements.map((entitlement) => entitlement.id));
      const usageCapacity =
        activePlans.length * limitedEntitlements.reduce((sum, entitlement) => sum + entitlement.allowance, 0);
      const totalRedemptions = activePlans.reduce(
        (sum, plan) =>
          sum +
          plan.redemptions
            .filter(
              (redemption) =>
                entitlementIds.has(redemption.entitlementId) &&
                redemption.redeemedAt >= plan.activatedAt &&
                (!plan.expiresAt || redemption.redeemedAt <= plan.expiresAt),
            )
            .reduce((innerSum, redemption) => innerSum + redemption.quantity, 0),
        0,
      );
      const usagePercent = usageCapacity > 0 ? Math.min(100, Math.round((totalRedemptions / usageCapacity) * 100)) : 0;

      return {
        ...subscription,
        stats: {
          activeSubscribers: activePlans.length,
          dailyRevenue: activeRevenue.daily,
          futureRevenue: activeRevenue.potential,
          recognizedRevenue: allRevenue.recognized,
          totalRedemptions,
          usageCapacity,
          usagePercent,
        },
      };
    });
  }

  async createSubscription(userId: number, dto: CreateCompanySubscriptionDto) {
    const member = await this.membership(userId);
    this.requireManager(member);
    this.requireTradingEnabled(member);
    const entitlements = dto.entitlements ?? [];
    if (entitlements.length === 0) {
      throw new BadRequestException("Subscription must include at least one service.");
    }
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
        entitlements: {
          create: entitlements.map((entitlement) => {
            const unlimited = entitlement.windowUnit === SubscriptionEntitlementWindow.UNLIMITED;
            return {
              title: entitlement.title.trim(),
              description: entitlement.description?.trim() || null,
              allowance: unlimited ? 1 : entitlement.allowance,
              windowValue: unlimited ? 1 : entitlement.windowValue,
              windowUnit: entitlement.windowUnit,
            };
          }),
        },
      },
      include: { entitlements: { orderBy: { createdAt: "asc" } } },
    });
  }

  async updateSubscription(userId: number, subscriptionUuid: string, dto: UpdateCompanyOwnedSubscriptionDto) {
    const member = await this.membership(userId);
    this.requireManager(member);
    this.requireTradingEnabled(member);
    const subscription = await this.prisma.subscription.findUnique({
      where: { uuid: subscriptionUuid },
      include: { entitlements: { orderBy: { createdAt: "asc" } } },
    });
    if (!subscription || subscription.companyId !== member.companyId) {
      throw new NotFoundException("Subscription not found for this company.");
    }

    await this.assertSubscriptionEditAcknowledged(subscription.id, dto.acknowledgeSubscriberRefundPolicy);

    const nextRenewalValue = dto.renewalValue ?? subscription.renewalValue;
    const nextRenewalUnit = dto.renewalUnit ?? ((subscription.renewalUnit || "month") as "week" | "month" | "year");
    const renewalUnit = ["week", "month", "year"].includes(nextRenewalUnit) ? nextRenewalUnit : "month";

    return this.prisma.subscription.update({
      where: { uuid: subscriptionUuid },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.price !== undefined ? { price: new Prisma.Decimal(dto.price) } : {}),
        renewalValue: nextRenewalValue,
        renewalUnit,
        renewalPeriod: this.renewalLabel(nextRenewalValue, renewalUnit, subscription.promoBonusDays ?? 0),
      },
      include: { entitlements: { orderBy: { createdAt: "asc" } } },
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

  async updateEntitlement(
    userId: number,
    subscriptionUuid: string,
    entitlementUuid: string,
    dto: UpdateSubscriptionEntitlementDto,
  ) {
    const member = await this.membership(userId);
    this.requireManager(member);
    this.requireTradingEnabled(member);
    const entitlement = await this.prisma.subscriptionEntitlement.findUnique({
      where: { uuid: entitlementUuid },
      include: {
        subscription: {
          include: {
            entitlements: {
              where: { isActive: true },
              select: { id: true },
            },
          },
        },
      },
    });
    if (
      !entitlement ||
      entitlement.subscription.uuid !== subscriptionUuid ||
      entitlement.subscription.companyId !== member.companyId
    ) {
      throw new NotFoundException("Subscription benefit not found for this company.");
    }

    await this.assertSubscriptionEditAcknowledged(entitlement.subscriptionId, dto.acknowledgeSubscriberRefundPolicy);
    if (dto.isActive === false && entitlement.isActive) {
      const hasAnotherActiveService = entitlement.subscription.entitlements.some((item) => item.id !== entitlement.id);
      if (!hasAnotherActiveService) {
        throw new BadRequestException("Subscription must keep at least one active service.");
      }
    }

    const nextWindowUnit = dto.windowUnit ?? entitlement.windowUnit;
    const unlimited = nextWindowUnit === SubscriptionEntitlementWindow.UNLIMITED;

    return this.prisma.subscriptionEntitlement.update({
      where: { uuid: entitlementUuid },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        allowance: unlimited ? 1 : dto.allowance ?? entitlement.allowance,
        windowValue: unlimited ? 1 : dto.windowValue ?? entitlement.windowValue,
        windowUnit: nextWindowUnit,
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
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

  async redeemBundleBenefit(userId: number, dto: RedeemSubscriptionBundleBenefitDto) {
    const member = await this.membership(userId);
    this.requireTradingEnabled(member);
    const participant = await this.prisma.subscriptionBundleParticipant.findUnique({
      where: { uuid: dto.participantUuid },
      include: { bundle: true, company: true },
    });
    if (
      !participant ||
      participant.companyId !== member.companyId ||
      participant.approvalStatus !== SubscriptionBundleParticipantStatus.APPROVED ||
      !participant.bundle.isActive ||
      participant.bundle.status !== SubscriptionBundleStatus.ACTIVE
    ) {
      throw new NotFoundException("Преимущество парной подписки не найдено для этой компании.");
    }
    const customer = await this.prisma.user.findFirst({ where: { uuid: dto.userUuid, role: UserRole.CLIENT } });
    if (!customer) throw new NotFoundException("Customer not found.");
    const plan = await this.prisma.userSubscriptionBundle.findFirst({
      where: {
        userId: customer.id,
        bundleId: participant.bundleId,
        status: SubscriptionStatus.ACTIVE,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    if (!plan) throw new BadRequestException("У клиента нет активной парной подписки для этого преимущества.");

    const quantity = dto.quantity ?? 1;
    const unlimited = participant.windowUnit === SubscriptionEntitlementWindow.UNLIMITED;
    const from = unlimited
      ? null
      : this.redemptionWindowStart(participant.windowUnit, participant.windowValue, plan.activatedAt);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          let alreadyUsed: number | null = null;
          if (!unlimited && from) {
            const total = await tx.subscriptionBundleRedemption.aggregate({
              where: { userSubscriptionBundleId: plan.id, participantId: participant.id, redeemedAt: { gte: from } },
              _sum: { quantity: true },
            });
            alreadyUsed = total._sum.quantity ?? 0;
            if (alreadyUsed + quantity > participant.allowance) {
              throw new ConflictException("Лимит этого преимущества уже исчерпан за период.");
            }
          }
          const redemption = await tx.subscriptionBundleRedemption.create({
            data: {
              userSubscriptionBundleId: plan.id,
              participantId: participant.id,
              companyId: member.companyId,
              processedById: userId,
              quantity,
              note: dto.note?.trim() || null,
            },
          });
          return {
            redemption,
            benefit: participant.benefitTitle,
            bundle: participant.bundle.name,
            unlimited,
            used: unlimited ? null : (alreadyUsed ?? 0) + quantity,
            allowance: unlimited ? null : participant.allowance,
            windowUnit: participant.windowUnit,
            windowValue: participant.windowValue,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if ((error as { code?: string }).code === "P2034") {
        throw new ConflictException("Это преимущество сейчас гасится на другой кассе. Обновите и повторите.");
      }
      throw error;
    }
  }
}
