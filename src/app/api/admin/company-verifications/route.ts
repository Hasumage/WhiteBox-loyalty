import { NextResponse, type NextRequest } from "next/server";
import type { CompanyVerificationStatus } from "@prisma/client";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const STATUSES = new Set<CompanyVerificationStatus>(["DRAFT", "SUBMITTED", "REVIEWING", "APPROVED", "REJECTED"]);

function clampNumber(value: string | null, fallback: number, min: number, max: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "COMPANY_VERIFICATIONS", "canView");
  if (!access.ok) return access.response;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim() ?? "";
  const status = searchParams.get("status")?.trim() as CompanyVerificationStatus | null;
  const page = clampNumber(searchParams.get("page"), 1, 1, 9999);
  const limit = clampNumber(searchParams.get("limit"), 12, 5, 50);

  const where = {
    ...(status && STATUSES.has(status) ? { status } : {}),
    ...(query
      ? {
          OR: [
            { uuid: { contains: query, mode: "insensitive" as const } },
            { contactName: { contains: query, mode: "insensitive" as const } },
            { contactEmail: { contains: query, mode: "insensitive" as const } },
            { contactTelegram: { contains: query, mode: "insensitive" as const } },
            { companyName: { contains: query, mode: "insensitive" as const } },
            { businessCategory: { contains: query, mode: "insensitive" as const } },
            { legalFullName: { contains: query, mode: "insensitive" as const } },
            { legalInn: { contains: query, mode: "insensitive" as const } },
            { legalOgrnip: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, items, summaryRows] = await Promise.all([
    prisma.companyVerificationApplication.count({ where }),
    prisma.companyVerificationApplication.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        company: {
          select: {
            id: true,
            slug: true,
            name: true,
            isActive: true,
            verificationStatus: true,
            passportVerificationStatus: true,
          },
        },
      },
    }),
    prisma.companyVerificationApplication.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    summary: Object.fromEntries(summaryRows.map((row) => [row.status, row._count.status])),
  });
}
