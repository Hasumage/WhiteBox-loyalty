import { NextResponse, type NextRequest } from "next/server";
import type { AdminTaskSource, CompanyVerificationStatus } from "@prisma/client";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { resolveEffectivePermissions } from "@/lib/admin/access-control";
import { ACTIVE_ADMIN_TASK_STATUSES, syncAdminTasksFromSignals } from "@/lib/admin/admin-tasks";
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

  await syncAdminTasksFromSignals();
  const actor = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      role: true,
      permissions: { select: { scope: true, canView: true, canEdit: true, canApprove: true } },
    },
  });
  const permissions = resolveEffectivePermissions(actor?.role ?? session.role, actor?.permissions ?? []);
  const visible = new Map(permissions.map((permission) => [permission.scope, permission.canView]));
  const taskSources: AdminTaskSource[] = [
    ...(visible.get("AUDIT") ? ["AUDIT" as const] : []),
    ...(visible.get("COMPANY_VERIFICATIONS") ? ["COMPANY_VERIFICATION" as const] : []),
    ...(visible.get("FINANCE") ? ["FINANCE" as const] : []),
  ];

  const [companyVerificationCount, telegramQueueFailed, developerCriticalCount, taskCount] = await Promise.all([
    visible.get("COMPANY_VERIFICATIONS")
      ? prisma.companyVerificationApplication.count({ where: { status: { in: OPEN_VERIFICATION_STATUSES } } })
      : Promise.resolve(0),
    visible.get("AUDIT") ? prisma.telegramMessageQueue.count({ where: { status: "FAILED" } }) : Promise.resolve(0),
    visible.get("AUDIT")
      ? prisma.auditEvent.count({ where: { workspace: "DEVELOPER", level: { in: ["WARN", "CRITICAL"] } } })
      : Promise.resolve(0),
    prisma.adminTask.count({
      where: {
        source: { in: taskSources },
        status: { in: [...ACTIVE_ADMIN_TASK_STATUSES] },
      },
    }),
  ]);

  const systemIssueCount = telegramQueueFailed + developerCriticalCount;

  return NextResponse.json({
    items: {
      "/admin": taskCount,
      "/admin/company-verifications": companyVerificationCount,
      "/admin/system-health": systemIssueCount,
    },
    sections: {
      "admin.nav.overview": taskCount,
      "admin.nav.usersPartners": companyVerificationCount,
      "admin.nav.system": systemIssueCount,
    },
  });
}
