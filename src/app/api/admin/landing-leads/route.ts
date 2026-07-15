import { NextResponse, type NextRequest } from "next/server";
import type { LandingLeadStatus } from "@prisma/client";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const STATUSES = new Set<LandingLeadStatus>(["NEW", "IN_PROGRESS", "CLOSED", "SPAM"]);

function clampNumber(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const supportAccess = await requireAdminScope(session, "SUPPORT", "canView");
  if (!supportAccess.ok) {
    const prAccess = await requireAdminScope(session, "PR", "canView");
    if (!prAccess.ok) return supportAccess.response;
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim() ?? "";
  const status = searchParams.get("status")?.trim() as LandingLeadStatus | null;
  const page = clampNumber(searchParams.get("page"), 1, 1, 9999);
  const limit = clampNumber(searchParams.get("limit"), 20, 5, 100);
  const where = {
    ...(status && STATUSES.has(status) ? { status } : {}),
    ...(query
      ? {
          OR: [
            { uuid: { contains: query, mode: "insensitive" as const } },
            { name: { contains: query, mode: "insensitive" as const } },
            { company: { contains: query, mode: "insensitive" as const } },
            { contact: { contains: query, mode: "insensitive" as const } },
            { business: { contains: query, mode: "insensitive" as const } },
            { message: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.landingLead.count({ where }),
    prisma.landingLead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        deliveries: {
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
    }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}
