import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HUNT_TROPHY_SEASON_DAYS } from "@/lib/hunt/battle-rewards";
import {
  requireUserSession,
  isUserAuthResponse,
} from "@/lib/auth/require-user-session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await requireUserSession(req);
  if (isUserAuthResponse(session)) return session;

  const now = new Date();
  const seasonCutoff = new Date(
    now.getTime() - HUNT_TROPHY_SEASON_DAYS * 86400000,
  );
  await prisma.huntPlayerProfile.updateMany({
    where: { huntTrophySeasonStartedAt: { lt: seasonCutoff } },
    data: {
      huntTrophies: 0,
      huntTrophySeasonStartedAt: now,
    },
  });

  const [current, currentPreference, profiles] = await Promise.all([
    prisma.huntPlayerProfile.findUnique({ where: { userId: session.userId } }),
    prisma.userProfilePreference.findUnique({
      where: { userId: session.userId },
      select: { profileVisibility: true },
    }),
    prisma.huntPlayerProfile.findMany({
      where: {
        user: {
          OR: [
            { profilePreference: null },
            { profilePreference: { profileVisibility: { not: "PRIVATE" } } },
          ],
        },
      },
      orderBy: [
        { huntTrophies: "desc" },
        { level: "desc" },
        { xp: "desc" },
        { updatedAt: "asc" },
      ],
      take: 50,
      include: {
        user: { select: { uuid: true, name: true } },
      },
    }),
  ]);
  const seasonStartedAt =
    current?.huntTrophySeasonStartedAt ?? profiles[0]?.huntTrophySeasonStartedAt ?? now;
  const resetsAt = new Date(
    seasonStartedAt.getTime() + HUNT_TROPHY_SEASON_DAYS * 86400000,
  );

  return NextResponse.json(
    {
      seasonDays: HUNT_TROPHY_SEASON_DAYS,
      seasonStartedAt: seasonStartedAt.toISOString(),
      resetsAt: resetsAt.toISOString(),
      currentUser: {
        profileVisibility:
          currentPreference?.profileVisibility === "PRIVATE"
            ? "PRIVATE"
            : currentPreference?.profileVisibility === "FRIENDS"
              ? "FRIENDS"
              : "PUBLIC",
        participates:
          currentPreference?.profileVisibility !== "PRIVATE",
      },
      players: profiles.map((profile, index) => ({
        rank: index + 1,
        userUuid: profile.user.uuid,
        name: profile.user.name,
        level: profile.level,
        huntTrophies: profile.huntTrophies,
        huntLifetimeTrophies: profile.huntLifetimeTrophies,
        cardsOwnedCount: profile.cardsOwnedCount,
        postsCount: profile.postsCount,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
