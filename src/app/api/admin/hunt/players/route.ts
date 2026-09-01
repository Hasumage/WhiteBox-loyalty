import { NextResponse, type NextRequest } from "next/server";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function bucketForLevel(level: number) {
  if (level <= 3) return "1-3";
  if (level <= 7) return "4-7";
  if (level <= 15) return "8-15";
  return "16+";
}

export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "HUNT", "canView");
  if (!access.ok) return access.response;

  const [profiles, aggregate] = await Promise.all([
    prisma.huntPlayerProfile.findMany({
      include: { user: { select: { uuid: true, name: true, email: true } } },
      orderBy: [{ level: "desc" }, { lifetimeInfluence: "desc" }],
      take: 80,
    }),
    prisma.huntPlayerProfile.aggregate({
      _count: { _all: true },
      _avg: { level: true, cardsOwnedCount: true },
      _sum: { lifetimeInfluence: true, postsCount: true, likesReceivedCount: true },
    }),
  ]);

  const bucketMap = new Map<string, number>([
    ["1-3", 0],
    ["4-7", 0],
    ["8-15", 0],
    ["16+", 0],
  ]);
  for (const profile of profiles) {
    const key = bucketForLevel(profile.level);
    bucketMap.set(key, (bucketMap.get(key) ?? 0) + 1);
  }

  return NextResponse.json({
    summary: {
      players: aggregate._count._all,
      avgLevel: Number((aggregate._avg.level ?? 0).toFixed(1)),
      avgCards: Number((aggregate._avg.cardsOwnedCount ?? 0).toFixed(1)),
      totalNearCoin: aggregate._sum.lifetimeInfluence ?? 0,
      totalPosts: aggregate._sum.postsCount ?? 0,
      totalLikes: aggregate._sum.likesReceivedCount ?? 0,
    },
    levelBuckets: [...bucketMap.entries()].map(([label, count]) => ({ label, count })),
    players: profiles.map((profile) => ({
      uuid: profile.user.uuid,
      name: profile.user.name,
      email: profile.user.email,
      level: profile.level,
      xp: profile.xp,
      influenceBalance: profile.influenceBalance,
      lifetimeInfluence: profile.lifetimeInfluence,
      postsCount: profile.postsCount,
      likesReceivedCount: profile.likesReceivedCount,
      boxesOpenedCount: profile.boxesOpenedCount,
      cardsOwnedCount: profile.cardsOwnedCount,
      tutorialCompletedAt: profile.tutorialCompletedAt?.toISOString() ?? null,
      updatedAt: profile.updatedAt.toISOString(),
    })),
  });
}
