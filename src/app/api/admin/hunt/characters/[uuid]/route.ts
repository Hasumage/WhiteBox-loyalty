import { NextResponse, type NextRequest } from "next/server";
import { HuntCardRarity, HuntElement, type Prisma } from "@prisma/client";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const STAT_KEYS = ["health", "attack", "luck", "evasion"] as const;

async function readUuid(params: { uuid?: string } | Promise<{ uuid?: string }>) {
  return (await Promise.resolve(params)).uuid ?? "";
}

function normalizeStats(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const stats: Record<string, number> = {};
  for (const key of STAT_KEYS) {
    const next = Number(input[key]);
    if (!Number.isFinite(next) || next < 1 || next > 10) return null;
    stats[key] = Math.round(next);
  }
  const sum = STAT_KEYS.reduce((total, key) => total + stats[key], 0);
  if (sum > 35) return null;
  return stats;
}

type CharacterRow = Prisma.HuntCreatureSpeciesGetPayload<{
  include: { category: true; _count: { select: { cards: true } } };
}>;

function serializeCharacter(character: CharacterRow) {
  return {
    uuid: character.id,
    slug: character.slug,
    name: character.name,
    description: character.description,
    element: character.element,
    baseRarity: character.baseRarity,
    baseStats: character.baseStats,
    traitPool: character.traitPool,
    visualPrompt: character.visualPrompt,
    imageUrl: character.imageUrl,
    isActive: character.isActive,
    sortOrder: character.sortOrder,
    cardsCount: character._count.cards,
    category: character.category,
    createdAt: character.createdAt.toISOString(),
    updatedAt: character.updatedAt.toISOString(),
  };
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
  const data: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, 80);
    if (!name) return NextResponse.json({ message: "Name is required" }, { status: 400 });
    data.name = name;
  }
  if (typeof body.description === "string") data.description = body.description.trim().slice(0, 600);
  if (typeof body.visualPrompt === "string") data.visualPrompt = body.visualPrompt.trim().slice(0, 800);
  if (typeof body.imageUrl === "string") data.imageUrl = body.imageUrl.trim().slice(0, 400) || null;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) data.sortOrder = Math.round(body.sortOrder);
  if (typeof body.element === "string") {
    const element = body.element.toUpperCase();
    if (!Object.values(HuntElement).includes(element as HuntElement)) return NextResponse.json({ message: "Invalid element" }, { status: 400 });
    data.element = element;
  }
  if (typeof body.baseRarity === "string") {
    const rarity = body.baseRarity.toUpperCase();
    if (!Object.values(HuntCardRarity).includes(rarity as HuntCardRarity)) return NextResponse.json({ message: "Invalid rarity" }, { status: 400 });
    data.baseRarity = rarity;
  }
  if (body.baseStats != null) {
    const stats = normalizeStats(body.baseStats);
    if (!stats) return NextResponse.json({ message: "Stats must be 1..10 and total must be 35 or lower" }, { status: 400 });
    data.baseStats = stats;
  }

  const character = await prisma.huntCreatureSpecies.update({
    where: { id: uuid },
    data,
    include: { category: true, _count: { select: { cards: true } } },
  });

  await prisma.auditEvent.create({
    data: {
      workspace: "MANAGER",
      level: "INFO",
      category: "SYSTEM",
      action: "Hunt character updated",
      actorUserId: access.actor.id,
      actorLabel: access.actor.email,
      details: `Updated Hunt character ${character.name}.`,
      tags: ["#HUNT", "#CHARACTER"],
    },
  });

  return NextResponse.json(serializeCharacter(character));
}
