import { NextResponse, type NextRequest } from "next/server";
import type { AdminTaskSource } from "@prisma/client";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { resolveEffectivePermissions } from "@/lib/admin/access-control";
import { ACTIVE_ADMIN_TASK_STATUSES, syncAdminTasksFromSignals } from "@/lib/admin/admin-tasks";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function allowedSourcesFor(role: string, permissions: Array<{ scope: string; canView: boolean; canEdit: boolean; canApprove: boolean }>) {
  const effective = resolveEffectivePermissions(role, permissions);
  const can = new Map(effective.map((permission) => [permission.scope, permission.canView]));
  return [
    ...(can.get("AUDIT") ? ["AUDIT" as const] : []),
    ...(can.get("COMPANY_VERIFICATIONS") ? ["COMPANY_VERIFICATION" as const] : []),
    ...(can.get("FINANCE") ? ["FINANCE" as const] : []),
  ];
}

export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;

  await syncAdminTasksFromSignals();

  const actor = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      role: true,
      permissions: { select: { scope: true, canView: true, canEdit: true, canApprove: true } },
    },
  });
  const sources = allowedSourcesFor(actor?.role ?? session.role, actor?.permissions ?? []);
  const visibleTaskWhere = { source: { in: sources as AdminTaskSource[] } };
  const openWhere = { ...visibleTaskWhere, status: { in: [...ACTIVE_ADMIN_TASK_STATUSES] } };
  const seesVerification = sources.includes("COMPANY_VERIFICATION");
  const seesFinance = sources.includes("FINANCE");
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 6);

  const [
    usersTotal,
    usersActive,
    companiesActive,
    subscriptionsActive,
    verificationOpen,
    pendingFinance,
    openTasks,
    criticalTasks,
    recentTasks,
    recentTaskEvents,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { accountStatus: "ACTIVE" } }),
    prisma.company.count({ where: { isActive: true } }),
    prisma.userSubscription.count({ where: { status: "ACTIVE" } }),
    seesVerification
      ? prisma.companyVerificationApplication.count({ where: { status: { in: ["SUBMITTED", "REVIEWING"] } } })
      : Promise.resolve(0),
    seesFinance ? prisma.financeOperation.count({ where: { status: "PENDING_APPROVAL" } }) : Promise.resolve(0),
    prisma.adminTask.count({ where: openWhere }),
    prisma.adminTask.count({ where: { ...openWhere, priority: "CRITICAL" } }),
    prisma.adminTask.findMany({
      where: openWhere,
      orderBy: { createdAt: "asc" },
      take: 32,
      include: { assignedTo: { select: { name: true } } },
    }),
    prisma.adminTask.findMany({
      where: { ...visibleTaskWhere, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
  ]);

  const priorityOrder = { CRITICAL: 0, HIGH: 1, NORMAL: 2 } as const;
  const priorityTasks = recentTasks
    .sort((left, right) => priorityOrder[left.priority] - priorityOrder[right.priority] || left.createdAt.getTime() - right.createdAt.getTime())
    .slice(0, 8);
  const trend = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(since);
    date.setDate(date.getDate() + offset);
    const key = dateKey(date);
    return {
      date: key,
      events: recentTaskEvents.filter((event) => dateKey(event.createdAt) === key).length,
    };
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    metrics: {
      usersTotal,
      usersActive,
      companiesActive,
      subscriptionsActive,
      verificationOpen,
      pendingFinance,
      openTasks,
      criticalTasks,
    },
    permittedSources: sources,
    trend,
    tasks: priorityTasks.map((task) => ({
      ...task,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      assignedAt: task.assignedAt?.toISOString() ?? null,
      resolvedAt: task.resolvedAt?.toISOString() ?? null,
    })),
  });
}
