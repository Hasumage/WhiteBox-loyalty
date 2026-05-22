import { NextResponse, type NextRequest } from "next/server";
import type { CompanyVerificationStatus } from "@prisma/client";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const OPEN_VERIFICATION_STATUSES: CompanyVerificationStatus[] = ["SUBMITTED", "REVIEWING"];

export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;

  if (session.role === "SUPPORT") {
    return NextResponse.json({
      items: {},
      sections: {},
    });
  }

  const [companyVerificationCount, telegramQueueFailed, developerCriticalCount] = await Promise.all([
    prisma.companyVerificationApplication.count({
      where: { status: { in: OPEN_VERIFICATION_STATUSES } },
    }),
    prisma.telegramMessageQueue.count({
      where: { status: "FAILED" },
    }),
    prisma.auditEvent.count({
      where: {
        workspace: "DEVELOPER",
        level: { in: ["WARN", "CRITICAL"] },
      },
    }),
  ]);

  const systemIssueCount = telegramQueueFailed + developerCriticalCount;

  return NextResponse.json({
    items: {
      "/admin/company-verifications": companyVerificationCount,
      "/admin/system-health": systemIssueCount,
    },
    sections: {
      "admin.nav.usersPartners": companyVerificationCount,
      "admin.nav.system": systemIssueCount,
    },
  });
}
