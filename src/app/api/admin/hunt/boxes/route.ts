import { NextResponse, type NextRequest } from "next/server";
import { HuntBoxType, HuntCardRarity, ProfileStatusRarity, type Prisma } from "@prisma/client";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const rarities = Object.values(HuntCardRarity);
const boxTypes = Object.values(HuntBoxType);
const statusRarities = Object.values(ProfileStatusRarity);

type BoxConfigRow = Prisma.HuntBoxConfigGetPayload<{
  include: {
    rarityChances: true;
    speciesRules: { include: { species: true } };
    statusChances: { include: { status: true } };
    _count: { select: { boxes: true } };
  };
}>;

function percent(weight: number, total: number) {
  if (!total) return 0;
  return Math.round((weight / total) * 10000) / 100;
}

function serializeBoxConfig(config: BoxConfigRow) {
  const enabledRarityTotal = config.rarityChances.reduce((sum, item) => sum + (item.isEnabled ? item.weight : 0), 0);
  return {
    uuid: config.id,
    slug: config.slug,
    type: config.type,
    title: config.title,
    description: config.description,
    imageUrl: config.imageUrl,
    cost: config.cost,
    minRarity: config.minRarity,
    maxRarity: config.maxRarity,
    itemCountMin: config.itemCountMin,
    itemCountMax: config.itemCountMax,
    dailyLimit: config.dailyLimit,
    statusDropChanceBp: config.statusDropChanceBp,
    statusDropChance: config.statusDropChanceBp / 100,
    guaranteedRarity: config.guaranteedRarity,
    guaranteedCount: config.guaranteedCount,
    rotationGroup: config.rotationGroup,
    rotationIndex: config.rotationIndex,
    rotationElement: config.rotationElement,
    rotationStartsAt: config.rotationStartsAt?.toISOString() ?? null,
    isActive: config.isActive,
    isPurchasable: config.isPurchasable,
    sortOrder: config.sortOrder,
    boxesCount: config._count.boxes,
    rarityChances: config.rarityChances
      .map((item) => ({
        uuid: item.id,
        rarity: item.rarity,
        weight: item.weight,
        enabled: item.isEnabled,
        chance: item.isEnabled ? percent(item.weight, enabledRarityTotal) : 0,
      }))
      .sort((a, b) => rarities.indexOf(a.rarity) - rarities.indexOf(b.rarity)),
    speciesRules: config.speciesRules
      .map((item) => ({
        uuid: item.id,
        speciesId: item.speciesId,
        name: item.species.name,
        nameRu: item.species.nameRu,
        nameEn: item.species.nameEn,
        slug: item.species.slug,
        imageUrl: item.species.imageUrl,
        rarity: item.species.baseRarity,
        element: item.species.element,
        weight: item.weight,
        enabled: item.isEnabled,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru")),
    statusChances: config.statusChances
      .map((item) => ({
        uuid: item.id,
        statusId: item.statusId,
        title: item.status.title,
        rarity: item.rarity,
        statusRarity: item.status.rarity,
        weight: item.weight,
        dropChanceBp: item.dropChanceBp,
        enabled: item.isEnabled,
      }))
      .sort((a, b) => a.title.localeCompare(b.title, "ru")),
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  };
}

async function boxInclude() {
  return {
    rarityChances: true,
    speciesRules: { include: { species: true } },
    statusChances: { include: { status: true } },
    _count: { select: { boxes: true } },
  } satisfies Prisma.HuntBoxConfigInclude;
}

function sanitizeBoxType(value: unknown) {
  const type = typeof value === "string" ? value.toUpperCase() : "";
  return boxTypes.includes(type as HuntBoxType) ? (type as HuntBoxType) : null;
}

function sanitizeRarity(value: unknown) {
  const rarity = typeof value === "string" ? value.toUpperCase() : "";
  return rarities.includes(rarity as HuntCardRarity) ? (rarity as HuntCardRarity) : null;
}

export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "HUNT", "canView");
  if (!access.ok) return access.response;

  const [configs, species, statuses] = await Promise.all([
    prisma.huntBoxConfig.findMany({
      include: await boxInclude(),
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.huntCreatureSpecies.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, slug: true, name: true, nameRu: true, nameEn: true, element: true, baseRarity: true, imageUrl: true, isActive: true },
    }),
    prisma.profileStatus.findMany({
      orderBy: [{ rarity: "asc" }, { title: "asc" }],
      select: { id: true, slug: true, title: true, rarity: true, isActive: true },
    }),
  ]);

  return NextResponse.json({
    configs: configs.map(serializeBoxConfig),
    species,
    statuses,
    boxTypes,
    rarities,
    statusRarities,
  });
}

export async function POST(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "HUNT", "canEdit");
  if (!access.ok) return access.response;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const type = sanitizeBoxType(body.type);
  if (!type) return NextResponse.json({ message: "Invalid box type" }, { status: 400 });

  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 120) : `${type} box`;
  const slug = typeof body.slug === "string" && body.slug.trim() ? body.slug.trim().slice(0, 80) : type.toLowerCase();
  const minRarity = sanitizeRarity(body.minRarity) ?? HuntCardRarity.COMMON;
  const maxRarity = body.maxRarity === null ? null : sanitizeRarity(body.maxRarity);
  const config = await prisma.huntBoxConfig.create({
    data: {
      type,
      title,
      slug,
      description: typeof body.description === "string" ? body.description.trim().slice(0, 600) : "Server-side Hunt reward box.",
      imageUrl: typeof body.imageUrl === "string" ? body.imageUrl.trim().slice(0, 400) || null : null,
      cost: typeof body.cost === "number" && Number.isFinite(body.cost) ? Math.max(0, Math.round(body.cost)) : 0,
      minRarity,
      maxRarity,
      itemCountMin: typeof body.itemCountMin === "number" && Number.isFinite(body.itemCountMin) ? Math.max(1, Math.min(10, Math.round(body.itemCountMin))) : 1,
      itemCountMax: typeof body.itemCountMax === "number" && Number.isFinite(body.itemCountMax) ? Math.max(1, Math.min(10, Math.round(body.itemCountMax))) : 1,
      dailyLimit: typeof body.dailyLimit === "number" && Number.isFinite(body.dailyLimit) ? Math.max(1, Math.round(body.dailyLimit)) : null,
      statusDropChanceBp: typeof body.statusDropChanceBp === "number" && Number.isFinite(body.statusDropChanceBp) ? Math.max(0, Math.min(10000, Math.round(body.statusDropChanceBp))) : 0,
      isActive: typeof body.isActive === "boolean" ? body.isActive : true,
      isPurchasable: typeof body.isPurchasable === "boolean" ? body.isPurchasable : true,
      sortOrder: typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder) ? Math.round(body.sortOrder) : 0,
      rarityChances: {
        create: rarities.map((rarity) => ({ rarity, weight: rarity === HuntCardRarity.COMMON ? 100 : 0, isEnabled: rarity === HuntCardRarity.COMMON })),
      },
    },
    include: await boxInclude(),
  });

  await prisma.auditEvent.create({
    data: {
      workspace: "MANAGER",
      level: "INFO",
      category: "SYSTEM",
      action: "Hunt box config created",
      actorUserId: access.actor.id,
      actorLabel: access.actor.email,
      details: `Created Hunt box config ${config.title}.`,
      tags: ["#HUNT", "#BOX"],
    },
  });

  return NextResponse.json(serializeBoxConfig(config), { status: 201 });
}
