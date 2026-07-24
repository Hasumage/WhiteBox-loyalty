import { NextResponse, type NextRequest } from "next/server";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const PROFILE_NAME_MAX = 80;

function compactText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function maskPhone(phone: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return phone;
  return `•••• ${digits.slice(-4)}`;
}

function serializeTelegramId(telegramId: bigint | null) {
  return telegramId?.toString() ?? null;
}

async function buildSettingsPayload(userId: number) {
  const [user, totalCompanies, activeCompanies, funnelCompanies, pendingPayouts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        uuid: true,
        name: true,
        email: true,
        role: true,
        accountStatus: true,
        companyReferralCode: true,
        telegramId: true,
        phoneNumber: true,
        phoneVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
        permissions: {
          select: {
            scope: true,
            canView: true,
            canEdit: true,
            canApprove: true,
          },
          orderBy: { scope: "asc" },
        },
      },
    }),
    prisma.companyReferral.count({ where: { referrerUserId: userId } }),
    prisma.companyReferral.count({ where: { referrerUserId: userId, status: "ACTIVE" } }),
    prisma.prFunnelCompany.count({ where: { ownerUserId: userId } }),
    prisma.financeOperation.count({
      where: {
        requestedById: userId,
        status: { in: ["PENDING_APPROVAL", "APPROVED"] },
      },
    }),
  ]);

  if (!user) return null;

  return {
    user: {
      uuid: user.uuid,
      name: user.name,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
      referralCode: user.companyReferralCode,
      telegramId: serializeTelegramId(user.telegramId),
      phoneNumber: maskPhone(user.phoneNumber),
      phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
    stats: {
      totalCompanies,
      activeCompanies,
      funnelCompanies,
      pendingPayouts,
    },
    permissions: user.permissions.map((permission) => ({
      scope: permission.scope,
      canView: permission.canView,
      canEdit: permission.canEdit,
      canApprove: permission.canApprove,
    })),
  };
}

export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "PR", "canView");
  if (!access.ok) return access.response;

  const payload = await buildSettingsPayload(session.userId);
  if (!payload) return NextResponse.json({ message: "PR account was not found" }, { status: 404 });

  return NextResponse.json(payload);
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "PR", "canView");
  if (!access.ok) return access.response;

  const body = (await request.json().catch(() => ({}))) as { name?: unknown };
  const name = compactText(body.name, PROFILE_NAME_MAX);
  if (!name) return NextResponse.json({ message: "Name is required" }, { status: 400 });

  await prisma.user.update({
    where: { id: session.userId },
    data: { name },
  });

  const payload = await buildSettingsPayload(session.userId);
  if (!payload) return NextResponse.json({ message: "PR account was not found" }, { status: 404 });

  return NextResponse.json(payload);
}
