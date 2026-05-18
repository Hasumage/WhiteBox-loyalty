import { NextResponse, type NextRequest } from "next/server";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const NOTIFICATION_ROLES = new Set(["ADMIN", "SUPER_ADMIN", "MANAGER"]);
const ADMIN_WORKSPACE_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "SUPPORT"] as const;

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdminSession(request);
    if (isAuthResponse(session)) return session;

    const admin =
      (await prisma.user.findUnique({
        where: { id: session.userId },
        select: { id: true, email: true, name: true, role: true, telegramId: true },
      })) ??
      (session.email
        ? await prisma.user.findUnique({
            where: { email: session.email },
            select: { id: true, email: true, name: true, role: true, telegramId: true },
          })
        : null);

    if (!admin) {
      return NextResponse.json({ message: "Administrator was not found. Please log out and sign in again." }, { status: 404 });
    }

    const admins = await prisma.user.findMany({
      where: { role: { in: [...ADMIN_WORKSPACE_ROLES] } },
      select: {
        uuid: true,
        email: true,
        name: true,
        role: true,
        accountStatus: true,
        telegramId: true,
        updatedAt: true,
      },
      orderBy: [{ role: "asc" }, { id: "asc" }],
    });

    return NextResponse.json({
      connected: Boolean(admin.telegramId),
      telegramId: admin.telegramId?.toString() ?? null,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      admins: admins.map((row) => ({
        uuid: row.uuid,
        email: row.email,
        name: row.name,
        role: row.role,
        accountStatus: row.accountStatus,
        telegramId: row.telegramId?.toString() ?? null,
        connected: Boolean(row.telegramId),
        receivesNotifications:
          Boolean(row.telegramId) &&
          row.accountStatus === "ACTIVE" &&
          NOTIFICATION_ROLES.has(row.role),
        updatedAt: row.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to check Telegram connection" },
      { status: 500 },
    );
  }
}
