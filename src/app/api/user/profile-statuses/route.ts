import { NextResponse, type NextRequest } from "next/server";
import { isUserAuthResponse, requireUserSession } from "@/lib/auth/require-user-session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const RARITY_ORDER = new Map([
  ["RARE", 0],
  ["EPIC", 1],
  ["LEGENDARY", 2],
]);

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
    createdAt: status.createdAt.toISOString(),
    updatedAt: status.updatedAt.toISOString(),
  };
}

async function buildResponse(userId: number) {
  const [user, statuses, unlocks] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        selectedProfileStatusId: true,
        selectedProfileStatus: true,
      },
    }),
    prisma.profileStatus.findMany({
      where: { isActive: true },
      orderBy: [{ title: "asc" }],
    }),
    prisma.userProfileStatusUnlock.findMany({
      where: { userId },
      include: { status: true },
      orderBy: { unlockedAt: "desc" },
    }),
  ]);

  if (!user) return null;

  const unlockByStatus = new Map(unlocks.map((unlock) => [unlock.statusId, unlock]));
  const decorated = statuses
    .map((status) => {
      const unlock = unlockByStatus.get(status.id);
      return {
        ...serializeStatus(status),
        unlocked: Boolean(unlock),
        unlockedAt: unlock?.unlockedAt.toISOString() ?? null,
        seenAt: unlock?.seenAt?.toISOString() ?? null,
        source: unlock?.source ?? null,
      };
    })
    .sort((a, b) => {
      const rarityDelta = (RARITY_ORDER.get(a.rarity) ?? 99) - (RARITY_ORDER.get(b.rarity) ?? 99);
      if (rarityDelta !== 0) return rarityDelta;
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      return a.title.localeCompare(b.title, "ru");
    });

  const newlyUnlocked = unlocks
    .filter((unlock) => !unlock.seenAt && unlock.status.isActive)
    .map((unlock) => ({
      ...serializeStatus(unlock.status),
      unlockedAt: unlock.unlockedAt.toISOString(),
      source: unlock.source,
    }));

  return {
    selectedStatusId: user.selectedProfileStatusId,
    selectedStatus: user.selectedProfileStatus ? serializeStatus(user.selectedProfileStatus) : null,
    statuses: decorated,
    newlyUnlocked,
    summary: {
      total: statuses.length,
      unlocked: unlocks.filter((unlock) => unlock.status.isActive).length,
      new: newlyUnlocked.length,
    },
  };
}

export async function GET(request: NextRequest) {
  const session = await requireUserSession(request);
  if (isUserAuthResponse(session)) return session;

  const data = await buildResponse(session.userId);
  if (!data) return NextResponse.json({ message: "User not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const session = await requireUserSession(request);
  if (isUserAuthResponse(session)) return session;

  const body = (await request.json().catch(() => ({}))) as { statusId?: string | null };
  const statusId = typeof body.statusId === "string" && body.statusId.trim() ? body.statusId.trim() : null;

  if (!statusId) {
    await prisma.user.update({ where: { id: session.userId }, data: { selectedProfileStatusId: null } });
    const data = await buildResponse(session.userId);
    return NextResponse.json(data);
  }

  const unlock = await prisma.userProfileStatusUnlock.findUnique({
    where: { userId_statusId: { userId: session.userId, statusId } },
    include: { status: true },
  });
  if (!unlock || !unlock.status.isActive) {
    return NextResponse.json({ message: "Status is not unlocked for this account" }, { status: 403 });
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { selectedProfileStatusId: statusId },
  });
  const data = await buildResponse(session.userId);
  return NextResponse.json(data);
}
