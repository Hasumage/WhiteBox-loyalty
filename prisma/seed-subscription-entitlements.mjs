import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, SubscriptionEntitlementWindow } from "@prisma/client";
import { Pool } from "pg";

const { DAY, WEEK, MONTH, UNLIMITED } = SubscriptionEntitlementWindow;

function isPlus(plan) {
  return plan.name.toLowerCase().includes("plus");
}

function isAnnual(plan) {
  return plan.name.toLowerCase().includes("annual");
}

function benefitsFor(plan) {
  const category = plan.category?.slug?.toLowerCase() ?? "";
  const enhanced = isPlus(plan) || isAnnual(plan);

  if (category.includes("coffee")) {
    return [
      {
        title: "Напиток из классического меню",
        description: "Кофе или чай стандартного размера на выбор гостя.",
        allowance: 1,
        windowValue: 1,
        windowUnit: DAY,
      },
      {
        title: enhanced ? "Десерт к напитку" : "Альтернативное молоко",
        description: enhanced
          ? "Один десерт из витрины в дополнение к любимому напитку."
          : "Бесплатная замена молока или сироп для одного напитка.",
        allowance: 1,
        windowValue: 1,
        windowUnit: WEEK,
      },
    ];
  }

  if (category.includes("fitness") || category.includes("sport")) {
    return [
      {
        title: "Доступ в фитнес-клуб",
        description: "Посещение тренировочного зала без ограничения количества входов.",
        allowance: 1,
        windowValue: 1,
        windowUnit: UNLIMITED,
      },
      {
        title: enhanced ? "Персональная тренировка" : "Групповая тренировка",
        description: enhanced
          ? "Одна индивидуальная тренировка с тренером по предварительной записи."
          : "Участие в одной групповой тренировке по расписанию клуба.",
        allowance: 1,
        windowValue: 1,
        windowUnit: enhanced ? MONTH : WEEK,
      },
    ];
  }

  if (category.includes("beauty")) {
    return [
      {
        title: enhanced ? "Уходовая процедура" : "Экспресс-уход",
        description: enhanced
          ? "Одна полноценная уходовая процедура из каталога тарифа."
          : "Быстрая процедура для знакомства с салоном.",
        allowance: 1,
        windowValue: 1,
        windowUnit: MONTH,
      },
      {
        title: "Консультация мастера",
        description: "Подбор ухода и рекомендаций по процедурам.",
        allowance: 1,
        windowValue: 1,
        windowUnit: MONTH,
      },
    ];
  }

  if (category.includes("food")) {
    return [
      {
        title: enhanced ? "Фирменный обед" : "Блюдо дня",
        description: enhanced
          ? "Основное блюдо и напиток из специального меню подписки."
          : "Одно блюдо из ежедневного предложения ресторана.",
        allowance: 1,
        windowValue: 1,
        windowUnit: WEEK,
      },
      {
        title: "Комплимент от кухни",
        description: "Десерт или закуска по выбору ресторана.",
        allowance: 1,
        windowValue: 1,
        windowUnit: MONTH,
      },
    ];
  }

  if (category.includes("retail")) {
    return [
      {
        title: enhanced ? "Купон на скидку 15%" : "Купон на скидку 10%",
        description: "Одно применение скидки к покупке товаров из ассортимента партнера.",
        allowance: 1,
        windowValue: 1,
        windowUnit: MONTH,
      },
      {
        title: enhanced ? "Бесплатная доставка" : "Подарочная упаковка",
        description: enhanced
          ? "Доставка одного заказа без дополнительной платы."
          : "Оформление одной покупки в фирменную подарочную упаковку.",
        allowance: 1,
        windowValue: 1,
        windowUnit: MONTH,
      },
    ];
  }

  return [
    {
      title: "Привилегия участника",
      description: "Одна фирменная услуга партнера в рамках активной подписки.",
      allowance: 1,
      windowValue: 1,
      windowUnit: MONTH,
    },
  ];
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set.");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const emptyPlans = await prisma.subscription.findMany({
      where: { entitlements: { none: {} } },
      include: { category: { select: { slug: true } } },
      orderBy: { id: "asc" },
    });

    let created = 0;
    await prisma.$transaction(async (tx) => {
      for (const plan of emptyPlans) {
        const benefits = benefitsFor(plan);
        await tx.subscriptionEntitlement.createMany({
          data: benefits.map((benefit) => ({
            subscriptionId: plan.id,
            ...benefit,
          })),
        });
        created += benefits.length;
      }
    });

    const totalPlans = await prisma.subscription.count();
    const populatedPlans = await prisma.subscription.count({
      where: { entitlements: { some: {} } },
    });
    console.log(
      `Subscription entitlement seed complete: populated ${emptyPlans.length} plan(s), created ${created} benefit(s). Coverage: ${populatedPlans}/${totalPlans} plans.`,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
