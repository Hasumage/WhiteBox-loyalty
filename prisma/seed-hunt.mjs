import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  HuntBoxType,
  HuntCardRarity,
  HuntElement,
  HuntMissionKind,
  HuntPlaceSource,
  HuntReactionType,
  PrismaClient,
} from "@prisma/client";
import { Pool } from "pg";

const speciesSeeds = [
  {
    slug: "coffee-ember",
    name: "Coffee Ember",
    element: HuntElement.FLAME,
    categorySlug: "coffee",
    baseRarity: HuntCardRarity.COMMON,
    sortOrder: 10,
    baseStats: { health: 4, attack: 4, luck: 3, evasion: 5 },
    traitPool: ["Morning glow", "Cafe memory", "Warm start"],
    visualPrompt: "Cute coffee ember creature with bean shell, steam horns and cyan Nearloy star mark.",
    imageUrl: "/hunt-assets/cards/coffee-ember.webp",
  },
  {
    slug: "map-tide",
    name: "Map Tide",
    element: HuntElement.WATER,
    categorySlug: "travel",
    baseRarity: HuntCardRarity.UNCOMMON,
    sortOrder: 20,
    baseStats: { health: 4, attack: 4, luck: 5, evasion: 3 },
    traitPool: ["Route finder", "Rain walk", "Hidden turn"],
    visualPrompt: "Translucent water-drop navigation creature with map-pin fins and glowing route lines.",
    imageUrl: "/hunt-assets/cards/water-route.webp?v=2",
  },
  {
    slug: "bloom-sprout",
    name: "Bloom Sprout",
    element: HuntElement.NATURE,
    categorySlug: "health",
    baseRarity: HuntCardRarity.UNCOMMON,
    sortOrder: 30,
    baseStats: { health: 5, attack: 3, luck: 4, evasion: 4 },
    traitPool: ["Fresh air", "Quiet place", "Green lens"],
    visualPrompt: "Leafy sprout creature with camera charm, cyan veins and soft park energy.",
    imageUrl: "/hunt-assets/cards/nature-sprout.webp",
  },
  {
    slug: "neon-echo",
    name: "Neon Echo",
    element: HuntElement.MUSIC,
    categorySlug: "entertainment",
    baseRarity: HuntCardRarity.RARE,
    sortOrder: 40,
    baseStats: { health: 4, attack: 5, luck: 4, evasion: 3 },
    traitPool: ["Signal boost", "Night pulse", "Crowd rhythm"],
    visualPrompt: "Tiny floating sound creature with equalizer wings, headphone halo and cyan glow.",
    imageUrl: "/hunt-assets/cards/neon-sound.webp?v=2",
  },
  {
    slug: "receipt-munch",
    name: "Receipt Munch",
    element: HuntElement.WIND,
    categorySlug: "retail",
    baseRarity: HuntCardRarity.RARE,
    sortOrder: 50,
    baseStats: { health: 3, attack: 4, luck: 5, evasion: 5 },
    traitPool: ["Proof hunter", "Bonus bite", "Useful detail"],
    visualPrompt: "Funny small creature that eats receipts and turns useful posts into glowing boxes.",
    imageUrl: "/hunt-assets/cards/receipt-munch.webp?v=2",
  },
  {
    slug: "sweet-orbit",
    name: "Sweet Orbit",
    element: HuntElement.NATURE,
    categorySlug: "food",
    baseRarity: HuntCardRarity.EPIC,
    sortOrder: 60,
    baseStats: { health: 5, attack: 5, luck: 5, evasion: 3 },
    traitPool: ["Dessert magnet", "Shareable bite", "Soft landing"],
    visualPrompt: "Round dessert comet creature with sugar rings, bright eyes and cyan star sprinkles.",
    imageUrl: "/hunt-assets/cards/sweet-comet.webp",
  },
  {
    slug: "district-lumen",
    name: "District Lumen",
    element: HuntElement.LIGHT,
    categorySlug: "services",
    baseRarity: HuntCardRarity.LEGENDARY,
    sortOrder: 70,
    baseStats: { health: 9, attack: 9, luck: 9, evasion: 8 },
    traitPool: ["Founder aura", "Local legend", "North star"],
    visualPrompt: "Rare tiny compass-light creature that marks a player's influence in a district.",
    imageUrl: "/hunt-assets/cards/compass-light.webp",
  },
  {
    slug: "chai-flare",
    name: "Chai Flare",
    element: HuntElement.FLAME,
    categorySlug: "food",
    baseRarity: HuntCardRarity.COMMON,
    sortOrder: 80,
    baseStats: { health: 4, attack: 5, luck: 3, evasion: 3 },
    traitPool: ["Spiced spark", "Warm lens", "Street snack"],
    visualPrompt: "Cute spicy flame creature with cinnamon horns, glowing cheeks and a tiny Nearloy star badge.",
    imageUrl: "/hunt-assets/cards/creatures/chai-flare.webp?v=2",
  },
  {
    slug: "metro-breeze",
    name: "Metro Breeze",
    element: HuntElement.WIND,
    categorySlug: "services",
    baseRarity: HuntCardRarity.COMMON,
    sortOrder: 90,
    baseStats: { health: 3, attack: 3, luck: 4, evasion: 5 },
    traitPool: ["Fast transfer", "Ticket shine", "Platform calm"],
    visualPrompt: "Small rounded metro-token creature with wind swirl paws, cyan turnstile glow and curious eyes.",
    imageUrl: "/hunt-assets/cards/creatures/metro-breeze.webp?v=2",
  },
  {
    slug: "rainy-pin",
    name: "Rainy Pin",
    element: HuntElement.WATER,
    categorySlug: "travel",
    baseRarity: HuntCardRarity.COMMON,
    sortOrder: 100,
    baseStats: { health: 3, attack: 4, luck: 5, evasion: 4 },
    traitPool: ["Umbrella route", "Wet neon", "Soft detour"],
    visualPrompt: "Tiny raindrop map-pin creature with umbrella ears and blue route light inside its body.",
    imageUrl: "/hunt-assets/cards/creatures/rainy-pin.webp",
  },
  {
    slug: "moss-button",
    name: "Moss Button",
    element: HuntElement.NATURE,
    categorySlug: "health",
    baseRarity: HuntCardRarity.UNCOMMON,
    sortOrder: 110,
    baseStats: { health: 5, attack: 3, luck: 4, evasion: 5 },
    traitPool: ["Bench friend", "Green pause", "Quiet roots"],
    visualPrompt: "Round mossy creature like a park button with leaf ears, tiny camera strap and cyan dew.",
    imageUrl: "/hunt-assets/cards/creatures/moss-button.webp",
  },
  {
    slug: "karaoke-puff",
    name: "Karaoke Puff",
    element: HuntElement.MUSIC,
    categorySlug: "entertainment",
    baseRarity: HuntCardRarity.UNCOMMON,
    sortOrder: 120,
    baseStats: { health: 5, attack: 5, luck: 4, evasion: 3 },
    traitPool: ["Hook chorus", "Room echo", "Night smile"],
    visualPrompt: "Fluffy sound-wave creature with microphone tail, equalizer freckles and bright cyan rhythm rings.",
    imageUrl: "/hunt-assets/cards/creatures/karaoke-puff.webp?v=2",
  },
  {
    slug: "mirror-spritz",
    name: "Mirror Spritz",
    element: HuntElement.LIGHT,
    categorySlug: "beauty",
    baseRarity: HuntCardRarity.RARE,
    sortOrder: 130,
    baseStats: { health: 5, attack: 4, luck: 3, evasion: 4 },
    traitPool: ["Fresh reflection", "Glow check", "Soft sparkle"],
    visualPrompt: "Cute light creature made of mirror shine and mist, with tiny salon comb wings.",
    imageUrl: "/hunt-assets/cards/creatures/mirror-spritz.webp?v=2",
  },
  {
    slug: "coupon-gust",
    name: "Coupon Gust",
    element: HuntElement.WIND,
    categorySlug: "retail",
    baseRarity: HuntCardRarity.RARE,
    sortOrder: 140,
    baseStats: { health: 4, attack: 5, luck: 5, evasion: 4 },
    traitPool: ["Lucky shelf", "Secret promo", "Cart orbit"],
    visualPrompt: "Small wind coupon creature with swirling receipt ribbon and floating Nearloy coin sparks.",
    imageUrl: "/hunt-assets/cards/creatures/coupon-gust-v2.webp",
  },
  {
    slug: "latte-moon",
    name: "Latte Moon",
    element: HuntElement.SHADOW,
    categorySlug: "coffee",
    baseRarity: HuntCardRarity.EPIC,
    sortOrder: 150,
    baseStats: { health: 5, attack: 4, luck: 4, evasion: 5 },
    traitPool: ["Late table", "Silent foam", "Afterhours focus"],
    visualPrompt: "Night cafe creature with crescent foam cap, sleepy bright eyes and a dark cyan aura.",
    imageUrl: "/hunt-assets/cards/creatures/latte-moon.webp",
  },
  {
    slug: "berry-loop",
    name: "Berry Loop",
    element: HuntElement.NATURE,
    categorySlug: "food",
    baseRarity: HuntCardRarity.EPIC,
    sortOrder: 160,
    baseStats: { health: 5, attack: 5, luck: 5, evasion: 3 },
    traitPool: ["Dessert trail", "Pink comet", "Share bite"],
    visualPrompt: "Cute berry dessert creature with orbiting jam rings, sprinkle stars and glossy eyes.",
    imageUrl: "/hunt-assets/cards/creatures/berry-loop.webp?v=2",
  },
  {
    slug: "aurora-ticket",
    name: "Aurora Ticket",
    element: HuntElement.LIGHT,
    categorySlug: "travel",
    baseRarity: HuntCardRarity.LEGENDARY,
    sortOrder: 170,
    baseStats: { health: 8, attack: 9, luck: 9, evasion: 9 },
    traitPool: ["City miracle", "Hidden gate", "Rare route"],
    visualPrompt: "Legendary aurora ticket creature with folded-map wings, cyan star core and golden route lines.",
    imageUrl: "/hunt-assets/cards/creatures/aurora-ticket.webp?v=2",
  },
  {
    slug: "velvet-eclipse",
    name: "Velvet Eclipse",
    element: HuntElement.SHADOW,
    categorySlug: "entertainment",
    baseRarity: HuntCardRarity.LEGENDARY,
    sortOrder: 180,
    baseStats: { health: 8, attack: 9, luck: 9, evasion: 9 },
    traitPool: ["Moon silence", "Hidden applause", "Velvet night"],
    visualPrompt: "Legendary cute shadow creature with crescent ears, smoky ribbon tail, cyan Nearloy star core and violet-gold eclipse aura.",
    imageUrl: "/hunt-assets/cards/creatures/velvet-eclipse.png",
  },
];

function normalizeCardStats(stats) {
  const source = stats && typeof stats === "object" && !Array.isArray(stats) ? stats : {};
  return {
    health: Number(source.health ?? source.charm ?? 0),
    attack: Number(source.attack ?? source.spark ?? 0),
    luck: Number(source.luck ?? 0),
    evasion: Number(source.evasion ?? source.focus ?? 0),
  };
}

const missionSeeds = [
  {
    slug: "onboarding-first-post",
    title: "First city post",
    description: "Create your first GPS-bound post about a place.",
    kind: HuntMissionKind.ONBOARDING,
    targetAction: "POST_CREATED",
    targetCount: 1,
    rewardInfluence: 80,
    rewardXp: 40,
    rewardBoxType: HuntBoxType.POST,
  },
  {
    slug: "daily-three-likes",
    title: "Useful signal",
    description: "Receive three Nearloy likes on Hunt posts.",
    kind: HuntMissionKind.DAILY,
    targetAction: "LIKE_RECEIVED",
    targetCount: 3,
    rewardInfluence: 60,
    rewardXp: 30,
    rewardBoxType: HuntBoxType.DAILY,
  },
  {
    slug: "weekly-three-places",
    title: "Scout a district",
    description: "Publish posts about three different places.",
    kind: HuntMissionKind.WEEKLY,
    targetAction: "UNIQUE_PLACE_POSTED",
    targetCount: 3,
    rewardInfluence: 180,
    rewardXp: 90,
    rewardBoxType: HuntBoxType.DISTRICT,
  },
];

const placeSeeds = [
  { slug: "nh-demo-coffee-corner", name: "Coffee Corner", categorySlug: "coffee", city: "Moscow", district: "Center", address: "Москва, Тверская улица, 7", latitude: 55.7601, longitude: 37.6118, tags: ["coffee", "work"] },
  { slug: "nh-demo-river-walk", name: "River Walk", categorySlug: "travel", city: "Moscow", district: "Embankment", address: "Москва, Крымская набережная", latitude: 55.7353, longitude: 37.5987, tags: ["walk", "route"] },
  { slug: "nh-demo-green-break", name: "Green Break", categorySlug: "health", city: "Moscow", district: "Park", address: "Москва, Нескучный сад", latitude: 55.7197, longitude: 37.5905, tags: ["calm", "healthy"] },
];

const huntDemoUsers = [
  { name: "Emma Clark", email: "emma.clark@nearloy.test" },
  { name: "Liam Scott", email: "liam.scott@nearloy.test" },
  { name: "Olivia Reed", email: "olivia.reed@nearloy.test" },
];

const demoPostSeeds = [
  {
    userEmail: "emma.clark@nearloy.test",
    placeSlug: "nh-demo-coffee-corner",
    categorySlug: "coffee",
    caption: "Утренний кофе, тихий стол у окна и нормальный Wi-Fi. Хорошая точка, чтобы начать рабочий день и не выпадать из города.",
    tags: ["coffee", "work", "morning"],
    moodTags: ["уютно", "фокус"],
    rating: 5,
    score: 96,
    likeCount: 7,
    createdHoursAgo: 2,
    mediaUrls: ["/hunt-assets/posts/demo-coffee-corner.webp"],
  },
  {
    userEmail: "liam.scott@nearloy.test",
    placeSlug: "nh-demo-river-walk",
    categorySlug: "travel",
    caption: "Маршрут вдоль воды выглядит как бесплатная перезагрузка. Особенно вечером, когда город светится и хочется пройти ещё квартал.",
    tags: ["walk", "city", "route"],
    moodTags: ["спокойно", "вечер"],
    rating: 4,
    score: 72,
    likeCount: 5,
    createdHoursAgo: 5,
    mediaUrls: ["/hunt-assets/posts/demo-river-walk.webp"],
  },
  {
    userEmail: "olivia.reed@nearloy.test",
    placeSlug: "nh-demo-green-break",
    categorySlug: "health",
    caption: "Зелёная пауза между делами. Тут легко сделать короткую прогулку, подышать и вернуться к задачам без ощущения, что день съел тебя целиком.",
    tags: ["health", "park", "pause"],
    moodTags: ["свежо", "тихо"],
    rating: 5,
    score: 84,
    likeCount: 6,
    createdHoursAgo: 8,
    mediaUrls: ["/hunt-assets/posts/demo-green-break.webp"],
  },
];

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const categories = await prisma.category.findMany();
    const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));

    for (const seed of speciesSeeds) {
      await prisma.huntCreatureSpecies.upsert({
        where: { slug: seed.slug },
        update: {
          name: seed.name,
          description: seed.visualPrompt,
          element: seed.element,
          baseRarity: seed.baseRarity,
          categoryId: categoryBySlug.get(seed.categorySlug)?.id,
          baseStats: seed.baseStats,
          traitPool: seed.traitPool,
          visualPrompt: seed.visualPrompt,
          imageUrl: seed.imageUrl,
          sortOrder: seed.sortOrder,
          isActive: true,
        },
        create: {
          slug: seed.slug,
          name: seed.name,
          description: seed.visualPrompt,
          element: seed.element,
          baseRarity: seed.baseRarity,
          categoryId: categoryBySlug.get(seed.categorySlug)?.id,
          baseStats: seed.baseStats,
          traitPool: seed.traitPool,
          visualPrompt: seed.visualPrompt,
          imageUrl: seed.imageUrl,
          sortOrder: seed.sortOrder,
          isActive: true,
        },
      });
    }

    await prisma.huntCreatureSpecies.updateMany({
      where: { slug: "metro-pebble" },
      data: {
        element: HuntElement.WIND,
        imageUrl: "/hunt-assets/cards/creatures/metro-pebble.png",
        isActive: false,
      },
    });

    await prisma.huntCreatureSpecies.updateMany({
      where: { slug: "coupon-wisp" },
      data: {
        element: HuntElement.WIND,
        imageUrl: "/hunt-assets/cards/creatures/coupon-wisp.png",
        isActive: false,
      },
    });

    const existingCards = await prisma.huntCard.findMany({ select: { id: true, stats: true } });
    for (const card of existingCards) {
      const stats = normalizeCardStats(card.stats);
      await prisma.huntCard.update({
        where: { id: card.id },
        data: { stats },
      });
    }

    for (const seed of missionSeeds) {
      await prisma.huntMission.upsert({
        where: { slug: seed.slug },
        update: seed,
        create: seed,
      });
    }

    const demoUser = await prisma.user.findFirst({ where: { role: "CLIENT" }, orderBy: { id: "asc" } });
    for (const seed of placeSeeds) {
      await prisma.huntPlace.upsert({
        where: { slug: seed.slug },
        update: {
          name: seed.name,
          categoryId: categoryBySlug.get(seed.categorySlug)?.id,
          city: seed.city,
          district: seed.district,
          address: seed.address,
          latitude: seed.latitude,
          longitude: seed.longitude,
          tags: seed.tags,
          source: HuntPlaceSource.SYSTEM_SEEDED,
        },
        create: {
          slug: seed.slug,
          name: seed.name,
          categoryId: categoryBySlug.get(seed.categorySlug)?.id,
          city: seed.city,
          district: seed.district,
          address: seed.address,
          latitude: seed.latitude,
          longitude: seed.longitude,
          tags: seed.tags,
          source: HuntPlaceSource.SYSTEM_SEEDED,
          createdById: demoUser?.id,
        },
      });
    }

    const demoUsers = new Map();
    for (const seed of huntDemoUsers) {
      const user = await prisma.user.upsert({
        where: { email: seed.email },
        update: { name: seed.name, role: "CLIENT", accountStatus: "ACTIVE", deletionScheduledAt: null },
        create: {
          name: seed.name,
          email: seed.email,
          role: "CLIENT",
          emailVerifiedAt: new Date(),
          accountStatus: "ACTIVE",
        },
      });
      demoUsers.set(seed.email, user);
      await prisma.huntPlayerProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id, influenceBalance: 420, lifetimeInfluence: 420, xp: 180, level: 2 },
      });
    }

    const placeBySlug = new Map((await prisma.huntPlace.findMany({ where: { slug: { in: placeSeeds.map((seed) => seed.slug) } } })).map((place) => [place.slug, place]));
    const users = [...demoUsers.values()];

    for (const seed of demoPostSeeds) {
      const user = demoUsers.get(seed.userEmail);
      const place = placeBySlug.get(seed.placeSlug);
      const category = categoryBySlug.get(seed.categorySlug);
      if (!user || !place) continue;

      const existing = await prisma.huntPost.findFirst({
        where: { userId: user.id, caption: seed.caption },
        select: { id: true },
      });
      const createdAt = hoursAgo(seed.createdHoursAgo);
      const post = existing
        ? await prisma.huntPost.update({
            where: { id: existing.id },
            data: {
              placeId: place.id,
              categoryId: category?.id,
              tags: seed.tags,
              moodTags: seed.moodTags,
              rating: seed.rating,
              photoUrl: seed.mediaUrls[0],
              mediaUrls: seed.mediaUrls,
              likeCount: seed.likeCount,
              score: seed.score,
              latitude: place.latitude,
              longitude: place.longitude,
              locationAccuracy: 42,
              gpsConfidence: 100,
              createdAt,
            },
          })
        : await prisma.huntPost.create({
            data: {
              userId: user.id,
              placeId: place.id,
              categoryId: category?.id,
              caption: seed.caption,
              tags: seed.tags,
              moodTags: seed.moodTags,
              rating: seed.rating,
              photoUrl: seed.mediaUrls[0],
              mediaUrls: seed.mediaUrls,
              likeCount: seed.likeCount,
              score: seed.score,
              latitude: place.latitude,
              longitude: place.longitude,
              locationAccuracy: 42,
              gpsConfidence: 100,
              createdAt,
            },
          });

      const reactors = users.filter((candidate) => candidate.id !== user.id).slice(0, 2);
      for (const reactor of reactors) {
        await prisma.huntPostReaction.upsert({
          where: { postId_userId_type: { postId: post.id, userId: reactor.id, type: HuntReactionType.LIKE } },
          update: {},
          create: { postId: post.id, userId: reactor.id, type: HuntReactionType.LIKE, createdAt },
        });
      }

      await prisma.huntPlace.update({
        where: { id: place.id },
        data: { postCount: 1, likeCount: seed.likeCount },
      });
    }

    console.log("Nearloy Hunt seed completed.");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
