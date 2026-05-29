import { NextResponse, type NextRequest } from "next/server";
import type { FinanceOperationStatus } from "@prisma/client";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { resolveEffectivePermission } from "@/lib/admin/access-control";
import { calculateCompanyFinancialSnapshot, evaluatePayoutCoverage } from "@/lib/finance/company-finance";
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
  try {
    const item = await prisma.$transaction(async (tx) => {
      const current = await tx.financeOperation.findUnique({ where: { uuid } });
      if (!current) {
        throw new Error("FINANCE_OPERATION_NOT_FOUND");
      }
      if (
        current.companyId &&
        current.type === "PAYOUT_REQUEST" &&
        (body.status === "APPROVED" || body.status === "PAID")
      ) {
        const [subscriptions, companyPayouts] = await Promise.all([
          tx.userSubscription.findMany({
            where: {
              status: { in: ["ACTIVE", "EXPIRED"] },
              subscription: { companyId: current.companyId },
            },
            select: {
              status: true,
              activatedAt: true,
              expiresAt: true,
              subscription: { select: { companyId: true, name: true, price: true } },
            },
          }),
          tx.financeOperation.findMany({
            where: {
              companyId: current.companyId,
              type: "PAYOUT_REQUEST",
              status: { in: ["PENDING_APPROVAL", "APPROVED", "PAID"] },
            },
            select: { companyId: true, type: true, status: true, amount: true },
          }),
        ]);
        const snapshot = calculateCompanyFinancialSnapshot(
          current.companyId,
          subscriptions.map((subscription) => ({
            companyId: subscription.subscription.companyId!,
            name: subscription.subscription.name,
            price: subscription.subscription.price,
            status: subscription.status,
            activatedAt: subscription.activatedAt,
            expiresAt: subscription.expiresAt,
          })),
          companyPayouts,
          now,
        );
        const coverage = evaluatePayoutCoverage(snapshot, current);
        if (!coverage.requestCovered) {
          throw new Error(`INSUFFICIENT_COMPANY_BALANCE:${coverage.availableBeforeThisRequest.toFixed(2)}`);
        }
      }
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "FINANCE_OPERATION_NOT_FOUND") {
      return NextResponse.json({ message: "Finance operation not found" }, { status: 404 });
    }
    if (message.startsWith("INSUFFICIENT_COMPANY_BALANCE:")) {
      const available = message.split(":")[1];
      return NextResponse.json(
        { message: `Company payout is not covered by earned balance. Available before this request: ${available} RUB.` },
        { status: 409 },
      );
    }
    throw error;
  }
}
