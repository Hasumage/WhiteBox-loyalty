import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { AccountStatus, PermissionScope, SubscriptionEntitlementWindow, UserRole } from "@prisma/client";
import { AdminService } from "./admin.service";

describe("AdminService", () => {
  let service: AdminService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    category: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    company: {
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    companyCategory: {
      count: jest.Mock;
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    companyLevelRule: {
      deleteMany: jest.Mock;
      createMany: jest.Mock;
      findMany: jest.Mock;
    };
    companyLocation: {
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      findUnique: jest.Mock;
      delete: jest.Mock;
      findFirst: jest.Mock;
    };
    userCompany: {
      findMany: jest.Mock;
    };
    loyaltyTransaction: {
      groupBy: jest.Mock;
    };
    emailChangeRequest: {
      updateMany: jest.Mock;
      create: jest.Mock;
    };
    refreshToken: {
      updateMany: jest.Mock;
    };
    auditEvent: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    $transaction: jest.Mock;
    userSubscription: { count: jest.Mock; findMany: jest.Mock };
    subscription: { findUnique: jest.Mock; findMany: jest.Mock; count: jest.Mock; create: jest.Mock };
    subscriptionBundle: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock };
    subscriptionBundleParticipant: { findMany: jest.Mock };
    promoCode: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    referralCampaign: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
    referralInvite: { count: jest.Mock };
  };
  const config = {
    get: (key: string) => {
      if (key === "EMAIL_CHANGE_TOKEN_HOURS") return "24";
      if (key === "FRONTEND_ORIGIN") return "http://localhost:3000";
      return undefined;
    },
  };
  const maintenance = {
    setRestoreStage: jest.fn(),
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      category: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      company: {
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      companyCategory: {
        count: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      companyLevelRule: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
      },
      companyLocation: {
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn(),
      },
      userCompany: {
        findMany: jest.fn(),
      },
      loyaltyTransaction: {
        groupBy: jest.fn(),
      },
      emailChangeRequest: {
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      refreshToken: {
        updateMany: jest.fn(),
      },
      auditEvent: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn().mockResolvedValue([]),
      userSubscription: { count: jest.fn(), findMany: jest.fn() },
      subscription: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
      subscriptionBundle: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
      subscriptionBundleParticipant: { findMany: jest.fn() },
      promoCode: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      referralCampaign: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      referralInvite: { count: jest.fn() },
    };
    service = new AdminService(prisma as never, config as never, maintenance as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("createAccount throws conflict on duplicate email", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 1 });

    await expect(
      service.createAccount({
        name: "Alice",
        email: "alice@example.com",
        password: "password123",
        role: UserRole.CLIENT,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("listUsers passes filters to prisma", async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);

    await service.listUsers(UserRole.COMPANY, "max");

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: UserRole.COMPANY,
          OR: expect.any(Array),
        }),
        take: 20,
      }),
    );
  });

  it("getUserByUuid returns transformed shape", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 10,
      uuid: "u-10",
      telegramId: BigInt(123456),
      name: "Max",
      email: "max@example.com",
      role: UserRole.CLIENT,
      accountStatus: "ACTIVE",
      emailVerifiedAt: null,
      deletionScheduledAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      passwordHash: "hash",
      favoriteCategories: [],
      companyLinks: [],
      subscriptions: [],
      refreshTokens: [],
      oauthAccounts: [],
      loginEvents: [],
      loyaltyTransactions: [],
      targetAuditEvents: [],
    });

    const result = await service.getUserByUuid("u-10");

    expect(result.telegramId).toBe("123456");
    expect(result.hasPassword).toBe(true);
    expect(result).not.toHaveProperty("passwordHash", "hash");
  });

  it("updateUserByUuid updates allowed fields", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: 11,
        uuid: "u-11",
      })
      .mockResolvedValueOnce({
        id: 1,
        role: UserRole.SUPER_ADMIN,
        email: "super@example.com",
      })
      .mockResolvedValueOnce({
        id: 11,
        uuid: "u-11",
        telegramId: null,
        name: "Jane Updated",
        email: "jane@new.com",
        role: UserRole.ADMIN,
        accountStatus: "ACTIVE",
        emailVerifiedAt: null,
        deletionScheduledAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-03T00:00:00.000Z"),
        passwordHash: "hashed-from-bcrypt",
        favoriteCategories: [],
        companyLinks: [],
        subscriptions: [],
        refreshTokens: [],
        oauthAccounts: [],
        loginEvents: [],
        loyaltyTransactions: [],
        targetAuditEvents: [],
      });
    prisma.user.update.mockResolvedValue({});

    const result = await service.updateUserByUuid("u-11", {
      name: " Jane Updated ",
      role: UserRole.ADMIN,
      emailVerifiedAt: "2026-01-02T00:00:00.000Z",
    }, 1);

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { uuid: "u-11" },
        data: expect.objectContaining({
          name: "Jane Updated",
          role: UserRole.ADMIN,
          emailVerifiedAt: new Date("2026-01-02T00:00:00.000Z"),
        }),
      }),
    );
    expect(result.uuid).toBe("u-11");
  });

  it("updateUserRole allows ADMIN to assign support roles", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 1, role: UserRole.ADMIN })
      .mockResolvedValueOnce({ id: 2, uuid: "u-2" });
    prisma.user.update.mockResolvedValue({
      uuid: "u-2",
      email: "support@example.com",
      name: "Support",
      role: UserRole.SUPPORT,
      updatedAt: new Date(),
    });

    const result = await service.updateUserRole("u-2", UserRole.SUPPORT, 1);

    expect(result.role).toBe(UserRole.SUPPORT);
  });

  it("updateUserRole blocks ADMIN from assigning SUPER_ADMIN", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 1, role: UserRole.ADMIN });

    await expect(service.updateUserRole("u-2", UserRole.SUPER_ADMIN, 1)).rejects.toThrow(
      "Only SUPER_ADMIN",
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("updateUserByUuid blocks ADMIN from freezing another admin workspace account", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: 2,
        uuid: "u-admin",
        role: UserRole.ADMIN,
        accountStatus: "ACTIVE",
      })
      .mockResolvedValueOnce({
        id: 1,
        role: UserRole.ADMIN,
        email: "admin@example.com",
      });

    await expect(
      service.updateUserByUuid(
        "u-admin",
        { accountStatus: AccountStatus.FROZEN_PENDING_DELETION },
        1,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("updateUserByUuid blocks SUPER_ADMIN from blocking another SUPER_ADMIN", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: 2,
        uuid: "u-super",
        role: UserRole.SUPER_ADMIN,
        accountStatus: "ACTIVE",
      })
      .mockResolvedValueOnce({
        id: 1,
        role: UserRole.SUPER_ADMIN,
        email: "super@example.com",
      });

    await expect(
      service.updateUserByUuid(
        "u-super",
        { accountStatus: AccountStatus.BLOCKED },
        1,
      ),
    ).rejects.toThrow("SUPER_ADMIN accounts cannot be blocked");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("updateUserByUuid blocks ADMIN from blocking another ADMIN", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: 2,
        uuid: "u-admin",
        role: UserRole.ADMIN,
        accountStatus: "ACTIVE",
      })
      .mockResolvedValueOnce({
        id: 1,
        role: UserRole.ADMIN,
        email: "admin@example.com",
      });

    await expect(
      service.updateUserByUuid(
        "u-admin",
        { accountStatus: AccountStatus.BLOCKED },
        1,
      ),
    ).rejects.toThrow("ADMIN accounts can be blocked only by a SUPER_ADMIN policy decision");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("assertAdminPermission gives SUPER_ADMIN database access without explicit rows", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      role: UserRole.SUPER_ADMIN,
      permissions: [],
    });

    await expect(
      service.assertAdminPermission(1, PermissionScope.DATABASE, "canView"),
    ).resolves.toBeUndefined();
  });

  it("assertAdminPermission blocks ADMIN database access until it is explicitly granted", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      role: UserRole.ADMIN,
      permissions: [],
    });

    await expect(
      service.assertAdminPermission(1, PermissionScope.DATABASE, "canView"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("assertAdminPermission allows ADMIN database restore only with approve permission", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      role: UserRole.ADMIN,
      permissions: [{ canView: true, canEdit: true, canApprove: true }],
    });

    await expect(
      service.assertAdminPermission(1, PermissionScope.DATABASE, "canApprove"),
    ).resolves.toBeUndefined();
  });

  it("updateCompanyUserByUuid creates warning audit when manager changes company data", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: 2,
        uuid: "company-user",
        role: UserRole.COMPANY,
      })
      .mockResolvedValueOnce({
        id: 1,
        role: UserRole.MANAGER,
        email: "manager@example.com",
      });
    prisma.user.update.mockResolvedValue({
      id: 2,
      uuid: "company-user",
      name: "Updated Company User",
      managedCompany: { name: "Coffee Partner" },
    });
    prisma.auditEvent.create.mockResolvedValue({ id: "audit-warning" });

    await service.updateCompanyUserByUuid("company-user", { name: "Updated Company User" }, 1);

    expect(prisma.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspace: "MANAGER",
          level: "WARN",
          action: "Manager changed company user account",
          actorUserId: 1,
          actorLabel: "manager@example.com",
          targetUuid: "company-user",
          tags: expect.arrayContaining(["WARNING", "MANAGER_CHANGE", "REVIEW_REQUIRED"]),
        }),
      }),
    );
  });

  it("blockUserAccountByUuid lets ADMIN block lower-risk client accounts and revokes refresh sessions", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 1, role: UserRole.ADMIN, email: "admin@example.com" })
      .mockResolvedValueOnce({
        id: 2,
        uuid: "u-2",
        email: "target@example.com",
        name: "Target",
        role: UserRole.CLIENT,
        accountStatus: "ACTIVE",
      });
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
    prisma.user.update.mockResolvedValue({
      uuid: "u-2",
      email: "target@example.com",
      name: "Target",
      role: UserRole.CLIENT,
      accountStatus: "BLOCKED",
      updatedAt: new Date(),
    });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });
    prisma.auditEvent.create.mockResolvedValue({ id: "audit-1" });

    const result = await service.blockUserAccountByUuid("u-2", 1, "Risk confirmed");

    expect(result.accountStatus).toBe("BLOCKED");
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 2 }) }),
    );
    expect(prisma.auditEvent.create).toHaveBeenCalled();
  });

  it("blockUserAccountByUuid blocks SUPER_ADMIN from blocking SUPER_ADMIN accounts", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 1, role: UserRole.SUPER_ADMIN, email: "super@example.com" })
      .mockResolvedValueOnce({
        id: 2,
        uuid: "u-super",
        email: "other-super@example.com",
        name: "Other Super",
        role: UserRole.SUPER_ADMIN,
        accountStatus: "ACTIVE",
      });

    await expect(service.blockUserAccountByUuid("u-super", 1, "test")).rejects.toThrow(
      "SUPER_ADMIN accounts cannot be blocked",
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("requestEmailChange creates request and returns preview", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 12, uuid: "u-12", email: "old@example.com" })
      .mockResolvedValueOnce(null);

    const response = await service.requestEmailChange("u-12", 1, "new@example.com");

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(response.success).toBe(true);
    expect(response.sentTo).toBe("new@example.com");
    expect(response.previewUrl).toContain("/email-change/confirm?token=");
  });

  it("reactivateUserAccountByUuid resets deletion schedule", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 1, uuid: "u-1", role: UserRole.CLIENT })
      .mockResolvedValueOnce({ role: UserRole.ADMIN });
    prisma.user.update.mockResolvedValue({
      uuid: "u-1",
      accountStatus: "ACTIVE",
      deletionScheduledAt: null,
      updatedAt: new Date(),
    });

    const result = await service.reactivateUserAccountByUuid("u-1", 2);

    expect(result.accountStatus).toBe("ACTIVE");
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { uuid: "u-1" },
        data: expect.objectContaining({
          accountStatus: "ACTIVE",
          deletionScheduledAt: null,
        }),
      }),
    );
  });

  it("createCategory normalizes slug and saves", async () => {
    prisma.category.create.mockResolvedValue({ id: 1, slug: "coffee", name: "Coffee", icon: "Coffee" });

    const result = await service.createCategory({
      slug: " Coffee ",
      name: "Coffee",
      icon: "Coffee",
      description: "desc",
    });

    expect(prisma.category.create).toHaveBeenCalled();
    expect(result.slug).toBe("coffee");
  });

  it("createCategory auto-generates unique slug suffix when slug exists", async () => {
    prisma.category.findUnique
      .mockResolvedValueOnce({ id: 100, slug: "coffee" })
      .mockResolvedValueOnce(null);
    prisma.category.create.mockImplementation(async ({ data }) => ({
      id: 2,
      slug: data.slug,
      name: data.name,
      icon: data.icon,
    }));

    const result = await service.createCategory({
      slug: "coffee",
      name: "Coffee",
      icon: "Coffee",
      description: "desc",
    });

    expect(prisma.category.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: "coffee-2",
        }),
      }),
    );
    expect(result.slug).toBe("coffee-2");
  });

  it("createCompanySubscription requires company profile", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 3, uuid: "c-1", role: "COMPANY", managedCompany: null });

    await expect(
      service.createCompanySubscription("c-1", {
        name: "Monthly",
        description: "desc value",
        price: 299,
        renewalPeriod: "month",
        entitlements: [
          {
            title: "Coffee",
            allowance: 1,
            windowValue: 1,
            windowUnit: SubscriptionEntitlementWindow.DAY,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("createCompanySubscription requires at least one service", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 3,
      uuid: "c-1",
      role: "COMPANY",
      managedCompany: {
        id: 44,
        categoryId: 2,
        identityVerificationCompleted: true,
        categories: [],
        levelRules: [],
      },
    });

    await expect(
      service.createCompanySubscription("c-1", {
        name: "Monthly",
        description: "desc value",
        price: 299,
        renewalPeriod: "month",
        entitlements: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it("createCompanySubscription rejects prices below the minimum", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 3,
      uuid: "c-1",
      role: "COMPANY",
      managedCompany: {
        id: 44,
        categoryId: 2,
        identityVerificationCompleted: true,
        categories: [],
        levelRules: [],
      },
    });

    await expect(
      service.createCompanySubscription("c-1", {
        name: "Monthly",
        description: "desc value",
        price: 298,
        renewalPeriod: "month",
        entitlements: [
          {
            title: "Coffee",
            allowance: 1,
            windowValue: 1,
            windowUnit: SubscriptionEntitlementWindow.DAY,
          },
        ],
      }),
    ).rejects.toThrow("Subscription price must be at least 299 RUB.");

    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it("createCompanySubscription creates the first service with the subscription", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 3,
      uuid: "c-1",
      role: "COMPANY",
      managedCompany: {
        id: 44,
        categoryId: 2,
        identityVerificationCompleted: true,
        categories: [],
        levelRules: [],
      },
    });
    prisma.subscription.findUnique.mockResolvedValue(null);
    prisma.subscription.create.mockResolvedValue({
      uuid: "sub-uuid",
      name: "Monthly",
      price: { toString: () => "299" },
      entitlements: [{ uuid: "benefit-uuid" }],
    });

    await service.createCompanySubscription("c-1", {
      name: "Monthly",
      description: "desc value",
      price: 299,
      renewalPeriod: "month",
      entitlements: [
        {
          title: "Coffee",
          description: "Any classic coffee",
          allowance: 3,
          windowValue: 1,
          windowUnit: SubscriptionEntitlementWindow.DAY,
        },
        {
          title: "Gym entry",
          allowance: 25,
          windowValue: 30,
          windowUnit: SubscriptionEntitlementWindow.UNLIMITED,
        },
      ],
    });

    expect(prisma.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: 44,
          entitlements: {
            create: [
              {
                title: "Coffee",
                description: "Any classic coffee",
                allowance: 3,
                windowValue: 1,
                windowUnit: SubscriptionEntitlementWindow.DAY,
              },
              {
                title: "Gym entry",
                description: null,
                allowance: 1,
                windowValue: 1,
                windowUnit: SubscriptionEntitlementWindow.UNLIMITED,
              },
            ],
          },
        }),
        include: { category: true, company: true, entitlements: { orderBy: { createdAt: "asc" } } },
      }),
    );
  });

  it("createPromoCode creates normalized points campaign", async () => {
    prisma.promoCode.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({
      id: 9,
      uuid: "company-user",
      role: "COMPANY",
      managedCompany: { id: 44 },
    });
    prisma.promoCode.create.mockImplementation(async ({ data }) => ({
      id: 1,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
      subscription: null,
      redemptions: [],
    }));

    const result = await service.createPromoCode({
      code: " welcome500 ",
      title: "Welcome bonus",
      rewardType: "POINTS",
      points: 500,
      companyUuid: "company-user",
    });

    expect(prisma.promoCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: "WELCOME500",
          points: 500,
        }),
      }),
    );
    expect(result).toMatchObject({ code: "WELCOME500", redemptionCount: 0 });
  });

  it("createPromoCode requires subscription uuid for subscription rewards", async () => {
    prisma.promoCode.findUnique.mockResolvedValue(null);

    await expect(
      service.createPromoCode({
        code: "FREEPASS",
        title: "Free pass",
        rewardType: "SUBSCRIPTION",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("updateReferralCampaign persists mutable referral conditions", async () => {
    prisma.referralCampaign.findFirst.mockResolvedValue({ id: 1, title: "Invite", inviterBonusPoints: 100, invitedBonusPoints: 100, isActive: true });
    prisma.referralCampaign.update.mockResolvedValue({ id: 1, title: "Spring invite", inviterBonusPoints: 300, invitedBonusPoints: 200, isActive: false });
    prisma.referralInvite.count.mockResolvedValue(0);

    const result = await service.updateReferralCampaign({
      title: "Spring invite",
      inviterBonusPoints: 300,
      invitedBonusPoints: 200,
      isActive: false,
    });

    expect(prisma.referralCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          title: "Spring invite",
          inviterBonusPoints: 300,
          invitedBonusPoints: 200,
          isActive: false,
        }),
      }),
    );
    expect(result).toMatchObject({ title: "Spring invite", stats: expect.any(Object) });
  });

  it("updateUserByUuid throws not found when user does not exist", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.updateUserByUuid("missing", {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it("deleteUserByUuid blocks self-delete", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 55, uuid: "u-55" });

    await expect(service.deleteUserByUuid("u-55", 55)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("deleteUserByUuid removes user", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 77, uuid: "u-77" });
    prisma.user.delete.mockResolvedValue({ id: 77 });

    const result = await service.deleteUserByUuid("u-77", 1);

    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { uuid: "u-77" } });
    expect(result.success).toBe(true);
  });

  it("upsertCompanyProfile rejects cashback that decreases on higher levels", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 10,
      uuid: "c-10",
      role: "COMPANY",
      managedCompany: {
        id: 42,
        levelRules: [],
        subscriptionSpendPolicy: "EXCLUDE",
      },
    });
    prisma.category.findMany.mockResolvedValue([{ id: 1 }]);

    await expect(
      service.upsertCompanyProfile("c-10", {
        name: "Acme",
        categoryIds: [1],
        levelRules: [
          { levelName: "Bronze", minTotalSpend: 0, cashbackPercent: 10 },
          { levelName: "Silver", minTotalSpend: 1000, cashbackPercent: 5 },
        ],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("upsertCompanyProfile rejects min redeem below 1", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 10,
      uuid: "c-10",
      role: "COMPANY",
      managedCompany: {
        id: 42,
        levelRules: [],
        subscriptionSpendPolicy: "EXCLUDE",
      },
    });

    await expect(
      service.upsertCompanyProfile("c-10", {
        name: "Acme",
        categoryIds: [1],
        pointsPerReward: 0,
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("upsertCompanyProfile persists online company mode", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 10,
      uuid: "c-online",
      role: "COMPANY",
      managedCompany: {
        id: 42,
        levelRules: [],
        subscriptionSpendPolicy: "EXCLUDE",
        operatesOnline: false,
      },
    });
    prisma.category.findMany.mockResolvedValue([{ id: 1 }]);
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
    prisma.company.update.mockResolvedValue({ id: 42, name: "Online Coffee", slug: "online-coffee" });
    prisma.company.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 42,
      name: "Online Coffee",
      slug: "online-coffee",
      operatesOnline: true,
    });

    const result = await service.upsertCompanyProfile("c-online", {
      name: "Online Coffee",
      categoryIds: [1],
      operatesOnline: true,
      levelRules: [{ levelName: "Bronze", minTotalSpend: 0, cashbackPercent: 1 }],
    } as never);

    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          operatesOnline: true,
        }),
      }),
    );
    expect(result).toMatchObject({ operatesOnline: true });
  });

  it("createCompanyLocation stores manually picked map coordinates without geocoding", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 20,
      uuid: "company-map-user",
      role: UserRole.COMPANY,
      managedCompany: { id: 501 },
    });
    prisma.companyLocation.findMany.mockResolvedValue([]);
    prisma.companyLocation.count.mockResolvedValue(0);
    prisma.companyLocation.create.mockImplementation(async ({ data }) => ({
      id: 701,
      uuid: "location-701",
      ...data,
      createdAt: new Date("2026-05-19T00:00:00.000Z"),
      updatedAt: new Date("2026-05-19T00:00:00.000Z"),
    }));
    prisma.companyLocation.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.createCompanyLocation("company-map-user", {
      title: "Front door",
      address: "Россия, Москва, Тверская улица, 7",
      city: "Москва",
      latitude: 55.761111,
      longitude: 37.609222,
      openTime: "10:00",
      closeTime: "22:00",
      workingDays: [1, 2, 3, 4, 5],
      isMain: true,
    });

    const createCall = prisma.companyLocation.create.mock.calls[0][0];
    expect(createCall.data).toMatchObject({
      companyId: 501,
      title: "Front door",
      address: "Россия, Москва, Тверская улица, 7",
      city: "Москва",
      precision: "manual",
      openTime: "10:00",
      closeTime: "22:00",
      workingDays: [1, 2, 3, 4, 5],
      isMain: true,
      isActive: true,
    });
    expect(createCall.data.latitude.toString()).toBe("55.761111");
    expect(createCall.data.longitude.toString()).toBe("37.609222");
    expect(createCall.data.geocoderResponse).toMatchObject({
      source: "admin-map-picker",
      address: "Россия, Москва, Тверская улица, 7",
    });
    expect(result.uuid).toBe("location-701");
  });

  it("listCompanyClients returns paginated rows and level by spent", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 2,
      uuid: "company-u",
      role: "COMPANY",
      managedCompany: { id: 7 },
    });
    prisma.userCompany.findMany.mockResolvedValue([
      {
        userId: 101,
        balance: 50,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-03T00:00:00.000Z"),
        user: {
          uuid: "u-101",
          name: "Alice",
          email: "alice@example.com",
          accountStatus: "ACTIVE",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      },
      {
        userId: 102,
        balance: 40,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        user: {
          uuid: "u-102",
          name: "Bob",
          email: "bob@example.com",
          accountStatus: "ACTIVE",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      },
    ]);
    prisma.loyaltyTransaction.groupBy.mockResolvedValue([
      { userId: 101, type: "EARN", _sum: { amount: 500 } },
      { userId: 101, type: "SPEND", _sum: { amount: 1500 } },
      { userId: 102, type: "SPEND", _sum: { amount: 300 } },
    ]);
    prisma.companyLevelRule.findMany.mockResolvedValue([
      { levelName: "Bronze", minTotalSpend: 0, cashbackPercent: 1 },
      { levelName: "Silver", minTotalSpend: 1000, cashbackPercent: 3 },
    ]);

    const result = await service.listCompanyClients(
      "company-u",
      undefined,
      1,
      1,
      "spent",
      "desc",
    );

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].userUuid).toBe("u-101");
    expect(result.items[0].currentLevel?.levelName).toBe("Silver");
  });

  it("subscriptionStats returns revenue and lifecycle analytics", async () => {
    prisma.userSubscription.count
      .mockResolvedValueOnce(5) // total
      .mockResolvedValueOnce(3) // active
      .mockResolvedValueOnce(1) // expired
      .mockResolvedValueOnce(1) // canceled
      .mockResolvedValueOnce(1) // expiring in 7 days
      .mockResolvedValueOnce(4) // started in 30 days
      .mockResolvedValueOnce(2) // started in previous 30 days
      .mockResolvedValueOnce(1); // churned in 30 days
    prisma.subscription.count
      .mockResolvedValueOnce(4) // total plans
      .mockResolvedValueOnce(3) // active plans
      .mockResolvedValueOnce(2) // company-linked plans
      .mockResolvedValueOnce(3); // category-linked plans
    prisma.userSubscription.findMany.mockResolvedValue([
      {
        subscriptionId: 1,
        willAutoRenew: true,
        subscription: {
          uuid: "s-1",
          slug: "plan-a",
          name: "Plan A",
          price: 100,
          renewalUnit: "month",
          renewalValue: 1,
          company: { name: "Acme" },
        },
      },
      {
        subscriptionId: 1,
        willAutoRenew: false,
        subscription: {
          uuid: "s-1",
          slug: "plan-a",
          name: "Plan A",
          price: 100,
          renewalUnit: "month",
          renewalValue: 1,
          company: { name: "Acme" },
        },
      },
      {
        subscriptionId: 2,
        willAutoRenew: true,
        subscription: {
          uuid: "s-2",
          slug: "plan-b",
          name: "Plan B",
          price: 1200,
          renewalUnit: "year",
          renewalValue: 1,
          company: null,
        },
      },
    ]);

    const result = await service.subscriptionStats();

    expect(result.total).toBe(5);
    expect(result.active).toBe(3);
    expect(result.estimatedMonthlyRevenue).toBe(300);
    expect(result.averageMonthlyRevenuePerActive).toBe(100);
    expect(result.autoRenewEnabled).toBe(2);
    expect(result.autoRenewRatePercent).toBe(66.7);
    expect(result.startedGrowthPercent).toBe(100);
    expect(result.catalog.inactivePlans).toBe(1);
    expect(result.topSubscriptions[0]).toMatchObject({
      slug: "plan-a",
      activeSubscribers: 2,
      estimatedMonthlyRevenue: 200,
    });
  });

  it("searchSubscriptions returns ordinary and paired subscriptions together", async () => {
    prisma.subscription.findMany.mockResolvedValue([
      {
        uuid: "plan-uuid",
        slug: "coffee-basic",
        name: "Coffee Basic",
        description: "Monthly coffee subscription",
        price: { toString: () => "999" },
        renewalPeriod: "1 month",
        isActive: true,
        updatedAt: new Date("2026-05-22T10:00:00.000Z"),
        company: { id: 11, slug: "coffee", name: "Coffee Co" },
        category: { id: 3, slug: "food", name: "Food", icon: "coffee" },
      },
    ]);
    prisma.subscriptionBundle.findMany.mockResolvedValue([
      {
        id: 2,
        uuid: "bundle-uuid",
        slug: "coffee-fitness",
        name: "Coffee + Fitness",
        description: "Shared subscription",
        price: { toString: () => "1990" },
        renewalPeriod: "1 month",
        renewalValue: 1,
        renewalUnit: "month",
        promoBonusDays: 0,
        status: "ACTIVE",
        isActive: true,
        categoryId: 3,
        createdAt: new Date("2026-05-22T09:00:00.000Z"),
        updatedAt: new Date("2026-05-22T11:00:00.000Z"),
        category: { id: 3, slug: "food", name: "Food", icon: "coffee" },
        participants: [
          {
            id: 1,
            companyId: 11,
            benefitTitle: "Coffee box",
            benefitDescription: "Fresh coffee delivery",
            fulfillmentNote: null,
            revenueSharePercent: { toString: () => "60" },
            sortOrder: 1,
            company: { id: 11, slug: "coffee", name: "Coffee Co", isActive: true },
          },
          {
            id: 2,
            companyId: 12,
            benefitTitle: "Fitness class",
            benefitDescription: "Weekly workout",
            fulfillmentNote: null,
            revenueSharePercent: { toString: () => "40" },
            sortOrder: 2,
            company: { id: 12, slug: "fitness", name: "Fitness Co", isActive: true },
          },
        ],
      },
    ]);

    const result = await service.searchSubscriptions("coffee");

    expect(result.items.map((item) => item.type)).toEqual(["bundle", "subscription"]);
    expect(result.items[0]).toMatchObject({
      uuid: "bundle-uuid",
      name: "Coffee + Fitness",
      participants: [
        expect.objectContaining({ companyName: "Coffee Co", revenueSharePercent: "60" }),
        expect.objectContaining({ companyName: "Fitness Co", revenueSharePercent: "40" }),
      ],
    });
    expect(prisma.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
        take: 10,
      }),
    );
  });

  it("createPairedSubscription validates revenue split and creates bundle participants", async () => {
    prisma.subscriptionBundle.findUnique.mockResolvedValue(null);
    prisma.company.findMany.mockResolvedValue([{ id: 11 }, { id: 12 }]);
    prisma.category.findUnique.mockResolvedValue({ id: 3 });
    prisma.subscriptionBundle.create.mockResolvedValue({
      id: 1,
      uuid: "bundle-uuid",
      slug: "coffee-fitness",
      name: "Coffee + Fitness",
      description: "Shared subscription",
      price: { toString: () => "1990" },
      renewalPeriod: "1 month",
      renewalValue: 1,
      renewalUnit: "month",
      promoBonusDays: 0,
      status: "DRAFT",
      isActive: false,
      categoryId: 3,
      createdAt: new Date("2026-05-22T10:00:00.000Z"),
      updatedAt: new Date("2026-05-22T10:00:00.000Z"),
      category: { id: 3, slug: "food", name: "Food", icon: "coffee" },
      participants: [
        {
          id: 1,
          companyId: 11,
          benefitTitle: "Coffee box",
          benefitDescription: "Fresh coffee delivery",
          fulfillmentNote: null,
          revenueSharePercent: { toString: () => "60" },
          sortOrder: 1,
          company: { id: 11, slug: "coffee", name: "Coffee Co", isActive: true },
        },
        {
          id: 2,
          companyId: 12,
          benefitTitle: "Fitness class",
          benefitDescription: "Weekly workout",
          fulfillmentNote: null,
          revenueSharePercent: { toString: () => "40" },
          sortOrder: 2,
          company: { id: 12, slug: "fitness", name: "Fitness Co", isActive: true },
        },
      ],
    } as never);
    prisma.auditEvent.create.mockResolvedValue({ id: "audit-1" });

    const result = await service.createPairedSubscription({
      name: "Coffee + Fitness",
      description: "Shared subscription",
      price: 1990,
      categoryId: 3,
      participants: [
        {
          companyId: 11,
          benefitTitle: "Coffee box",
          benefitDescription: "Fresh coffee delivery",
          revenueSharePercent: 60,
        },
        {
          companyId: 12,
          benefitTitle: "Fitness class",
          benefitDescription: "Weekly workout",
          revenueSharePercent: 40,
        },
      ],
    });

    expect(result.slug).toBe("coffee-fitness");
    expect(result.participants).toHaveLength(2);
    expect(prisma.subscriptionBundle.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: "coffee-fitness",
          participants: expect.objectContaining({
            create: [
              expect.objectContaining({ companyId: 11, revenueSharePercent: expect.anything() }),
              expect.objectContaining({ companyId: 12, revenueSharePercent: expect.anything() }),
            ],
          }),
        }),
      }),
    );
  });

  it("createPairedSubscription rejects revenue split that is not 100 percent", async () => {
    await expect(
      service.createPairedSubscription({
        name: "Bad split",
        description: "Shared subscription",
        price: 1000,
        participants: [
          {
            companyId: 11,
            benefitTitle: "A",
            benefitDescription: "Company A",
            revenueSharePercent: 80,
          },
          {
            companyId: 12,
            benefitTitle: "B",
            benefitDescription: "Company B",
            revenueSharePercent: 30,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.subscriptionBundle.create).not.toHaveBeenCalled();
  });
});
