import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";

describe("AuthService", () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
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
      $transaction: jest.fn().mockResolvedValue([]),
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
      emailVerifiedAt: null,
      accountStatus: "ACTIVE",
      deletionScheduledAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
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
    expect(prisma.refreshToken.create).toHaveBeenCalled();
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
      emailVerifiedAt: null,
      accountStatus: "ACTIVE",
      deletionScheduledAt: null,
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
