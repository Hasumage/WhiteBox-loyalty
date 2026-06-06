import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { createHmac } from "crypto";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";

function signedTelegramInitData(
  user: { id: number; first_name?: string; username?: string },
  botToken = "123456:test-bot-token",
  authDate = Math.floor(Date.now() / 1000),
) {
  const params = new URLSearchParams({
    auth_date: String(authDate),
    query_id: "AAH-test-query",
    user: JSON.stringify(user),
  });
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  params.set("hash", hash);
  return params.toString();
}

describe("AuthService", () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    profileStatus: { findUnique: jest.Mock };
    platformCounter: { upsert: jest.Mock };
    userProfileStatusUnlock: { upsert: jest.Mock };
    refreshToken: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
    loginEvent: {
      create: jest.Mock;
      deleteMany: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    emailChangeRequest: { findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    $transaction: jest.Mock;
    userFavoriteCategory: { count: jest.Mock };
  };
  let jwt: { signAsync: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      profileStatus: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      platformCounter: {
        upsert: jest.fn(),
      },
      userProfileStatusUnlock: {
        upsert: jest.fn(),
      },
      refreshToken: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      loginEvent: {
        create: jest.fn(),
        deleteMany: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      emailChangeRequest: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((input) => (typeof input === "function" ? input(prisma) : Promise.resolve(input))),
      userFavoriteCategory: {
        count: jest.fn().mockResolvedValue(0),
      },
    };
    jwt = { signAsync: jest.fn().mockResolvedValue("access.jwt.token") };

    const testingModule: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, def?: string) => {
              if (key === "JWT_SECRET") return "test-secret-test-secret-test-secret";
              if (key === "JWT_EXPIRES_IN") return "15m";
              if (key === "JWT_REFRESH_EXPIRES_DAYS") return "7";
              if (key === "TELEGRAM_BOT_TOKEN") return "123456:test-bot-token";
              if (key === "TELEGRAM_MINI_APP_AUTH_MAX_AGE_SECONDS") return "86400";
              return def;
            },
            getOrThrow: (key: string) => {
              if (key === "JWT_SECRET") return "test-secret-test-secret-test-secret";
              throw new Error(`missing ${key}`);
            },
          },
        },
      ],
    }).compile();

    service = testingModule.get(AuthService);
  });

  it("register rejects ADMIN role", async () => {
    await expect(
      service.register({
        name: "A",
        email: "a@b.com",
        password: "password12",
        role: UserRole.ADMIN,
      }),
    ).rejects.toThrow("Admin workspace accounts");
  });

  it("register creates CLIENT and returns tokens", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 1,
      uuid: "11111111-1111-4111-8111-111111111111",
      email: "u@b.com",
      name: "U",
      role: UserRole.CLIENT,
      passwordHash: "h",
      telegramId: null,
      phoneNumber: null,
      phoneVerifiedAt: null,
      companyReferralCode: null,
      emailVerifiedAt: null,
      accountStatus: "ACTIVE",
      deletionScheduledAt: null,
      selectedProfileStatusId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.profileStatus.findUnique.mockResolvedValue({ id: "top-100-status" });
    prisma.platformCounter.upsert.mockResolvedValue({ key: "top100_client_registrations", value: 1 });
    prisma.userProfileStatusUnlock.upsert.mockResolvedValue({ id: "top-100-unlock" });
    prisma.refreshToken.create.mockResolvedValue({ id: "rt" });

    const result = await service.register({
      name: "U",
      email: "u@b.com",
      password: "password12",
    });

    expect(result.accessToken).toBe("access.jwt.token");
    expect(result.refreshToken).toHaveLength(96);
    expect(result.needsCategoryOnboarding).toBe(true);
    expect(prisma.user.create).toHaveBeenCalled();
    expect(prisma.userProfileStatusUnlock.upsert).toHaveBeenCalledWith({
      where: { userId_statusId: { userId: 1, statusId: "top-100-status" } },
      create: { userId: 1, statusId: "top-100-status", source: "TOP_100" },
      update: {},
    });
    expect(prisma.refreshToken.create).toHaveBeenCalled();
  });

  it("register does not grant Top 100 after the first 100 client registrations", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 101,
      uuid: "10110110-1011-4101-8101-101101101101",
      email: "late@user.com",
      name: "Late User",
      role: UserRole.CLIENT,
      passwordHash: "h",
      telegramId: null,
      phoneNumber: null,
      phoneVerifiedAt: null,
      companyReferralCode: null,
      emailVerifiedAt: null,
      accountStatus: "ACTIVE",
      deletionScheduledAt: null,
      selectedProfileStatusId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.profileStatus.findUnique.mockResolvedValue({ id: "top-100-status" });
    prisma.platformCounter.upsert.mockResolvedValue({ key: "top100_client_registrations", value: 101 });
    prisma.refreshToken.create.mockResolvedValue({ id: "rt-late" });

    const result = await service.register({
      name: "Late User",
      email: "late@user.com",
      password: "password12",
    });

    expect(result.accessToken).toBe("access.jwt.token");
    expect(prisma.platformCounter.upsert).toHaveBeenCalledWith({
      where: { key: "top100_client_registrations" },
      create: { key: "top100_client_registrations", value: 1 },
      update: { value: { increment: 1 } },
    });
    expect(prisma.userProfileStatusUnlock.upsert).not.toHaveBeenCalled();
  });

  it("login fails for unknown user", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login({ email: "x@y.com", password: "password12" })).rejects.toThrow(
      "Invalid email or password",
    );
  });

  it("login fails for blocked user", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 2,
      uuid: "22222222-2222-4222-8222-222222222222",
      email: "blocked@user.com",
      name: "Blocked User",
      role: UserRole.CLIENT,
      passwordHash: "hash",
      accountStatus: "BLOCKED",
      deletionScheduledAt: null,
    });

    await expect(service.login({ email: "blocked@user.com", password: "password12" })).rejects.toThrow(
      "Invalid email or password",
    );
  });

  it("logs in from Telegram Mini App for a linked active user", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 13,
      uuid: "13131313-1313-4313-8313-131313131313",
      email: "tg@user.com",
      name: "Telegram User",
      role: UserRole.CLIENT,
      passwordHash: "hash",
      telegramId: BigInt(1348887499),
      phoneNumber: null,
      phoneVerifiedAt: null,
      emailVerifiedAt: null,
      accountStatus: "ACTIVE",
      deletionScheduledAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.loginEvent.findFirst.mockResolvedValue(null);
    prisma.loginEvent.create.mockResolvedValue({ id: "mini-app-device" });
    prisma.loginEvent.findMany.mockResolvedValue([]);
    prisma.refreshToken.create.mockResolvedValue({ id: "rt-mini" });

    const result = await service.loginWithTelegramMiniApp(
      signedTelegramInitData({ id: 1348887499, first_name: "Max" }),
      { userAgent: "TelegramWebView" },
    );

    expect(result.accessToken).toBe("access.jwt.token");
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { telegramId: BigInt(1348887499) },
    });
    expect(prisma.loginEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 13,
          userAgent: "TelegramWebView",
          deviceLabel: "Telegram Mini App",
        }),
      }),
    );
  });

  it("rejects Telegram Mini App login when the signature is invalid", async () => {
    const params = new URLSearchParams({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({ id: 1348887499 }),
      hash: "deadbeef",
    });

    await expect(service.loginWithTelegramMiniApp(params.toString())).rejects.toThrow(
      "Telegram Mini App auth signature is invalid",
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects Telegram Mini App login when Telegram is not linked", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.loginWithTelegramMiniApp(signedTelegramInitData({ id: 1348887499 })),
    ).rejects.toThrow("Telegram account is not linked to WhiteBox");
  });

  it("rotates a valid refresh token and issues a restored session", async () => {
    prisma.refreshToken.findFirst.mockResolvedValue({
      id: "old-refresh",
      user: {
        id: 21,
        uuid: "21212121-2121-4121-8121-212121212121",
        email: "returning@user.com",
        name: "Returning User",
        role: UserRole.CLIENT,
        passwordHash: "hash",
        telegramId: null,
        phoneNumber: null,
        phoneVerifiedAt: null,
        emailVerifiedAt: null,
        accountStatus: "ACTIVE",
        deletionScheduledAt: null,
        selectedProfileStatusId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    prisma.refreshToken.update.mockResolvedValue({ id: "old-refresh" });
    prisma.refreshToken.create.mockResolvedValue({ id: "new-refresh" });

    const result = await service.refresh({ refreshToken: "stored-refresh-token" });

    expect(result.accessToken).toBe("access.jwt.token");
    expect(result.refreshToken).not.toBe("stored-refresh-token");
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: "old-refresh" },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.refreshToken.create).toHaveBeenCalled();
  });

  it("issueTokens disables onboarding when favorites exist", async () => {
    prisma.userFavoriteCategory.count.mockResolvedValue(2);
    prisma.refreshToken.create.mockResolvedValue({ id: "rt2" });

    const result = await service.issueTokens({
      id: 7,
      uuid: "77777777-7777-4777-8777-777777777777",
      email: "fav@user.com",
      name: "Fav User",
      role: UserRole.CLIENT,
      passwordHash: "h",
      telegramId: null,
      phoneNumber: null,
      phoneVerifiedAt: null,
      companyReferralCode: null,
      emailVerifiedAt: null,
      accountStatus: "ACTIVE",
      deletionScheduledAt: null,
      selectedProfileStatusId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(result.needsCategoryOnboarding).toBe(false);
  });

  it("recordLoginEvent saves login metadata", async () => {
    prisma.loginEvent.findFirst.mockResolvedValue(null);
    prisma.loginEvent.create.mockResolvedValue({ id: "le1" });
    prisma.loginEvent.findMany.mockResolvedValue([]);

    await service.recordLoginEvent(1, {
      ipAddress: "1.2.3.4",
      countryCode: "ru",
      userAgent: "UA",
    });

    expect(prisma.loginEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 1,
          ipAddress: "1.2.3.4",
          countryCode: "RU",
        }),
      }),
    );
  });

  it("recordLoginEvent updates existing device and keeps only 10 devices", async () => {
    prisma.loginEvent.findFirst.mockResolvedValue({ id: "existing-device" });
    prisma.loginEvent.update.mockResolvedValue({ id: "existing-device" });
    prisma.loginEvent.findMany.mockResolvedValue([{ id: "old-1" }, { id: "old-2" }]);
    prisma.loginEvent.deleteMany.mockResolvedValue({ count: 2 });

    await service.recordLoginEvent(1, {
      ipAddress: "1.2.3.4",
      countryCode: "ru",
      userAgent: "UA",
      deviceLabel: "Windows",
    });

    expect(prisma.loginEvent.create).not.toHaveBeenCalled();
    expect(prisma.loginEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "existing-device" },
        data: expect.objectContaining({
          ipAddress: "1.2.3.4",
          countryCode: "RU",
          userAgent: "UA",
          deviceLabel: "Windows",
          createdAt: expect.any(Date),
        }),
      }),
    );
    expect(prisma.loginEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 1 },
        skip: 10,
      }),
    );
    expect(prisma.loginEvent.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["old-1", "old-2"] } },
    });
  });

  it("confirmEmailChange updates email and marks token used", async () => {
    prisma.emailChangeRequest.findUnique.mockResolvedValue({
      id: "req1",
      tokenHash: "hash",
      userId: 1,
      newEmail: "new@example.com",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      revokedAt: null,
      user: { id: 1 },
    });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockResolvedValue([]);

    const result = await service.confirmEmailChange("raw-token");

    expect(result.success).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("confirmEmailChange throws when target email already taken", async () => {
    prisma.emailChangeRequest.findUnique.mockResolvedValue({
      id: "req1",
      tokenHash: "hash",
      userId: 1,
      newEmail: "new@example.com",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      revokedAt: null,
      user: { id: 1 },
    });
    prisma.user.findUnique.mockResolvedValue({ id: 2 });

    await expect(service.confirmEmailChange("raw-token")).rejects.toBeInstanceOf(ConflictException);
  });
});
