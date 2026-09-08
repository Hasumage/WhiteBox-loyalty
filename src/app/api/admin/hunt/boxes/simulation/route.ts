import { NextResponse, type NextRequest } from "next/server";
import { HuntCardRarity, HuntBoxType, type Prisma } from "@prisma/client";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const SIMULATION_BOXES = 100;
const ELEMENTAL_ROTATION_GROUP = "elemental-weekly";
const ELEMENTAL_ROTATION_ANCHOR_UTC = Date.UTC(2026, 8, 7, 8, 0, 0, 0);
const ELEMENTAL_ROTATION_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const RARITY_ORDER = [
  HuntCardRarity.COMMON,
  HuntCardRarity.UNCOMMON,
  HuntCardRarity.RARE,
  HuntCardRarity.EPIC,
  HuntCardRarity.LEGENDARY,
];

const RARITY_VALUE: Record<HuntCardRarity, number> = {
  COMMON: 40,
  UNCOMMON: 100,
  RARE: 240,
  EPIC: 700,
  LEGENDARY: 5000,
};

type BoxConfigRow = Prisma.HuntBoxConfigGetPayload<{
  include: {
    rarityChances: true;
    speciesRules: { include: { species: true } };
    statusChances: { include: { status: true } };
  };
}>;

function currentElementalIndex(now = new Date()) {
  const elapsedWeeks = Math.floor((now.getTime() - ELEMENTAL_ROTATION_ANCHOR_UTC) / ELEMENTAL_ROTATION_WEEK_MS);
  return ((elapsedWeeks % 5) + 5) % 5;
}

function isCurrentBox(config: BoxConfigRow) {
  if (!config.rotationGroup) return true;
  if (config.rotationGroup !== ELEMENTAL_ROTATION_GROUP) return true;
  return config.rotationIndex === currentElementalIndex();
}

function randomInt(min: number, maxExclusive: number) {
  return Math.floor(Math.random() * (maxExclusive - min)) + min;
}

function weightedPick<T extends { weight: number }>(items: T[]) {
  const enabled = items.filter((item) => item.weight > 0);
  const total = enabled.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return null;
  let roll = randomInt(0, total);
  for (const item of enabled) {
    roll -= item.weight;
    if (roll < 0) return item;
  }
  return enabled[enabled.length - 1] ?? null;
}

function rarityBounds(rarity: HuntCardRarity, minRarity: HuntCardRarity, maxRarity: HuntCardRarity | null) {
  let next = RARITY_ORDER.indexOf(rarity) >= RARITY_ORDER.indexOf(minRarity) ? rarity : minRarity;
  if (maxRarity && RARITY_ORDER.indexOf(next) > RARITY_ORDER.indexOf(maxRarity)) next = maxRarity;
  return next;
}

function availableRarities(config: BoxConfigRow, fallbackSpecies: Array<{ baseRarity: HuntCardRarity; element: string; isActive: boolean }>) {
  const rules = config.speciesRules.filter((rule) => rule.isEnabled && rule.species.isActive);
  const source = rules.length
    ? rules.map((rule) => ({ baseRarity: rule.species.baseRarity, element: rule.species.element, isActive: rule.species.isActive }))
    : fallbackSpecies;
  return new Set(
    source
      .filter((species) => species.isActive)
      .filter((species) => !config.rotationElement || species.element === config.rotationElement)
      .filter((species) => !config.maxRarity || RARITY_ORDER.indexOf(species.baseRarity) <= RARITY_ORDER.indexOf(config.maxRarity))
      .map((species) => species.baseRarity),
  );
}

function resolveAvailableRarity(target: HuntCardRarity, available: Set<HuntCardRarity>, maxRarity: HuntCardRarity | null) {
  if (available.has(target)) return target;
  const targetIndex = RARITY_ORDER.indexOf(target);
  const fallbackRarities = [
    ...RARITY_ORDER.slice(targetIndex + 1),
    ...RARITY_ORDER.slice(0, targetIndex).reverse(),
  ];
  for (const rarity of fallbackRarities) {
    if (maxRarity && RARITY_ORDER.indexOf(rarity) > RARITY_ORDER.indexOf(maxRarity)) continue;
    if (available.has(rarity)) return rarity;
  }
  return HuntCardRarity.COMMON;
}

function simulateBox(config: BoxConfigRow, fallbackSpecies: Array<{ baseRarity: HuntCardRarity; element: string; isActive: boolean }>) {
  const rarityCounts = Object.fromEntries(RARITY_ORDER.map((rarity) => [rarity, 0])) as Record<HuntCardRarity, number>;
  const statusCounts = Object.fromEntries(RARITY_ORDER.map((rarity) => [rarity, 0])) as Record<HuntCardRarity, number>;
  const enabledRarities = config.rarityChances.filter((chance) => chance.isEnabled && chance.weight > 0);
  const enabledStatuses = config.statusChances.filter((chance) => chance.isEnabled && chance.weight > 0 && chance.status.isActive);
  const speciesRarities = availableRarities(config, fallbackSpecies);
  const itemCountMin = Math.max(1, config.itemCountMin);
  const itemCountMax = Math.max(itemCountMin, config.itemCountMax);
  const guaranteedCount = Math.max(0, Math.min(itemCountMax, config.guaranteedCount));
  let itemsTotal = 0;
  let cardsValue = 0;
  let statusesValue = 0;

  for (let boxIndex = 0; boxIndex < SIMULATION_BOXES; boxIndex += 1) {
    const itemCount = randomInt(itemCountMin, itemCountMax + 1);
    for (let itemIndex = 0; itemIndex < itemCount; itemIndex += 1) {
      const picked = config.guaranteedRarity && itemIndex < guaranteedCount
        ? { rarity: rarityBounds(config.guaranteedRarity, config.minRarity, config.maxRarity), weight: 1 }
        : weightedPick(enabledRarities);
      const targetRarity = rarityBounds(picked?.rarity ?? config.minRarity, config.minRarity, config.maxRarity);
      const finalRarity = resolveAvailableRarity(targetRarity, speciesRarities, config.maxRarity);
      rarityCounts[finalRarity] += 1;
      cardsValue += RARITY_VALUE[finalRarity];
      itemsTotal += 1;
    }

    if (config.statusDropChanceBp > 0 && enabledStatuses.length > 0 && randomInt(0, 10000) < config.statusDropChanceBp) {
      const status = weightedPick(enabledStatuses);
      if (status) {
        const rarity = status.rarity as HuntCardRarity;
        statusCounts[rarity] += 1;
        statusesValue += Math.round(RARITY_VALUE[rarity] * 0.6);
        itemsTotal += 1;
      }
    }
  }

  const totalCost = config.cost * SIMULATION_BOXES;
  const totalValue = cardsValue + statusesValue;
  const valueRatio = totalCost > 0 ? totalValue / totalCost : null;
  const verdict = valueRatio === null
    ? "free"
    : valueRatio < 0.85
      ? "low"
      : valueRatio > 1.25
        ? "high"
        : "ok";

  return {
    uuid: config.id,
    slug: config.slug,
    title: config.title,
    type: config.type,
    rotationElement: config.rotationElement,
    boxesOpened: SIMULATION_BOXES,
    totalCost,
    itemsTotal,
    cardsValue,
    statusesValue,
    totalValue,
    valueRatio,
    verdict,
    rarityCounts,
    statusCounts,
    averageItemsPerBox: Math.round((itemsTotal / SIMULATION_BOXES) * 100) / 100,
  };
}

export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "HUNT", "canView");
  if (!access.ok) return access.response;

  const [configs, species] = await Promise.all([
    prisma.huntBoxConfig.findMany({
      where: { isActive: true, isPurchasable: true },
      include: {
        rarityChances: true,
        speciesRules: { include: { species: true } },
        statusChances: { include: { status: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    }),
    prisma.huntCreatureSpecies.findMany({
      select: { baseRarity: true, element: true, isActive: true },
    }),
  ]);

  return NextResponse.json({
    boxesPerConfig: SIMULATION_BOXES,
    rarityValue: RARITY_VALUE,
    generatedAt: new Date().toISOString(),
    results: configs
      .filter((config) => config.type !== HuntBoxType.DAILY)
      .filter(isCurrentBox)
      .map((config) => simulateBox(config, species)),
  });
}
