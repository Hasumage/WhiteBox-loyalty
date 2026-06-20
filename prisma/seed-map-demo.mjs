import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, SubscriptionSpendPolicy, UserRole } from "@prisma/client";
import { Pool } from "pg";

const DEMO_PASSWORD_HASH = "$2b$12$AYJ2n6Jx6lBWYPNp8RlGhu24yILFqlB2jmP.ylA9d83l8FIfy9dWS"; // DemoPass!123

const categorySeeds = [
  { slug: "coffee", name: "Coffee", icon: "Coffee", description: "Coffee shops and roasteries" },
  { slug: "food", name: "Food", icon: "UtensilsCrossed", description: "Restaurants and casual dining" },
  { slug: "fitness", name: "Fitness", icon: "Dumbbell", description: "Gyms and workout studios" },
  { slug: "beauty", name: "Beauty", icon: "Sparkles", description: "Beauty and personal care" },
  { slug: "retail", name: "Retail", icon: "ShoppingBag", description: "Retail stores and boutiques" },
  { slug: "health", name: "Health", icon: "HeartPulse", description: "Clinics and health services" },
  { slug: "education", name: "Education", icon: "GraduationCap", description: "Courses and education" },
  { slug: "entertainment", name: "Entertainment", icon: "Film", description: "Events and entertainment" },
];

const demoCompanies = [
  {
    slug: "map-demo-coffee-tverskaya",
    name: "Tverskaya Brew",
    description: "Coffee, breakfast and quick loyalty rewards near Tverskaya.",
    categorySlug: "coffee",
    address: "Россия, Москва, Тверская улица, 7",
    title: "Tverskaya",
    latitude: 55.761585,
    longitude: 37.609511,
  },
  {
    slug: "map-demo-food-patriarch",
    name: "Patriarch Kitchen",
    description: "Casual dining with evening rewards around Patriarch Ponds.",
    categorySlug: "food",
    address: "Россия, Москва, Малая Бронная улица, 24",
    title: "Patriarch",
    latitude: 55.763821,
    longitude: 37.594778,
  },
  {
    slug: "map-demo-fitness-arbat",
    name: "Arbat Motion",
    description: "Boutique fitness studio with flexible visit perks.",
    categorySlug: "fitness",
    address: "Россия, Москва, улица Арбат, 12",
    title: "Arbat",
    latitude: 55.750991,
    longitude: 37.595989,
  },
  {
    slug: "map-demo-beauty-color",
    name: "Color Lab Beauty",
    description: "Beauty bar with member treatments and bonus accruals.",
    categorySlug: "beauty",
    address: "Россия, Москва, Цветной бульвар, 15с1",
    title: "Tsvetnoy",
    latitude: 55.771145,
    longitude: 37.620177,
  },
  {
    slug: "map-demo-retail-kuznetsky",
    name: "Kuznetsky Select",
    description: "Lifestyle retail store with client levels and personal offers.",
    categorySlug: "retail",
    address: "Россия, Москва, Кузнецкий Мост, 20",
    title: "Kuznetsky",
    latitude: 55.761309,
    longitude: 37.623109,
  },
  {
    slug: "map-demo-health-chistye",
    name: "Chistye Health",
    description: "Wellness services and preventive care bonuses.",
    categorySlug: "health",
    address: "Россия, Москва, Чистопрудный бульвар, 12к2",
    title: "Chistye",
    latitude: 55.763628,
    longitude: 37.642158,
  },
  {
    slug: "map-demo-education-polyanka",
    name: "Polyanka Academy",
    description: "Short courses, workshops and education subscriptions.",
    categorySlug: "education",
    address: "Россия, Москва, Большая Полянка, 30",
    title: "Polyanka",
    latitude: 55.735866,
    longitude: 37.618098,
  },
  {
    slug: "map-demo-entertainment-theatre",
    name: "Theatre Night Club",
    description: "Events and private community perks around Teatralnaya.",
    categorySlug: "entertainment",
    address: "Россия, Москва, Театральный проезд, 5с1",
    title: "Theatre",
    latitude: 55.759555,
    longitude: 37.620755,
  },
  {
    slug: "map-demo-coffee-zamoskvorechye",
    name: "Zamos Coffee",
    description: "Specialty coffee point with daily drink benefits.",
    categorySlug: "coffee",
    address: "Россия, Москва, Пятницкая улица, 29",
    title: "Pyatnitskaya",
    latitude: 55.740119,
    longitude: 37.629472,
  },
  {
    slug: "map-demo-food-baumanskaya",
    name: "Bauman Grill",
    description: "Lunch and dinner rewards for nearby office clients.",
    categorySlug: "food",
    address: "Россия, Москва, Бауманская улица, 33/2с1",
    title: "Baumanskaya",
    latitude: 55.772764,
    longitude: 37.679464,
  },
  {
    slug: "map-demo-fitness-frunzenskaya",
    name: "Frunze Fitness",
    description: "Training club with unlimited pass test scenarios.",
    categorySlug: "fitness",
    address: "Россия, Москва, Комсомольский проспект, 28",
    title: "Frunzenskaya",
    latitude: 55.726974,
    longitude: 37.578051,
  },
  {
    slug: "map-demo-beauty-sokol",
    name: "Sokol Beauty Room",
    description: "Neighborhood salon with personal loyalty levels.",
    categorySlug: "beauty",
    address: "Россия, Москва, Ленинградский проспект, 75к1",
    title: "Sokol",
    latitude: 55.805056,
    longitude: 37.514797,
  },
  {
    slug: "map-demo-retail-danilov",
    name: "Danilov Market Goods",
    description: "Retail and market offers with QR-based client search.",
    categorySlug: "retail",
    address: "Россия, Москва, Мытная улица, 74",
    title: "Danilov",
    latitude: 55.711534,
    longitude: 37.620739,
  },
  {
    slug: "map-demo-health-krylatskoe",
    name: "Krylatskoe Wellness",
    description: "Healthy services and recurring customer bonuses.",
    categorySlug: "health",
    address: "Россия, Москва, Осенний бульвар, 12",
    title: "Krylatskoe",
    latitude: 55.760072,
    longitude: 37.407119,
  },
  {
    slug: "map-demo-education-university",
    name: "University Skills",
    description: "Education studio for workshops and practical skills.",
    categorySlug: "education",
    address: "Россия, Москва, Ломоносовский проспект, 23",
    title: "University",
    latitude: 55.692453,
    longitude: 37.534754,
  },
  {
    slug: "map-demo-entertainment-vdnkh",
    name: "VDNH Weekend",
    description: "Entertainment partner with events and family bonuses.",
    categorySlug: "entertainment",
    address: "Россия, Москва, проспект Мира, 119",
    title: "VDNH",
    latitude: 55.829831,
    longitude: 37.633869,
  },
  {
    slug: "map-demo-coffee-kurskaya",
    name: "Kurskaya Roasters",
    description: "Coffee bar with subscription-friendly test data.",
    categorySlug: "coffee",
    address: "Россия, Москва, улица Земляной Вал, 33",
    title: "Kurskaya",
    latitude: 55.757339,
    longitude: 37.659173,
  },
  {
    slug: "map-demo-food-taganka",
    name: "Taganka Table",
    description: "Restaurant point with lunch perks and cashback.",
    categorySlug: "food",
    address: "Россия, Москва, Таганская улица, 1с1",
    title: "Taganka",
    latitude: 55.741573,
    longitude: 37.652101,
  },
  {
    slug: "map-demo-fitness-belarus",
    name: "Belarus Fit Lab",
    description: "Fitness and wellness partner near Belorusskaya.",
    categorySlug: "fitness",
    address: "Россия, Москва, Лесная улица, 20с3",
    title: "Belorusskaya",
    latitude: 55.778912,
    longitude: 37.587861,
  },
  {
    slug: "map-demo-beauty-redgate",
    name: "Red Gate Nails",
    description: "Nail studio with visit rewards and profile statuses.",
    categorySlug: "beauty",
    address: "Россия, Москва, Садовая-Спасская улица, 21/1",
    title: "Red Gate",
    latitude: 55.769972,
    longitude: 37.647655,
  },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    console.log("Seeding local map demo companies...");

    const categories = new Map();
    for (const category of categorySeeds) {
      const record = await prisma.category.upsert({
        where: { slug: category.slug },
        update: {
          name: category.name,
          icon: category.icon,
          description: category.description,
        },
        create: category,
      });
      categories.set(category.slug, record);
    }

    for (let index = 0; index < demoCompanies.length; index += 1) {
      const seed = demoCompanies[index];
      const category = categories.get(seed.categorySlug);
      if (!category) {
        throw new Error(`Category ${seed.categorySlug} was not created`);
      }

      const owner = await prisma.user.upsert({
        where: { email: `${seed.slug}@nearloy.test` },
        update: {
          name: `${seed.name} Owner`,
          role: UserRole.COMPANY,
          accountStatus: "ACTIVE",
          emailVerifiedAt: new Date(),
        },
        create: {
          name: `${seed.name} Owner`,
          email: `${seed.slug}@nearloy.test`,
          role: UserRole.COMPANY,
          accountStatus: "ACTIVE",
          passwordHash: DEMO_PASSWORD_HASH,
          emailVerifiedAt: new Date(),
        },
      });

      const company = await prisma.company.upsert({
        where: { slug: seed.slug },
        update: {
          name: seed.name,
          description: seed.description,
          categoryId: category.id,
          pointsPerReward: 100 + (index % 5) * 25,
          subscriptionSpendPolicy: SubscriptionSpendPolicy.INCLUDE_WITH_BONUS,
          isActive: true,
          operatesOnline: false,
          ownerUserId: owner.id,
        },
        create: {
          slug: seed.slug,
          name: seed.name,
          description: seed.description,
          categoryId: category.id,
          pointsPerReward: 100 + (index % 5) * 25,
          subscriptionSpendPolicy: SubscriptionSpendPolicy.INCLUDE_WITH_BONUS,
          isActive: true,
          operatesOnline: false,
          ownerUserId: owner.id,
        },
      });

      await prisma.companyCategory.upsert({
        where: {
          companyId_categoryId: {
            companyId: company.id,
            categoryId: category.id,
          },
        },
        update: {},
        create: {
          companyId: company.id,
          categoryId: category.id,
        },
      });

      const existingMainLocation = await prisma.companyLocation.findFirst({
        where: { companyId: company.id, isMain: true },
        select: { id: true },
      });

      const locationData = {
        title: seed.title,
        address: seed.address,
        city: "Москва",
        latitude: seed.latitude,
        longitude: seed.longitude,
        precision: "manual",
        geocoderResponse: {
          source: "seed-map-demo",
          formattedAddress: seed.address,
        },
        openTime: index % 4 === 0 ? "08:00" : "09:00",
        closeTime: index % 3 === 0 ? "22:00" : "21:00",
        workingDays: [0, 1, 2, 3, 4, 5, 6],
        isMain: true,
        isActive: true,
      };

      if (existingMainLocation) {
        await prisma.companyLocation.update({
          where: { id: existingMainLocation.id },
          data: locationData,
        });
      } else {
        await prisma.companyLocation.create({
          data: {
            ...locationData,
            companyId: company.id,
          },
        });
      }
    }

    const totalLocations = await prisma.companyLocation.count({
      where: { company: { slug: { startsWith: "map-demo-" } } },
    });
    console.log(`Map demo ready: ${demoCompanies.length} companies, ${totalLocations} locations.`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
