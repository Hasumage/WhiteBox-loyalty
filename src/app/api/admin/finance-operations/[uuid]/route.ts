import { NextResponse, type NextRequest } from "next/server";
import type { FinanceOperationStatus } from "@prisma/client";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { resolveEffectivePermission } from "@/lib/admin/access-control";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const APPROVAL_STATUSES = new Set<FinanceOperationStatus>(["APPROVED", "REJECTED", "PAID", "CANCELED"]);

async function readUuid(params: { uuid?: string } | Promise<{ uuid?: string }>) {
  return (await Promise.resolve(params)).uuid ?? "";
}

export async function PATCH(
  request: NextRequest,
  context: { params: { uuid?: string } | Promise<{ uuid?: string }> },
) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;

  const actor = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      role: true,
      email: true,
      permissions: {
        where: { scope: "FINANCE" },
        select: { scope: true, canView: true, canEdit: true, canApprove: true },
      },
    },
  });
  const financePermission = resolveEffectivePermission(actor?.role ?? "CLIENT", actor?.permissions[0] ?? null, "FINANCE");
  if (!actor || !financePermission.canApprove) {
    return NextResponse.json({ message: "Finance approval is not allowed" }, { status: 403 });
  }

  const uuid = await readUuid(context.params);
  const body = (await request.json().catch(() => ({}))) as { status?: FinanceOperationStatus };
  if (!body.status || !APPROVAL_STATUSES.has(body.status)) {
    return NextResponse.json({ message: "Choose valid finance status" }, { status: 400 });
  }

  const now = new Date();
  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.financeOperation.update({
      where: { uuid },
      data: {
        status: body.status,
        approvedById: body.status === "APPROVED" || body.status === "PAID" ? actor.id : undefined,
        approvedAt: body.status === "APPROVED" ? now : undefined,
        processedAt: body.status === "PAID" ? now : undefined,
      },
      include: {
        company: { select: { id: true, slug: true, name: true } },
        requestedBy: { select: { id: true, uuid: true, email: true, name: true } },
        approvedBy: { select: { id: true, uuid: true, email: true, name: true } },
      },
    });
    await tx.auditEvent.create({
      data: {
        workspace: "MANAGER",
        level: "CRITICAL",
        category: "BILLING",
        action: "Finance operation status changed",
        actorUserId: actor.id,
        actorLabel: actor.email,
        targetUuid: updated.uuid,
        targetLabel: updated.title,
        details: `Status changed to ${body.status}. Amount: ${updated.amount.toString()} ${updated.currency}`,
        tags: ["#BILLING", "#FINANCE", "#APPROVAL"],
      },
    });
    await tx.adminTask.updateMany({
      where: {
        sourceKey: `finance:${updated.uuid}`,
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
      data: {
        status: "RESOLVED",
        resolvedById: actor.id,
        resolvedAt: now,
      },
    });
    return updated;
  });

  return NextResponse.json(item);
}
