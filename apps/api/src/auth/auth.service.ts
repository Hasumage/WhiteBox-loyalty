import {
  BadRequestException,
  ConflictException,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { User, UserRole, type Prisma } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { RegisterDto } from "./dto/register.dto";

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

export type LoginContext = {
  ipAddress?: string | null;
  countryCode?: string | null;
  city?: string | null;
  userAgent?: string | null;
  deviceLabel?: string | null;
  requestId?: string | null;
};

@Injectable()
export class AuthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthService.name);
  private purgeTimer: NodeJS.Timeout | null = null;
  private purgeInProgress = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
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
      const removed = await this.purgeExpiredFrozenAccounts();
      if (removed > 0) {
        this.logger.log(`Finalized ${removed} frozen account(s).`);
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

  private deletedName(uuid: string) {
    return `Deleted User ${uuid.slice(0, 8)}`;
  }

  private deletedEmail(uuid: string) {
    return `deleted+${uuid.toLowerCase()}@deleted.whitebox.local`;
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

  async register(dto: RegisterDto) {
    const role = dto.role ?? UserRole.CLIENT;
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
        passwordHash,
        role,
      },
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

  async issueTokens(user: User) {
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

  toSafeUser(user: User): SafeUser {
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
