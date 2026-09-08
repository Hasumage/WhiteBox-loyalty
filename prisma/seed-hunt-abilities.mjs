import "dotenv/config";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ABILITIES } from "../src/lib/hunt/tactics.ts";
import { parseAbilityConfig } from "../src/lib/hunt/ability-config.ts";

const power = (stat, factor) => ({ stat, factor });
const damage = (factor) => ({ type: "damage", power: power("attack", factor) });
const buff = (stat, factor) => ({
  type: "buff",
  stat,
  power: power(stat, factor),
  duration: 2,
});
const preset = (cost, target, radius, effects, rangeBonus = 1) => ({
  cost,
  cooldown: 2,
  target,
  radius,
  rangeBonus,
  effects,
});
const presets = {
  ...ABILITIES,
  pulse: preset(3, "enemy", 1, [
    damage(0.8),
    { type: "push", power: power("speed", 0.5) },
  ]),
  tempo: preset(3, "ally", 1, [buff("speed", 0.5), buff("luck", 0.4)]),
  encore: preset(4, "ally", 1, [
    { type: "heal", power: power("hp", 0.18) },
    { type: "shield", power: power("hp", 0.2) },
  ]),
  gust: preset(3, "enemy", 0, [
    damage(0.9),
    { type: "push", power: power("speed", 0.5) },
  ]),
  slipstream: preset(2, "ally", 1, [buff("speed", 0.75)]),
  storm: preset(4, "enemy", 1, [damage(1.1)]),
  sunray: preset(3, "enemy", 0, [damage(1.2)]),
  prism: preset(4, "ally", 1, [
    { type: "shield", power: power("hp", 0.3) },
    buff("luck", 0.3),
  ]),
  siphon: preset(3, "enemy", 0, [
    { type: "lifesteal", power: power("attack", 1), ratio: 0.5 },
  ]),
  nightVeil: preset(3, "self", 0, [
    { type: "shield", power: power("hp", 0.35) },
    buff("speed", 0.5),
  ]),
  eclipse: preset(4, "enemy", 1, [
    { type: "lifesteal", power: power("attack", 0.7), ratio: 0.35 },
  ]),
  sugar: preset(3, "ally", 1, [buff("attack", 0.3), buff("luck", 0.5)]),
};
const definitions = {
  "coffee-ember": [
    ["lavaShield", "Щит из лавы", "Lava Shield", "shield"],
    ["ember", "Тлеющий уголь", "Ember", "flame"],
    ["eruption", "Извержение", "Eruption", "flame"],
  ],
  "map-tide": [
    ["tideLance", "Водяное копьё", "Tide Lance", "droplets"],
    ["tidalWave", "Водоворот", "Whirlpool", "waves"],
    ["waterVeil", "Водяной покров", "Water Veil", "shield"],
  ],
  "bloom-sprout": [
    ["plantain", "Подорожник", "Plantain", "leaf"],
    ["venom", "Ядовитый шип", "Venom Thorn", "skull"],
    ["bloom", "Пробуждение", "Awakening", "sprout"],
  ],
  "neon-echo": [
    ["pulse", "Басовый удар", "Bass Impact", "music"],
    ["tempo", "Разгон ритма", "Tempo Boost", "music"],
    ["encore", "На бис", "Encore", "heart"],
  ],
  "receipt-munch": [
    ["gust", "Бумажный шквал", "Paper Gust", "wind"],
    ["nightVeil", "Чековый панцирь", "Receipt Armor", "shield"],
    ["siphon", "Возврат энергии", "Energy Refund", "heart"],
  ],
  "sweet-orbit": [
    ["plantain", "Сладкая передышка", "Sweet Respite", "heart"],
    ["sugar", "Сахарный заряд", "Sugar Rush", "sparkles"],
    ["tidalWave", "Липкая орбита", "Sticky Orbit", "moon"],
  ],
  "district-lumen": [
    ["sunray", "Уличный луч", "Street Ray", "sun"],
    ["prism", "Световой купол", "Light Dome", "shield"],
    ["plantain", "Тёплый фонарь", "Warm Lantern", "heart"],
  ],
  "chai-flare": [
    ["ember", "Пряная искра", "Spiced Spark", "flame"],
    ["sugar", "Чайная бодрость", "Tea Spirit", "sparkles"],
    ["eruption", "Кипящий всплеск", "Boiling Burst", "flame"],
  ],
  "metro-pebble": [
    ["gust", "Каменный толчок", "Stone Push", "swords"],
    ["lavaShield", "Гранитный щит", "Granite Shield", "shield"],
    ["storm", "Дрожь платформы", "Platform Tremor", "wind"],
  ],
  "metro-breeze": [
    ["gust", "Встречный поток", "Headwind", "wind"],
    ["slipstream", "Зелёный сигнал", "Green Signal", "sparkles"],
    ["tidalWave", "Тяга тоннеля", "Tunnel Draft", "wind"],
  ],
  "rainy-pin": [
    ["tideLance", "Косой дождь", "Slanting Rain", "droplets"],
    ["plantain", "Свежесть дождя", "Rain Relief", "heart"],
    ["waterVeil", "Дождевой навес", "Rain Canopy", "shield"],
  ],
  "moss-button": [
    ["venom", "Моховая спора", "Moss Spore", "skull"],
    ["lavaShield", "Мягкий панцирь", "Soft Armor", "shield"],
    ["plantain", "Лесная аптечка", "Forest Aid", "leaf"],
  ],
  "karaoke-puff": [
    ["sunray", "Высокая нота", "High Note", "music"],
    ["tempo", "Общий припев", "Shared Chorus", "music"],
    ["encore", "Тихая мелодия", "Gentle Melody", "heart"],
  ],
  "rhythm-moth": [
    ["pulse", "Ритм крыльев", "Wing Rhythm", "music"],
    ["sugar", "Крещендо", "Crescendo", "sparkles"],
    ["waterVeil", "Звуковой кокон", "Sound Cocoon", "shield"],
  ],
  "mirror-spritz": [
    ["sunray", "Солнечный блик", "Sun Glint", "sun"],
    ["nightVeil", "Зеркальная грань", "Mirror Facet", "shield"],
    ["storm", "Призма осколков", "Shard Prism", "sparkles"],
  ],
  "coupon-wisp": [
    ["gust", "Лёгкий укол", "Light Jab", "wind"],
    ["slipstream", "Попутный ветер", "Tailwind", "wind"],
    ["prism", "Бумажный оберег", "Paper Charm", "shield"],
  ],
  "coupon-gust": [
    ["storm", "Купонный вихрь", "Coupon Vortex", "wind"],
    ["tempo", "Удачный маршрут", "Lucky Route", "sparkles"],
    ["plantain", "Второе дыхание", "Second Wind", "heart"],
  ],
  "latte-moon": [
    ["siphon", "Лунный глоток", "Moon Sip", "moon"],
    ["nightVeil", "Бархатная пенка", "Velvet Foam", "shield"],
    ["eclipse", "Полночный прилив", "Midnight Tide", "moon"],
  ],
  "berry-loop": [
    ["venom", "Терпкая ягода", "Tart Berry", "skull"],
    ["siphon", "Живительный сок", "Vital Juice", "heart"],
    ["bloom", "Ягодный круг", "Berry Circle", "leaf"],
  ],
  "aurora-ticket": [
    ["sunray", "Луч рассвета", "Dawn Ray", "sun"],
    ["prism", "Полярная защита", "Polar Guard", "shield"],
    ["encore", "Билет к рассвету", "Ticket to Dawn", "heart"],
  ],
  "velvet-eclipse": [
    ["siphon", "Бархатный укус", "Velvet Bite", "moon"],
    ["tidalWave", "Объятия тени", "Shadow Embrace", "moon"],
    ["eclipse", "Полное затмение", "Total Eclipse", "moon"],
  ],
};
const defaults = {
  FLAME: definitions["coffee-ember"],
  WATER: definitions["map-tide"],
  NATURE: definitions["bloom-sprout"],
  WIND: definitions["metro-breeze"],
  MUSIC: definitions["neon-echo"],
  LIGHT: definitions["district-lumen"],
  SHADOW: definitions["latte-moon"],
};
export async function seedHuntAbilities(prisma) {
  const species = await prisma.huntCreatureSpecies.findMany({
    select: { id: true, slug: true, element: true },
  });
  let created = 0;
  for (const character of species) {
    const slots = definitions[character.slug] ?? defaults[character.element];
    await prisma.$transaction(async (tx) => {
      for (const [slot, [presetKey, nameRu, nameEn, icon]] of slots.entries()) {
        if (
          await tx.huntSpeciesAbility.findUnique({
            where: { speciesId_slot: { speciesId: character.id, slot } },
          })
        )
          continue;
        const { key: _key, ...rawConfig } = presets[presetKey];
        const config = parseAbilityConfig(rawConfig);
        const slug = `${character.slug}-${slot + 1}`;
        const ability = await tx.huntAbility.upsert({
          where: { slug },
          update: {},
          create: {
            slug,
            nameRu,
            nameEn,
            descriptionRu: "",
            descriptionEn: "",
            icon,
            config,
          },
        });
        await tx.huntSpeciesAbility.create({
          data: { speciesId: character.id, abilityId: ability.id, slot },
        });
        await tx.huntAbilityRevision.upsert({
          where: {
            abilityId_revision: {
              abilityId: ability.id,
              revision: ability.revision,
            },
          },
          update: {},
          create: {
            abilityId: ability.id,
            revision: ability.revision,
            snapshot: {
              nameRu: ability.nameRu,
              nameEn: ability.nameEn,
              descriptionRu: ability.descriptionRu,
              descriptionEn: ability.descriptionEn,
              icon: ability.icon,
              config: ability.config,
              isActive: ability.isActive,
              schemaVersion: ability.schemaVersion,
            },
          },
        });
        created++;
      }
    });
  }
  console.log(
    JSON.stringify({
      species: species.length,
      slotsAdded: created,
      assignments: await prisma.huntSpeciesAbility.count(),
    }),
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    await seedHuntAbilities(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
