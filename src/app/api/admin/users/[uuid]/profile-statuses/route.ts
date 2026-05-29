import { NextResponse, type NextRequest } from "next/server";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function readUuid(params: { uuid?: string } | Promise<{ uuid?: string }>) {
  return (await Promise.resolve(params)).uuid ?? "";
}

export async function POST(
  request: NextRequest,
  context: { params: { uuid?: string } | Promise<{ uuid?: string }> },
) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "USERS", "canEdit");
  if (!access.ok) return access.response;

  const uuid = await readUuid(context.params);
  const body = (await request.json().catch(() => ({}))) as { statusId?: string };
  const statusId = typeof body.statusId === "string" ? body.statusId.trim() : "";
  if (!statusId) return NextResponse.json({ message: "statusId is required" }, { status: 400 });

  const [user, status] = await Promise.all([
    prisma.user.findUnique({ where: { uuid }, select: { id: true, uuid: true, email: true, name: true } }),
    prisma.profileStatus.findUnique({ where: { id: statusId } }),
  ]);
  if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });
  if (!status || !status.isActive) return NextResponse.json({ message: "Status not found" }, { status: 404 });

  const unlock = await prisma.userProfileStatusUnlock.upsert({
    where: { userId_statusId: { userId: user.id, statusId: status.id } },
    create: {
      userId: user.id,
      statusId: status.id,
      source: "ADMIN_GRANT",
      unlockedById: access.actor.id,
    },
    update: {
      unlockedById: access.actor.id,
    },
    include: { status: true },
  });

  await prisma.auditEvent.create({
    data: {
      workspace: "MANAGER",
      level: "INFO",
      category: "USER",
      action: "Profile status granted",
      actorUserId: access.actor.id,
      actorLabel: access.actor.email,
      targetUserId: user.id,
      targetEmail: user.email,
      targetUuid: user.uuid,
      details: `Granted profile status ${status.title} to ${user.email}.`,
      tags: ["#USER", "#STATUS"],
    },
  });

  return NextResponse.json({
    id: unlock.id,
    statusId: unlock.statusId,
    source: unlock.source,
    unlockedAt: unlock.unlockedAt.toISOString(),
    seenAt: unlock.seenAt?.toISOString() ?? null,
    status: {
      id: unlock.status.id,
      slug: unlock.status.slug,
      title: unlock.status.title,
      description: unlock.status.description,
      rarity: unlock.status.rarity,
      icon: unlock.status.icon,
    },
  });
}
