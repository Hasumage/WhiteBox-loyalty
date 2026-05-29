import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const RARITIES = new Set(["RARE", "EPIC", "LEGENDARY"]);
const RARITY_ORDER = new Map([
  ["RARE", 0],
  ["EPIC", 1],
  ["LEGENDARY", 2],
]);

function safeSlug(value: string) {
  const base = value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return base || `status-${randomUUID().slice(0, 8)}`;
}

function serializeStatus(status: {
  id: string;
  slug: string;
  title: string;
  description: string;
  rarity: string;
  icon: string;
  isActive: boolean;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { unlocks: number };
}) {
  return {
    id: status.id,
    slug: status.slug,
    title: status.title,
    description: status.description,
    rarity: status.rarity,
    icon: status.icon,
    isActive: status.isActive,
    isSystem: status.isSystem,
    unlockCount: status._count?.unlocks ?? 0,
    createdAt: status.createdAt.toISOString(),
    updatedAt: status.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "USERS", "canView");
  if (!access.ok) return access.response;

  const { searchParams } = new URL(request.url);
  const userUuid = searchParams.get("userUuid")?.trim();
  const [statuses, user] = await Promise.all([
    prisma.profileStatus.findMany({
      include: { _count: { select: { unlocks: true } } },
      orderBy: [{ title: "asc" }],
    }),
    userUuid
      ? prisma.user.findUnique({
          where: { uuid: userUuid },
          select: {
            id: true,
            uuid: true,
            selectedProfileStatusId: true,
            profileStatusUnlocks: { include: { status: true }, orderBy: { unlockedAt: "desc" } },
          },
        })
      : Promise.resolve(null),
  ]);

  const unlockByStatus = new Map((user?.profileStatusUnlocks ?? []).map((unlock) => [unlock.statusId, unlock]));
  const items = statuses
    .map((status) => {
      const unlock = unlockByStatus.get(status.id);
      return {
        ...serializeStatus(status),
        unlocked: Boolean(unlock),
        unlockedAt: unlock?.unlockedAt.toISOString() ?? null,
        seenAt: unlock?.seenAt?.toISOString() ?? null,
        source: unlock?.source ?? null,
        selected: user?.selectedProfileStatusId === status.id,
      };
    })
    .sort((a, b) => {
      const rarityDelta = (RARITY_ORDER.get(a.rarity) ?? 99) - (RARITY_ORDER.get(b.rarity) ?? 99);
      if (rarityDelta !== 0) return rarityDelta;
      return a.title.localeCompare(b.title, "ru");
    });

  return NextResponse.json({
    statuses: items,
    selectedStatusId: user?.selectedProfileStatusId ?? null,
    userFound: userUuid ? Boolean(user) : null,
  });
}

export async function POST(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "USERS", "canEdit");
  if (!access.ok) return access.response;

  const body = (await request.json().catch(() => ({}))) as {
    slug?: string;
    title?: string;
    description?: string;
    rarity?: string;
    icon?: string;
  };
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 80) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 360) : "";
  const rarity = typeof body.rarity === "string" ? body.rarity.trim().toUpperCase() : "";
  const icon = typeof body.icon === "string" && body.icon.trim() ? body.icon.trim().slice(0, 40) : "Sparkles";
  const preferredSlug = typeof body.slug === "string" && body.slug.trim() ? safeSlug(body.slug) : safeSlug(title);

  if (!title || !description) {
    return NextResponse.json({ message: "Title and description are required" }, { status: 400 });
  }
  if (!RARITIES.has(rarity)) {
    return NextResponse.json({ message: "Rarity must be RARE, EPIC or LEGENDARY" }, { status: 400 });
  }

  let slug = preferredSlug;
  for (let i = 0; i < 6; i += 1) {
    const exists = await prisma.profileStatus.findUnique({ where: { slug }, select: { id: true } });
    if (!exists) break;
    slug = `${preferredSlug}-${randomUUID().slice(0, 5)}`;
  }

  const status = await prisma.profileStatus.create({
    data: {
      slug,
      title,
      description,
      rarity: rarity as "RARE" | "EPIC" | "LEGENDARY",
      icon,
    },
  });

  await prisma.auditEvent.create({
    data: {
      workspace: "MANAGER",
      level: "INFO",
      category: "USER",
      action: "Profile status created",
      actorUserId: access.actor.id,
      actorLabel: access.actor.email,
      details: `Created profile status ${title} (${rarity}).`,
      tags: ["#USER", "#STATUS"],
    },
  });

  return NextResponse.json(serializeStatus(status), { status: 201 });
}
