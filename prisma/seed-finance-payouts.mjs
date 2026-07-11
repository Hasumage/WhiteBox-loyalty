import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const DAY_MS = 24 * 60 * 60 * 1000;
const TEST_PREFIX = "TEST PAYOUT";
let prisma;

function daysFromNow(days) {
  return new Date(Date.now() + days * DAY_MS);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = new Pool({ connectionString });
  prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const company = await prisma.company.findFirst({
    where: { isActive: true },
    orderBy: { id: "asc" },
    include: { category: true, owner: true },
  });
  if (!company) {
    throw new Error("No active company found. Run npm run db:seed first.");
  }

  const category = company.category ?? (await prisma.category.findFirst({ orderBy: { id: "asc" } }));
  if (!category) {
    throw new Error("No category found. Run npm run db:seed first.");
  }

  const clients = await prisma.user.findMany({
    where: { role: "CLIENT", accountStatus: "ACTIVE" },
    orderBy: { id: "asc" },
    take: 6,
  });
  if (clients.length < 3) {
    throw new Error("Need at least 3 active CLIENT users. Run npm run db:seed first.");
  }

  const admin = await prisma.user.findFirst({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, accountStatus: "ACTIVE" },
    orderBy: { id: "asc" },
  });
  const prAgent =
    (await prisma.user.findFirst({
      where: { email: "priya.growth@nearloy.test" },
      orderBy: { id: "asc" },
    })) ??
    (await prisma.user.findFirst({
      where: { role: { in: ["MANAGER", "SUPPORT", "ADMIN"] }, accountStatus: "ACTIVE" },
      orderBy: { id: "asc" },
    }));

  if (!prAgent) {
    throw new Error("No PR/manager user found for referral payout seed.");
  }

  await prisma.company.update({
    where: { id: company.id },
    data: {
      payoutBankName: company.payoutBankName ?? "Тест Банк",
      payoutBik: company.payoutBik ?? "044525225",
      payoutAccount: company.payoutAccount ?? "40702810900000000001",
      payoutCorrespondentAccount: company.payoutCorrespondentAccount ?? "30101810400000000225",
      payoutCardLast4: company.payoutCardLast4 ?? "4242",
      verificationStatus: "APPROVED",
      identityVerificationCompleted: true,
    },
  });

  const subscription = await prisma.subscription.upsert({
    where: { slug: `finance-payout-test-${company.slug}` },
    update: {
      name: "Finance payout test plan",
      description: "Seed plan that creates recognized revenue for manual payout testing.",
      price: 100000,
      renewalPeriod: "monthly",
      renewalValue: 1,
      renewalUnit: "month",
      isActive: true,
      companyId: company.id,
      categoryId: category.id,
    },
    create: {
      slug: `finance-payout-test-${company.slug}`,
      name: "Finance payout test plan",
      description: "Seed plan that creates recognized revenue for manual payout testing.",
      price: 100000,
      renewalPeriod: "monthly",
      renewalValue: 1,
      renewalUnit: "month",
      isActive: true,
      companyId: company.id,
      categoryId: category.id,
    },
  });

  await prisma.userSubscription.deleteMany({ where: { subscriptionId: subscription.id } });
  await prisma.userSubscription.createMany({
    data: clients.map((client, index) => ({
      userId: client.id,
      subscriptionId: subscription.id,
      status: "ACTIVE",
      activatedAt: daysFromNow(-18 - index),
      expiresAt: daysFromNow(12 - index),
      willAutoRenew: true,
      createdAt: daysFromNow(-18 - index),
    })),
  });

  await prisma.companyReferral.upsert({
    where: { companyId: company.id },
    update: {
      referrerUserId: prAgent.id,
      status: "ACTIVE",
      pipelineStatus: "REVENUE_ACTIVE",
      referralPercent: 1,
      source: "SEED_FINANCE_PAYOUTS",
      notes: "Seed referral used to test PR payout coverage.",
    },
    create: {
      companyId: company.id,
      referrerUserId: prAgent.id,
      status: "ACTIVE",
      pipelineStatus: "REVENUE_ACTIVE",
      referralPercent: 1,
      source: "SEED_FINANCE_PAYOUTS",
      notes: "Seed referral used to test PR payout coverage.",
      startedAt: daysFromNow(-30),
    },
  });

  await prisma.financeOperation.deleteMany({
    where: {
      OR: [
        { title: { startsWith: TEST_PREFIX } },
        { title: { startsWith: `Company referral payout request: ${TEST_PREFIX}` } },
      ],
    },
  });

  await prisma.financeOperation.createMany({
    data: [
      {
        type: "PAYOUT_REQUEST",
        status: "PENDING_APPROVAL",
        amount: 1500,
        currency: "RUB",
        companyId: company.id,
        title: `${TEST_PREFIX} — company pending approval`,
        details: "Тестовая заявка компании: должна проходить проверку покрытия и реквизитов.",
        requestedById: company.ownerUserId ?? admin?.id ?? null,
        requestedAt: daysFromNow(-2),
        createdAt: daysFromNow(-2),
      },
      {
        type: "PAYOUT_REQUEST",
        status: "APPROVED",
        amount: 2500,
        currency: "RUB",
        companyId: company.id,
        title: `${TEST_PREFIX} — company ready for manual close`,
        details: "Тестовая заявка компании: можно закрыть вручную после перевода.",
        requestedById: company.ownerUserId ?? admin?.id ?? null,
        approvedById: admin?.id ?? null,
        requestedAt: daysFromNow(-3),
        approvedAt: daysFromNow(-1),
        createdAt: daysFromNow(-3),
      },
      {
        type: "PAYOUT_REQUEST",
        status: "PAID",
        amount: 900,
        currency: "RUB",
        companyId: company.id,
        title: `${TEST_PREFIX} — company manually paid`,
        details: "Тестовая закрытая выплата.\n\n[Finance decision seed]\nStatus: PAID\nMethod: Банковский перевод\nReference: SEED-PAID-001",
        requestedById: company.ownerUserId ?? admin?.id ?? null,
        approvedById: admin?.id ?? null,
        requestedAt: daysFromNow(-6),
        approvedAt: daysFromNow(-5),
        processedAt: daysFromNow(-4),
        createdAt: daysFromNow(-6),
      },
      {
        type: "PAYOUT_REQUEST",
        status: "REJECTED",
        amount: 700,
        currency: "RUB",
        companyId: company.id,
        title: `${TEST_PREFIX} — company rejected`,
        details: "Тестовая отклонённая выплата для проверки истории.",
        requestedById: company.ownerUserId ?? admin?.id ?? null,
        approvedById: admin?.id ?? null,
        requestedAt: daysFromNow(-7),
        approvedAt: daysFromNow(-6),
        createdAt: daysFromNow(-7),
      },
      {
        type: "PAYOUT_REQUEST",
        status: "PENDING_APPROVAL",
        amount: 600,
        currency: "RUB",
        companyId: null,
        title: `Company referral payout request: ${TEST_PREFIX} — PR agent pending approval`,
        details: "Тестовая PR-выплата: покрывается referral-комиссией по seed-компании.",
        requestedById: prAgent.id,
        requestedAt: daysFromNow(-1),
        createdAt: daysFromNow(-1),
      },
      {
        type: "PAYOUT_REQUEST",
        status: "PENDING_APPROVAL",
        amount: 111,
        currency: "RUB",
        companyId: null,
        title: `${TEST_PREFIX} — legacy unlinked payout`,
        details: "Тестовая непривязанная заявка: должна быть заблокирована для апрува/выплаты.",
        requestedById: admin?.id ?? null,
        requestedAt: daysFromNow(-1),
        createdAt: daysFromNow(-1),
      },
    ],
  });

  console.log(`Seeded finance payout test data for company "${company.name}".`);
  console.log("Open /admin/finance and test approve, reject, filters and manual close.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma?.$disconnect();
  });
