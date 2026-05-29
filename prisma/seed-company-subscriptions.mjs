import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, SubscriptionEntitlementWindow } from "@prisma/client";
import { Pool } from "pg";

function plansFor(company) {
  const category = company.category.slug.toLowerCase();
  if (category.includes("fitness") || category.includes("sport")) {
    return [
      {
        suffix: "unlimited",
        name: `${company.name}: Безлимит`,
        description: "Неограниченные посещения клуба в течение месяца.",
        price: 2990,
        entitlement: {
          title: "Вход в клуб",
          description: "Посещайте зал без лимита по количеству входов.",
          windowUnit: SubscriptionEntitlementWindow.UNLIMITED,
        },
      },
      {
        suffix: "trainer",
        name: `${company.name}: Тренировки`,
        description: "Абонемент с еженедельной персональной тренировкой.",
        price: 4490,
        entitlement: {
          title: "Персональная тренировка",
          description: "Одна тренировка с тренером каждую неделю.",
          allowance: 1,
          windowValue: 1,
          windowUnit: SubscriptionEntitlementWindow.WEEK,
        },
      },
    ];
  }
  if (category.includes("coffee") || category.includes("food")) {
    return [
      {
        suffix: "daily",
        name: `${company.name}: Каждый день`,
        description: "Любимый напиток или блюдо каждый день по подписке.",
        price: 1290,
        entitlement: {
          title: "Ежедневная выдача",
          description: "Одна выбранная позиция меню каждый день.",
          allowance: 1,
          windowValue: 1,
          windowUnit: SubscriptionEntitlementWindow.DAY,
        },
      },
      {
        suffix: "monthly-box",
        name: `${company.name}: Месячный набор`,
        description: "Получите большой набор один раз за период подписки.",
        price: 2490,
        entitlement: {
          title: "Фирменный набор",
          description: "Один набор на весь оплаченный месяц.",
          allowance: 1,
          windowValue: 1,
          windowUnit: SubscriptionEntitlementWindow.TERM,
        },
      },
    ];
  }
  return [
    {
      suffix: "club",
      name: `${company.name}: Клуб`,
      description: "Основной ежемесячный тариф с услугой партнера.",
      price: 1490,
      entitlement: {
        title: "Услуга по тарифу",
        description: "Одна услуга каждую неделю.",
        allowance: 1,
        windowValue: 1,
        windowUnit: SubscriptionEntitlementWindow.WEEK,
      },
    },
    {
      suffix: "plus",
      name: `${company.name}: Плюс`,
      description: "Расширенный тариф с более частым использованием.",
      price: 2990,
      entitlement: {
        title: "Премиальная услуга",
        description: "Две услуги каждую неделю.",
        allowance: 2,
        windowValue: 1,
        windowUnit: SubscriptionEntitlementWindow.WEEK,
      },
    },
  ];
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = process.argv.includes("--dry-run");
  if (!apply && !dryRun) {
    throw new Error("This command resets company subscriptions. Run with --dry-run first, then re-run with --apply.");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set.");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const [companies, oldPlans, plansWithoutEntitlements, activeCustomerPlans, oldBundles] = await Promise.all([
      prisma.company.findMany({
        include: { category: { select: { slug: true } } },
        orderBy: { id: "asc" },
      }),
      prisma.subscription.count({ where: { companyId: { not: null } } }),
      prisma.subscription.count({ where: { companyId: { not: null }, entitlements: { none: {} } } }),
      prisma.userSubscription.count({ where: { subscription: { companyId: { not: null } } } }),
      prisma.subscriptionBundle.count(),
    ]);
    console.log(
      `Reset scope: ${companies.length} companies, ${oldPlans} company plans (${plansWithoutEntitlements} without redemption rules), ${activeCustomerPlans} customer plan records, ${oldBundles} paired offers.`,
    );
    if (dryRun) {
      console.log("Dry run only. No subscription data was changed.");
      return;
    }

    let createdPlans = 0;
    await prisma.$transaction(async (tx) => {
      // Company plans own their user subscriptions and redemptions; cascade intentionally clears stale test usage.
      await tx.subscription.deleteMany({ where: { companyId: { not: null } } });
      await tx.subscriptionBundle.deleteMany();

      for (const company of companies) {
        for (const plan of plansFor(company)) {
          await tx.subscription.create({
            data: {
              slug: `seed-${company.slug}-${plan.suffix}`,
              name: plan.name,
              description: plan.description,
              price: plan.price,
              renewalPeriod: "1 month",
              renewalValue: 1,
              renewalUnit: "month",
              isActive: true,
              companyId: company.id,
              categoryId: company.categoryId,
              entitlements: {
                create: {
                  title: plan.entitlement.title,
                  description: plan.entitlement.description,
                  allowance: plan.entitlement.allowance ?? 1,
                  windowValue: plan.entitlement.windowValue ?? 1,
                  windowUnit: plan.entitlement.windowUnit,
                  isActive: true,
                },
              },
            },
          });
          createdPlans += 1;
        }
      }
    }, { timeout: 60_000 });

    console.log(`Company subscription reset complete: ${createdPlans} seeded plans with redemption rules.`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
