import { NextResponse, type NextRequest } from "next/server";
import type { AdminTaskPriority, AdminTaskSource, AdminTaskStatus } from "@prisma/client";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { resolveEffectivePermissions } from "@/lib/admin/access-control";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { ACTIVE_ADMIN_TASK_STATUSES, syncAdminTasksFromSignals } from "@/lib/admin/admin-tasks";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const priorityOrder: Record<AdminTaskPriority, number> = { CRITICAL: 0, HIGH: 1, NORMAL: 2 };
const statusOrder: Record<AdminTaskStatus, number> = { OPEN: 0, IN_PROGRESS: 1, RESOLVED: 2, DISMISSED: 3 };


function isTaskSource(value: unknown): value is AdminTaskSource {
  return value === "AUDIT" || value === "COMPANY_VERIFICATION" || value === "FINANCE";
}

function isTaskPriority(value: unknown): value is AdminTaskPriority {
  return value === "NORMAL" || value === "HIGH" || value === "CRITICAL";
}

function isManualStatus(value: unknown): value is Exclude<AdminTaskStatus, "DISMISSED"> {
  return value === "OPEN" || value === "IN_PROGRESS" || value === "RESOLVED";
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

function departmentForSource(source: AdminTaskSource) {
  if (source === "FINANCE") return "finance";
  if (source === "COMPANY_VERIFICATION") return "operations";
  return "system";
}

function audienceForTask(task: { source: AdminTaskSource; priority: AdminTaskPriority; title: string; description: string | null }) {
  const haystack = `${task.title} ${task.description ?? ""}`.toLowerCase();
  if (task.source === "FINANCE") return "admin";
  if (task.source === "COMPANY_VERIFICATION") return "manager";
  if (haystack.includes("referral") || haystack.includes("pr") || haystack.includes("реферал")) return "pr";
  return task.priority === "CRITICAL" ? "admin" : "manager";
}

function criticalKind(task: { source: AdminTaskSource; title: string; description: string | null; sourceKey: string }) {
  const haystack = `${task.title} ${task.description ?? ""} ${task.sourceKey}`.toLowerCase();
  if (task.source === "FINANCE") return "admin.tasks.kindFinancePayout";
  if (haystack.includes("payment") || haystack.includes("yookassa") || haystack.includes("\u043e\u043f\u043b\u0430\u0442")) return "admin.tasks.kindPaymentError";
  if (haystack.includes("daily") || haystack.includes("report") || haystack.includes("\u043e\u0442\u0447\u0435\u0442") || haystack.includes("\u043e\u0442\u0447\u0451\u0442")) return "admin.tasks.kindReportFailed";
  if (task.source === "COMPANY_VERIFICATION") return "admin.tasks.kindVerification";
  return "admin.tasks.kindSystem";
}

function serializeTask(task: Awaited<ReturnType<typeof prisma.adminTask.findMany>>[number]) {
  return {
    ...task,
    department: departmentForSource(task.source),
    audience: audienceForTask(task),
    criticalKind: criticalKind(task),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    assignedAt: task.assignedAt?.toISOString() ?? null,
    resolvedAt: task.resolvedAt?.toISOString() ?? null,
  };
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
  const role = actor?.role ?? session.role;
  const sources = allowedSourcesFor(role, actor?.permissions ?? []);
  const sourceFilter = sources as AdminTaskSource[];

  const [tasks, assignees] = await Promise.all([
    prisma.adminTask.findMany({
      where: {
        source: { in: sourceFilter },
        OR: [
          { status: { in: [...ACTIVE_ADMIN_TASK_STATUSES] } },
          { resolvedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
          { status: "DISMISSED", updatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        ],
      },
      orderBy: [{ status: "asc" }, { priority: "asc" }, { createdAt: "asc" }],
      take: 240,
      include: {
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        resolvedBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN", "MANAGER", "SUPPORT"] } },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: { id: true, uuid: true, name: true, email: true, role: true },
    }),
  ]);

  const serializedTasks = tasks
    .sort((left, right) => (
      statusOrder[left.status] - statusOrder[right.status] ||
      priorityOrder[left.priority] - priorityOrder[right.priority] ||
      left.createdAt.getTime() - right.createdAt.getTime()
    ))
    .map(serializeTask);

  const criticalTasks = serializedTasks.filter((task) => task.priority === "CRITICAL" && (task.status === "OPEN" || task.status === "IN_PROGRESS"));

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    role,
    permittedSources: sources,
    departments: [
      { id: "finance", label: "admin.tasks.departmentFinance", description: "admin.tasks.departmentFinanceDescription" },
      { id: "operations", label: "admin.tasks.departmentOperations", description: "admin.tasks.departmentOperationsDescription" },
      { id: "system", label: "admin.tasks.departmentSystem", description: "admin.tasks.departmentSystemDescription" },
      { id: "growth", label: "admin.tasks.departmentGrowth", description: "admin.tasks.departmentGrowthDescription" },
    ],
    alertMenus: [
      {
        id: "admin",
        label: "admin.tasks.menuAdmin",
        description: "admin.tasks.menuAdminDescription",
        examples: [],
        count: criticalTasks.filter((task) => task.audience === "admin").length,
      },
      {
        id: "manager",
        label: "admin.tasks.menuManager",
        description: "admin.tasks.menuManagerDescription",
        examples: [],
        count: criticalTasks.filter((task) => task.audience === "manager").length,
      },
      {
        id: "pr",
        label: "admin.tasks.menuPr",
        description: "admin.tasks.menuPrDescription",
        examples: [],
        count: criticalTasks.filter((task) => task.audience === "pr").length,
      },
    ],
    tasks: serializedTasks,
    assignees,
  });
}


export async function POST(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;

  const body = (await request.json().catch(() => ({}))) as {
    title?: unknown;
    description?: unknown;
    priority?: unknown;
    status?: unknown;
    source?: unknown;
    assignedToId?: unknown;
  };

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const source = isTaskSource(body.source) ? body.source : "AUDIT";
  const priority = isTaskPriority(body.priority) ? body.priority : "NORMAL";
  const status = isManualStatus(body.status) ? body.status : "OPEN";
  const assignedToId = typeof body.assignedToId === "number" && Number.isInteger(body.assignedToId) ? body.assignedToId : null;

  if (title.length < 3) return NextResponse.json({ message: "Task title is too short." }, { status: 400 });
  if (title.length > 160) return NextResponse.json({ message: "Task title is too long." }, { status: 400 });
  if (description.length > 8000) return NextResponse.json({ message: "Task description is too long." }, { status: 400 });

  const access = await requireAdminScope(session, source === "COMPANY_VERIFICATION" ? "COMPANY_VERIFICATIONS" : source, "canEdit");
  if (!access.ok) return access.response;

  if (assignedToId) {
    const assignee = await prisma.user.findFirst({
      where: { id: assignedToId, role: { in: ["SUPER_ADMIN", "ADMIN", "MANAGER", "SUPPORT"] } },
      select: { id: true },
    });
    if (!assignee) return NextResponse.json({ message: "Assignee not found." }, { status: 404 });
  }

  const task = await prisma.adminTask.create({
    data: {
      source,
      sourceKey: `manual:${crypto.randomUUID()}`,
      title,
      description: description || null,
      priority,
      status,
      assignedToId,
      assignedAt: assignedToId ? new Date() : null,
      resolvedById: status === "RESOLVED" ? session.userId : null,
      resolvedAt: status === "RESOLVED" ? new Date() : null,
    },
    include: {
      assignedTo: { select: { id: true, name: true, email: true, role: true } },
      resolvedBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(serializeTask(task), { status: 201 });
}
