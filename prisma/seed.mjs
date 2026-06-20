import "dotenv/config";
import { createHash, randomUUID } from "crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  CompanyReferralPipelineStatus,
  CompanyReferralStatus,
  PermissionScope,
  PrismaClient,
  SubscriptionSpendPolicy,
  UserRole,
} from "@prisma/client";
import { Pool } from "pg";
import { seedProfileStatuses } from "./profile-status-seed-data.mjs";

const DEMO_PASSWORD_HASH = "$2b$12$AYJ2n6Jx6lBWYPNp8RlGhu24yILFqlB2jmP.ylA9d83l8FIfy9dWS"; // DemoPass!123

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function tokenHash(seed) {
  return createHash("sha256").update(seed).digest("hex");
}

function pick(arr, index) {
  return arr[index % arr.length];
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    console.log("Seeding started...");

    await prisma.$transaction([
      prisma.auditEvent.deleteMany(),
      prisma.emailChangeRequest.deleteMany(),
      prisma.loginEvent.deleteMany(),
      prisma.refreshToken.deleteMany(),
      prisma.oAuthAccount.deleteMany(),
      prisma.loyaltyTransaction.deleteMany(),
      prisma.userSubscription.deleteMany(),
      prisma.userCompany.deleteMany(),
      prisma.userFavoriteCategory.deleteMany(),
      prisma.userProfileStatusUnlock.deleteMany(),
      prisma.companyLevelRule.deleteMany(),
      prisma.companyCategory.deleteMany(),
      prisma.subscription.deleteMany(),
      prisma.company.deleteMany(),
      prisma.category.deleteMany(),
      prisma.user.deleteMany(),
      prisma.profileStatus.deleteMany(),
      prisma.platformCounter.deleteMany(),
    ]);

    await seedProfileStatuses(prisma);
    await prisma.platformCounter.create({
      data: { key: "top100_client_registrations", value: 0 },
    });

    const categorySeeds = [
      { slug: "coffee", name: "Coffee", icon: "Coffee", description: "Coffee shops and roasteries" },
      { slug: "barber", name: "Barber", icon: "Scissors", description: "Barber shops and grooming" },
      { slug: "food", name: "Food", icon: "UtensilsCrossed", description: "Restaurants and casual dining" },
      { slug: "fitness", name: "Fitness", icon: "Dumbbell", description: "Gyms and workout studios" },
      { slug: "beauty", name: "Beauty", icon: "Sparkles", description: "Beauty and personal care" },
      { slug: "pharmacy", name: "Pharmacy", icon: "Pill", description: "Pharmacies and wellness" },
      { slug: "retail", name: "Retail", icon: "ShoppingBag", description: "Retail stores and boutiques" },
      { slug: "other", name: "Other", icon: "Grid2x2", description: "Other partner categories" },
      { slug: "electronics", name: "Electronics", icon: "Smartphone", description: "Gadgets and electronics stores" },
      { slug: "books", name: "Books", icon: "BookOpen", description: "Books and stationery" },
      { slug: "travel", name: "Travel", icon: "Plane", description: "Travel and booking services" },
      { slug: "pet-care", name: "Pet Care", icon: "PawPrint", description: "Pets and vet services" },
      { slug: "kids", name: "Kids", icon: "Baby", description: "Kids products and activities" },
      { slug: "home", name: "Home", icon: "Home", description: "Home improvement and decor" },
      { slug: "auto", name: "Auto", icon: "Car", description: "Auto services and products" },
      { slug: "health", name: "Health", icon: "HeartPulse", description: "Clinics and health services" },
      { slug: "education", name: "Education", icon: "GraduationCap", description: "Courses and education" },
      { slug: "entertainment", name: "Entertainment", icon: "Film", description: "Events and entertainment" },
      { slug: "delivery", name: "Delivery", icon: "Truck", description: "Courier and delivery" },
      { slug: "services", name: "Services", icon: "Wrench", description: "Everyday services" },
      { slug: "fashion", name: "Fashion", icon: "Shirt", description: "Fashion and apparel" },
      { slug: "sports", name: "Sports", icon: "Trophy", description: "Sports clubs and shops" },
    ];
    const categories = [];
    for (const category of categorySeeds) {
      categories.push(
        await prisma.category.create({
          data: category,
        }),
      );
    }
    const categoryBySlug = new Map(categories.map((x) => [x.slug, x]));

    const peopleSeeds = [
      { name: "Alice Admin", email: "alice.admin@nearloy.test", role: UserRole.ADMIN },
      { name: "Priya Growth", email: "priya.growth@nearloy.test", role: UserRole.MANAGER },
      { name: "Martin Coffee", email: "martin.coffee@nearloy.test", role: UserRole.COMPANY },
      { name: "Nina Fit", email: "nina.fit@nearloy.test", role: UserRole.COMPANY },
      { name: "Oleg Beauty", email: "oleg.beauty@nearloy.test", role: UserRole.COMPANY },
      { name: "Paula Food", email: "paula.food@nearloy.test", role: UserRole.COMPANY },
      { name: "Roman Retail", email: "roman.retail@nearloy.test", role: UserRole.COMPANY },
      { name: "Emma Clark", email: "emma.clark@nearloy.test", role: UserRole.CLIENT },
      { name: "Liam Scott", email: "liam.scott@nearloy.test", role: UserRole.CLIENT },
      { name: "Olivia Reed", email: "olivia.reed@nearloy.test", role: UserRole.CLIENT },
      { name: "Noah Adams", email: "noah.adams@nearloy.test", role: UserRole.CLIENT },
      { name: "Ava Turner", email: "ava.turner@nearloy.test", role: UserRole.CLIENT },
      { name: "Mason Hall", email: "mason.hall@nearloy.test", role: UserRole.CLIENT },
      { name: "Sophia Gray", email: "sophia.gray@nearloy.test", role: UserRole.CLIENT },
      { name: "Ethan Lee", email: "ethan.lee@nearloy.test", role: UserRole.CLIENT },
      { name: "Mia Carter", email: "mia.carter@nearloy.test", role: UserRole.CLIENT },
      { name: "Lucas Young", email: "lucas.young@nearloy.test", role: UserRole.CLIENT },
      { name: "Isabella King", email: "isabella.king@nearloy.test", role: UserRole.CLIENT },
      { name: "James Wright", email: "james.wright@nearloy.test", role: UserRole.CLIENT },
      { name: "Amelia Baker", email: "amelia.baker@nearloy.test", role: UserRole.CLIENT },
      { name: "Benjamin Green", email: "benjamin.green@nearloy.test", role: UserRole.CLIENT },
    ];

    const users = [];
    for (let i = 0; i < peopleSeeds.length; i += 1) {
      const seed = peopleSeeds[i];
      users.push(
        await prisma.user.create({
          data: {
            name: seed.name,
            email: seed.email,
            role: seed.role,
            telegramId: BigInt(880000000000 + i),
            passwordHash: DEMO_PASSWORD_HASH,
            emailVerifiedAt: daysAgo(120 - i * 3),
            accountStatus: "ACTIVE",
            deletionScheduledAt: null,
            createdAt: daysAgo(150 - i * 2),
          },
        }),
      );
    }

    const owners = users.filter((u) => u.role === UserRole.COMPANY);
    const clients = users.filter((u) => u.role === UserRole.CLIENT);
    const admin = users.find((u) => u.role === UserRole.ADMIN);
    const prManager = users.find((u) => u.email === "priya.growth@nearloy.test");

    if (prManager) {
      await prisma.adminUserPermission.createMany({
        data: [
          {
            userId: prManager.id,
            scope: PermissionScope.PR,
            canView: true,
            canEdit: true,
            canApprove: false,
          },
          {
            userId: prManager.id,
            scope: PermissionScope.COMPANIES,
            canView: true,
            canEdit: false,
            canApprove: false,
          },
          {
            userId: prManager.id,
            scope: PermissionScope.AUDIT,
            canView: true,
            canEdit: false,
            canApprove: false,
          },
        ],
      });
    }

    const companySeeds = [
      {
        slug: "aurora-coffee",
        name: "Aurora Coffee",
        description: "Specialty coffee network with city-wide loyalty rewards",
        categorySlug: "coffee",
        extraCategorySlugs: ["food"],
        pointsPerReward: 100,
        subscriptionSpendPolicy: SubscriptionSpendPolicy.INCLUDE_WITH_BONUS,
      },
      {
        slug: "pulse-fitness",
        name: "Pulse Fitness",
        description: "Gyms and functional training studios with tiered cashback",
        categorySlug: "fitness",
        extraCategorySlugs: ["beauty"],
        pointsPerReward: 250,
        subscriptionSpendPolicy: SubscriptionSpendPolicy.INCLUDE_NO_BONUS,
      },
      {
        slug: "velvet-beauty",
        name: "Velvet Beauty",
        description: "Beauty and wellness salons with personalized member plans",
        categorySlug: "beauty",
        extraCategorySlugs: ["barber"],
        pointsPerReward: 150,
        subscriptionSpendPolicy: SubscriptionSpendPolicy.INCLUDE_WITH_BONUS,
      },
      {
        slug: "fork-flame",
        name: "Fork & Flame",
        description: "Restaurant group with subscription perks and lunch promos",
        categorySlug: "food",
        extraCategorySlugs: ["coffee"],
        pointsPerReward: 120,
        subscriptionSpendPolicy: SubscriptionSpendPolicy.EXCLUDE,
      },
      {
        slug: "urban-retail",
        name: "Urban Retail",
        description: "Lifestyle retail marketplace with cashback progression",
        categorySlug: "retail",
        extraCategorySlugs: ["pharmacy"],
        pointsPerReward: 300,
        subscriptionSpendPolicy: SubscriptionSpendPolicy.INCLUDE_NO_BONUS,
      },
    ];

    const companies = [];
    for (let i = 0; i < companySeeds.length; i += 1) {
      const seed = companySeeds[i];
      const owner = owners[i];
      const primaryCategory = categoryBySlug.get(seed.categorySlug);
      if (!primaryCategory) {
        throw new Error(`Category ${seed.categorySlug} not found`);
      }

      const company = await prisma.company.create({
        data: {
          slug: seed.slug,
          name: seed.name,
          description: seed.description,
          categoryId: primaryCategory.id,
          pointsPerReward: seed.pointsPerReward,
          subscriptionSpendPolicy: seed.subscriptionSpendPolicy,
          isActive: true,
          ownerUserId: owner.id,
          createdAt: daysAgo(110 - i * 5),
        },
      });
      companies.push(company);

      const categoryIds = [
        primaryCategory.id,
        ...seed.extraCategorySlugs
          .map((slug) => categoryBySlug.get(slug)?.id)
          .filter((id) => typeof id === "number"),
      ];
      for (const categoryId of new Set(categoryIds)) {
        await prisma.companyCategory.create({
          data: {
            companyId: company.id,
            categoryId,
            createdAt: daysAgo(100 - i * 4),
          },
        });
      }

      const levelRules = [
        { levelName: "Bronze", minTotalSpend: 0, cashbackPercent: 1.5, sortOrder: 1 },
        { levelName: "Silver", minTotalSpend: 800, cashbackPercent: 3.5, sortOrder: 2 },
        { levelName: "Gold", minTotalSpend: 2200, cashbackPercent: 6, sortOrder: 3 },
      ];
      for (const rule of levelRules) {
        await prisma.companyLevelRule.create({
          data: {
            companyId: company.id,
            ...rule,
            createdAt: daysAgo(95 - i * 4),
          },
        });
      }
    }

    if (prManager) {
      const referralSeeds = [
        {
          companySlug: "aurora-coffee",
          referralPercent: 1,
          source: "PR manager",
          notes: "Warm lead from local coffee entrepreneur network.",
          pipelineStatus: CompanyReferralPipelineStatus.REVENUE_ACTIVE,
          startedAt: daysAgo(45),
        },
        {
          companySlug: "pulse-fitness",
          referralPercent: 1,
          source: "PR manager",
          notes: "Invited after joint subscription pitch with wellness segment.",
          pipelineStatus: CompanyReferralPipelineStatus.CONNECTED,
          startedAt: daysAgo(38),
        },
        {
          companySlug: "fork-flame",
          referralPercent: 0.75,
          source: "PR manager",
          notes: "Restaurant group onboarded through partner club outreach.",
          pipelineStatus: CompanyReferralPipelineStatus.NEGOTIATION,
          startedAt: daysAgo(26),
        },
      ];

      for (const referralSeed of referralSeeds) {
        const company = companies.find((item) => item.slug === referralSeed.companySlug);
        if (!company) continue;
        await prisma.companyReferral.create({
          data: {
            companyId: company.id,
            referrerUserId: prManager.id,
            status: CompanyReferralStatus.ACTIVE,
            pipelineStatus: referralSeed.pipelineStatus,
            referralPercent: referralSeed.referralPercent,
            source: referralSeed.source,
            notes: referralSeed.notes,
            startedAt: referralSeed.startedAt,
            createdAt: referralSeed.startedAt,
          },
        });
      }
    }

    const companySubscriptions = [];
    for (let i = 0; i < companies.length; i += 1) {
      const company = companies[i];
      const primaryCategoryId = company.categoryId;

      const seeds = [
        {
          slug: `${company.slug}-starter`,
          name: `${company.name} Starter`,
          description: "Entry-level membership with member pricing and priority cashback.",
          price: 9.99 + i,
          renewalValue: 1,
          renewalUnit: "month",
          promoBonusDays: 7,
        },
        {
          slug: `${company.slug}-plus`,
          name: `${company.name} Plus`,
          description: "Balanced monthly plan with bonus points and selected partner perks.",
          price: 19.99 + i,
          renewalValue: 1,
          renewalUnit: "month",
          promoBonusDays: 14,
        },
        {
          slug: `${company.slug}-annual`,
          name: `${company.name} Annual`,
          description: "Annual commitment with best unit economics and premium perks.",
          price: 199.99 + i * 10,
          renewalValue: 1,
          renewalUnit: "year",
          promoBonusDays: 30,
        },
      ];

      for (const seed of seeds) {
        companySubscriptions.push(
          await prisma.subscription.create({
            data: {
              slug: seed.slug,
              name: seed.name,
              description: seed.description,
              price: seed.price,
              renewalPeriod:
                seed.renewalUnit === "year"
                  ? "1 year"
                  : `${seed.renewalValue} ${seed.renewalUnit}`,
              renewalValue: seed.renewalValue,
              renewalUnit: seed.renewalUnit,
              promoBonusDays: seed.promoBonusDays,
              promoEndsAt: daysFromNow(60 + i * 5),
              isActive: true,
              companyId: company.id,
              categoryId: primaryCategoryId,
              createdAt: daysAgo(85 - i * 3),
            },
          }),
        );
      }
    }

    const globalSubscriptionSeeds = [
      { slug: "global-coffee-pass", name: "Global Coffee Pass", categorySlug: "coffee", price: 14.99 },
      { slug: "global-fitness-pass", name: "Global Fitness Pass", categorySlug: "fitness", price: 29.99 },
      { slug: "global-beauty-pass", name: "Global Beauty Pass", categorySlug: "beauty", price: 24.99 },
      { slug: "global-food-pass", name: "Global Food Pass", categorySlug: "food", price: 18.49 },
      { slug: "global-retail-pass", name: "Global Retail Pass", categorySlug: "retail", price: 15.49 },
    ];
    const globalSubscriptions = [];
    for (const seed of globalSubscriptionSeeds) {
      const category = categoryBySlug.get(seed.categorySlug);
      if (!category) continue;
      globalSubscriptions.push(
        await prisma.subscription.create({
          data: {
            slug: seed.slug,
            name: seed.name,
            description: `${seed.name} with cross-company benefits and bonus rewards.`,
            price: seed.price,
            renewalPeriod: "1 month",
            renewalValue: 1,
            renewalUnit: "month",
            promoBonusDays: 10,
            promoEndsAt: daysFromNow(75),
            isActive: true,
            companyId: null,
            categoryId: category.id,
            createdAt: daysAgo(70),
          },
        }),
      );
    }

    const allSubscriptions = [...companySubscriptions, ...globalSubscriptions];

    for (let i = 0; i < users.length; i += 1) {
      const user = users[i];
      const tokenBase = `${user.email}:${i}:refresh`;
      await prisma.refreshToken.create({
        data: {
          tokenHash: tokenHash(tokenBase),
          userId: user.id,
          expiresAt: daysFromNow(20 + (i % 7)),
          createdAt: daysAgo(3 + (i % 9)),
          revokedAt: i % 6 === 0 ? daysAgo(1) : null,
        },
      });

      const loginCount = 1 + (i % 3);
      for (let j = 0; j < loginCount; j += 1) {
        await prisma.loginEvent.create({
          data: {
            userId: user.id,
            ipAddress: `10.10.${i}.${j + 10}`,
            countryCode: pick(["US", "DE", "PL", "RU", "AE"], i + j),
            city: pick(["New York", "Berlin", "Warsaw", "Moscow", "Dubai"], i + j),
            userAgent: pick(
              [
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)",
                "Mozilla/5.0 (Linux; Android 14)",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3)",
              ],
              i + j,
            ),
            deviceLabel: pick(["iOS", "Android", "Desktop"], i + j),
            requestId: randomUUID(),
            createdAt: daysAgo((i % 10) + j),
          },
        });
      }
    }

    for (let i = 0; i < 6; i += 1) {
      const user = users[i];
      await prisma.oAuthAccount.create({
        data: {
          provider: i % 2 === 0 ? "telegram" : "google",
          providerAccountId: `${i % 2 === 0 ? "tg" : "gg"}-${1000 + i}`,
          userId: user.id,
          accessToken: `access-token-${i}`,
          refreshToken: `refresh-token-${i}`,
          expiresAt: daysFromNow(30 + i),
          scope: i % 2 === 0 ? "profile" : "profile email",
          createdAt: daysAgo(20 - i),
        },
      });
    }

    for (let i = 0; i < clients.length; i += 1) {
      const user = clients[i];
      const favorites = [
        categories[i % categories.length],
        categories[(i + 2) % categories.length],
        categories[(i + 4) % categories.length],
      ];
      for (const favorite of favorites) {
        await prisma.userFavoriteCategory.create({
          data: {
            userId: user.id,
            categoryId: favorite.id,
            createdAt: daysAgo(40 - i),
          },
        });
      }
    }

    const linkPairs = [];
    for (let i = 0; i < clients.length; i += 1) {
      const user = clients[i];
      const memberships = 2 + (i % 3); // 2..4 companies per client
      const usedCompanyIds = new Set();
      for (let j = 0; j < memberships; j += 1) {
        const company = companies[(i + j) % companies.length];
        if (usedCompanyIds.has(company.id)) continue;
        usedCompanyIds.add(company.id);
        const balance = 80 + i * 35 + j * 20;
        await prisma.userCompany.create({
          data: {
            userId: user.id,
            companyId: company.id,
            balance,
            pointsToNextReward: Math.max(10, company.pointsPerReward - (balance % company.pointsPerReward)),
            expiringPoints: 20 + ((i + j) % 5) * 15,
            expiringDate: daysFromNow(20 + ((i + j) % 10)),
            createdAt: daysAgo(50 - i),
          },
        });
        linkPairs.push({ userId: user.id, companyId: company.id });
      }
    }

    for (let i = 0; i < linkPairs.length; i += 1) {
      const link = linkPairs[i];
      const earnAmount = 120 + (i % 6) * 30;
      const spendAmount = 40 + (i % 4) * 15;
      await prisma.loyaltyTransaction.createMany({
        data: [
          {
            userId: link.userId,
            companyId: link.companyId,
            type: "EARN",
            status: "ACTIVE",
            amount: earnAmount,
            description: "Purchase cashback",
            occurredAt: daysAgo(12 - (i % 5)),
            createdAt: daysAgo(12 - (i % 5)),
          },
          {
            userId: link.userId,
            companyId: link.companyId,
            type: "SPEND",
            status: "ACTIVE",
            amount: spendAmount,
            description: "Reward redemption",
            occurredAt: daysAgo(6 - (i % 3)),
            createdAt: daysAgo(6 - (i % 3)),
          },
          {
            userId: link.userId,
            companyId: link.companyId,
            type: "EARN",
            status: "EXPIRED",
            amount: 30 + (i % 5) * 10,
            description: "Expired bonus points",
            occurredAt: daysAgo(90 + (i % 12)),
            createdAt: daysAgo(90 + (i % 12)),
          },
        ],
      });
    }

    for (let i = 0; i < clients.length; i += 1) {
      const user = clients[i];
      const count = 1 + (i % 4); // 1..4 subscriptions
      for (let j = 0; j < count; j += 1) {
        const sub = allSubscriptions[(i * 2 + j) % allSubscriptions.length];
        await prisma.userSubscription.create({
          data: {
            userId: user.id,
            subscriptionId: sub.id,
            status: "ACTIVE",
            activatedAt: daysAgo(20 - (i % 6)),
            expiresAt: daysFromNow(40 + (j * 20) + (i % 10)),
            willAutoRenew: (i + j) % 4 !== 0,
            createdAt: daysAgo(20 - (i % 6)),
          },
        });
      }
    }

    if (admin) {
      const targetUser = clients[0];
      await prisma.emailChangeRequest.create({
        data: {
          tokenHash: tokenHash("email-change-used"),
          userId: targetUser.id,
          requestedByUserId: admin.id,
          oldEmail: targetUser.email,
          newEmail: "emma.clark.new@nearloy.test",
          expiresAt: daysFromNow(2),
          usedAt: daysAgo(1),
          createdAt: daysAgo(3),
        },
      });
      await prisma.emailChangeRequest.create({
        data: {
          tokenHash: tokenHash("email-change-revoked"),
          userId: clients[1].id,
          requestedByUserId: admin.id,
          oldEmail: clients[1].email,
          newEmail: "liam.scott.new@nearloy.test",
          expiresAt: daysFromNow(2),
          revokedAt: daysAgo(1),
          createdAt: daysAgo(2),
        },
      });

      await prisma.auditEvent.createMany({
        data: [
          {
            workspace: "MANAGER",
            level: "INFO",
            category: "SUBSCRIPTION",
            action: "Seeded subscription analytics demo dataset",
            details: "20 users, 5 companies and active subscription assignments created.",
            actorUserId: admin.id,
            actorLabel: admin.email,
            targetLabel: "system",
            result: "SUCCESS",
            tags: ["SEED", "SUBSCRIPTIONS"],
            createdAt: daysAgo(1),
          },
          {
            workspace: "MANAGER",
            level: "WARN",
            category: "SECURITY",
            action: "High churn watcher initialized",
            details: "Synthetic alert for demo dashboard behavior validation.",
            actorUserId: admin.id,
            actorLabel: admin.email,
            targetLabel: "subscriptions",
            result: "BLOCKED",
            tags: ["SEED", "ALERT"],
            createdAt: daysAgo(1),
          },
        ],
      });
    }

    const counts = await Promise.all([
      prisma.user.count(),
      prisma.company.count(),
      prisma.subscription.count(),
      prisma.userSubscription.count(),
      prisma.userSubscription.count({ where: { status: "ACTIVE", expiresAt: { gt: new Date() } } }),
    ]);

    console.log("Seed completed successfully.");
    console.log(`Users: ${counts[0]} (target: 20)`);
    console.log(`Companies: ${counts[1]} (target: 5)`);
    console.log(`Subscriptions catalog: ${counts[2]}`);
    console.log(`User subscriptions total: ${counts[3]}`);
    console.log(`User subscriptions active and not expired: ${counts[4]}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Seed failed.");
  console.error(error);
  process.exit(1);
});
