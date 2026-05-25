import { NextResponse, type NextRequest } from "next/server";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { requiredScopeForAdminTask, syncAdminTasksFromSignals } from "@/lib/admin/admin-tasks";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function readUuid(params: { uuid?: string } | Promise<{ uuid?: string }>) {
  return (await Promise.resolve(params)).uuid ?? "";
}

async function findTask(uuid: string) {
  return prisma.adminTask.findUnique({
    where: { uuid },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      resolvedBy: { select: { id: true, name: true, email: true } },
    },
  });
}

async function authorizeTask(session: Exclude<Awaited<ReturnType<typeof requireAdminSession>>, NextResponse>, source: Parameters<typeof requiredScopeForAdminTask>[0], action: "canView" | "canEdit") {
  return requireAdminScope(session, requiredScopeForAdminTask(source), action);
}

export async function GET(
  request: NextRequest,
  context: { params: { uuid?: string } | Promise<{ uuid?: string }> },
) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  await syncAdminTasksFromSignals();
  const task = await findTask(await readUuid(context.params));
  if (!task) return NextResponse.json({ message: "Task not found." }, { status: 404 });
  const access = await authorizeTask(session, task.source, "canView");
  if (!access.ok) return access.response;
  return NextResponse.json(task);
}

export async function PATCH(
  request: NextRequest,
  context: { params: { uuid?: string } | Promise<{ uuid?: string }> },
) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const uuid = await readUuid(context.params);
  const task = await findTask(uuid);
  if (!task) return NextResponse.json({ message: "Task not found." }, { status: 404 });
  const access = await authorizeTask(session, task.source, "canEdit");
  if (!access.ok) return access.response;

  const body = (await request.json().catch(() => ({}))) as { action?: "start" | "resolve" | "reopen" };
  if (!body.action || !["start", "resolve", "reopen"].includes(body.action)) {
    return NextResponse.json({ message: "Invalid task action." }, { status: 400 });
  }
  if (body.action === "resolve" && task.source !== "AUDIT") {
    return NextResponse.json({ message: "Complete the linked workflow to resolve this task." }, { status: 409 });
  }

  const next = await prisma.$transaction(async (tx) => {
    if (body.action === "resolve") {
      const auditId = task.sourceKey.startsWith("audit:") ? task.sourceKey.slice("audit:".length) : null;
      if (auditId) {
        const event = await tx.auditEvent.findUnique({ where: { id: auditId }, select: { tags: true, details: true } });
        if (event) {
          await tx.auditEvent.update({
            where: { id: auditId },
            data: {
              level: "INFO",
              tags: Array.from(new Set([...event.tags, "RESOLVED"])),
              details: `${event.details ?? ""}\n\nResolved from task board by ${session.email ?? `admin:${session.userId}`}.`.trim(),
            },
          });
        }
      }
      return tx.adminTask.update({
        where: { uuid },
        data: { status: "RESOLVED", resolvedById: session.userId, resolvedAt: new Date() },
      });
    }
    if (body.action === "start") {
      return tx.adminTask.update({
        where: { uuid },
        data: { status: "IN_PROGRESS", assignedToId: session.userId, assignedAt: new Date(), resolvedAt: null, resolvedById: null },
      });
    }
    return tx.adminTask.update({
      where: { uuid },
      data: { status: "OPEN", assignedToId: null, assignedAt: null, resolvedAt: null, resolvedById: null },
    });
  });

  return NextResponse.json(next);
}
