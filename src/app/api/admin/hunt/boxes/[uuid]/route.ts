import { NextResponse, type NextRequest } from "next/server";
import { HuntCardRarity, type Prisma } from "@prisma/client";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const rarities = Object.values(HuntCardRarity);

async function readUuid(params: { uuid?: string } | Promise<{ uuid?: string }>) {
  return (await Promise.resolve(params)).uuid ?? "";
}

function sanitizeRarity(value: unknown) {
  const rarity = typeof value === "string" ? value.toUpperCase() : "";
  return rarities.includes(rarity as HuntCardRarity) ? (rarity as HuntCardRarity) : null;
}

function boxInclude() {
  return {
    rarityChances: true,
    speciesRules: { include: { species: true } },
    statusChances: { include: { status: true } },
    _count: { select: { boxes: true } },
  } satisfies Prisma.HuntBoxConfigInclude;
}

type BoxConfigRow = Prisma.HuntBoxConfigGetPayload<{ include: ReturnType<typeof boxInclude> }>;

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
    rarityChances: config.rarityChances.map((item) => ({
      uuid: item.id,
      rarity: item.rarity,
      weight: item.weight,
      enabled: item.isEnabled,
      chance: item.isEnabled ? percent(item.weight, enabledRarityTotal) : 0,
    })),
    speciesRules: config.speciesRules.map((item) => ({
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
    })),
    statusChances: config.statusChances.map((item) => ({
      uuid: item.id,
      statusId: item.statusId,
      title: item.status.title,
      rarity: item.rarity,
      statusRarity: item.status.rarity,
      weight: item.weight,
      dropChanceBp: item.dropChanceBp,
      enabled: item.isEnabled,
    })),
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  };
}

function configData(body: Record<string, unknown>) {
  const data: Prisma.HuntBoxConfigUpdateInput = {};
  if (typeof body.title === "string") data.title = body.title.trim().slice(0, 120);
  if (typeof body.description === "string") data.description = body.description.trim().slice(0, 600);
  if (typeof body.imageUrl === "string") data.imageUrl = body.imageUrl.trim().slice(0, 400) || null;
  if (typeof body.cost === "number" && Number.isFinite(body.cost)) data.cost = Math.max(0, Math.round(body.cost));
  if (typeof body.itemCountMin === "number" && Number.isFinite(body.itemCountMin)) data.itemCountMin = Math.max(1, Math.min(10, Math.round(body.itemCountMin)));
  if (typeof body.itemCountMax === "number" && Number.isFinite(body.itemCountMax)) data.itemCountMax = Math.max(1, Math.min(10, Math.round(body.itemCountMax)));
  if (typeof body.dailyLimit === "number" && Number.isFinite(body.dailyLimit)) data.dailyLimit = Math.max(1, Math.round(body.dailyLimit));
  if (body.dailyLimit === null) data.dailyLimit = null;
  if (typeof body.statusDropChanceBp === "number" && Number.isFinite(body.statusDropChanceBp)) data.statusDropChanceBp = Math.max(0, Math.min(10000, Math.round(body.statusDropChanceBp)));
  if (typeof body.guaranteedCount === "number" && Number.isFinite(body.guaranteedCount)) data.guaranteedCount = Math.max(0, Math.min(10, Math.round(body.guaranteedCount)));
  const guaranteedRarity = body.guaranteedRarity === null ? null : sanitizeRarity(body.guaranteedRarity);
  if (body.guaranteedRarity === null || guaranteedRarity) data.guaranteedRarity = guaranteedRarity;
  if (typeof body.rotationGroup === "string") data.rotationGroup = body.rotationGroup.trim().slice(0, 80) || null;
  if (typeof body.rotationIndex === "number" && Number.isFinite(body.rotationIndex)) data.rotationIndex = Math.max(0, Math.round(body.rotationIndex));
  if (body.rotationIndex === null) data.rotationIndex = null;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.isPurchasable === "boolean") data.isPurchasable = body.isPurchasable;
  if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) data.sortOrder = Math.round(body.sortOrder);
  const minRarity = sanitizeRarity(body.minRarity);
  if (minRarity) data.minRarity = minRarity;
  const maxRarity = body.maxRarity === null ? null : sanitizeRarity(body.maxRarity);
  if (body.maxRarity === null || maxRarity) data.maxRarity = maxRarity;
  return data;
}

export async function PATCH(
  request: NextRequest,
  context: { params: { uuid?: string } | Promise<{ uuid?: string }> },
) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "HUNT", "canEdit");
  if (!access.ok) return access.response;

  const uuid = await readUuid(context.params);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const config = await prisma.$transaction(async (tx) => {
    const updated = await tx.huntBoxConfig.update({ where: { id: uuid }, data: configData(body) });

    if (Array.isArray(body.rarityChances)) {
      for (const item of body.rarityChances as Array<Record<string, unknown>>) {
        const rarity = sanitizeRarity(item.rarity);
        if (!rarity) continue;
        await tx.huntBoxRarityChance.upsert({
          where: { boxConfigId_rarity: { boxConfigId: updated.id, rarity } },
          create: {
            boxConfigId: updated.id,
            rarity,
            weight: Math.max(0, Math.round(Number(item.weight) || 0)),
            isEnabled: item.enabled !== false,
          },
          update: {
            weight: Math.max(0, Math.round(Number(item.weight) || 0)),
            isEnabled: item.enabled !== false,
          },
        });
      }
    }

    if (Array.isArray(body.speciesRules)) {
      for (const item of body.speciesRules as Array<Record<string, unknown>>) {
        if (typeof item.speciesId !== "string") continue;
        await tx.huntBoxSpeciesRule.upsert({
          where: { boxConfigId_speciesId: { boxConfigId: updated.id, speciesId: item.speciesId } },
          create: {
            boxConfigId: updated.id,
            speciesId: item.speciesId,
            weight: Math.max(0, Math.round(Number(item.weight) || 0)),
            isEnabled: item.enabled !== false,
          },
          update: {
            weight: Math.max(0, Math.round(Number(item.weight) || 0)),
            isEnabled: item.enabled !== false,
          },
        });
      }
    }

    if (Array.isArray(body.statusChances)) {
      for (const item of body.statusChances as Array<Record<string, unknown>>) {
        if (typeof item.statusId !== "string") continue;
        await tx.huntBoxProfileStatusChance.upsert({
          where: { boxConfigId_statusId: { boxConfigId: updated.id, statusId: item.statusId } },
          create: {
            boxConfigId: updated.id,
            statusId: item.statusId,
            rarity: typeof item.rarity === "string" ? (item.rarity as never) : "RARE",
            weight: Math.max(0, Math.round(Number(item.weight) || 0)),
            dropChanceBp: Math.max(0, Math.min(10000, Math.round(Number(item.dropChanceBp) || 0))),
            isEnabled: item.enabled !== false,
          },
          update: {
            rarity: typeof item.rarity === "string" ? (item.rarity as never) : undefined,
            weight: Math.max(0, Math.round(Number(item.weight) || 0)),
            dropChanceBp: Math.max(0, Math.min(10000, Math.round(Number(item.dropChanceBp) || 0))),
            isEnabled: item.enabled !== false,
          },
        });
      }
    }

    return tx.huntBoxConfig.findUniqueOrThrow({ where: { id: updated.id }, include: boxInclude() });
  });

  await prisma.auditEvent.create({
    data: {
      workspace: "MANAGER",
      level: "INFO",
      category: "SYSTEM",
      action: "Hunt box config updated",
      actorUserId: access.actor.id,
      actorLabel: access.actor.email,
      details: `Updated Hunt box config ${config.title}.`,
      tags: ["#HUNT", "#BOX"],
    },
  });

  return NextResponse.json(serializeBoxConfig(config));
}

export async function DELETE(
  request: NextRequest,
  context: { params: { uuid?: string } | Promise<{ uuid?: string }> },
) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "HUNT", "canEdit");
  if (!access.ok) return access.response;

  const uuid = await readUuid(context.params);
  const existing = await prisma.huntBoxConfig.findUnique({
    where: { id: uuid },
    select: { id: true, title: true },
  });

  if (!existing) {
    return NextResponse.json({ message: "Hunt box config not found" }, { status: 404 });
  }

  await prisma.huntBoxConfig.delete({ where: { id: uuid } });

  await prisma.auditEvent.create({
    data: {
      workspace: "MANAGER",
      level: "WARN",
      category: "SYSTEM",
      action: "Hunt box config deleted",
      actorUserId: access.actor.id,
      actorLabel: access.actor.email,
      details: `Deleted Hunt box config ${existing.title}.`,
      tags: ["#HUNT", "#BOX"],
    },
  });

  return NextResponse.json({ ok: true });
}
