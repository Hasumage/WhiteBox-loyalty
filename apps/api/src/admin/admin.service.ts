import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { promises as fs } from "fs";
import { join, resolve } from "path";
import {
  AccountStatus,
  AuditCategory,
  AuditLevel,
  AuditResult,
  AuditWorkspace,
  PermissionScope,
  PromoCodeRewardType,
  Prisma,
  ReferralInviteStatus,
  SubscriptionBundleStatus,
  SubscriptionSpendPolicy,
  UserRole,
} from "@prisma/client";
import * as bcrypt from "bcrypt";
import { createHash, randomBytes, randomUUID } from "crypto";
import { MaintenanceStateService } from "../maintenance/maintenance-state.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { CreateCompanySubscriptionDto } from "./dto/create-company-subscription.dto";
import { CreatePairedSubscriptionDto } from "./dto/create-paired-subscription.dto";
import { CreatePromoCodeDto } from "./dto/create-promo-code.dto";
import { CreateAccountDto } from "./dto/create-account.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { UpdateCompanySubscriptionDto } from "./dto/update-company-subscription.dto";
import { UpdateCompanyUserDto } from "./dto/update-company-user.dto";
import { UpdateReferralCampaignDto } from "./dto/update-referral-campaign.dto";
import { UpsertCompanyLocationDto } from "./dto/upsert-company-location.dto";
import { UpsertCompanyProfileDto } from "./dto/upsert-company-profile.dto";
import { CreateSubscriptionEntitlementDto } from "../company/dto/company-workspace.dto";

@Injectable()
export class AdminService {
  private static readonly MAX_SLUG_LENGTH = 60;
  private static readonly RENEWAL_UNITS = ["week", "month", "year"] as const;

  private readonly backupTableOrder = [
    "User",
    "Category",
    "Company",
    "CompanyLocation",
    "Subscription",
    "SubscriptionBundle",
    "SubscriptionBundleParticipant",
    "CompanyCategory",
    "CompanyLevelRule",
    "CompanyMember",
    "CompanyPurchase",
    "UserFavoriteCategory",
    "UserProfilePreference",
    "UserCompany",
    "UserSubscription",
    "SubscriptionEntitlement",
    "SubscriptionRedemption",
    "PromoCode",
    "PromoCodeRedemption",
    "ReferralCampaign",
    "ReferralInvite",
    "RefreshToken",
    "OAuthAccount",
    "LoginEvent",
    "EmailChangeRequest",
    "LoyaltyTransaction",
    "FinanceOperation",
    "AuditEvent",
    "AdminTask",
  ] as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly maintenance: MaintenanceStateService,
  ) {}

  private slugify(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, AdminService.MAX_SLUG_LENGTH);
  }

  private async createUniqueSlug(
    baseValue: string,
    exists: (slug: string) => Promise<{ id: number } | null>,
    fallback: string,
    excludeId?: number,
  ) {
    const normalizedBase = (this.slugify(baseValue) || fallback).slice(
      0,
      AdminService.MAX_SLUG_LENGTH,
    );
    let candidate = normalizedBase;
    let suffixIndex = 2;

    while (true) {
      const existing = await exists(candidate);
      if (!existing || (excludeId !== undefined && existing.id === excludeId)) {
        return candidate;
      }

      const suffix = `-${suffixIndex}`;
      const head = normalizedBase.slice(
        0,
        Math.max(1, AdminService.MAX_SLUG_LENGTH - suffix.length),
      );
      candidate = `${head}${suffix}`;
      suffixIndex += 1;
    }
  }

  private async createUniqueCategorySlug(baseValue: string, excludeId?: number) {
    return this.createUniqueSlug(
      baseValue,
      (slug) => this.prisma.category.findUnique({ where: { slug }, select: { id: true } }),
      "category",
      excludeId,
    );
  }

  private async createUniqueCompanySlug(baseValue: string, excludeId?: number) {
    return this.createUniqueSlug(
      baseValue,
      (slug) => this.prisma.company.findUnique({ where: { slug }, select: { id: true } }),
      "company",
      excludeId,
    );
  }

  private async createUniqueSubscriptionSlug(baseValue: string, excludeId?: number) {
    return this.createUniqueSlug(
      baseValue,
      (slug) => this.prisma.subscription.findUnique({ where: { slug }, select: { id: true } }),
      "subscription",
      excludeId,
    );
  }

  private async createUniqueSubscriptionBundleSlug(baseValue: string, excludeId?: number) {
    return this.createUniqueSlug(
      baseValue,
      (slug) => this.prisma.subscriptionBundle.findUnique({ where: { slug }, select: { id: true } }),
      "bundle",
      excludeId,
    );
  }

  private normalizePromoCode(code: string) {
    return code.trim().toUpperCase().replace(/\s+/g, "");
  }

  private serializePromoCode(row: Prisma.PromoCodeGetPayload<{
    include: {
      subscription: { select: { uuid: true; slug: true; name: true } };
      company: { select: { id: true; slug: true; name: true } };
      redemptions: { select: { id: true } };
    };
  }>) {
    const { redemptions, ...promoCode } = row;
    return {
      ...promoCode,
      redemptionCount: redemptions.length,
    };
  }

  private async requireCompanyUser(uuid: string) {
    const user = await this.prisma.user.findUnique({
      where: { uuid },
      include: { managedCompany: { include: { categories: true, levelRules: true } } },
    });
    if (!user || user.role !== UserRole.COMPANY) {
      throw new NotFoundException("Company user not found");
    }
    return user;
  }

  private parseRenewalUnit(raw?: string | null): (typeof AdminService.RENEWAL_UNITS)[number] {
    const unit = (raw ?? "").trim().toLowerCase();
    if (AdminService.RENEWAL_UNITS.includes(unit as never)) {
      return unit as (typeof AdminService.RENEWAL_UNITS)[number];
    }
    throw new BadRequestException("Renewal unit must be week, month or year.");
  }

  private buildRenewalLabel(
    value: number,
    unit: (typeof AdminService.RENEWAL_UNITS)[number],
    promoBonusDays: number,
  ) {
    const base = `${value} ${unit}${value > 1 ? "s" : ""}`;
    if (promoBonusDays > 0) {
      return `${base} (+${promoBonusDays} bonus days promo)`;
    }
    return base;
  }

  private estimateMonthlyMultiplier(renewalUnit: string | null, renewalValue: number) {
    const safeValue = Math.max(1, Number(renewalValue) || 1);
    const unit = (renewalUnit ?? "").toLowerCase();
    if (unit === "week") return (52 / 12) / safeValue;
    if (unit === "year") return 1 / (12 * safeValue);
    return 1 / safeValue;
  }

  private async resolveActorLabel(actorUserId?: number | null) {
    if (!actorUserId) return "system";
    const actor = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: { email: true, uuid: true },
    });
    return actor?.email ?? actor?.uuid ?? "system";
  }

  private async createAuditEvent(input: {
    workspace?: AuditWorkspace;
    category: AuditCategory;
    level?: AuditLevel;
    action: string;
    details?: string | null;
    actorUserId?: number | null;
    actorLabel?: string;
    targetUserId?: number | null;
    targetLabel?: string | null;
    targetEmail?: string | null;
    targetUuid?: string | null;
    result?: AuditResult;
    tags?: string[];
    ipAddress?: string | null;
    countryCode?: string | null;
    linkUrl?: string | null;
    linkLabel?: string | null;
  }) {
    const actorLabel = input.actorLabel ?? (await this.resolveActorLabel(input.actorUserId));
    return this.prisma.auditEvent.create({
      data: {
        workspace: input.workspace ?? AuditWorkspace.MANAGER,
        category: input.category,
        level: input.level ?? AuditLevel.INFO,
        action: input.action.trim(),
        details: input.details?.trim() || null,
        actorUserId: input.actorUserId ?? null,
        actorLabel,
        targetUserId: input.targetUserId ?? null,
        targetLabel: input.targetLabel?.trim() || null,
        targetEmail: input.targetEmail?.trim().toLowerCase() || null,
        targetUuid: input.targetUuid?.trim() || null,
        result: input.result ?? AuditResult.SUCCESS,
        tags: [...new Set((input.tags ?? []).map((tag) => tag.trim().toUpperCase()).filter(Boolean))],
        ipAddress: input.ipAddress?.trim() || null,
        countryCode: input.countryCode?.trim().toUpperCase() || null,
        linkUrl: input.linkUrl?.trim() || null,
        linkLabel: input.linkLabel?.trim() || null,
      },
    });
  }

  private async recordManagerCompanyChangeWarning(
    actorUserId: number | undefined,
    input: {
      action: string;
      details: string;
      targetUuid?: string | null;
      targetLabel?: string | null;
      category?: AuditCategory;
    },
  ) {
    if (!actorUserId) return;
    const actor = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: { id: true, role: true, email: true },
    });
    if (!actor || actor.role !== UserRole.MANAGER) return;
    await this.createAuditEvent({
      workspace: AuditWorkspace.MANAGER,
      category: input.category ?? AuditCategory.SYSTEM,
      level: AuditLevel.WARN,
      action: input.action,
      details: input.details,
      actorUserId: actor.id,
      actorLabel: actor.email,
      targetUuid: input.targetUuid,
      targetLabel: input.targetLabel,
      tags: ["WARNING", "MANAGER_CHANGE", "REVIEW_REQUIRED"],
    });
  }

  private isAuditStorageUnavailable(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022")
    );
  }

  private defaultGitAuditEvents() {
    return [
      {
        id: "git_bootstrap_001",
        workspace: AuditWorkspace.DEVELOPER,
        level: AuditLevel.INFO,
        category: AuditCategory.SYSTEM,
        action: "Release branch pushed to GitHub",
        details: "Branch pushed and pull request created for merge into main.",
        actorUserId: null,
        actorLabel: "system",
        targetUserId: null,
        targetLabel: "release/admin-security-crud-2026-04-24",
        targetEmail: null,
        targetUuid: null,
        result: AuditResult.SUCCESS,
        tags: ["GIT"],
        ipAddress: null,
        countryCode: null,
        linkUrl: "https://github.com/magistoro/WhiteBox-loyalty/pulls",
        linkLabel: "Open pull requests",
        createdAt: new Date("2026-04-24T20:10:00.000Z"),
      },
      {
        id: "git_bootstrap_002",
        workspace: AuditWorkspace.DEVELOPER,
        level: AuditLevel.INFO,
        category: AuditCategory.SYSTEM,
        action: "Merge to main completed",
        details: "Release pull request was merged and release branch removed.",
        actorUserId: null,
        actorLabel: "system",
        targetUserId: null,
        targetLabel: "main",
        targetEmail: null,
        targetUuid: null,
        result: AuditResult.SUCCESS,
        tags: ["GIT"],
        ipAddress: null,
        countryCode: null,
        linkUrl: "https://github.com/magistoro/WhiteBox-loyalty/commits/main",
        linkLabel: "Open main commits",
        createdAt: new Date("2026-04-25T08:20:00.000Z"),
      },
    ] as const;
  }

  private normalizeCompanyCategoryIds(dto: UpsertCompanyProfileDto) {
    const fromArray = (dto.categoryIds ?? [])
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);
    const merged = dto.categoryId ? [dto.categoryId, ...fromArray] : fromArray;
    const uniqueOrdered = [...new Set(merged)];
    if (uniqueOrdered.length === 0) {
      throw new BadRequestException("At least one category is required.");
    }
    return uniqueOrdered;
  }

  private normalizeLevelRules(
    levelRules?: Array<{ levelName: string; minTotalSpend: number; cashbackPercent: number }>,
  ) {
    const rules = (levelRules ?? [{ levelName: "Bronze", minTotalSpend: 0, cashbackPercent: 0 }])
      .map((item, index) => ({
        levelName: item.levelName.trim() || `Level ${index + 1}`,
        minTotalSpend: Number(item.minTotalSpend),
        cashbackPercent: Number(item.cashbackPercent),
      }))
      .filter((item) => item.levelName.length > 0);

    if (rules.length === 0) {
      throw new BadRequestException("At least one level rule is required.");
    }

    rules.sort((a, b) => a.minTotalSpend - b.minTotalSpend);

    for (let i = 0; i < rules.length; i += 1) {
      const current = rules[i];
      if (!Number.isFinite(current.minTotalSpend) || current.minTotalSpend < 0) {
        throw new BadRequestException("Level minimum spend must be >= 0.");
      }
      if (
        !Number.isFinite(current.cashbackPercent) ||
        current.cashbackPercent < 0 ||
        current.cashbackPercent > 100
      ) {
        throw new BadRequestException("Cashback percent must be between 0 and 100.");
      }
      if (i > 0 && current.minTotalSpend === rules[i - 1].minTotalSpend) {
        throw new BadRequestException("Level minimum spend values must be unique.");
      }
      if (i > 0 && current.cashbackPercent < rules[i - 1].cashbackPercent) {
        throw new BadRequestException(
          "Cashback percent cannot be higher on lower levels. Cashback must increase or stay the same with level spend thresholds.",
        );
      }
    }

    return rules;
  }

  private backupDir() {
    const configured = this.config.get<string>("DB_BACKUP_DIR");
    return configured
      ? resolve(configured)
      : resolve(process.cwd(), "backups", "db");
  }

  private backupPath(backupId: string) {
    return join(this.backupDir(), `${backupId}.json`);
  }

  private backupMetaPath(backupId: string) {
    return join(this.backupDir(), `${backupId}.meta.json`);
  }

  private assertBackupId(backupId: string) {
    if (!/^[a-z0-9-]+$/i.test(backupId)) {
      throw new BadRequestException("Invalid backup id");
    }
  }

  private serializeSnapshotData(data: unknown) {
    return JSON.stringify(
      data,
      (_key, value) => {
        if (typeof value === "bigint") return value.toString();
        return value;
      },
      2,
    );
  }

  private async ensureBackupDir() {
    await fs.mkdir(this.backupDir(), { recursive: true });
  }

  private async readBackupMeta(backupId: string) {
    const metaRaw = await fs.readFile(this.backupMetaPath(backupId), "utf8");
    return JSON.parse(metaRaw) as {
      id: string;
      label: string;
      kind: "CURRENT" | "SEED" | "MANUAL";
      createdAt: string;
      sourceDatabase: string;
      counts: Record<string, number>;
      file: string;
    };
  }

  private async collectBackupRows() {
    const [
      users,
      categories,
      companies,
      companyLocations,
      subscriptions,
      subscriptionBundles,
      subscriptionBundleParticipants,
      companyCategories,
      companyLevelRules,
      companyMembers,
      companyPurchases,
      userFavoriteCategories,
      userProfilePreferences,
      userCompanies,
      userSubscriptions,
      subscriptionEntitlements,
      subscriptionRedemptions,
      promoCodes,
      promoCodeRedemptions,
      referralCampaigns,
      referralInvites,
      refreshTokens,
      oAuthAccounts,
      loginEvents,
      emailChangeRequests,
      loyaltyTransactions,
      financeOperations,
      auditEvents,
      adminTasks,
    ] = await Promise.all([
      this.prisma.user.findMany({ orderBy: { id: "asc" } }),
      this.prisma.category.findMany({ orderBy: { id: "asc" } }),
      this.prisma.company.findMany({ orderBy: { id: "asc" } }),
      this.prisma.companyLocation.findMany({ orderBy: { id: "asc" } }),
      this.prisma.subscription.findMany({ orderBy: { id: "asc" } }),
      this.prisma.subscriptionBundle.findMany({ orderBy: { id: "asc" } }),
      this.prisma.subscriptionBundleParticipant.findMany({ orderBy: { id: "asc" } }),
      this.prisma.companyCategory.findMany({ orderBy: { id: "asc" } }),
      this.prisma.companyLevelRule.findMany({ orderBy: { id: "asc" } }),
      this.prisma.companyMember.findMany({ orderBy: { id: "asc" } }),
      this.prisma.companyPurchase.findMany({ orderBy: { id: "asc" } }),
      this.prisma.userFavoriteCategory.findMany({ orderBy: { id: "asc" } }),
      this.prisma.userProfilePreference.findMany({ orderBy: { id: "asc" } }),
      this.prisma.userCompany.findMany({ orderBy: { id: "asc" } }),
      this.prisma.userSubscription.findMany({ orderBy: { id: "asc" } }),
      this.prisma.subscriptionEntitlement.findMany({ orderBy: { id: "asc" } }),
      this.prisma.subscriptionRedemption.findMany({ orderBy: { id: "asc" } }),
      this.prisma.promoCode.findMany({ orderBy: { id: "asc" } }),
      this.prisma.promoCodeRedemption.findMany({ orderBy: { id: "asc" } }),
      this.prisma.referralCampaign.findMany({ orderBy: { id: "asc" } }),
      this.prisma.referralInvite.findMany({ orderBy: { id: "asc" } }),
      this.prisma.refreshToken.findMany({ orderBy: { createdAt: "asc" } }),
      this.prisma.oAuthAccount.findMany({ orderBy: { createdAt: "asc" } }),
      this.prisma.loginEvent.findMany({ orderBy: { createdAt: "asc" } }),
      this.prisma.emailChangeRequest.findMany({ orderBy: { createdAt: "asc" } }),
      this.prisma.loyaltyTransaction.findMany({ orderBy: { id: "asc" } }),
      this.prisma.financeOperation.findMany({ orderBy: { createdAt: "asc" } }),
      this.prisma.auditEvent.findMany({ orderBy: { createdAt: "asc" } }),
      this.prisma.adminTask.findMany({ orderBy: { createdAt: "asc" } }),
    ]);

    return {
      User: users,
      Category: categories,
      Company: companies,
      CompanyLocation: companyLocations,
      Subscription: subscriptions,
      SubscriptionBundle: subscriptionBundles,
      SubscriptionBundleParticipant: subscriptionBundleParticipants,
      CompanyCategory: companyCategories,
      CompanyLevelRule: companyLevelRules,
      CompanyMember: companyMembers,
      CompanyPurchase: companyPurchases,
      UserFavoriteCategory: userFavoriteCategories,
      UserProfilePreference: userProfilePreferences,
      UserCompany: userCompanies,
      UserSubscription: userSubscriptions,
      SubscriptionEntitlement: subscriptionEntitlements,
      SubscriptionRedemption: subscriptionRedemptions,
      PromoCode: promoCodes,
      PromoCodeRedemption: promoCodeRedemptions,
      ReferralCampaign: referralCampaigns,
      ReferralInvite: referralInvites,
      RefreshToken: refreshTokens,
      OAuthAccount: oAuthAccounts,
      LoginEvent: loginEvents,
      EmailChangeRequest: emailChangeRequests,
      LoyaltyTransaction: loyaltyTransactions,
      FinanceOperation: financeOperations,
      AuditEvent: auditEvents,
      AdminTask: adminTasks,
    };
  }

  async listBackups() {
    await this.ensureBackupDir();
    const files = await fs.readdir(this.backupDir());
    const metaFiles = files.filter((name) => name.endsWith(".meta.json"));
    const metas = await Promise.all(
      metaFiles.map(async (name) => {
        const raw = await fs.readFile(join(this.backupDir(), name), "utf8");
        return JSON.parse(raw) as {
          id: string;
          label: string;
          kind: "CURRENT" | "SEED" | "MANUAL";
          createdAt: string;
          sourceDatabase: string;
          counts: Record<string, number>;
          file: string;
        };
      }),
    );
    return metas.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }

  async createBackup(input?: { label?: string; kind?: "CURRENT" | "SEED" | "MANUAL" }) {
    await this.ensureBackupDir();
    const now = new Date();
    const kind = input?.kind ?? "MANUAL";
    const slugPart = (input?.label ?? kind)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "backup";
    const backupId = `${now.toISOString().replace(/[:.]/g, "-")}-${slugPart}-${randomUUID().slice(0, 8)}`;

    const data = await this.collectBackupRows();
    const counts: Record<string, number> = Object.fromEntries(
      this.backupTableOrder.map((name) => [name, data[name].length]),
    );

    const url = this.config.get<string>("DATABASE_URL") ?? "";
    const sourceDatabase = (() => {
      try {
        return new URL(url).pathname.replace(/^\//, "") || "unknown";
      } catch {
        return "unknown";
      }
    })();

    const payload = {
      schemaVersion: 2,
      backupId,
      createdAt: now.toISOString(),
      kind,
      label: input?.label?.trim() || `${kind} snapshot`,
      sourceDatabase,
      counts,
      tables: data,
    };

    const meta = {
      id: backupId,
      createdAt: payload.createdAt,
      kind,
      label: payload.label,
      sourceDatabase,
      counts,
      file: `${backupId}.json`,
    };

    await fs.writeFile(this.backupPath(backupId), this.serializeSnapshotData(payload), "utf8");
    await fs.writeFile(this.backupMetaPath(backupId), JSON.stringify(meta, null, 2), "utf8");
    return meta;
  }

  private async restoreSequences() {
    await this.prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"User"', 'id'), COALESCE((SELECT MAX(id) FROM "User"), 1), true)`,
    );
    await this.prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"Category"', 'id'), COALESCE((SELECT MAX(id) FROM "Category"), 1), true)`,
    );
    await this.prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"Company"', 'id'), COALESCE((SELECT MAX(id) FROM "Company"), 1), true)`,
    );
    await this.prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"CompanyLocation"', 'id'), COALESCE((SELECT MAX(id) FROM "CompanyLocation"), 1), true)`,
    );
    await this.prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"Subscription"', 'id'), COALESCE((SELECT MAX(id) FROM "Subscription"), 1), true)`,
    );
    await this.prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"CompanyCategory"', 'id'), COALESCE((SELECT MAX(id) FROM "CompanyCategory"), 1), true)`,
    );
    await this.prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"CompanyLevelRule"', 'id'), COALESCE((SELECT MAX(id) FROM "CompanyLevelRule"), 1), true)`,
    );
    await this.prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"CompanyMember"', 'id'), COALESCE((SELECT MAX(id) FROM "CompanyMember"), 1), true)`,
    );
    await this.prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"CompanyPurchase"', 'id'), COALESCE((SELECT MAX(id) FROM "CompanyPurchase"), 1), true)`,
    );
    await this.prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"UserFavoriteCategory"', 'id'), COALESCE((SELECT MAX(id) FROM "UserFavoriteCategory"), 1), true)`,
    );
    await this.prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"UserProfilePreference"', 'id'), COALESCE((SELECT MAX(id) FROM "UserProfilePreference"), 1), true)`,
    );
    await this.prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"UserCompany"', 'id'), COALESCE((SELECT MAX(id) FROM "UserCompany"), 1), true)`,
    );
    await this.prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"UserSubscription"', 'id'), COALESCE((SELECT MAX(id) FROM "UserSubscription"), 1), true)`,
    );
    await this.prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"SubscriptionEntitlement"', 'id'), COALESCE((SELECT MAX(id) FROM "SubscriptionEntitlement"), 1), true)`,
    );
    await this.prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"SubscriptionRedemption"', 'id'), COALESCE((SELECT MAX(id) FROM "SubscriptionRedemption"), 1), true)`,
    );
    await this.prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"PromoCode"', 'id'), COALESCE((SELECT MAX(id) FROM "PromoCode"), 1), true)`,
    );
    await this.prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"PromoCodeRedemption"', 'id'), COALESCE((SELECT MAX(id) FROM "PromoCodeRedemption"), 1), true)`,
    );
    await this.prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"ReferralCampaign"', 'id'), COALESCE((SELECT MAX(id) FROM "ReferralCampaign"), 1), true)`,
    );
    await this.prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"ReferralInvite"', 'id'), COALESCE((SELECT MAX(id) FROM "ReferralInvite"), 1), true)`,
    );
    await this.prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"LoyaltyTransaction"', 'id'), COALESCE((SELECT MAX(id) FROM "LoyaltyTransaction"), 1), true)`,
    );
  }

  async restoreBackup(backupId: string) {
    this.maintenance.setRestoreStage({
      stage: "READING_SNAPSHOT",
      message: "Reading backup file from storage.",
      progressPercent: 12,
    });
    this.assertBackupId(backupId);
    const backupRaw = await fs.readFile(this.backupPath(backupId), "utf8");
    this.maintenance.setRestoreStage({
      stage: "VALIDATING_PAYLOAD",
      message: "Validating backup payload and table structure.",
      progressPercent: 20,
    });
    const backup = JSON.parse(backupRaw) as {
      tables: {
        User: Array<{
          id: number;
          uuid: string;
          telegramId: string | null;
          phoneNumber?: string | null;
          phoneVerifiedAt?: string | null;
          name: string;
          email: string;
          role: UserRole;
          passwordHash: string | null;
          emailVerifiedAt: string | null;
          accountStatus: AccountStatus;
          deletionScheduledAt: string | null;
          createdAt: string;
          updatedAt: string;
        }>;
        Category: Array<Record<string, unknown>>;
        Company: Array<Record<string, unknown>>;
        CompanyLocation?: Array<Record<string, unknown>>;
        Subscription: Array<Record<string, unknown>>;
        SubscriptionBundle?: Array<Record<string, unknown>>;
        SubscriptionBundleParticipant?: Array<Record<string, unknown>>;
        CompanyCategory: Array<Record<string, unknown>>;
        CompanyLevelRule: Array<Record<string, unknown>>;
        CompanyMember?: Array<Record<string, unknown>>;
        CompanyPurchase?: Array<Record<string, unknown>>;
        UserFavoriteCategory: Array<Record<string, unknown>>;
        UserProfilePreference?: Array<Record<string, unknown>>;
        UserCompany: Array<Record<string, unknown>>;
        UserSubscription: Array<Record<string, unknown>>;
        SubscriptionEntitlement?: Array<Record<string, unknown>>;
        SubscriptionRedemption?: Array<Record<string, unknown>>;
        PromoCode?: Array<Record<string, unknown>>;
        PromoCodeRedemption?: Array<Record<string, unknown>>;
        ReferralCampaign?: Array<Record<string, unknown>>;
        ReferralInvite?: Array<Record<string, unknown>>;
        RefreshToken: Array<Record<string, unknown>>;
        OAuthAccount: Array<Record<string, unknown>>;
        LoginEvent: Array<Record<string, unknown>>;
        EmailChangeRequest: Array<Record<string, unknown>>;
        LoyaltyTransaction: Array<Record<string, unknown>>;
        FinanceOperation?: Array<Record<string, unknown>>;
        AuditEvent: Array<Record<string, unknown>>;
        AdminTask?: Array<Record<string, unknown>>;
      };
    };
    const tables = backup.tables;
    if (!tables) {
      throw new BadRequestException("Invalid backup payload");
    }

    this.maintenance.setRestoreStage({
      stage: "WAITING_DB_LOCK",
      message: "Waiting for database transaction lock.",
      progressPercent: 28,
    });
    await this.prisma.$transaction(async (tx) => {
      const quotedTables = this.backupTableOrder.map((table) => `"${table}"`).join(", ");
      await tx.$executeRawUnsafe(`LOCK TABLE ${quotedTables} IN ACCESS EXCLUSIVE MODE`);
      this.maintenance.setRestoreStage({
        stage: "CLEARING_TABLES",
        message: "Clearing existing records in dependency-safe order.",
        progressPercent: 42,
      });
      await tx.auditEvent.deleteMany();
      await tx.adminTask.deleteMany();
      await tx.emailChangeRequest.deleteMany();
      await tx.loginEvent.deleteMany();
      await tx.oAuthAccount.deleteMany();
      await tx.refreshToken.deleteMany();
      await tx.subscriptionRedemption.deleteMany();
      await tx.loyaltyTransaction.deleteMany();
      await tx.financeOperation.deleteMany();
      await tx.userSubscription.deleteMany();
      await tx.subscriptionEntitlement.deleteMany();
      await tx.userCompany.deleteMany();
      await tx.promoCodeRedemption.deleteMany();
      await tx.referralInvite.deleteMany();
      await tx.subscriptionBundleParticipant.deleteMany();
      await tx.userProfilePreference.deleteMany();
      await tx.userFavoriteCategory.deleteMany();
      await tx.referralCampaign.deleteMany();
      await tx.companyLevelRule.deleteMany();
      await tx.companyPurchase.deleteMany();
      await tx.companyMember.deleteMany();
      await tx.companyCategory.deleteMany();
      await tx.companyLocation.deleteMany();
      await tx.promoCode.deleteMany();
      await tx.subscriptionBundle.deleteMany();
      await tx.subscription.deleteMany();
      await tx.company.deleteMany();
      await tx.category.deleteMany();
      await tx.user.deleteMany();

      this.maintenance.setRestoreStage({
        stage: "RESTORING_TABLES",
        message: "Recreating records from backup snapshot.",
        progressPercent: 64,
      });
      if (tables.User.length) {
        await tx.user.createMany({
          data: tables.User.map((row) => ({
            ...row,
            telegramId: row.telegramId ? BigInt(row.telegramId) : null,
            emailVerifiedAt: row.emailVerifiedAt ? new Date(row.emailVerifiedAt) : null,
            deletionScheduledAt: row.deletionScheduledAt ? new Date(row.deletionScheduledAt) : null,
            createdAt: new Date(row.createdAt),
            updatedAt: new Date(row.updatedAt),
          })),
        });
      }
      if (tables.Category.length) await tx.category.createMany({ data: tables.Category as never });
      if (tables.Company.length) await tx.company.createMany({ data: tables.Company as never });
      if (tables.CompanyLocation?.length) {
        await tx.companyLocation.createMany({ data: tables.CompanyLocation as never });
      }
      if (tables.Subscription.length) {
        await tx.subscription.createMany({ data: tables.Subscription as never });
      }
      if (tables.SubscriptionBundle?.length) {
        await tx.subscriptionBundle.createMany({ data: tables.SubscriptionBundle as never });
      }
      if (tables.SubscriptionBundleParticipant?.length) {
        await tx.subscriptionBundleParticipant.createMany({
          data: tables.SubscriptionBundleParticipant as never,
        });
      }
      if (tables.CompanyCategory.length) {
        await tx.companyCategory.createMany({ data: tables.CompanyCategory as never });
      }
      if (tables.CompanyLevelRule.length) {
        await tx.companyLevelRule.createMany({ data: tables.CompanyLevelRule as never });
      }
      if (tables.CompanyMember?.length) {
        await tx.companyMember.createMany({ data: tables.CompanyMember as never });
      }
      if (tables.CompanyPurchase?.length) {
        await tx.companyPurchase.createMany({ data: tables.CompanyPurchase as never });
      }
      if (tables.UserFavoriteCategory.length) {
        await tx.userFavoriteCategory.createMany({ data: tables.UserFavoriteCategory as never });
      }
      if (tables.UserProfilePreference?.length) {
        await tx.userProfilePreference.createMany({ data: tables.UserProfilePreference as never });
      }
      if (tables.UserCompany.length) await tx.userCompany.createMany({ data: tables.UserCompany as never });
      if (tables.UserSubscription.length) {
        await tx.userSubscription.createMany({ data: tables.UserSubscription as never });
      }
      if (tables.SubscriptionEntitlement?.length) {
        await tx.subscriptionEntitlement.createMany({ data: tables.SubscriptionEntitlement as never });
      }
      if (tables.SubscriptionRedemption?.length) {
        await tx.subscriptionRedemption.createMany({ data: tables.SubscriptionRedemption as never });
      }
      if (tables.PromoCode?.length) await tx.promoCode.createMany({ data: tables.PromoCode as never });
      if (tables.PromoCodeRedemption?.length) {
        await tx.promoCodeRedemption.createMany({ data: tables.PromoCodeRedemption as never });
      }
      if (tables.ReferralCampaign?.length) {
        await tx.referralCampaign.createMany({ data: tables.ReferralCampaign as never });
      }
      if (tables.ReferralInvite?.length) await tx.referralInvite.createMany({ data: tables.ReferralInvite as never });
      if (tables.RefreshToken.length) {
        await tx.refreshToken.createMany({ data: tables.RefreshToken as never });
      }
      if (tables.OAuthAccount.length) {
        await tx.oAuthAccount.createMany({ data: tables.OAuthAccount as never });
      }
      if (tables.LoginEvent.length) await tx.loginEvent.createMany({ data: tables.LoginEvent as never });
      if (tables.EmailChangeRequest.length) {
        await tx.emailChangeRequest.createMany({ data: tables.EmailChangeRequest as never });
      }
      if (tables.LoyaltyTransaction.length) {
        await tx.loyaltyTransaction.createMany({ data: tables.LoyaltyTransaction as never });
      }
      if (tables.FinanceOperation?.length) {
        await tx.financeOperation.createMany({ data: tables.FinanceOperation as never });
      }
      if (tables.AuditEvent.length) await tx.auditEvent.createMany({ data: tables.AuditEvent as never });
      if (tables.AdminTask?.length) await tx.adminTask.createMany({ data: tables.AdminTask as never });
    });

    this.maintenance.setRestoreStage({
      stage: "RESETTING_SEQUENCES",
      message: "Resetting PostgreSQL sequences to current max IDs.",
      progressPercent: 88,
    });
    await this.restoreSequences();
    this.maintenance.setRestoreStage({
      stage: "FINALIZING",
      message: "Final verification and metadata sync.",
      progressPercent: 96,
    });
    return this.readBackupMeta(backupId);
  }

  async deleteBackup(backupId: string) {
    this.assertBackupId(backupId);
    await fs.rm(this.backupPath(backupId), { force: true });
    await fs.rm(this.backupMetaPath(backupId), { force: true });
    return { success: true as const };
  }

  async getBackupFile(backupId: string) {
    this.assertBackupId(backupId);
    const meta = await this.readBackupMeta(backupId);
    const content = await fs.readFile(this.backupPath(backupId), "utf8");
    return {
      fileName: `${meta.id}.json`,
      content,
    };
  }

  async createAccount(dto: CreateAccountDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException("Email is already registered");
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        role: dto.role,
        passwordHash,
      },
      select: {
        uuid: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
    return user;
  }

  async listUsers(
    role?: UserRole,
    query?: string,
    page = 1,
    limit = 20,
    sortBy: "name" | "email" | "role" | "status" | "createdAt" = "createdAt",
    sortDir: "asc" | "desc" = "desc",
  ) {
    const q = query?.trim().toLowerCase();
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const safePage = Math.max(1, Number(page) || 1);
    const where = {
      ...(role ? { role } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" as const } },
              { name: { contains: q, mode: "insensitive" as const } },
              { uuid: { contains: q } },
            ],
          }
        : {}),
    } satisfies Prisma.UserWhereInput;

    const orderBy =
      sortBy === "status"
        ? ({ accountStatus: sortDir } as const)
        : sortBy === "createdAt"
          ? ({ createdAt: sortDir } as const)
          : ({ [sortBy]: sortDir } as const);

    const [items, total, activeUsers, adminUsers, blockedUsers] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy,
        select: {
          uuid: true,
          email: true,
          name: true,
          role: true,
          accountStatus: true,
          createdAt: true,
        },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.user.count({ where }),
      this.prisma.user.count({ where: { accountStatus: AccountStatus.ACTIVE } }),
      this.prisma.user.count({ where: { role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.SUPPORT] } } }),
      this.prisma.user.count({ where: { accountStatus: AccountStatus.BLOCKED } }),
    ]);

    return {
      items,
      total,
      summary: {
        totalUsers: total,
        activeUsers,
        adminUsers,
        blockedUsers,
      },
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
      sortBy,
      sortDir,
    };
  }

  async listAuditEvents(options?: {
    workspace?: AuditWorkspace;
    query?: string;
    tag?: string;
    page?: number;
    limit?: number;
  }) {
    const workspace = options?.workspace ?? AuditWorkspace.MANAGER;
    const q = options?.query?.trim();
    const tag = options?.tag?.trim().toUpperCase();
    const safeLimit = Math.max(1, Math.min(200, Number(options?.limit) || 40));
    const safePage = Math.max(1, Number(options?.page) || 1);

    const where = {
      workspace,
      ...(tag ? { tags: { has: tag } } : {}),
      ...(q
        ? {
            OR: [
              { actorLabel: { contains: q, mode: "insensitive" as const } },
              { action: { contains: q, mode: "insensitive" as const } },
              { targetLabel: { contains: q, mode: "insensitive" as const } },
              { targetEmail: { contains: q, mode: "insensitive" as const } },
              { targetUuid: { contains: q, mode: "insensitive" as const } },
              { details: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    } satisfies Prisma.AuditEventWhereInput;

    try {
      const [items, total] = await Promise.all([
        this.prisma.auditEvent.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (safePage - 1) * safeLimit,
          take: safeLimit,
        }),
        this.prisma.auditEvent.count({ where }),
      ]);

      return {
        items,
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      };
    } catch (error) {
      if (!this.isAuditStorageUnavailable(error)) {
        throw error;
      }
      const fallback = this.defaultGitAuditEvents().filter((entry) => {
        if (entry.workspace !== workspace) return false;
        if (tag && !entry.tags.some((value) => value === tag)) return false;
        if (!q) return true;
        const normalized = q.toLowerCase();
        return (
          entry.action.toLowerCase().includes(normalized) ||
          entry.actorLabel.toLowerCase().includes(normalized) ||
          (entry.targetLabel ?? "").toLowerCase().includes(normalized) ||
          (entry.details ?? "").toLowerCase().includes(normalized) ||
          entry.tags.some((t) => t.toLowerCase().includes(normalized))
        );
      });
      const total = fallback.length;
      const start = (safePage - 1) * safeLimit;
      return {
        items: fallback.slice(start, start + safeLimit),
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      };
    }
  }

  async createManualAuditEvent(
    actorUserId: number,
    payload: {
      workspace?: AuditWorkspace;
      category: AuditCategory;
      level?: AuditLevel;
      action: string;
      targetLabel?: string;
      targetEmail?: string;
      targetUuid?: string;
      details?: string;
      tags?: string[];
      result?: AuditResult;
      linkUrl?: string;
      linkLabel?: string;
    },
  ) {
    try {
      return await this.createAuditEvent({
        workspace: payload.workspace ?? AuditWorkspace.MANAGER,
        category: payload.category,
        level: payload.level ?? AuditLevel.INFO,
        action: payload.action,
        details: payload.details,
        actorUserId,
        targetLabel: payload.targetLabel,
        targetEmail: payload.targetEmail,
        targetUuid: payload.targetUuid,
        tags: payload.tags,
        result: payload.result ?? AuditResult.SUCCESS,
        linkUrl: payload.linkUrl,
        linkLabel: payload.linkLabel,
      });
    } catch (error) {
      if (this.isAuditStorageUnavailable(error)) {
        throw new BadRequestException("Audit storage is not ready. Apply DB migrations and retry.");
      }
      throw error;
    }
  }

  private assertCanAssignRole(actorRole: UserRole, nextRole: UserRole) {
    if (actorRole === UserRole.SUPER_ADMIN) return;

    const adminAssignableRoles = new Set<UserRole>([
      UserRole.CLIENT,
      UserRole.COMPANY,
      UserRole.MANAGER,
      UserRole.SUPPORT,
    ]);
    if (actorRole === UserRole.ADMIN && adminAssignableRoles.has(nextRole)) return;

    throw new ForbiddenException("Only SUPER_ADMIN can assign this role");
  }

  private isAdminWorkspaceRole(role: UserRole) {
    const adminWorkspaceRoles = new Set<UserRole>([
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.SUPPORT,
    ]);
    return adminWorkspaceRoles.has(role);
  }

  private defaultPermissionForRole(role: UserRole | string, scope: PermissionScope) {
    if (role === UserRole.SUPER_ADMIN) return { canView: true, canEdit: true, canApprove: true };
    if (role === UserRole.ADMIN) {
      if (scope === PermissionScope.FINANCE || scope === PermissionScope.DATABASE) {
        return { canView: false, canEdit: false, canApprove: false };
      }
      return { canView: true, canEdit: true, canApprove: scope !== PermissionScope.TELEGRAM };
    }
    if (role === UserRole.MANAGER) {
      if (scope === PermissionScope.USERS) return { canView: true, canEdit: false, canApprove: false };
      if (scope === PermissionScope.COMPANIES) return { canView: true, canEdit: true, canApprove: false };
      if (scope === PermissionScope.COMPANY_VERIFICATIONS) return { canView: true, canEdit: true, canApprove: true };
      if (scope === PermissionScope.SUPPORT) return { canView: true, canEdit: true, canApprove: false };
      if (scope === PermissionScope.AUDIT || scope === PermissionScope.TELEGRAM) {
        return { canView: true, canEdit: false, canApprove: false };
      }
    }
    if (role === UserRole.SUPPORT) {
      if (scope === PermissionScope.USERS) return { canView: true, canEdit: false, canApprove: false };
      if (scope === PermissionScope.SUPPORT) return { canView: true, canEdit: true, canApprove: false };
    }
    return { canView: false, canEdit: false, canApprove: false };
  }

  private clampPermissionToRole(
    role: UserRole | string,
    scope: PermissionScope,
    input: { canView?: boolean; canEdit?: boolean; canApprove?: boolean },
  ) {
    if (role === UserRole.SUPER_ADMIN) return { canView: true, canEdit: true, canApprove: true };
    const next = {
      canView: input.canView === true,
      canEdit: input.canEdit === true,
      canApprove: input.canApprove === true,
    };
    if (next.canEdit || next.canApprove) next.canView = true;
    if (role === UserRole.ADMIN) return next;
    if (role === UserRole.MANAGER) {
      if (scope === PermissionScope.FINANCE || scope === PermissionScope.SETTINGS) {
        return { canView: false, canEdit: false, canApprove: false };
      }
      if (scope === PermissionScope.DATABASE) return { canView: next.canView, canEdit: false, canApprove: false };
      return next;
    }
    if (role === UserRole.SUPPORT) {
      if (
        scope === PermissionScope.FINANCE ||
        scope === PermissionScope.SETTINGS ||
        scope === PermissionScope.COMPANY_VERIFICATIONS
      ) {
        return { canView: false, canEdit: false, canApprove: false };
      }
      if (scope === PermissionScope.DATABASE || scope === PermissionScope.AUDIT || scope === PermissionScope.TELEGRAM) {
        return { canView: next.canView, canEdit: false, canApprove: false };
      }
      return { canView: next.canView, canEdit: next.canEdit, canApprove: false };
    }
    return { canView: false, canEdit: false, canApprove: false };
  }

  async assertAdminPermission(
    actorUserId: number,
    scope: PermissionScope,
    action: "canView" | "canEdit" | "canApprove",
  ) {
    const actor = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: {
        id: true,
        role: true,
        permissions: {
          where: { scope },
          select: { canView: true, canEdit: true, canApprove: true },
        },
      },
    });
    if (!actor) throw new ForbiddenException("Actor account was not found");
    const explicit = actor.permissions[0];
    const permission = explicit
      ? this.clampPermissionToRole(actor.role, scope, explicit)
      : this.defaultPermissionForRole(actor.role, scope);
    if (!permission[action]) {
      throw new ForbiddenException(`${scope} ${action.replace("can", "").toLowerCase()} access is not allowed`);
    }
  }

  private assertCanChangeBlockedStatus(actorRole: UserRole, targetRole: UserRole) {
    if (actorRole === UserRole.SUPER_ADMIN && targetRole !== UserRole.SUPER_ADMIN) return;
    if (actorRole === UserRole.ADMIN && targetRole !== UserRole.SUPER_ADMIN && targetRole !== UserRole.ADMIN) {
      return;
    }

    if (targetRole === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException("SUPER_ADMIN accounts cannot be blocked");
    }
    if (targetRole === UserRole.ADMIN) {
      throw new ForbiddenException("ADMIN accounts can be blocked only by a SUPER_ADMIN policy decision");
    }
    throw new ForbiddenException("Only ADMIN or SUPER_ADMIN can block or unblock accounts");
  }

  async updateUserRole(uuid: string, role: UserRole, actorUserId: number) {
    const actor = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: { role: true },
    });
    if (!actor) {
      throw new ForbiddenException("Actor account was not found");
    }
    this.assertCanAssignRole(actor.role, role);

    const user = await this.prisma.user.findUnique({ where: { uuid } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return this.prisma.user.update({
      where: { uuid },
      data: { role },
      select: {
        uuid: true,
        email: true,
        name: true,
        role: true,
        updatedAt: true,
      },
    });
  }

  async getUserByUuid(uuid: string) {
    const user = await this.prisma.user.findUnique({
      where: { uuid },
      select: {
        id: true,
        uuid: true,
        telegramId: true,
        name: true,
        email: true,
        role: true,
        accountStatus: true,
        emailVerifiedAt: true,
        deletionScheduledAt: true,
        createdAt: true,
        updatedAt: true,
        passwordHash: true,
        favoriteCategories: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            createdAt: true,
            category: {
              select: { id: true, slug: true, name: true, icon: true },
            },
          },
        },
        companyLinks: {
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            balance: true,
            pointsToNextReward: true,
            expiringPoints: true,
            expiringDate: true,
            createdAt: true,
            updatedAt: true,
            company: {
              select: {
                slug: true,
                name: true,
                category: { select: { slug: true, name: true } },
              },
            },
          },
        },
        subscriptions: {
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            status: true,
            activatedAt: true,
            expiresAt: true,
            willAutoRenew: true,
            createdAt: true,
            updatedAt: true,
            subscription: {
              select: {
                uuid: true,
                slug: true,
                name: true,
                price: true,
                renewalPeriod: true,
                company: { select: { name: true } },
                category: { select: { name: true } },
              },
            },
          },
        },
        refreshTokens: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            expiresAt: true,
            createdAt: true,
            revokedAt: true,
          },
        },
        oauthAccounts: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            provider: true,
            providerAccountId: true,
            scope: true,
            expiresAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        loginEvents: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            ipAddress: true,
            countryCode: true,
            city: true,
            userAgent: true,
            deviceLabel: true,
            createdAt: true,
          },
        },
        loyaltyTransactions: {
          orderBy: { occurredAt: "desc" },
          take: 50,
          select: {
            uuid: true,
            type: true,
            status: true,
            amount: true,
            description: true,
            occurredAt: true,
            company: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        },
        targetAuditEvents: {
          where: {
            tags: { has: "CRITICAL_ACTION" },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            action: true,
            details: true,
            category: true,
            level: true,
            result: true,
            tags: true,
            actorLabel: true,
            ipAddress: true,
            countryCode: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const countryFrequency = new Map<string, number>();
    for (const event of user.loginEvents) {
      const key = (event.countryCode ?? "unknown").toUpperCase();
      countryFrequency.set(key, (countryFrequency.get(key) ?? 0) + 1);
    }
    const primaryCountry =
      [...countryFrequency.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const latestCountry =
      (user.loginEvents[0]?.countryCode ?? null)?.toUpperCase() ?? null;
    const unusualCountries = [...countryFrequency.keys()].filter(
      (c) => primaryCountry && c !== primaryCountry && c !== "UNKNOWN",
    );

    return {
      ...user,
      telegramId: user.telegramId?.toString() ?? null,
      hasPassword: Boolean(user.passwordHash),
      passwordHash: undefined,
      loginRisk: {
        primaryCountry,
        latestCountry,
        unusualCountries,
        shouldReview:
          Boolean(primaryCountry && latestCountry && latestCountry !== primaryCountry) ||
          unusualCountries.length > 0,
      },
      criticalActions: user.targetAuditEvents,
    };
  }

  async updateUserByUuid(uuid: string, dto: UpdateUserDto, actorUserId?: number) {
    const existing = await this.prisma.user.findUnique({ where: { uuid } });
    if (!existing) {
      throw new NotFoundException("User not found");
    }
    const actor = actorUserId
      ? await this.prisma.user.findUnique({
          where: { id: actorUserId },
          select: { id: true, role: true, email: true },
        })
      : null;

    const updateData: Prisma.UserUpdateInput = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name.trim();
    }
    if (dto.role !== undefined) {
      if (!actor) {
        throw new ForbiddenException("Actor account was not found");
      }
      this.assertCanAssignRole(actor.role, dto.role);
      updateData.role = dto.role;
    }
    if (dto.accountStatus !== undefined) {
      const nextStatus = dto.accountStatus as AccountStatus;
      const nextStatusValue = String(dto.accountStatus);
      const statusChanges = nextStatus !== existing.accountStatus;
      if (statusChanges && !actor) {
        throw new ForbiddenException("Actor account was not found");
      }
      const touchesBlockedStatus =
        nextStatusValue === "BLOCKED" ||
        (String(existing.accountStatus) === "BLOCKED" && nextStatusValue !== "BLOCKED");
      if (touchesBlockedStatus && actor) {
        this.assertCanChangeBlockedStatus(actor.role, existing.role);
      }
      if (
        statusChanges &&
        !touchesBlockedStatus &&
        this.isAdminWorkspaceRole(existing.role) &&
        actor?.role !== UserRole.SUPER_ADMIN
      ) {
        throw new ForbiddenException("Only SUPER_ADMIN can freeze or reactivate admin workspace accounts");
      }
      updateData.accountStatus = nextStatus;
      if (nextStatus === AccountStatus.BLOCKED || nextStatus === AccountStatus.ACTIVE) {
        updateData.deletionScheduledAt = null;
      }
    }
    if (dto.emailVerifiedAt !== undefined) {
      updateData.emailVerifiedAt =
        dto.emailVerifiedAt === null || dto.emailVerifiedAt === ""
          ? null
          : new Date(dto.emailVerifiedAt);
    }
    if (dto.createdAt !== undefined && dto.createdAt !== null && dto.createdAt !== "") {
      updateData.createdAt = new Date(dto.createdAt);
    }

    const shouldRecordFreezeAudit =
      dto.accountStatus === AccountStatus.FROZEN_PENDING_DELETION &&
      existing.accountStatus !== AccountStatus.FROZEN_PENDING_DELETION;
    const shouldRecordBlockAudit =
      dto.accountStatus === AccountStatus.BLOCKED &&
      existing.accountStatus !== AccountStatus.BLOCKED;

    try {
      await this.prisma.user.update({
        where: { uuid },
        data: updateData,
      });
      if (dto.accountStatus === AccountStatus.BLOCKED) {
        await this.prisma.refreshToken.updateMany({
          where: { userId: existing.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("A user with this email or telegram id already exists");
      }
      throw error;
    }

    if (shouldRecordFreezeAudit) {
      await this.createAuditEvent({
        workspace: AuditWorkspace.MANAGER,
        category: AuditCategory.SECURITY,
        level: AuditLevel.CRITICAL,
        action: "Account frozen by admin",
        details: "User account was set to FROZEN_PENDING_DELETION via admin panel.",
        actorUserId: actorUserId ?? null,
        targetUserId: existing.id,
        targetLabel: existing.name,
        targetEmail: existing.email,
        targetUuid: existing.uuid,
        tags: ["CRITICAL_ACTION", "SECURITY", "USER", "FREEZE"],
      });
    }
    if (shouldRecordBlockAudit) {
      await this.createAuditEvent({
        workspace: AuditWorkspace.MANAGER,
        category: AuditCategory.SECURITY,
        level: AuditLevel.CRITICAL,
        action: "Account blocked by super admin",
        details: "User account was set to BLOCKED. All active refresh sessions were revoked.",
        actorUserId: actorUserId ?? null,
        targetUserId: existing.id,
        targetLabel: existing.name,
        targetEmail: existing.email,
        targetUuid: existing.uuid,
        tags: ["CRITICAL_ACTION", "SECURITY", "USER", "BLOCK"],
      });
    }

    return this.getUserByUuid(uuid);
  }

  async blockUserAccountByUuid(uuid: string, actorUserId: number, reason?: string) {
    const [actor, target] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: actorUserId }, select: { id: true, role: true, email: true } }),
      this.prisma.user.findUnique({ where: { uuid }, select: { id: true, uuid: true, email: true, name: true, role: true, accountStatus: true } }),
    ]);
    if (!actor) {
      throw new ForbiddenException("Actor account was not found");
    }
    if (!target) {
      throw new NotFoundException("User not found");
    }
    this.assertCanChangeBlockedStatus(actor.role, target.role);

    const cleanReason = reason?.trim().slice(0, 1000) || "No reason provided.";
    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { uuid },
        data: {
          accountStatus: AccountStatus.BLOCKED,
          deletionScheduledAt: null,
        },
        select: {
          uuid: true,
          email: true,
          name: true,
          role: true,
          accountStatus: true,
          updatedAt: true,
        },
      });
      await tx.refreshToken.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          workspace: AuditWorkspace.MANAGER,
          category: AuditCategory.SECURITY,
          level: AuditLevel.CRITICAL,
          action: "Account blocked by super admin",
          details: cleanReason,
          actorUserId: actor.id,
          actorLabel: actor.email,
          targetUserId: target.id,
          targetLabel: target.name,
          targetEmail: target.email,
          targetUuid: target.uuid,
          tags: ["CRITICAL_ACTION", "SECURITY", "USER", "BLOCK"],
          result: AuditResult.BLOCKED,
        },
      });
      return user;
    });

    return {
      ...updated,
      realtime: {
        event: "account_blocked",
        requiredClientAction: "clear_tokens_and_lock_screen",
      },
    };
  }

  async reactivateUserAccountByUuid(uuid: string, actorUserId: number) {
    const [user, actor] = await Promise.all([
      this.prisma.user.findUnique({ where: { uuid } }),
      this.prisma.user.findUnique({ where: { id: actorUserId }, select: { role: true } }),
    ]);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    if (!actor) {
      throw new ForbiddenException("Actor account was not found");
    }
    if (this.isAdminWorkspaceRole(user.role) && actor.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException("Only SUPER_ADMIN can reactivate admin workspace accounts");
    }
    return this.prisma.user.update({
      where: { uuid },
      data: {
        accountStatus: AccountStatus.ACTIVE,
        deletionScheduledAt: null,
      },
      select: {
        uuid: true,
        accountStatus: true,
        deletionScheduledAt: true,
        updatedAt: true,
      },
    });
  }

  async requestEmailChange(uuid: string, actorUserId: number, newEmailRaw: string) {
    const target = await this.prisma.user.findUnique({ where: { uuid } });
    if (!target) {
      throw new NotFoundException("User not found");
    }

    const newEmail = newEmailRaw.trim().toLowerCase();
    if (!newEmail) {
      throw new BadRequestException("New email is required");
    }
    if (newEmail === target.email) {
      throw new BadRequestException("New email must be different from current email");
    }

    const existing = await this.prisma.user.findUnique({ where: { email: newEmail } });
    if (existing) {
      throw new ConflictException("This email is already in use");
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresInHours = Number(this.config.get("EMAIL_CHANGE_TOKEN_HOURS") ?? 24);
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    await this.prisma.$transaction([
      this.prisma.emailChangeRequest.updateMany({
        where: { userId: target.id, usedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.emailChangeRequest.create({
        data: {
          tokenHash,
          userId: target.id,
          requestedByUserId: actorUserId,
          oldEmail: target.email,
          newEmail,
          expiresAt,
        },
      }),
    ]);

    const frontendOrigin = this.config.get("FRONTEND_ORIGIN") ?? "http://localhost:3000";
    const confirmUrl = `${frontendOrigin}/email-change/confirm?token=${rawToken}`;

    // Placeholder transport: integrate with real SMTP/provider webhook when available.
    // We still return success and (in non-production) preview URL for manual verification.
    if (process.env.NODE_ENV !== "test") {
      console.info(`[email-change] send to ${newEmail}: ${confirmUrl}`);
    }

    await this.createAuditEvent({
      workspace: AuditWorkspace.MANAGER,
      category: AuditCategory.SECURITY,
      level: AuditLevel.CRITICAL,
      action: "Email change recovery link sent",
      details: "Admin initiated secure email change confirmation flow.",
      actorUserId,
      targetUserId: target.id,
      targetLabel: target.name,
      targetEmail: target.email,
      targetUuid: target.uuid,
      tags: ["CRITICAL_ACTION", "SECURITY", "USER", "EMAIL_CHANGE"],
      linkUrl: process.env.NODE_ENV === "production" ? null : confirmUrl,
      linkLabel: process.env.NODE_ENV === "production" ? null : "Dev preview link",
    });

    return {
      success: true as const,
      sentTo: newEmail,
      expiresAt: expiresAt.toISOString(),
      ...(process.env.NODE_ENV === "production" ? {} : { previewUrl: confirmUrl }),
    };
  }

  async deleteUserByUuid(uuid: string, actorUserId: number) {
    const user = await this.prisma.user.findUnique({ where: { uuid } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    if (user.id === actorUserId) {
      throw new BadRequestException("You cannot delete your own admin account.");
    }

    await this.prisma.user.delete({ where: { uuid } });
    return { success: true as const };
  }

  async forceLogoutUserSessions(uuid: string, actorUserId: number) {
    const target = await this.prisma.user.findUnique({ where: { uuid } });
    if (!target) {
      throw new NotFoundException("User not found");
    }
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId: target.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.createAuditEvent({
      workspace: AuditWorkspace.MANAGER,
      category: AuditCategory.SECURITY,
      level: AuditLevel.CRITICAL,
      action: "Force logout executed",
      details: `Revoked ${result.count} active refresh token(s).`,
      actorUserId,
      targetUserId: target.id,
      targetLabel: target.name,
      targetEmail: target.email,
      targetUuid: target.uuid,
      tags: ["CRITICAL_ACTION", "SECURITY", "USER", "FORCE_LOGOUT"],
    });
    return { success: true as const, revokedSessions: result.count };
  }

  async listCategories() {
    return this.prisma.category.findMany({
      orderBy: { name: "asc" },
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    const slug = await this.createUniqueCategorySlug(dto.slug || dto.name);
    return this.prisma.category.create({
      data: {
        slug,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        icon: dto.icon.trim(),
      },
    });
  }

  async updateCategory(id: number, dto: UpdateCategoryDto) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Category not found");
    const slug =
      dto.slug !== undefined ? await this.createUniqueCategorySlug(dto.slug, existing.id) : undefined;
    return this.prisma.category.update({
      where: { id },
      data: {
        ...(slug !== undefined ? { slug } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon.trim() } : {}),
      },
    });
  }

  async deleteCategory(id: number) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Category not found");
    const companyRefs = await this.prisma.company.count({ where: { categoryId: id } });
    const companyCategoryRefs = await this.prisma.companyCategory.count({ where: { categoryId: id } });
    if (companyRefs > 0 || companyCategoryRefs > 0) {
      throw new BadRequestException("Cannot delete category linked to companies.");
    }
    await this.prisma.category.delete({ where: { id } });
    return { success: true as const };
  }

  async listCompanyUsers(query?: string) {
    const q = query?.trim();
    const where = {
      role: UserRole.COMPANY,
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" as const } },
              { name: { contains: q, mode: "insensitive" as const } },
              { uuid: { contains: q } },
            ],
          }
        : {}),
    } satisfies Prisma.UserWhereInput;

    try {
      return await this.prisma.user.findMany({
        where,
        select: {
          id: true,
          uuid: true,
          name: true,
          email: true,
          role: true,
          accountStatus: true,
          emailVerifiedAt: true,
          createdAt: true,
          updatedAt: true,
          managedCompany: {
            select: {
              id: true,
              slug: true,
              name: true,
              isActive: true,
              operatesOnline: true,
              category: { select: { id: true, name: true } },
              categories: {
                select: {
                  categoryId: true,
                  category: { select: { id: true, name: true, slug: true, icon: true } },
                },
              },
              locations: {
                orderBy: [{ isMain: "desc" }, { createdAt: "asc" }],
              },
              subscriptionSpendPolicy: true,
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
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2022"
      ) {
        const fallbackRows = await this.prisma.user.findMany({
          where,
          select: {
            id: true,
            uuid: true,
            name: true,
            email: true,
            role: true,
            accountStatus: true,
            emailVerifiedAt: true,
            createdAt: true,
            updatedAt: true,
            managedCompany: {
              select: {
                id: true,
                slug: true,
                name: true,
                isActive: true,
                category: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 200,
        });

        return fallbackRows.map((row) => ({
          ...row,
          managedCompany: row.managedCompany
            ? {
                ...row.managedCompany,
                categories: [],
                operatesOnline: false,
                subscriptionSpendPolicy: SubscriptionSpendPolicy.EXCLUDE,
                levelRules: [],
              }
            : null,
        }));
      }
      throw error;
    }
  }

  async getCompanyUserByUuid(uuid: string) {
    const user = await this.prisma.user.findUnique({
      where: { uuid },
      select: {
        id: true,
        uuid: true,
        name: true,
        email: true,
        role: true,
        accountStatus: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
        managedCompany: {
          include: {
            category: true,
            categories: {
              include: {
                category: true,
              },
            },
            levelRules: {
              orderBy: { sortOrder: "asc" },
            },
            locations: {
              orderBy: [{ isMain: "desc" }, { createdAt: "asc" }],
            },
            subscriptions: {
              orderBy: { createdAt: "desc" },
              include: { entitlements: { orderBy: { createdAt: "asc" } } },
            },
          },
        },
      },
    });
    if (!user || user.role !== UserRole.COMPANY) {
      throw new NotFoundException("Company user not found");
    }
    return user;
  }

  async updateCompanyUserByUuid(uuid: string, dto: UpdateCompanyUserDto, actorUserId?: number) {
    const user = await this.prisma.user.findUnique({ where: { uuid } });
    if (!user || user.role !== UserRole.COMPANY) {
      throw new NotFoundException("Company user not found");
    }
    const updated = await this.prisma.user.update({
      where: { uuid },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.accountStatus !== undefined ? { accountStatus: dto.accountStatus } : {}),
        ...(dto.emailVerifiedAt !== undefined
          ? {
              emailVerifiedAt:
                dto.emailVerifiedAt === null || dto.emailVerifiedAt === ""
                  ? null
                  : new Date(dto.emailVerifiedAt),
            }
          : {}),
        ...(dto.createdAt !== undefined && dto.createdAt !== null && dto.createdAt !== ""
          ? { createdAt: new Date(dto.createdAt) }
          : {}),
      },
      include: { managedCompany: true },
    });
    await this.recordManagerCompanyChangeWarning(actorUserId, {
      action: "Manager changed company user account",
      details: `Manager updated company user fields: ${Object.keys(dto).join(", ") || "unknown"}.`,
      targetUuid: uuid,
      targetLabel: updated.managedCompany?.name ?? updated.name,
      category: AuditCategory.USER,
    });
    return updated;
  }

  async deleteCompanyUserByUuid(uuid: string, actorUserId: number) {
    const user = await this.prisma.user.findUnique({ where: { uuid }, include: { managedCompany: true } });
    if (!user || user.role !== UserRole.COMPANY) {
      throw new NotFoundException("Company user not found");
    }
    if (user.id === actorUserId) {
      throw new BadRequestException("You cannot delete your own account.");
    }
    if (user.managedCompany) {
      const subCount = await this.prisma.subscription.count({ where: { companyId: user.managedCompany.id } });
      if (subCount > 0) {
        throw new BadRequestException("Delete company subscriptions first.");
      }
      await this.prisma.company.delete({ where: { id: user.managedCompany.id } });
    }
    await this.prisma.user.delete({ where: { uuid } });
    return { success: true as const };
  }

  async upsertCompanyProfile(uuid: string, dto: UpsertCompanyProfileDto, actorUserId?: number) {
    const user = await this.requireCompanyUser(uuid);
    const categoryIds = this.normalizeCompanyCategoryIds(dto);
    const levelRules = this.normalizeLevelRules(
      dto.levelRules ??
        user.managedCompany?.levelRules?.map((rule) => ({
          levelName: rule.levelName,
          minTotalSpend: Number(rule.minTotalSpend),
          cashbackPercent: Number(rule.cashbackPercent),
        })),
    );
    const subscriptionSpendPolicy =
      (dto.subscriptionSpendPolicy as SubscriptionSpendPolicy | undefined) ??
      user.managedCompany?.subscriptionSpendPolicy ??
      SubscriptionSpendPolicy.EXCLUDE;
    const minRedeem = Number(
      dto.pointsPerReward ?? user.managedCompany?.pointsPerReward ?? 100,
    );
    if (!Number.isFinite(minRedeem) || minRedeem < 1) {
      throw new BadRequestException("Min redeem must be at least 1.");
    }
    const primaryCategoryId = categoryIds[0];
    const slugBase = dto.slug || dto.name;
    const slug = await this.createUniqueCompanySlug(slugBase, user.managedCompany?.id);
    if (!slug) throw new BadRequestException("Company slug is invalid.");
    const existingCategories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true },
    });
    if (existingCategories.length !== categoryIds.length) {
      throw new NotFoundException("One or more categories not found");
    }

    if (user.managedCompany) {
      const result = await this.prisma.$transaction(async (tx) => {
        const company = await tx.company.update({
          where: { id: user.managedCompany!.id },
          data: {
            name: dto.name.trim(),
            slug,
            description: dto.description?.trim() || null,
            categoryId: primaryCategoryId,
            pointsPerReward: minRedeem,
            subscriptionSpendPolicy,
            isActive: dto.isActive ?? true,
            operatesOnline: dto.operatesOnline ?? user.managedCompany!.operatesOnline ?? false,
          },
        });
        await tx.companyCategory.deleteMany({ where: { companyId: company.id } });
        await tx.companyCategory.createMany({
          data: categoryIds.map((categoryId) => ({ companyId: company.id, categoryId })),
          skipDuplicates: true,
        });
        await tx.companyLevelRule.deleteMany({ where: { companyId: company.id } });
        await tx.companyLevelRule.createMany({
          data: levelRules.map((rule, index) => ({
            companyId: company.id,
            levelName: rule.levelName,
            minTotalSpend: new Prisma.Decimal(rule.minTotalSpend),
            cashbackPercent: new Prisma.Decimal(rule.cashbackPercent),
            sortOrder: index + 1,
          })),
        });
        return tx.company.findUnique({
          where: { id: company.id },
          include: {
            category: true,
            categories: { include: { category: true } },
            levelRules: { orderBy: { sortOrder: "asc" } },
          },
        });
      });
      await this.recordManagerCompanyChangeWarning(actorUserId, {
        action: "Manager changed company profile",
        details: `Manager updated company profile "${dto.name}". Admin review is recommended.`,
        targetUuid: uuid,
        targetLabel: result?.name ?? dto.name,
      });
      return result;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: dto.name.trim(),
          slug,
          description: dto.description?.trim() || null,
          categoryId: primaryCategoryId,
          pointsPerReward: minRedeem,
          subscriptionSpendPolicy,
          isActive: dto.isActive ?? true,
          operatesOnline: dto.operatesOnline ?? false,
          ownerUserId: user.id,
        },
      });
      await tx.companyCategory.createMany({
        data: categoryIds.map((categoryId) => ({ companyId: company.id, categoryId })),
        skipDuplicates: true,
      });
      await tx.companyLevelRule.createMany({
        data: levelRules.map((rule, index) => ({
          companyId: company.id,
          levelName: rule.levelName,
          minTotalSpend: new Prisma.Decimal(rule.minTotalSpend),
          cashbackPercent: new Prisma.Decimal(rule.cashbackPercent),
          sortOrder: index + 1,
        })),
      });
      return tx.company.findUnique({
        where: { id: company.id },
        include: {
          category: true,
          categories: { include: { category: true } },
          levelRules: { orderBy: { sortOrder: "asc" } },
        },
      });
    });
    await this.recordManagerCompanyChangeWarning(actorUserId, {
      action: "Manager created company profile",
      details: `Manager created company profile "${dto.name}". Admin review is recommended.`,
      targetUuid: uuid,
      targetLabel: result?.name ?? dto.name,
    });
    return result;
  }

  async listCompanySubscriptions(companyUserUuid: string) {
    const user = await this.requireCompanyUser(companyUserUuid);
    if (!user.managedCompany) {
      return [];
    }
    return this.prisma.subscription.findMany({
      where: { companyId: user.managedCompany.id },
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        entitlements: { orderBy: { createdAt: "asc" } },
      },
    });
  }

  private async geocodeCompanyAddress(address: string) {
    const apiKey =
      this.config.get<string>("YANDEX_GEOCODER_API_KEY") ??
      this.config.get<string>("NEXT_PUBLIC_YANDEX_MAPS_API_KEY");
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
    const referer = this.config.get<string>("FRONTEND_ORIGIN") ?? "http://localhost:3000";
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
              name?: string;
              description?: string;
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
        source: "admin-map-picker",
        latitude,
        longitude,
        address: dto.address.trim(),
        city: dto.city?.trim() || null,
      } as Prisma.InputJsonValue,
    };
  }

  private async ensureSingleMainLocation(companyId: number, locationId: number) {
    await this.prisma.companyLocation.updateMany({
      where: { companyId, id: { not: locationId } },
      data: { isMain: false },
    });
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

  async createCompanyLocation(companyUserUuid: string, dto: UpsertCompanyLocationDto, actorUserId?: number) {
    const user = await this.requireCompanyUser(companyUserUuid);
    if (!user.managedCompany) {
      throw new BadRequestException("Company profile must exist before adding locations.");
    }
    const address = dto.address.trim();
    const geocoded = this.mapPickedCompanyAddress(dto) ?? (await this.geocodeCompanyAddress(address));
    await this.assertUniqueCompanyLocationAddress(user.managedCompany.id, geocoded.formattedAddress);
    const openTime = dto.openTime ?? "09:00";
    const closeTime = dto.closeTime ?? "21:00";
    this.assertValidLocationTime(openTime, "Open time");
    this.assertValidLocationTime(closeTime, "Close time");
    const shouldBeMain =
      dto.isMain ??
      ((await this.prisma.companyLocation.count({ where: { companyId: user.managedCompany.id } })) === 0);
    const location = await this.prisma.companyLocation.create({
      data: {
        companyId: user.managedCompany.id,
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
    if (location.isMain) await this.ensureSingleMainLocation(user.managedCompany.id, location.id);
    await this.recordManagerCompanyChangeWarning(actorUserId, {
      action: "Manager created company location",
      details: `Manager added location "${location.title ?? location.address}".`,
      targetUuid: companyUserUuid,
      targetLabel: user.managedCompany.name,
    });
    return location;
  }

  async updateCompanyLocation(
    companyUserUuid: string,
    locationUuid: string,
    dto: UpsertCompanyLocationDto,
    actorUserId?: number,
  ) {
    const user = await this.requireCompanyUser(companyUserUuid);
    if (!user.managedCompany) {
      throw new BadRequestException("Company profile must exist before editing locations.");
    }
    const existing = await this.prisma.companyLocation.findUnique({ where: { uuid: locationUuid } });
    if (!existing || existing.companyId !== user.managedCompany.id) {
      throw new NotFoundException("Company location not found.");
    }

    const nextAddress = dto.address.trim();
    const geocoded = this.mapPickedCompanyAddress(dto) ?? (nextAddress !== existing.address ? await this.geocodeCompanyAddress(nextAddress) : null);
    const nextFormattedAddress = geocoded?.formattedAddress ?? nextAddress;
    await this.assertUniqueCompanyLocationAddress(user.managedCompany.id, nextFormattedAddress, existing.id);
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
    if (location.isMain) await this.ensureSingleMainLocation(user.managedCompany.id, location.id);
    await this.recordManagerCompanyChangeWarning(actorUserId, {
      action: "Manager changed company location",
      details: `Manager updated location "${location.title ?? location.address}".`,
      targetUuid: locationUuid,
      targetLabel: user.managedCompany.name,
    });
    return location;
  }

  async deleteCompanyLocation(companyUserUuid: string, locationUuid: string, actorUserId?: number) {
    const user = await this.requireCompanyUser(companyUserUuid);
    if (!user.managedCompany) {
      throw new BadRequestException("Company profile must exist before deleting locations.");
    }
    const existing = await this.prisma.companyLocation.findUnique({ where: { uuid: locationUuid } });
    if (!existing || existing.companyId !== user.managedCompany.id) {
      throw new NotFoundException("Company location not found.");
    }
    await this.prisma.companyLocation.delete({ where: { uuid: locationUuid } });
    if (existing.isMain) {
      const nextMain = await this.prisma.companyLocation.findFirst({
        where: { companyId: user.managedCompany.id, isActive: true },
        orderBy: { createdAt: "asc" },
      });
      if (nextMain) {
        await this.prisma.companyLocation.update({ where: { id: nextMain.id }, data: { isMain: true } });
      }
    }
    await this.recordManagerCompanyChangeWarning(actorUserId, {
      action: "Manager deleted company location",
      details: `Manager deleted location "${existing.title ?? existing.address}".`,
      targetUuid: locationUuid,
      targetLabel: user.managedCompany.name,
    });
    return { success: true as const };
  }

  async listCompanyClients(
    companyUserUuid: string,
    query?: string,
    page = 1,
    limit = 20,
    sortBy: "name" | "email" | "balance" | "earned" | "spent" | "level" | "updatedAt" = "updatedAt",
    sortDir: "asc" | "desc" = "desc",
  ) {
    const user = await this.requireCompanyUser(companyUserUuid);
    if (!user.managedCompany) {
      return {
        items: [],
        total: 0,
        page: 1,
        limit: Math.max(1, Math.min(100, Number(limit) || 20)),
        totalPages: 0,
        sortBy,
        sortDir,
      };
    }

    const q = query?.trim();
    const companyId = user.managedCompany.id;
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const safePage = Math.max(1, Number(page) || 1);
    const direction = sortDir === "asc" ? 1 : -1;

    const [links, groupedTransactions, levelRules] = await Promise.all([
      this.prisma.userCompany.findMany({
        where: {
          companyId,
          ...(q
            ? {
                user: {
                  OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    { email: { contains: q, mode: "insensitive" } },
                    { uuid: { contains: q } },
                  ],
                },
              }
            : {}),
        },
        orderBy: { updatedAt: "desc" },
        include: {
          user: {
            select: {
              uuid: true,
              name: true,
              email: true,
              accountStatus: true,
              createdAt: true,
            },
          },
        },
        take: 500,
      }),
      this.prisma.loyaltyTransaction.groupBy({
        by: ["userId", "type"],
        where: {
          companyId,
          ...(q
            ? {
                user: {
                  OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    { email: { contains: q, mode: "insensitive" } },
                    { uuid: { contains: q } },
                  ],
                },
              }
            : {}),
        },
        _sum: {
          amount: true,
        },
      }),
      this.prisma.companyLevelRule.findMany({
        where: { companyId },
        orderBy: { sortOrder: "asc" },
        select: {
          levelName: true,
          minTotalSpend: true,
          cashbackPercent: true,
        },
      }),
    ]);

    const totalsByUser = new Map<number, { earned: number; spent: number }>();
    for (const row of groupedTransactions) {
      const current = totalsByUser.get(row.userId) ?? { earned: 0, spent: 0 };
      const sumAmount = Number(row._sum.amount ?? 0);
      if (row.type === "EARN") current.earned += sumAmount;
      if (row.type === "SPEND") current.spent += sumAmount;
      totalsByUser.set(row.userId, current);
    }

    const items = links.map((link) => {
      const totals = totalsByUser.get(link.userId) ?? { earned: 0, spent: 0 };
      const level =
        [...levelRules]
          .reverse()
          .find((rule) => totals.spent >= Number(rule.minTotalSpend)) ?? null;

      return {
        userId: link.userId,
        userUuid: link.user.uuid,
        name: link.user.name,
        email: link.user.email,
        accountStatus: link.user.accountStatus,
        userCreatedAt: link.user.createdAt,
        linkCreatedAt: link.createdAt,
        linkUpdatedAt: link.updatedAt,
        balance: link.balance,
        totalEarnedPoints: totals.earned,
        totalSpentPoints: totals.spent,
        currentLevel: level
          ? {
              levelName: level.levelName,
              cashbackPercent: Number(level.cashbackPercent),
            }
          : null,
      };
    });

    const sorted = [...items].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name) * direction;
      if (sortBy === "email") return a.email.localeCompare(b.email) * direction;
      if (sortBy === "balance") return (a.balance - b.balance) * direction;
      if (sortBy === "earned") return (a.totalEarnedPoints - b.totalEarnedPoints) * direction;
      if (sortBy === "spent") return (a.totalSpentPoints - b.totalSpentPoints) * direction;
      if (sortBy === "level") {
        return (
          ((a.currentLevel?.cashbackPercent ?? -1) - (b.currentLevel?.cashbackPercent ?? -1)) *
          direction
        );
      }
      return (
        (new Date(a.linkUpdatedAt).getTime() - new Date(b.linkUpdatedAt).getTime()) * direction
      );
    });

    const total = sorted.length;
    const totalPages = Math.ceil(total / safeLimit);
    const start = (safePage - 1) * safeLimit;

    return {
      items: sorted.slice(start, start + safeLimit),
      total,
      page: safePage,
      limit: safeLimit,
      totalPages,
      sortBy,
      sortDir,
    };
  }

  async createCompanySubscription(companyUserUuid: string, dto: CreateCompanySubscriptionDto, actorUserId?: number) {
    const user = await this.requireCompanyUser(companyUserUuid);
    if (!user.managedCompany) {
      throw new BadRequestException("Company profile must exist before creating subscriptions.");
    }
    if (!user.managedCompany.identityVerificationCompleted) {
      throw new BadRequestException("Full identity verification is required before creating subscriptions.");
    }
    const slug = await this.createUniqueSubscriptionSlug(dto.slug || dto.name);
    if (!slug) throw new BadRequestException("Subscription slug is invalid.");

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!category) throw new NotFoundException("Category not found");
    }

    const renewalValue = dto.renewalValue ?? 1;
    const renewalUnit = this.parseRenewalUnit(dto.renewalUnit ?? "month");
    const promoBonusDays = Math.max(0, dto.promoBonusDays ?? 0);
    const promoEndsAt = dto.promoEndsAt ? new Date(dto.promoEndsAt) : null;
    const renewalPeriod =
      dto.renewalPeriod?.trim() ||
      this.buildRenewalLabel(renewalValue, renewalUnit, promoBonusDays);

    const subscription = await this.prisma.subscription.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description.trim(),
        price: new Prisma.Decimal(dto.price),
        renewalPeriod,
        renewalValue,
        renewalUnit,
        promoBonusDays,
        promoEndsAt,
        companyId: user.managedCompany.id,
        categoryId: dto.categoryId ?? user.managedCompany.categoryId,
      },
      include: { category: true, company: true, entitlements: true },
    });
    await this.recordManagerCompanyChangeWarning(actorUserId, {
      action: "Manager created company subscription",
      details: `Manager created subscription "${subscription.name}" for ${subscription.price.toString()}.`,
      targetUuid: subscription.uuid,
      targetLabel: subscription.name,
      category: AuditCategory.SUBSCRIPTION,
    });
    return subscription;
  }

  async updateCompanySubscription(
    companyUserUuid: string,
    subscriptionUuid: string,
    dto: UpdateCompanySubscriptionDto,
    actorUserId?: number,
  ) {
    const user = await this.requireCompanyUser(companyUserUuid);
    if (!user.managedCompany) {
      throw new BadRequestException("Company profile must exist before managing subscriptions.");
    }
    const sub = await this.prisma.subscription.findUnique({
      where: { uuid: subscriptionUuid },
    });
    if (!sub || sub.companyId !== user.managedCompany.id) {
      throw new NotFoundException("Subscription not found for this company user.");
    }
    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!category) throw new NotFoundException("Category not found");
    }
    const nextSlug =
      dto.slug !== undefined
        ? await this.createUniqueSubscriptionSlug(dto.slug, sub.id)
        : undefined;
    const nextRenewalValue = dto.renewalValue ?? sub.renewalValue;
    const nextRenewalUnit = dto.renewalUnit
      ? this.parseRenewalUnit(dto.renewalUnit)
      : AdminService.RENEWAL_UNITS.includes((sub.renewalUnit ?? "").toLowerCase() as never)
        ? ((sub.renewalUnit ?? "").toLowerCase() as "week" | "month" | "year")
        : "month";
    const nextPromoBonusDays = dto.promoBonusDays ?? sub.promoBonusDays ?? 0;
    const nextPromoEndsAt =
      dto.promoEndsAt === undefined
        ? sub.promoEndsAt
        : dto.promoEndsAt
          ? new Date(dto.promoEndsAt)
          : null;
    const nextRenewalLabel =
      dto.renewalPeriod?.trim() ??
      this.buildRenewalLabel(nextRenewalValue, nextRenewalUnit, nextPromoBonusDays);
    const subscription = await this.prisma.subscription.update({
      where: { uuid: subscriptionUuid },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(nextSlug !== undefined ? { slug: nextSlug } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.price !== undefined ? { price: new Prisma.Decimal(dto.price) } : {}),
        renewalPeriod: nextRenewalLabel,
        renewalValue: nextRenewalValue,
        renewalUnit: nextRenewalUnit,
        promoBonusDays: nextPromoBonusDays,
        promoEndsAt: nextPromoEndsAt,
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        companyId: user.managedCompany.id,
      },
      include: { category: true, company: true, entitlements: true },
    });
    await this.recordManagerCompanyChangeWarning(actorUserId, {
      action: "Manager changed company subscription",
      details: `Manager updated subscription "${subscription.name}". Changed fields: ${Object.keys(dto).join(", ") || "unknown"}.`,
      targetUuid: subscription.uuid,
      targetLabel: subscription.name,
      category: AuditCategory.SUBSCRIPTION,
    });
    return subscription;
  }

  async createCompanySubscriptionEntitlement(
    companyUserUuid: string,
    subscriptionUuid: string,
    dto: CreateSubscriptionEntitlementDto,
    actorUserId?: number,
  ) {
    const user = await this.requireCompanyUser(companyUserUuid);
    if (!user.managedCompany) {
      throw new BadRequestException("Company profile must exist before managing subscriptions.");
    }
    const subscription = await this.prisma.subscription.findUnique({ where: { uuid: subscriptionUuid } });
    if (!subscription || subscription.companyId !== user.managedCompany.id) {
      throw new NotFoundException("Subscription not found for this company user.");
    }
    const unlimited = dto.windowUnit === "UNLIMITED";
    const entitlement = await this.prisma.subscriptionEntitlement.create({
      data: {
        subscriptionId: subscription.id,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        allowance: unlimited ? 1 : dto.allowance,
        windowValue: unlimited ? 1 : dto.windowValue,
        windowUnit: dto.windowUnit,
      },
    });
    await this.recordManagerCompanyChangeWarning(actorUserId, {
      action: "Manager created subscription benefit",
      details: unlimited
        ? `Added benefit "${entitlement.title}" with unlimited usage.`
        : `Added benefit "${entitlement.title}" with limit ${entitlement.allowance}/${entitlement.windowValue} ${entitlement.windowUnit}.`,
      targetUuid: subscriptionUuid,
      targetLabel: subscription.name,
      category: AuditCategory.SUBSCRIPTION,
    });
    return entitlement;
  }

  async deleteCompanySubscription(companyUserUuid: string, subscriptionUuid: string, actorUserId?: number) {
    const user = await this.requireCompanyUser(companyUserUuid);
    if (!user.managedCompany) {
      throw new BadRequestException("Company profile must exist before managing subscriptions.");
    }
    const sub = await this.prisma.subscription.findUnique({
      where: { uuid: subscriptionUuid },
    });
    if (!sub || sub.companyId !== user.managedCompany.id) {
      throw new NotFoundException("Subscription not found for this company user.");
    }
    await this.prisma.subscription.delete({ where: { uuid: subscriptionUuid } });
    await this.recordManagerCompanyChangeWarning(actorUserId, {
      action: "Manager deleted company subscription",
      details: `Manager deleted subscription "${sub.name}".`,
      targetUuid: subscriptionUuid,
      targetLabel: sub.name,
      category: AuditCategory.SUBSCRIPTION,
    });
    return { success: true as const };
  }

  private serializeSubscriptionBundle(row: {
    id: number;
    uuid: string;
    slug: string;
    name: string;
    description: string;
    price: Prisma.Decimal;
    renewalPeriod: string;
    renewalValue: number;
    renewalUnit: string;
    promoBonusDays: number;
    status: SubscriptionBundleStatus;
    isActive: boolean;
    categoryId: number | null;
    createdAt: Date;
    updatedAt: Date;
    category?: { id: number; slug: string; name: string; icon: string } | null;
    participants: Array<{
      id: number;
      companyId: number;
      benefitTitle: string;
      benefitDescription: string;
      fulfillmentNote: string | null;
      revenueSharePercent: Prisma.Decimal;
      sortOrder: number;
      company: { id: number; slug: string; name: string; isActive: boolean };
    }>;
  }) {
    return {
      ...row,
      price: row.price.toString(),
      participants: row.participants
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((participant) => ({
          ...participant,
          revenueSharePercent: participant.revenueSharePercent.toString(),
        })),
    };
  }

  async listSubscriptionBundles() {
    const bundles = await this.prisma.subscriptionBundle.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        category: { select: { id: true, slug: true, name: true, icon: true } },
        participants: {
          include: { company: { select: { id: true, slug: true, name: true, isActive: true } } },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    return bundles.map((bundle) => this.serializeSubscriptionBundle(bundle));
  }

  async searchSubscriptions(query?: string) {
    const q = query?.trim();
    const textFilter = q
      ? {
          contains: q,
          mode: Prisma.QueryMode.insensitive,
        }
      : undefined;

    const subscriptionWhere: Prisma.SubscriptionWhereInput = textFilter
      ? {
          OR: [
            { name: textFilter },
            { slug: textFilter },
            { description: textFilter },
            { company: { name: textFilter } },
            { category: { name: textFilter } },
          ],
        }
      : {};

    const bundleWhere: Prisma.SubscriptionBundleWhereInput = textFilter
      ? {
          OR: [
            { name: textFilter },
            { slug: textFilter },
            { description: textFilter },
            { category: { name: textFilter } },
            { participants: { some: { company: { name: textFilter } } } },
            { participants: { some: { benefitTitle: textFilter } } },
            { participants: { some: { benefitDescription: textFilter } } },
          ],
        }
      : {};

    const [subscriptions, bundles] = await Promise.all([
      this.prisma.subscription.findMany({
        where: subscriptionWhere,
        orderBy: { updatedAt: "desc" },
        take: 10,
        include: {
          company: { select: { id: true, slug: true, name: true } },
          category: { select: { id: true, slug: true, name: true, icon: true } },
        },
      }),
      this.prisma.subscriptionBundle.findMany({
        where: bundleWhere,
        orderBy: { updatedAt: "desc" },
        take: 10,
        include: {
          category: { select: { id: true, slug: true, name: true, icon: true } },
          participants: {
            include: { company: { select: { id: true, slug: true, name: true, isActive: true } } },
            orderBy: { sortOrder: "asc" },
          },
        },
      }),
    ]);

    const ordinaryItems = subscriptions.map((subscription) => ({
      type: "subscription" as const,
      uuid: subscription.uuid,
      slug: subscription.slug,
      name: subscription.name,
      description: subscription.description,
      price: subscription.price.toString(),
      renewalPeriod: subscription.renewalPeriod,
      isActive: subscription.isActive,
      status: subscription.isActive ? "ACTIVE" : "INACTIVE",
      updatedAt: subscription.updatedAt.toISOString(),
      company: subscription.company,
      category: subscription.category,
      participants: [],
    }));

    const bundleItems = bundles.map((bundle) => {
      const serialized = this.serializeSubscriptionBundle(bundle);
      return {
        type: "bundle" as const,
        uuid: serialized.uuid,
        slug: serialized.slug,
        name: serialized.name,
        description: serialized.description,
        price: serialized.price,
        renewalPeriod: serialized.renewalPeriod,
        isActive: serialized.isActive,
        status: serialized.status,
        updatedAt: serialized.updatedAt.toISOString(),
        company: null,
        category: serialized.category ?? null,
        participants: serialized.participants.map((participant) => ({
          companyId: participant.companyId,
          companyName: participant.company.name,
          benefitTitle: participant.benefitTitle,
          revenueSharePercent: participant.revenueSharePercent,
        })),
      };
    });

    return {
      items: [...ordinaryItems, ...bundleItems]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 12),
    };
  }

  async createPairedSubscription(dto: CreatePairedSubscriptionDto, actorUserId?: number) {
    const participants = dto.participants.map((participant, index) => ({
      companyId: Number(participant.companyId),
      benefitTitle: participant.benefitTitle.trim(),
      benefitDescription: participant.benefitDescription.trim(),
      fulfillmentNote: participant.fulfillmentNote?.trim() || null,
      revenueSharePercent: Number(participant.revenueSharePercent),
      sortOrder: index + 1,
    }));

    const uniqueCompanyIds = [...new Set(participants.map((participant) => participant.companyId))];
    if (uniqueCompanyIds.length !== participants.length) {
      throw new BadRequestException("Each company can participate in a paired subscription only once.");
    }
    if (uniqueCompanyIds.length < 2) {
      throw new BadRequestException("A paired subscription requires at least two companies.");
    }

    const shareTotal = participants.reduce((sum, participant) => sum + participant.revenueSharePercent, 0);
    if (Math.round(shareTotal * 100) !== 10000) {
      throw new BadRequestException("Revenue shares must add up to 100%.");
    }

    const companies = await this.prisma.company.findMany({
      where: { id: { in: uniqueCompanyIds } },
      select: { id: true },
    });
    if (companies.length !== uniqueCompanyIds.length) {
      throw new NotFoundException("One or more companies were not found.");
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!category) throw new NotFoundException("Category not found");
    }

    const slug = await this.createUniqueSubscriptionBundleSlug(dto.slug || dto.name);
    if (!slug) throw new BadRequestException("Paired subscription slug is invalid.");

    const renewalValue = dto.renewalValue ?? 1;
    const renewalUnit = this.parseRenewalUnit(dto.renewalUnit ?? "month");
    const promoBonusDays = Math.max(0, dto.promoBonusDays ?? 0);
    const renewalPeriod = this.buildRenewalLabel(renewalValue, renewalUnit, promoBonusDays);
    const isActive = dto.isActive ?? false;

    const bundle = await this.prisma.subscriptionBundle.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description.trim(),
        price: new Prisma.Decimal(dto.price),
        renewalPeriod,
        renewalValue,
        renewalUnit,
        promoBonusDays,
        isActive,
        status: isActive ? SubscriptionBundleStatus.ACTIVE : SubscriptionBundleStatus.DRAFT,
        categoryId: dto.categoryId ?? null,
        participants: {
          create: participants.map((participant) => ({
            companyId: participant.companyId,
            benefitTitle: participant.benefitTitle,
            benefitDescription: participant.benefitDescription,
            fulfillmentNote: participant.fulfillmentNote,
            revenueSharePercent: new Prisma.Decimal(participant.revenueSharePercent),
            sortOrder: participant.sortOrder,
          })),
        },
      },
      include: {
        category: { select: { id: true, slug: true, name: true, icon: true } },
        participants: {
          include: { company: { select: { id: true, slug: true, name: true, isActive: true } } },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    await this.createAuditEvent({
      workspace: AuditWorkspace.MANAGER,
      category: AuditCategory.SUBSCRIPTION,
      level: AuditLevel.INFO,
      action: "Paired subscription created",
      details: `Created paired subscription "${bundle.name}" with ${participants.length} companies and 100% revenue split.`,
      actorUserId,
      targetUuid: bundle.uuid,
      targetLabel: bundle.name,
      tags: ["PAIRED_SUBSCRIPTION", "SUBSCRIPTION_BUNDLE"],
    });

    return this.serializeSubscriptionBundle(bundle);
  }

  async listPromoCodes() {
    const rows = await this.prisma.promoCode.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        company: { select: { id: true, slug: true, name: true } },
        subscription: { select: { uuid: true, slug: true, name: true } },
        redemptions: { select: { id: true } },
      },
    });
    return rows.map((row) => this.serializePromoCode(row));
  }

  async createPromoCode(dto: CreatePromoCodeDto) {
    const code = this.normalizePromoCode(dto.code);
    if (!code) {
      throw new BadRequestException("Promo code is required.");
    }

    const existing = await this.prisma.promoCode.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException("Promo code already exists.");
    }

    const rewardType = dto.rewardType;
    const points = Math.max(0, Number(dto.points ?? 0));
    let companyId: number | null = null;
    let subscriptionId: number | null = null;

    if (rewardType === PromoCodeRewardType.POINTS && points <= 0) {
      throw new BadRequestException("Point promo code must grant at least 1 point.");
    }
    if (rewardType === PromoCodeRewardType.POINTS) {
      if (!dto.companyUuid) {
        throw new BadRequestException("Company is required for point promo codes.");
      }
      const companyUser = await this.requireCompanyUser(dto.companyUuid);
      if (!companyUser.managedCompany) {
        throw new BadRequestException("Selected company user does not have a company profile.");
      }
      companyId = companyUser.managedCompany.id;
    }

    if (rewardType === PromoCodeRewardType.SUBSCRIPTION) {
      if (!dto.subscriptionUuid) {
        throw new BadRequestException("Subscription UUID is required for subscription promo codes.");
      }
      const subscription = await this.prisma.subscription.findUnique({
        where: { uuid: dto.subscriptionUuid },
        select: { id: true },
      });
      if (!subscription) {
        throw new NotFoundException("Subscription not found.");
      }
      subscriptionId = subscription.id;
    }

    const row = await this.prisma.promoCode.create({
      data: {
        code,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        rewardType,
        points: rewardType === PromoCodeRewardType.POINTS ? points : 0,
        companyId,
        subscriptionId,
        maxRedemptions: dto.maxRedemptions ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isActive: dto.isActive ?? true,
      },
      include: {
        company: { select: { id: true, slug: true, name: true } },
        subscription: { select: { uuid: true, slug: true, name: true } },
        redemptions: { select: { id: true } },
      },
    });

    return this.serializePromoCode(row);
  }

  async updatePromoCode(id: number, dto: Partial<CreatePromoCodeDto>) {
    const existing = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Promo code not found.");

    const nextRewardType = dto.rewardType ?? existing.rewardType;
    const nextPoints = dto.points === undefined ? existing.points : Math.max(0, Number(dto.points));
    let companyId = existing.companyId;
    let subscriptionId = existing.subscriptionId;

    if (nextRewardType === PromoCodeRewardType.POINTS && nextPoints <= 0) {
      throw new BadRequestException("Point promo code must grant at least 1 point.");
    }
    if (nextRewardType === PromoCodeRewardType.POINTS) {
      if (dto.companyUuid !== undefined) {
        const companyUser = await this.requireCompanyUser(dto.companyUuid);
        if (!companyUser.managedCompany) {
          throw new BadRequestException("Selected company user does not have a company profile.");
        }
        companyId = companyUser.managedCompany.id;
      }
      if (!companyId) {
        throw new BadRequestException("Point promo code must be linked to a company.");
      }
    } else {
      companyId = null;
    }

    if (nextRewardType === PromoCodeRewardType.SUBSCRIPTION) {
      if (dto.subscriptionUuid !== undefined) {
        const subscription = await this.prisma.subscription.findUnique({
          where: { uuid: dto.subscriptionUuid },
          select: { id: true },
        });
        if (!subscription) throw new NotFoundException("Subscription not found.");
        subscriptionId = subscription.id;
      }
      if (!subscriptionId) {
        throw new BadRequestException("Subscription promo code must be linked to a subscription.");
      }
    } else {
      subscriptionId = null;
    }

    const row = await this.prisma.promoCode.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: this.normalizePromoCode(dto.code) } : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.rewardType !== undefined ? { rewardType: dto.rewardType } : {}),
        points: nextRewardType === PromoCodeRewardType.POINTS ? nextPoints : 0,
        companyId,
        subscriptionId,
        ...(dto.maxRedemptions !== undefined ? { maxRedemptions: dto.maxRedemptions ?? null } : {}),
        ...(dto.expiresAt !== undefined ? { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: {
        company: { select: { id: true, slug: true, name: true } },
        subscription: { select: { uuid: true, slug: true, name: true } },
        redemptions: { select: { id: true } },
      },
    });

    return this.serializePromoCode(row);
  }

  private async ensureReferralCampaign() {
    const existing = await this.prisma.referralCampaign.findFirst({
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    });
    if (existing) return existing;
    return this.prisma.referralCampaign.create({ data: {} });
  }

  async getReferralCampaignAdmin() {
    const [campaign, createdInvites, redeemedInvites, rewardedInvites] = await Promise.all([
      this.prisma.referralCampaign.findFirst({
        orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
        include: { bonusCompany: { select: { id: true, slug: true, name: true } } },
      }).then((row) => row ?? this.prisma.referralCampaign.create({ data: {}, include: { bonusCompany: { select: { id: true, slug: true, name: true } } } })),
      this.prisma.referralInvite.count({ where: { status: ReferralInviteStatus.CREATED } }),
      this.prisma.referralInvite.count({ where: { status: ReferralInviteStatus.REDEEMED } }),
      this.prisma.referralInvite.count({ where: { status: ReferralInviteStatus.REWARDED } }),
    ]);
    return {
      ...campaign,
      stats: {
        createdInvites,
        redeemedInvites,
        rewardedInvites,
      },
    };
  }

  async updateReferralCampaign(dto: UpdateReferralCampaignDto) {
    const existing = await this.ensureReferralCampaign();
    let bonusCompanyId = existing.bonusCompanyId;
    if (dto.bonusCompanyUuid !== undefined) {
      if (!dto.bonusCompanyUuid) {
        bonusCompanyId = null;
      } else {
        const companyUser = await this.requireCompanyUser(dto.bonusCompanyUuid);
        if (!companyUser.managedCompany) {
          throw new BadRequestException("Selected company user does not have a company profile.");
        }
        bonusCompanyId = companyUser.managedCompany.id;
      }
    }
    const campaign = await this.prisma.referralCampaign.update({
      where: { id: existing.id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() || existing.title } : {}),
        ...(dto.inviterBonusPoints !== undefined ? { inviterBonusPoints: Math.max(0, Number(dto.inviterBonusPoints)) } : {}),
        ...(dto.invitedBonusPoints !== undefined ? { invitedBonusPoints: Math.max(0, Number(dto.invitedBonusPoints)) } : {}),
        bonusCompanyId,
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return this.getReferralCampaignAdmin().then((result) => ({ ...result, ...campaign }));
  }

  async subscriptionStats() {
    const now = new Date();
    const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const days60Ago = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const days7Ahead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      total,
      active,
      expired,
      canceled,
      totalPlans,
      activePlans,
      companyLinkedPlans,
      categoryLinkedPlans,
      expiringIn7Days,
      startedIn30Days,
      startedInPrevious30Days,
      churnedIn30Days,
      activeAssignments,
    ] = await Promise.all([
      this.prisma.userSubscription.count(),
      this.prisma.userSubscription.count({ where: { status: "ACTIVE" } }),
      this.prisma.userSubscription.count({ where: { status: "EXPIRED" } }),
      this.prisma.userSubscription.count({ where: { status: "CANCELED" } }),
      this.prisma.subscription.count(),
      this.prisma.subscription.count({ where: { isActive: true } }),
      this.prisma.subscription.count({ where: { companyId: { not: null } } }),
      this.prisma.subscription.count({ where: { categoryId: { not: null } } }),
      this.prisma.userSubscription.count({
        where: {
          status: "ACTIVE",
          expiresAt: { gte: now, lte: days7Ahead },
        },
      }),
      this.prisma.userSubscription.count({
        where: {
          activatedAt: { gte: days30Ago, lte: now },
        },
      }),
      this.prisma.userSubscription.count({
        where: {
          activatedAt: { gte: days60Ago, lt: days30Ago },
        },
      }),
      this.prisma.userSubscription.count({
        where: {
          status: { in: ["EXPIRED", "CANCELED"] },
          updatedAt: { gte: days30Ago, lte: now },
        },
      }),
      this.prisma.userSubscription.findMany({
        where: { status: "ACTIVE" },
        select: {
          subscriptionId: true,
          willAutoRenew: true,
          subscription: {
            select: {
              uuid: true,
              slug: true,
              name: true,
              price: true,
              renewalUnit: true,
              renewalValue: true,
              company: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    let autoRenewEnabled = 0;
    let estimatedMonthlyRevenue = 0;
    const planMap = new Map<
      number,
      {
        uuid: string;
        slug: string;
        name: string;
        companyName: string | null;
        activeSubscribers: number;
        estimatedMonthlyRevenue: number;
      }
    >();

    for (const row of activeAssignments) {
      if (row.willAutoRenew) {
        autoRenewEnabled += 1;
      }
      const price = Number(row.subscription.price ?? 0);
      const monthly = price * this.estimateMonthlyMultiplier(
        row.subscription.renewalUnit,
        row.subscription.renewalValue,
      );
      estimatedMonthlyRevenue += monthly;

      const existing = planMap.get(row.subscriptionId);
      if (existing) {
        existing.activeSubscribers += 1;
        existing.estimatedMonthlyRevenue += monthly;
      } else {
        planMap.set(row.subscriptionId, {
          uuid: row.subscription.uuid,
          slug: row.subscription.slug,
          name: row.subscription.name,
          companyName: row.subscription.company?.name ?? null,
          activeSubscribers: 1,
          estimatedMonthlyRevenue: monthly,
        });
      }
    }

    const topSubscriptions = [...planMap.values()]
      .sort((a, b) => {
        if (b.activeSubscribers !== a.activeSubscribers) {
          return b.activeSubscribers - a.activeSubscribers;
        }
        return b.estimatedMonthlyRevenue - a.estimatedMonthlyRevenue;
      })
      .slice(0, 5)
      .map((item) => ({
        ...item,
        estimatedMonthlyRevenue: Number(item.estimatedMonthlyRevenue.toFixed(2)),
      }));

    const activeRatePercent = total > 0 ? (active / total) * 100 : 0;
    const autoRenewRatePercent = active > 0 ? (autoRenewEnabled / active) * 100 : 0;
    const averageMonthlyRevenuePerActive = active > 0 ? estimatedMonthlyRevenue / active : 0;
    const startedGrowthPercent =
      startedInPrevious30Days > 0
        ? ((startedIn30Days - startedInPrevious30Days) / startedInPrevious30Days) * 100
        : startedIn30Days > 0
          ? 100
          : 0;
    const churnRatePercent = active > 0 ? (churnedIn30Days / active) * 100 : 0;

    const targetAutoRenewRatePercent = 75;
    const targetChurnRatePercent = 8;
    const autoRenewAttainmentPercent =
      targetAutoRenewRatePercent > 0
        ? (autoRenewRatePercent / targetAutoRenewRatePercent) * 100
        : 0;
    const churnAttainmentPercent =
      targetChurnRatePercent > 0
        ? (targetChurnRatePercent / Math.max(churnRatePercent, 0.1)) * 100
        : 0;
    const autoRenewSla =
      autoRenewRatePercent >= targetAutoRenewRatePercent
        ? "on_track"
        : autoRenewRatePercent >= targetAutoRenewRatePercent * 0.85
          ? "at_risk"
          : "off_track";
    const churnSla =
      churnRatePercent <= targetChurnRatePercent
        ? "on_track"
        : churnRatePercent <= targetChurnRatePercent * 1.3
          ? "at_risk"
          : "off_track";

    const growthSignal = (startedGrowthPercent / 100) * 0.35;
    const churnSignal = churnRatePercent / 100;
    const clamp = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(max, value));
    const baseMonthlyFactor = clamp(1 + growthSignal - churnSignal, 0.75, 1.35);
    const optimisticMonthlyFactor = clamp(baseMonthlyFactor + 0.08, 0.8, 1.5);
    const riskMonthlyFactor = clamp(baseMonthlyFactor - 0.12, 0.55, 1.2);
    const project90 = (mrr: number, factor: number) =>
      mrr * factor + mrr * factor * factor + mrr * factor * factor * factor;

    const forecast = {
      assumptions: {
        startedGrowthPercent: Number(startedGrowthPercent.toFixed(1)),
        churnRatePercent: Number(churnRatePercent.toFixed(1)),
      },
      base: {
        days30: Number((estimatedMonthlyRevenue * baseMonthlyFactor).toFixed(2)),
        days90: Number(project90(estimatedMonthlyRevenue, baseMonthlyFactor).toFixed(2)),
      },
      optimistic: {
        days30: Number((estimatedMonthlyRevenue * optimisticMonthlyFactor).toFixed(2)),
        days90: Number(project90(estimatedMonthlyRevenue, optimisticMonthlyFactor).toFixed(2)),
      },
      risk: {
        days30: Number((estimatedMonthlyRevenue * riskMonthlyFactor).toFixed(2)),
        days90: Number(project90(estimatedMonthlyRevenue, riskMonthlyFactor).toFixed(2)),
      },
    };

    const totalActiveSubscribers = topSubscriptions.reduce(
      (sum, row) => sum + row.activeSubscribers,
      0,
    );
    const totalTopRevenue = topSubscriptions.reduce(
      (sum, row) => sum + row.estimatedMonthlyRevenue,
      0,
    );
    const top1 = topSubscriptions[0];
    const top3 = topSubscriptions.slice(0, 3);
    const top3SubscriberSharePercent =
      totalActiveSubscribers > 0
        ? (top3.reduce((sum, row) => sum + row.activeSubscribers, 0) / totalActiveSubscribers) *
          100
        : 0;
    const top1RevenueSharePercent =
      totalTopRevenue > 0 && top1
        ? (top1.estimatedMonthlyRevenue / totalTopRevenue) * 100
        : 0;
    const concentrationScore = clamp(
      100 - top3SubscriberSharePercent * 0.6 - top1RevenueSharePercent * 0.4,
      0,
      100,
    );

    return {
      generatedAt: now.toISOString(),
      total,
      active,
      expired,
      canceled,
      activeRatePercent: Number(activeRatePercent.toFixed(1)),
      estimatedMonthlyRevenue: Number(estimatedMonthlyRevenue.toFixed(2)),
      averageMonthlyRevenuePerActive: Number(averageMonthlyRevenuePerActive.toFixed(2)),
      autoRenewEnabled,
      autoRenewRatePercent: Number(autoRenewRatePercent.toFixed(1)),
      expiringIn7Days,
      churnedIn30Days,
      startedIn30Days,
      startedInPrevious30Days,
      startedGrowthPercent: Number(startedGrowthPercent.toFixed(1)),
      churnRatePercent: Number(churnRatePercent.toFixed(1)),
      kpi: {
        targets: {
          autoRenewRatePercent: targetAutoRenewRatePercent,
          churnRatePercent: targetChurnRatePercent,
        },
        actual: {
          autoRenewRatePercent: Number(autoRenewRatePercent.toFixed(1)),
          churnRatePercent: Number(churnRatePercent.toFixed(1)),
        },
        attainment: {
          autoRenewPercent: Number(clamp(autoRenewAttainmentPercent, 0, 140).toFixed(1)),
          churnPercent: Number(clamp(churnAttainmentPercent, 0, 140).toFixed(1)),
        },
        sla: {
          autoRenew: autoRenewSla,
          churn: churnSla,
        },
      },
      forecast,
      concentration: {
        score: Number(concentrationScore.toFixed(1)),
        top3SubscriberSharePercent: Number(top3SubscriberSharePercent.toFixed(1)),
        top1RevenueSharePercent: Number(top1RevenueSharePercent.toFixed(1)),
      },
      catalog: {
        totalPlans,
        activePlans,
        inactivePlans: Math.max(0, totalPlans - activePlans),
        companyLinkedPlans,
        categoryLinkedPlans,
      },
      topSubscriptions,
    };
  }

  async findSubscriptionByUuid(uuid: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { uuid },
      include: {
        company: { select: { id: true, slug: true, name: true } },
        category: { select: { id: true, slug: true, name: true } },
      },
    });
    if (!sub) {
      throw new NotFoundException("Subscription not found");
    }
    return sub;
  }
}
