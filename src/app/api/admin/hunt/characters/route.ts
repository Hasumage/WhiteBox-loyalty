import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

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

export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "HUNT", "canView");
  if (!access.ok) return access.response;

  const characters = await prisma.huntCreatureSpecies.findMany({
    include: { category: true, _count: { select: { cards: true } } },
    orderBy: [{ sortOrder: "asc" }, { baseRarity: "desc" }, { name: "asc" }],
  });

  return NextResponse.json(characters.map(serializeCharacter));
}
