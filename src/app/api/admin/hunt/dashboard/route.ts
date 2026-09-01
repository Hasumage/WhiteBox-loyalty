import { NextResponse, type NextRequest } from "next/server";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "HUNT", "canView");
  if (!access.ok) return access.response;

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 6);

  const [
    players,
    activePlayers,
    posts,
    publishedPosts,
    likes,
    cards,
    boxesOpened,
    nearCoin,
    openReports,
    moderationGroups,
    recentPosts,
    recentReactions,
    rarityGroups,
    topSpecies,
    topPlayers,
  ] = await Promise.all([
    prisma.huntPlayerProfile.count(),
    prisma.huntPlayerProfile.count({ where: { updatedAt: { gte: since } } }),
    prisma.huntPost.count(),
    prisma.huntPost.count({ where: { status: "PUBLISHED" } }),
    prisma.huntPostReaction.count(),
    prisma.huntCard.count(),
    prisma.huntBox.count({ where: { status: "OPENED" } }),
    prisma.huntCurrencyLedger.aggregate({ _sum: { amount: true }, where: { amount: { gt: 0 } } }),
    prisma.huntPostReport.count({ where: { status: { in: ["OPEN", "REVIEWING"] } } }),
    prisma.huntPost.groupBy({ by: ["moderationStatus"], _count: { _all: true } }),
    prisma.huntPost.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, likeCount: true } }),
    prisma.huntPostReaction.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.huntCard.groupBy({ by: ["rarity"], _count: { _all: true } }),
    prisma.huntCreatureSpecies.findMany({
      include: { _count: { select: { cards: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.huntPlayerProfile.findMany({
      include: { user: { select: { uuid: true, name: true, email: true } } },
      orderBy: [{ level: "desc" }, { lifetimeInfluence: "desc" }],
      take: 8,
    }),
  ]);

  const byDay = new Map<string, { date: string; posts: number; likes: number }>();
  for (let index = 0; index < 7; index += 1) {
    const date = new Date(since);
    date.setDate(since.getDate() + index);
    const key = dayKey(date);
    byDay.set(key, { date: key, posts: 0, likes: 0 });
  }
  for (const post of recentPosts) {
    const bucket = byDay.get(dayKey(post.createdAt));
    if (bucket) {
      bucket.posts += 1;
      bucket.likes += post.likeCount;
    }
  }
  for (const reaction of recentReactions) {
    const bucket = byDay.get(dayKey(reaction.createdAt));
    if (bucket) bucket.likes += 1;
  }

  const moderation = {
    flagged: moderationGroups.find((item) => item.moderationStatus === "FLAGGED")?._count._all ?? 0,
    reviewing: moderationGroups.find((item) => item.moderationStatus === "REVIEWING")?._count._all ?? 0,
    actioned: moderationGroups.find((item) => item.moderationStatus === "ACTIONED")?._count._all ?? 0,
  };

  return NextResponse.json({
    summary: {
      players,
      activePlayers,
      posts,
      publishedPosts,
      likes,
      cards,
      boxesOpened,
      nearCoinIssued: nearCoin._sum.amount ?? 0,
      openReports,
    },
    postsByDay: [...byDay.values()],
    rarityDistribution: rarityGroups.map((item) => ({ rarity: item.rarity, count: item._count._all })),
    topCharacters: topSpecies
      .sort((left, right) => right._count.cards - left._count.cards || left.sortOrder - right.sortOrder)
      .slice(0, 8)
      .map((species) => ({
        uuid: species.id,
        name: species.name,
        rarity: species.baseRarity,
        element: species.element,
        imageUrl: species.imageUrl,
        ownedCount: species._count.cards,
      })),
    topPlayers: topPlayers.map((profile) => ({
      uuid: profile.user.uuid,
      name: profile.user.name,
      email: profile.user.email,
      level: profile.level,
      cardsOwnedCount: profile.cardsOwnedCount,
      postsCount: profile.postsCount,
      lifetimeInfluence: profile.lifetimeInfluence,
    })),
    moderation,
  });
}
