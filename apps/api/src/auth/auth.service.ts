import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Injectable,
  Optional,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { User, UserRole, type Prisma } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { createHash, randomBytes, randomInt } from "crypto";
import { EmailService } from "../email/email.service";
import { PrismaService } from "../prisma/prisma.service";
import { TelegramNotificationsService } from "../telegram/telegram-notifications.service";
import { ConfirmPasswordResetDto } from "./dto/confirm-password-reset.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { RegisterDto } from "./dto/register.dto";
import { RequestPasswordResetDto } from "./dto/request-password-reset.dto";
import { RequestRegistrationCodeDto } from "./dto/request-registration-code.dto";
import { VerifyRegistrationCodeDto } from "./dto/verify-registration-code.dto";
import { verifyTelegramMiniAppInitData } from "./telegram-mini-app";

/** Mirrors Prisma `AccountStatus` — string union keeps emitted `.d.ts` stable if Prisma re-exports differ. */
export type AccountStatusValue = "ACTIVE" | "FROZEN_PENDING_DELETION" | "BLOCKED";

export type SafeUser = {
  id: string;
  legacyId: number;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  accountStatus: AccountStatusValue;
  deletionScheduledAt: string | null;
};

type SafeUserSource = Pick<User, "uuid" | "id" | "email" | "name" | "role" | "createdAt" | "accountStatus" | "deletionScheduledAt">;

export type LoginContext = {
  ipAddress?: string | null;
  countryCode?: string | null;
  city?: string | null;
  userAgent?: string | null;
  deviceLabel?: string | null;
  requestId?: string | null;
};

export type EmailRequestContext = LoginContext & {
  emailGuardId?: string | null;
};

type EmailRequestGuardState = {
  firstSentAt: number;
  lastSentAt: number;
  sentCount: number;
  blockedUntil: number | null;
};

const EMAIL_REPEAT_DELAY_MS = 90_000;
const EMAIL_BLOCK_MS = 2 * 60 * 60_000;
const PASSWORD_RESET_PENDING_HASH = "PASSWORD_RESET_PENDING";
const USER_TERMS_VERSION = "2026-07-12";

@Injectable()
export class AuthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthService.name);
  private purgeTimer: NodeJS.Timeout | null = null;
  private purgeInProgress = false;
  private readonly emailRequestGuards = new Map<string, EmailRequestGuardState>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
    @Optional()
    private readonly telegramNotifications?: TelegramNotificationsService,
  ) {}

  onModuleInit() {
    const intervalMinutes = this.resolvePurgeIntervalMinutes();
    const intervalMs = intervalMinutes * 60_000;
    this.purgeTimer = setInterval(() => {
      void this.runScheduledPurge();
    }, intervalMs);
    this.purgeTimer.unref?.();
    void this.runScheduledPurge();
  }

  onModuleDestroy() {
    if (this.purgeTimer) {
      clearInterval(this.purgeTimer);
      this.purgeTimer = null;
    }
  }

  private resolvePurgeIntervalMinutes() {
    const raw = Number(this.config.get("ACCOUNT_PURGE_INTERVAL_MINUTES") ?? 60);
    if (!Number.isFinite(raw)) {
      return 60;
    }
    return Math.max(1, Math.floor(raw));
  }

  private async runScheduledPurge() {
    if (this.purgeInProgress) {
      return;
    }
    this.purgeInProgress = true;
    try {
      const [removedAccounts, removedCodes] = await Promise.all([
        this.purgeExpiredFrozenAccounts(),
        this.purgeExpiredEmailVerificationCodes(),
      ]);
      if (removedAccounts > 0) {
        this.logger.log(`Finalized ${removedAccounts} frozen account(s).`);
      }
      if (removedCodes > 0) {
        this.logger.log(`Purged ${removedCodes} expired email verification code(s).`);
      }
    } catch (error) {
      this.logger.error("Scheduled account purge failed.", error as Error);
    } finally {
      this.purgeInProgress = false;
    }
  }

  /**
   * Finalizes users that exceeded deletion recovery window.
   * We intentionally keep historical entities (transactions/audit) and only
   * remove personal access/profile data to preserve analytics integrity.
   */
  async purgeExpiredFrozenAccounts(now = new Date()) {
    const expiredUsers = await this.prisma.user.findMany({
      where: {
        accountStatus: "FROZEN_PENDING_DELETION",
        deletionScheduledAt: { lte: now },
      },
      select: { id: true, uuid: true },
      take: 500,
    });
    if (expiredUsers.length === 0) {
      return 0;
    }

    let finalized = 0;
    for (const user of expiredUsers) {
      const done = await this.finalizeExpiredFrozenAccount(user.id, now, user.uuid);
      if (done) {
        finalized += 1;
      }
    }
    return finalized;
  }

  async purgeExpiredEmailVerificationCodes(now = new Date()) {
    const retentionHoursRaw = Number(this.config.get("EMAIL_VERIFICATION_CODE_RETENTION_HOURS") ?? 24);
    const retentionHours = Number.isFinite(retentionHoursRaw)
      ? Math.max(1, Math.floor(retentionHoursRaw))
      : 24;
    const retentionCutoff = new Date(now.getTime() - retentionHours * 60 * 60_000);
    const result = await this.prisma.emailVerificationCode.deleteMany({
      where: {
        OR: [
          { status: "PENDING", expiresAt: { lte: now } },
          { status: { in: ["CONSUMED", "EXPIRED"] }, updatedAt: { lte: retentionCutoff } },
        ],
      },
    });
    return result.count;
  }

  private deletedName(uuid: string) {
    return `Deleted User ${uuid.slice(0, 8)}`;
  }

  private deletedEmail(uuid: string) {
    return `deleted+${uuid.toLowerCase()}@deleted.nearloy.local`;
  }

  private async finalizeExpiredFrozenAccount(
    userId: number,
    now = new Date(),
    knownUuid?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          uuid: true,
          accountStatus: true,
          deletionScheduledAt: true,
        },
      });
      if (
        !user ||
        user.accountStatus !== "FROZEN_PENDING_DELETION" ||
        !user.deletionScheduledAt ||
        user.deletionScheduledAt > now
      ) {
        return false;
      }

      const userUuid = knownUuid ?? user.uuid;
      const dataScrubOps: Prisma.PrismaPromise<unknown>[] = [
        tx.refreshToken.deleteMany({ where: { userId } }),
        tx.oAuthAccount.deleteMany({ where: { userId } }),
        tx.userFavoriteCategory.deleteMany({ where: { userId } }),
        tx.userSubscription.deleteMany({ where: { userId } }),
        tx.userCompany.deleteMany({ where: { userId } }),
        tx.loginEvent.deleteMany({ where: { userId } }),
        tx.emailChangeRequest.deleteMany({
          where: {
            OR: [{ userId }, { requestedByUserId: userId }],
          },
        }),
        tx.company.updateMany({
          where: { ownerUserId: userId },
          data: { ownerUserId: null },
        }),
      ];
      await Promise.all(dataScrubOps);

      await tx.user.update({
        where: { id: userId },
        data: {
          name: this.deletedName(userUuid),
          email: this.deletedEmail(userUuid),
          telegramId: null,
          passwordHash: null,
          emailVerifiedAt: null,
          deletionScheduledAt: null,
        },
      });
      return true;
    });
  }

  private assertPublicRegistrationRole(role: UserRole) {
    const publicRegistrationBlockedRoles = new Set<UserRole>([
      UserRole.ADMIN,
      UserRole.SUPER_ADMIN,
      UserRole.MANAGER,
      UserRole.SUPPORT,
    ]);
    if (publicRegistrationBlockedRoles.has(role)) {
      throw new BadRequestException(
        "Admin workspace accounts cannot be created via public registration",
      );
    }
  }

  private async grantClientRegistrationRewards(
    tx: Prisma.TransactionClient,
    userId: number,
    role: UserRole,
  ) {
    if (role !== UserRole.CLIENT) return;
    const topStatus = await tx.profileStatus.findUnique({
      where: { slug: "top-100" },
      select: { id: true },
    });
    const counter = await tx.platformCounter.upsert({
      where: { key: "top100_client_registrations" },
      create: { key: "top100_client_registrations", value: 1 },
      update: { value: { increment: 1 } },
    });

    if (topStatus && counter.value <= 100) {
      await tx.userProfileStatusUnlock.upsert({
        where: { userId_statusId: { userId, statusId: topStatus.id } },
        create: {
          userId,
          statusId: topStatus.id,
          source: "TOP_100",
        },
        update: {},
      });
    }
  }

  async register(dto: RegisterDto) {
    const role = dto.role ?? UserRole.CLIENT;
    this.assertPublicRegistrationRole(role);
    throw new BadRequestException("Email confirmation is required. Request a registration code first.");
  }

  private assertRegistrationCanUseExistingEmail(existing: {
    emailVerifiedAt: Date | null;
    accountStatus: AccountStatusValue;
  } | null) {
    if (!existing) return;
    if (existing.accountStatus === "BLOCKED") {
      throw new BadRequestException("Account is blocked");
    }
    if (existing.emailVerifiedAt) {
      throw new ConflictException("Email is already registered");
    }
  }

  private registrationTargetFromExisting(
    existing: { name: string; role: UserRole } | null,
    dto: RequestRegistrationCodeDto,
    requestedRole: UserRole,
  ) {
    return {
      name: existing?.name?.trim() || dto.name.trim(),
      role: existing?.role ?? requestedRole,
    };
  }

  private async createVerifiedUserFromPending(
    tx: Prisma.TransactionClient,
    pending: {
      name: string;
      passwordHash: string;
      role: UserRole;
      termsAcceptedAt?: Date | null;
      termsVersion?: string | null;
    },
    email: string,
  ) {
    const created = await tx.user.create({
      data: {
        name: pending.name,
        email,
        passwordHash: pending.passwordHash,
        role: pending.role,
        emailVerifiedAt: new Date(),
        termsAcceptedAt: pending.termsAcceptedAt ?? new Date(),
        termsVersion: pending.termsVersion ?? USER_TERMS_VERSION,
      },
    });
    await this.grantClientRegistrationRewards(tx, created.id, pending.role);
    return created;
  }

  private async verifyExistingUnconfirmedUser(
    tx: Prisma.TransactionClient,
    existing: {
      id: number;
      emailVerifiedAt: Date | null;
      accountStatus: AccountStatusValue;
    },
    pending: {
      name: string;
      passwordHash: string;
      role: UserRole;
      termsAcceptedAt?: Date | null;
      termsVersion?: string | null;
    },
  ) {
    this.assertRegistrationCanUseExistingEmail(existing);
    return tx.user.update({
      where: { id: existing.id },
      data: {
        name: pending.name,
        passwordHash: pending.passwordHash,
        role: pending.role,
        emailVerifiedAt: new Date(),
        termsAcceptedAt: pending.termsAcceptedAt ?? new Date(),
        termsVersion: pending.termsVersion ?? USER_TERMS_VERSION,
      },
    });
  }

  private emailRateLimitKeys(normalizedEmail: string, ctx: EmailRequestContext) {
    const keys = [`auth-email:email:${normalizedEmail}`];
    const ip = ctx.ipAddress?.trim();
    const guard = ctx.emailGuardId?.trim();
    if (ip) keys.push(`auth-email:ip:${ip}`);
    if (guard) keys.push(`auth-email:cookie:${guard}`);
    return Array.from(new Set(keys));
  }

  private cleanupEmailRequestGuards(nowMs = Date.now()) {
    const staleAfterMs = EMAIL_BLOCK_MS * 2;
    for (const [key, state] of this.emailRequestGuards.entries()) {
      const reference = state.blockedUntil ?? state.lastSentAt;
      if (reference + staleAfterMs <= nowMs) {
        this.emailRequestGuards.delete(key);
      }
    }
  }

  private throwEmailRateLimit(retryAfterMs: number) {
    const minutes = Math.max(1, Math.ceil(retryAfterMs / 60_000));
    throw new HttpException(
      `Слишком много запросов на отправку email. Повторите через ${minutes} мин.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private assertEmailRequestAllowed(normalizedEmail: string, ctx: EmailRequestContext = {}) {
    const nowMs = Date.now();
    this.cleanupEmailRequestGuards(nowMs);
    const keys = this.emailRateLimitKeys(normalizedEmail, ctx);
    const states = keys
      .map((key) => this.emailRequestGuards.get(key))
      .filter((state): state is EmailRequestGuardState => Boolean(state));

    const blockedUntil = states.reduce(
      (max, state) => Math.max(max, state.blockedUntil && state.blockedUntil > nowMs ? state.blockedUntil : 0),
      0,
    );
    if (blockedUntil > nowMs) {
      this.throwEmailRateLimit(blockedUntil - nowMs);
    }

    const twoSentState = states.find((state) => state.sentCount >= 2);
    if (twoSentState) {
      const blockedUntilMs = nowMs + EMAIL_BLOCK_MS;
      keys.forEach((key) => {
        const state = this.emailRequestGuards.get(key) ?? twoSentState;
        this.emailRequestGuards.set(key, {
          ...state,
          blockedUntil: blockedUntilMs,
          lastSentAt: nowMs,
          sentCount: Math.max(2, state.sentCount),
        });
      });
      this.throwEmailRateLimit(EMAIL_BLOCK_MS);
    }

    const oneSentState = states.find((state) => state.sentCount === 1);
    if (oneSentState) {
      const waitMs = oneSentState.lastSentAt + EMAIL_REPEAT_DELAY_MS - nowMs;
      if (waitMs > 0) {
        this.throwEmailRateLimit(waitMs);
      }
      const nextState: EmailRequestGuardState = {
        firstSentAt: oneSentState.firstSentAt,
        lastSentAt: nowMs,
        sentCount: 2,
        blockedUntil: nowMs + EMAIL_BLOCK_MS,
      };
      keys.forEach((key) => this.emailRequestGuards.set(key, nextState));
      return;
    }

    const firstState: EmailRequestGuardState = {
      firstSentAt: nowMs,
      lastSentAt: nowMs,
      sentCount: 1,
      blockedUntil: null,
    };
    keys.forEach((key) => this.emailRequestGuards.set(key, firstState));
  }

  async requestRegistrationCode(dto: RequestRegistrationCodeDto, ctx: EmailRequestContext = {}) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException("Passwords do not match");
    }
    if (dto.termsAccepted !== true) {
      throw new BadRequestException("Accept the NearLoy user terms before creating an account.");
    }
    const role = dto.role ?? UserRole.CLIENT;
    this.assertPublicRegistrationRole(role);

    const email = dto.email.trim().toLowerCase();
    this.assertEmailRequestAllowed(email, ctx);
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, role: true, emailVerifiedAt: true, accountStatus: true },
    });
    this.assertRegistrationCanUseExistingEmail(existing);
    const target = this.registrationTargetFromExisting(existing, dto, role);

    const code = String(randomInt(100000, 1_000_000));
    const codeHash = await bcrypt.hash(code, 12);
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const ttlMinutes = Number(this.config.get("REGISTRATION_EMAIL_CODE_TTL_MINUTES") ?? 15);
    const expiresAt = new Date(Date.now() + Math.max(5, ttlMinutes) * 60_000);
    const termsAcceptedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.emailVerificationCode.updateMany({
        where: { normalizedEmail: email, status: "PENDING", purpose: "REGISTRATION", consumedAt: null },
        data: { status: "EXPIRED" },
      });
      await tx.emailVerificationCode.create({
        data: {
          email: dto.email.trim(),
          normalizedEmail: email,
          name: target.name,
          passwordHash,
          role: target.role,
          codeHash,
          expiresAt,
          termsAcceptedAt,
          termsVersion: USER_TERMS_VERSION,
        },
      });
    });

    await this.email.sendRegistrationCode({
      toEmail: email,
      toName: target.name,
      code,
      expiresAt,
      locale: dto.locale ?? "ru",
    });

    return {
      success: true as const,
      email,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async requestPasswordResetCode(dto: RequestPasswordResetDto, ctx: EmailRequestContext = {}) {
    const email = dto.email.trim().toLowerCase();
    this.assertEmailRequestAllowed(email, ctx);

    const ttlMinutes = Number(this.config.get("PASSWORD_RESET_EMAIL_CODE_TTL_MINUTES") ?? 15);
    const expiresAt = new Date(Date.now() + Math.max(5, ttlMinutes) * 60_000);
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        accountStatus: true,
        passwordHash: true,
      },
    });

    const generic = {
      success: true as const,
      email,
      expiresAt: expiresAt.toISOString(),
    };
    if (!user || user.accountStatus === "BLOCKED" || !user.passwordHash) {
      return generic;
    }

    const code = String(randomInt(100000, 1_000_000));
    const codeHash = await bcrypt.hash(code, 12);

    await this.prisma.$transaction(async (tx) => {
      await tx.emailVerificationCode.updateMany({
        where: { normalizedEmail: email, status: "PENDING", purpose: "PASSWORD_RESET", consumedAt: null },
        data: { status: "EXPIRED" },
      });
      await tx.emailVerificationCode.create({
        data: {
          email: user.email,
          normalizedEmail: email,
          name: user.name,
          passwordHash: PASSWORD_RESET_PENDING_HASH,
          role: user.role,
          purpose: "PASSWORD_RESET",
          codeHash,
          expiresAt,
        },
      });
    });

    await this.email.sendPasswordResetCode({
      toEmail: user.email,
      toName: user.name,
      code,
      expiresAt,
      locale: dto.locale ?? "ru",
    });

    return generic;
  }

  async confirmPasswordReset(dto: ConfirmPasswordResetDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException("Passwords do not match");
    }
    const email = dto.email.trim().toLowerCase();
    const pending = await this.prisma.emailVerificationCode.findFirst({
      where: {
        normalizedEmail: email,
        status: "PENDING",
        purpose: "PASSWORD_RESET",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!pending) {
      throw new BadRequestException("Password reset code is invalid or expired");
    }
    if (pending.attempts >= 5) {
      await this.prisma.emailVerificationCode.update({
        where: { id: pending.id },
        data: { status: "EXPIRED" },
      });
      throw new BadRequestException("Too many attempts. Request a new code.");
    }

    const ok = await bcrypt.compare(dto.code, pending.codeHash);
    if (!ok) {
      await this.prisma.emailVerificationCode.update({
        where: { id: pending.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException("Password reset code is invalid or expired");
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, accountStatus: true },
    });
    if (!user || user.accountStatus === "BLOCKED") {
      await this.prisma.emailVerificationCode.update({
        where: { id: pending.id },
        data: { status: "EXPIRED" },
      });
      throw new BadRequestException("Password reset code is invalid or expired");
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash, emailVerifiedAt: new Date() },
      });
      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.emailVerificationCode.update({
        where: { id: pending.id },
        data: { status: "CONSUMED", consumedAt: new Date() },
      });
      await tx.emailVerificationCode.updateMany({
        where: {
          normalizedEmail: email,
          status: "PENDING",
          purpose: "PASSWORD_RESET",
          id: { not: pending.id },
        },
        data: { status: "EXPIRED" },
      });
    });

    void this.telegramNotifications?.notifyPasswordChanged(user.id);

    return { success: true as const };
  }

  async verifyRegistrationCode(dto: VerifyRegistrationCodeDto) {
    const email = dto.email.trim().toLowerCase();
    const pending = await this.prisma.emailVerificationCode.findFirst({
      where: {
        normalizedEmail: email,
        status: "PENDING",
        purpose: "REGISTRATION",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!pending) {
      throw new BadRequestException("Registration code is invalid or expired");
    }
    if (pending.attempts >= 5) {
      await this.prisma.emailVerificationCode.update({
        where: { id: pending.id },
        data: { status: "EXPIRED" },
      });
      throw new BadRequestException("Too many attempts. Request a new code.");
    }

    const ok = await bcrypt.compare(dto.code, pending.codeHash);
    if (!ok) {
      await this.prisma.emailVerificationCode.update({
        where: { id: pending.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException("Registration code is invalid or expired");
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { email },
        select: { id: true, emailVerifiedAt: true, accountStatus: true },
      });
      const user = existing
        ? await this.verifyExistingUnconfirmedUser(tx, existing, pending)
        : await this.createVerifiedUserFromPending(tx, pending, email);
      await tx.emailVerificationCode.update({
        where: { id: pending.id },
        data: { status: "CONSUMED", consumedAt: new Date() },
      });
      return user;
    });

    return this.issueTokens(user);
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (!user) return null;

    const now = new Date();
    if (
      user.accountStatus === "FROZEN_PENDING_DELETION" &&
      user.deletionScheduledAt &&
      user.deletionScheduledAt <= now
    ) {
      await this.finalizeExpiredFrozenAccount(user.id, now, user.uuid);
      return null;
    }
    if (user.accountStatus === "BLOCKED") return null;

    if (!user.passwordHash) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    return ok ? user : null;
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) {
      throw new BadRequestException("Password login is not set for this account.");
    }
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Current password is incorrect.");
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    void this.telegramNotifications?.notifyPasswordChanged(userId);
    return { success: true as const };
  }

  /** Soft-delete window: account stays recoverable for 5 days. */
  async freezeAccount(userId: number) {
    const deletionScheduledAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        accountStatus: "FROZEN_PENDING_DELETION",
        deletionScheduledAt,
      },
    });
    return {
      user: this.toSafeUser(user),
      deletionScheduledAt: user.deletionScheduledAt!.toISOString(),
    };
  }

  async reactivateAccount(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException("User not found.");
    }
    if (user.accountStatus !== "FROZEN_PENDING_DELETION") {
      throw new BadRequestException("Account is not scheduled for deletion.");
    }
    const now = new Date();
    if (user.deletionScheduledAt && user.deletionScheduledAt <= now) {
      await this.finalizeExpiredFrozenAccount(userId, now, user.uuid);
      throw new BadRequestException(
        "Recovery period has ended. This account has been permanently removed.",
      );
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        accountStatus: "ACTIVE",
        deletionScheduledAt: null,
      },
    });
    return this.issueTokens(updated);
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }
    return this.issueTokens(user);
  }


  async loginWithTelegramMiniApp(initData: string, ctx: LoginContext = {}) {
    const maxAgeSecondsRaw = Number(
      this.config.get("TELEGRAM_MINI_APP_AUTH_MAX_AGE_SECONDS") ?? 24 * 60 * 60,
    );
    const verified = verifyTelegramMiniAppInitData(
      initData,
      this.config.get<string>("TELEGRAM_BOT_TOKEN"),
      {
        maxAgeSeconds: Number.isFinite(maxAgeSecondsRaw)
          ? Math.max(60, Math.floor(maxAgeSecondsRaw))
          : 24 * 60 * 60,
      },
    );

    let telegramId: bigint;
    try {
      telegramId = BigInt(String(verified.user.id));
    } catch {
      throw new UnauthorizedException("Linked client user id is invalid.");
    }

    const user = await this.prisma.user.findUnique({ where: { telegramId } });
    if (!user) {
      throw new UnauthorizedException("Account is not linked to NearLoy.");
    }

    const now = new Date();
    if (
      user.accountStatus === "FROZEN_PENDING_DELETION" &&
      user.deletionScheduledAt &&
      user.deletionScheduledAt <= now
    ) {
      await this.finalizeExpiredFrozenAccount(user.id, now, user.uuid);
      throw new UnauthorizedException("Account is not linked to an active NearLoy account.");
    }
    if (user.accountStatus === "BLOCKED") {
      throw new UnauthorizedException("Account is blocked.");
    }

    await this.recordLoginEvent(user.id, {
      ...ctx,
      deviceLabel: ctx.deviceLabel ?? "Linked client session",
    });
    return this.issueTokens(user);
  }

  async recordLoginEvent(userId: number, ctx: LoginContext) {
    const data = {
      ipAddress: ctx.ipAddress ?? null,
      countryCode: ctx.countryCode?.toUpperCase() ?? null,
      city: ctx.city ?? null,
      userAgent: ctx.userAgent ?? null,
      deviceLabel: ctx.deviceLabel ?? null,
      requestId: ctx.requestId ?? null,
    };
    const existingDevice = await this.prisma.loginEvent.findFirst({
      where: {
        userId,
        userAgent: data.userAgent,
        deviceLabel: data.deviceLabel,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (existingDevice) {
      await this.prisma.loginEvent.update({
        where: { id: existingDevice.id },
        data: {
          ...data,
          createdAt: new Date(),
        },
      });
    } else {
      await this.prisma.loginEvent.create({
        data: {
          userId,
          ...data,
        },
      });
    }

    const staleDevices = await this.prisma.loginEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: 10,
      select: { id: true },
    });
    if (staleDevices.length > 0) {
      await this.prisma.loginEvent.deleteMany({
        where: { id: { in: staleDevices.map((event) => event.id) } },
      });
    }
  }

  async refresh(dto: RefreshDto) {
    const tokenHash = createHash("sha256").update(dto.refreshToken).digest("hex");
    const row = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
    if (!row?.user) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
    if (row.user.accountStatus === "BLOCKED") {
      throw new UnauthorizedException("Account is blocked");
    }
    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(row.user);
  }

  async issueTokens<T extends SafeUserSource>(user: T) {
    const expiresIn = this.config.get<string>("JWT_EXPIRES_IN") ?? "15m";
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshRaw = randomBytes(48).toString("hex");
    const refreshHash = createHash("sha256").update(refreshRaw).digest("hex");
    const days = Number(this.config.get("JWT_REFRESH_EXPIRES_DAYS") ?? 7);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: refreshHash,
        userId: user.id,
        expiresAt,
      },
    });

    const favoriteCount = await this.prisma.userFavoriteCategory.count({
      where: { userId: user.id },
    });

    return {
      accessToken,
      refreshToken: refreshRaw,
      tokenType: "Bearer" as const,
      expiresIn,
      needsCategoryOnboarding: favoriteCount === 0,
      user: this.toSafeUser(user),
    };
  }

  toSafeUser(user: SafeUserSource): SafeUser {
    return {
      id: user.uuid,
      legacyId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      accountStatus: user.accountStatus as AccountStatusValue,
      deletionScheduledAt: user.deletionScheduledAt?.toISOString() ?? null,
    };
  }

  async findSafeUserById(id: number): Promise<SafeUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) return null;
    if (user.accountStatus === "BLOCKED") return null;
    const now = new Date();
    if (
      user.accountStatus === "FROZEN_PENDING_DELETION" &&
      user.deletionScheduledAt &&
      user.deletionScheduledAt <= now
    ) {
      await this.finalizeExpiredFrozenAccount(user.id, now, user.uuid);
      return null;
    }
    return this.toSafeUser(user);
  }

  async confirmEmailChange(rawToken: string) {
    const token = rawToken.trim();
    if (!token) {
      throw new BadRequestException("Token is required.");
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const request = await this.prisma.emailChangeRequest.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!request || request.usedAt || request.revokedAt || request.expiresAt <= new Date()) {
      throw new BadRequestException("Invalid or expired email change token.");
    }

    const emailTaken = await this.prisma.user.findUnique({
      where: { email: request.newEmail },
      select: { id: true },
    });
    if (emailTaken && emailTaken.id !== request.userId) {
      throw new ConflictException("Target email is already in use.");
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: request.userId },
        data: {
          email: request.newEmail,
          emailVerifiedAt: new Date(),
        },
      }),
      this.prisma.emailChangeRequest.update({
        where: { id: request.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.emailChangeRequest.updateMany({
        where: { userId: request.userId, usedAt: null, revokedAt: null, id: { not: request.id } },
        data: { revokedAt: new Date() },
      }),
    ]);

    return {
      success: true as const,
      email: request.newEmail,
      message: "Email updated successfully. Please login with your new email.",
    };
  }
}
