import { NextResponse, type NextRequest } from "next/server";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { upsertAdminTaskForFinance } from "@/lib/admin/admin-tasks";
import { resolveEffectivePermission } from "@/lib/admin/access-control";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function actorFromSession(session: Awaited<ReturnType<typeof requireAdminSession>>) {
  if (isAuthResponse(session)) return null;
  return prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      uuid: true,
      role: true,
      email: true,
      name: true,
      permissions: {
        where: { scope: "FINANCE" },
        select: { scope: true, canView: true, canEdit: true, canApprove: true },
      },
    },
  });
}

function financeAccess(actor: Awaited<ReturnType<typeof actorFromSession>>) {
  const explicit = actor?.permissions[0];
  return resolveEffectivePermission(actor?.role ?? "CLIENT", explicit, "FINANCE");
}

export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const actor = await actorFromSession(session);
  if (!financeAccess(actor).canView) {
    return NextResponse.json({ message: "Finance access is not allowed" }, { status: 403 });
  }

  const items = await prisma.financeOperation.findMany({
    orderBy: { createdAt: "desc" },
    take: 80,
    include: {
      company: { select: { id: true, slug: true, name: true } },
      requestedBy: { select: { id: true, uuid: true, email: true, name: true } },
      approvedBy: { select: { id: true, uuid: true, email: true, name: true } },
    },
  });

  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;

  const actor = await actorFromSession(session);
  if (!actor || !financeAccess(actor).canEdit) {
    return NextResponse.json({ message: "Finance request creation is not allowed" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    amount?: string;
    currency?: string;
    details?: string;
  };

  const title = body.title?.trim().slice(0, 160);
  const amount = Number(body.amount);
  const currency = (body.currency?.trim().toUpperCase() || "RUB").slice(0, 8);

  if (!title || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ message: "Enter payout title and positive amount" }, { status: 400 });
  }

  const operation = await prisma.$transaction(async (tx) => {
    const created = await tx.financeOperation.create({
      data: {
        type: "PAYOUT_REQUEST",
        status: "PENDING_APPROVAL",
        title,
        amount,
        currency,
        details: body.details?.trim().slice(0, 2000) || null,
        requestedById: actor.id,
        requestedAt: new Date(),
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
        level: "WARN",
        category: "BILLING",
        action: "Finance payout request created",
        actorUserId: actor.id,
        actorLabel: actor.email,
        targetUuid: created.uuid,
        targetLabel: created.title,
        details: `${created.amount.toString()} ${created.currency}`,
        tags: ["#BILLING", "#FINANCE"],
      },
    });

    return created;
  });

  // The dashboard reconciliation will recreate a missed task; do not fail a persisted payout request.
  await upsertAdminTaskForFinance(operation).catch(() => undefined);
  return NextResponse.json(operation);
}
