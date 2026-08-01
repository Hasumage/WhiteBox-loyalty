import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { createHmac } from "crypto";
import { AuthService } from "./auth.service";
import { EmailService } from "../email/email.service";
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

function signedMaxInitData(
  user: { id: number | string; first_name?: string; username?: string },
  botToken = "max-bot-token",
  authDate = Math.floor(Date.now() / 1000),
) {
  const params = new URLSearchParams({
    auth_date: String(authDate),
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
    refreshToken: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    loginEvent: {
      create: jest.Mock;
      deleteMany: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    emailChangeRequest: { findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    emailVerificationCode: {
      create: jest.Mock;
      deleteMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
    userFavoriteCategory: { count: jest.Mock };
  };
  let jwt: { signAsync: jest.Mock };
  let email: { sendRegistrationCode: jest.Mock; sendPasswordResetCode: jest.Mock };

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
        updateMany: jest.fn(),
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
      emailVerificationCode: {
        create: jest.fn(),
        deleteMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((input) => (typeof input === "function" ? input(prisma) : Promise.resolve(input))),
      userFavoriteCategory: {
        count: jest.fn().mockResolvedValue(0),
      },
    };
    jwt = { signAsync: jest.fn().mockResolvedValue("access.jwt.token") };
    email = {
      sendRegistrationCode: jest.fn().mockResolvedValue({ id: "email-message-id" }),
      sendPasswordResetCode: jest.fn().mockResolvedValue({ id: "reset-email-message-id" }),
    };

    const testingModule: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: EmailService, useValue: email },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, def?: string) => {
              if (key === "JWT_SECRET") return "test-secret-test-secret-test-secret";
              if (key === "JWT_EXPIRES_IN") return "15m";
              if (key === "JWT_REFRESH_EXPIRES_DAYS") return "7";
              if (key === "TELEGRAM_BOT_TOKEN") return "123456:test-bot-token";
              if (key === "TELEGRAM_MINI_APP_AUTH_MAX_AGE_SECONDS") return "86400";
              if (key === "MAX_BOT_TOKEN") return "max-bot-token";
              if (key === "MAX_MINI_APP_AUTH_MAX_AGE_SECONDS") return "86400";
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

  it("register requires email confirmation code flow", async () => {
    await expect(
      service.register({
        name: "U",
        email: "u@b.com",
        password: "password12",
      }),
    ).rejects.toThrow("Email confirmation is required");

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("purgeExpiredEmailVerificationCodes removes expired pending and stale finalized codes", async () => {
    const now = new Date("2026-07-05T12:00:00.000Z");
    prisma.emailVerificationCode.deleteMany.mockResolvedValue({ count: 3 });

    await expect(service.purgeExpiredEmailVerificationCodes(now)).resolves.toBe(3);

    expect(prisma.emailVerificationCode.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { status: "PENDING", expiresAt: { lte: now } },
          {
            status: { in: ["CONSUMED", "EXPIRED"] },
            updatedAt: { lte: new Date("2026-07-04T12:00:00.000Z") },
          },
        ],
      },
    });
  });

  it("requestRegistrationCode stores a pending verification and emails a 6-digit code", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.emailVerificationCode.updateMany.mockResolvedValue({ count: 0 });
    prisma.emailVerificationCode.create.mockResolvedValue({ id: "pending-code" });

    const result = await service.requestRegistrationCode({
      name: "New Client",
      email: "New.Client@Example.COM",
      password: "password12",
      confirmPassword: "password12",
      termsAccepted: true,
    });

    expect(result.success).toBe(true);
    expect(result.email).toBe("new.client@example.com");
    expect(prisma.emailVerificationCode.updateMany).toHaveBeenCalledWith({
      where: {
        normalizedEmail: "new.client@example.com",
        status: "PENDING",
        purpose: "REGISTRATION",
        consumedAt: null,
      },
      data: { status: "EXPIRED" },
    });
    expect(prisma.emailVerificationCode.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "New.Client@Example.COM",
        normalizedEmail: "new.client@example.com",
        name: "New Client",
        role: UserRole.CLIENT,
        passwordHash: expect.any(String),
        codeHash: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    });
    expect(email.sendRegistrationCode).toHaveBeenCalledWith({
      toEmail: "new.client@example.com",
      toName: "New Client",
      code: expect.stringMatching(/^\d{6}$/),
      expiresAt: expect.any(Date),
      locale: "ru",
    });
  });

  it("requestRegistrationCode resends code for an existing unconfirmed account", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 55,
      name: "Existing Client",
      role: UserRole.CLIENT,
      emailVerifiedAt: null,
      accountStatus: "ACTIVE",
    });
    prisma.emailVerificationCode.updateMany.mockResolvedValue({ count: 0 });
    prisma.emailVerificationCode.create.mockResolvedValue({ id: "pending-code" });

    const result = await service.requestRegistrationCode({
      name: "Ignored Name",
      email: "Existing@Example.COM",
      password: "password12",
      confirmPassword: "password12",
      locale: "en",
      termsAccepted: true,
    });

    expect(result.success).toBe(true);
    expect(prisma.emailVerificationCode.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        normalizedEmail: "existing@example.com",
        name: "Existing Client",
        role: UserRole.CLIENT,
        passwordHash: expect.any(String),
      }),
    });
    expect(email.sendRegistrationCode).toHaveBeenCalledWith({
      toEmail: "existing@example.com",
      toName: "Existing Client",
      code: expect.stringMatching(/^\d{6}$/),
      expiresAt: expect.any(Date),
      locale: "en",
    });
  });

  it("requestRegistrationCode rate-limits repeated account creation emails", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.emailVerificationCode.updateMany.mockResolvedValue({ count: 0 });
    prisma.emailVerificationCode.create.mockResolvedValue({ id: "pending-code" });

    const payload = {
      name: "New Client",
      email: "clicker@example.com",
      password: "password12",
      confirmPassword: "password12",
      termsAccepted: true,
    };
    const context = { ipAddress: "10.0.0.3", emailGuardId: "guard-register-click" };

    await service.requestRegistrationCode(payload, context);

    await expect(service.requestRegistrationCode(payload, context)).rejects.toThrow(
      "Слишком много запросов",
    );
    expect(email.sendRegistrationCode).toHaveBeenCalledTimes(1);
  });

  it("requestPasswordResetCode stores a reset code and sends email without exposing account state", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 77,
      name: "Reset User",
      email: "reset@example.com",
      role: UserRole.CLIENT,
      accountStatus: "ACTIVE",
      passwordHash: "existing-hash",
    });
    prisma.emailVerificationCode.updateMany.mockResolvedValue({ count: 0 });
    prisma.emailVerificationCode.create.mockResolvedValue({ id: "reset-code" });

    const result = await service.requestPasswordResetCode(
      { email: "Reset@Example.COM", locale: "ru" },
      { ipAddress: "10.0.0.1", emailGuardId: "guard-reset" },
    );

    expect(result.success).toBe(true);
    expect(result.email).toBe("reset@example.com");
    expect(prisma.emailVerificationCode.updateMany).toHaveBeenCalledWith({
      where: {
        normalizedEmail: "reset@example.com",
        status: "PENDING",
        purpose: "PASSWORD_RESET",
        consumedAt: null,
      },
      data: { status: "EXPIRED" },
    });
    expect(prisma.emailVerificationCode.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "reset@example.com",
        normalizedEmail: "reset@example.com",
        name: "Reset User",
        role: UserRole.CLIENT,
        purpose: "PASSWORD_RESET",
        passwordHash: "PASSWORD_RESET_PENDING",
        codeHash: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    });
    expect(email.sendPasswordResetCode).toHaveBeenCalledWith({
      toEmail: "reset@example.com",
      toName: "Reset User",
      code: expect.stringMatching(/^\d{6}$/),
      expiresAt: expect.any(Date),
      locale: "ru",
    });
  });

  it("requestPasswordResetCode rate-limits repeated email requests", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 77,
      name: "Reset User",
      email: "reset@example.com",
      role: UserRole.CLIENT,
      accountStatus: "ACTIVE",
      passwordHash: "existing-hash",
    });
    prisma.emailVerificationCode.updateMany.mockResolvedValue({ count: 0 });
    prisma.emailVerificationCode.create.mockResolvedValue({ id: "reset-code" });

    await service.requestPasswordResetCode(
      { email: "reset@example.com" },
      { ipAddress: "10.0.0.2", emailGuardId: "guard-click" },
    );

    await expect(
      service.requestPasswordResetCode(
        { email: "reset@example.com" },
        { ipAddress: "10.0.0.2", emailGuardId: "guard-click" },
      ),
    ).rejects.toThrow("Слишком много запросов");
  });

  it("confirmPasswordReset updates password and revokes active refresh tokens", async () => {
    const codeHash = await bcrypt.hash("654321", 4);
    prisma.emailVerificationCode.findFirst.mockResolvedValue({
      id: "reset-code",
      normalizedEmail: "reset@example.com",
      codeHash,
      attempts: 0,
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 77,
      accountStatus: "ACTIVE",
    });
    prisma.user.update.mockResolvedValue({ id: 77 });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });
    prisma.emailVerificationCode.update.mockResolvedValue({ id: "reset-code" });
    prisma.emailVerificationCode.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.confirmPasswordReset({
      email: "Reset@Example.COM",
      code: "654321",
      password: "new-password-123",
      confirmPassword: "new-password-123",
    });

    expect(result.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 77 },
      data: {
        passwordHash: expect.any(String),
        emailVerifiedAt: expect.any(Date),
      },
    });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 77, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.emailVerificationCode.update).toHaveBeenCalledWith({
      where: { id: "reset-code" },
      data: { status: "CONSUMED", consumedAt: expect.any(Date) },
    });
  });

  it("verifyRegistrationCode creates a verified user and consumes the code", async () => {
    const codeHash = await bcrypt.hash("123456", 4);
    const passwordHash = await bcrypt.hash("password12", 4);
    prisma.emailVerificationCode.findFirst.mockResolvedValue({
      id: "pending-code",
      normalizedEmail: "verified@example.com",
      name: "Verified User",
      role: UserRole.CLIENT,
      passwordHash,
      codeHash,
      attempts: 0,
    });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 31,
      uuid: "31313131-3131-4313-8313-313131313131",
      email: "verified@example.com",
      name: "Verified User",
      role: UserRole.CLIENT,
      passwordHash,
      telegramId: null,
      phoneNumber: null,
      phoneVerifiedAt: null,
      companyReferralCode: null,
      emailVerifiedAt: new Date(),
      accountStatus: "ACTIVE",
      deletionScheduledAt: null,
      selectedProfileStatusId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.emailVerificationCode.update.mockResolvedValue({ id: "pending-code" });
    prisma.platformCounter.upsert.mockResolvedValue({ key: "top100_client_registrations", value: 101 });
    prisma.refreshToken.create.mockResolvedValue({ id: "rt-verified" });

    const result = await service.verifyRegistrationCode({
      email: "VERIFIED@example.com",
      code: "123456",
    });

    expect(result.accessToken).toBe("access.jwt.token");
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Verified User",
        email: "verified@example.com",
        passwordHash,
        role: UserRole.CLIENT,
        emailVerifiedAt: expect.any(Date),
      }),
    });
    expect(prisma.emailVerificationCode.update).toHaveBeenCalledWith({
      where: { id: "pending-code" },
      data: { status: "CONSUMED", consumedAt: expect.any(Date) },
    });
  });

  it("verifyRegistrationCode verifies an existing unconfirmed account instead of conflicting", async () => {
    const codeHash = await bcrypt.hash("123456", 4);
    const passwordHash = await bcrypt.hash("password12", 4);
    prisma.emailVerificationCode.findFirst.mockResolvedValue({
      id: "pending-code",
      normalizedEmail: "existing@example.com",
      name: "Existing Client",
      role: UserRole.CLIENT,
      passwordHash,
      codeHash,
      attempts: 0,
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 55,
      emailVerifiedAt: null,
      accountStatus: "ACTIVE",
    });
    prisma.user.update.mockResolvedValue({
      id: 55,
      uuid: "55555555-5555-4555-8555-555555555555",
      email: "existing@example.com",
      name: "Existing Client",
      role: UserRole.CLIENT,
      passwordHash,
      telegramId: null,
      phoneNumber: null,
      phoneVerifiedAt: null,
      companyReferralCode: null,
      emailVerifiedAt: new Date(),
      accountStatus: "ACTIVE",
      deletionScheduledAt: null,
      selectedProfileStatusId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.emailVerificationCode.update.mockResolvedValue({ id: "pending-code" });
    prisma.refreshToken.create.mockResolvedValue({ id: "rt-existing" });

    const result = await service.verifyRegistrationCode({
      email: "existing@example.com",
      code: "123456",
    });

    expect(result.accessToken).toBe("access.jwt.token");
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 55 },
      data: expect.objectContaining({
        name: "Existing Client",
        passwordHash,
        role: UserRole.CLIENT,
        emailVerifiedAt: expect.any(Date),
      }),
    });
    expect(prisma.emailVerificationCode.update).toHaveBeenCalledWith({
      where: { id: "pending-code" },
      data: { status: "CONSUMED", consumedAt: expect.any(Date) },
    });
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

  it("login fails for a passwordless VK ID account", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 3,
      uuid: "33333333-3333-4333-8333-333333333333",
      email: "vk-user@example.com",
      name: "VK User",
      role: UserRole.CLIENT,
      passwordHash: null,
      accountStatus: "ACTIVE",
      deletionScheduledAt: null,
    });

    await expect(service.login({ email: "vk-user@example.com", password: "password12" })).rejects.toThrow(
      "Invalid email or password",
    );
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it("logs in from a linked client session for an active user", async () => {
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
          deviceLabel: "Linked client session",
        }),
      }),
    );
  });

  it("logs in from a linked MAX mini-app session for an active user", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 14,
      uuid: "14141414-1414-4414-8414-141414141414",
      email: "max@user.com",
      name: "MAX User",
      role: UserRole.CLIENT,
      passwordHash: "hash",
      telegramId: null,
      maxId: "max-user-1",
      phoneNumber: null,
      phoneVerifiedAt: null,
      emailVerifiedAt: null,
      accountStatus: "ACTIVE",
      deletionScheduledAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.loginEvent.findFirst.mockResolvedValue(null);
    prisma.loginEvent.create.mockResolvedValue({ id: "max-mini-app-device" });
    prisma.loginEvent.findMany.mockResolvedValue([]);
    prisma.refreshToken.create.mockResolvedValue({ id: "rt-max-mini" });

    const result = await service.loginWithMaxMiniApp(
      signedMaxInitData({ id: "max-user-1", first_name: "Max" }),
      { userAgent: "MAXWebView" },
    );

    expect(result.accessToken).toBe("access.jwt.token");
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { maxId: "max-user-1" },
    });
    expect(prisma.loginEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 14,
          userAgent: "MAXWebView",
          deviceLabel: "MAX mini-app session",
        }),
      }),
    );
  });


  it("rejects linked client session login when the signature is invalid", async () => {
    const params = new URLSearchParams({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({ id: 1348887499 }),
      hash: "deadbeef",
    });

    await expect(service.loginWithTelegramMiniApp(params.toString())).rejects.toThrow(
      "Linked client sign-in signature is invalid",
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects MAX mini-app login when the signature is invalid", async () => {
    const params = new URLSearchParams({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({ id: "max-user-1" }),
      hash: "deadbeef",
    });

    await expect(service.loginWithMaxMiniApp(params.toString())).rejects.toThrow(
      "MAX linked client sign-in signature is invalid",
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("links the current account to a verified MAX mini-app identity", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.update.mockResolvedValue({ id: 7, maxId: "max-user-1" });

    await expect(
      service.linkMaxMiniApp(7, signedMaxInitData({ id: "max-user-1" })),
    ).resolves.toEqual({ linked: true, provider: "max" });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { maxId: "max-user-1" },
      select: { id: true },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { maxId: "max-user-1" },
    });
  });

  it("does not link a MAX identity that belongs to another account", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 8 });

    await expect(
      service.linkMaxMiniApp(7, signedMaxInitData({ id: "max-user-1" })),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects linked client session login when account is not linked", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.loginWithTelegramMiniApp(signedTelegramInitData({ id: 1348887499 })),
    ).rejects.toThrow("Account is not linked to NearLoy");
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
      birthDate: null,
      emailVerifiedAt: null,
      termsAcceptedAt: null,
      termsVersion: null,
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
