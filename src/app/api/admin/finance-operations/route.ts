import { NextResponse, type NextRequest } from "next/server";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { resolveEffectivePermission } from "@/lib/admin/access-control";
import { calculateCompanyReferralPayoutCoverage } from "@/lib/company-referrals/company-referrals";
import { calculateCompanyFinancialSnapshot, evaluatePayoutCoverage } from "@/lib/finance/company-finance";
import { buildPayoutChecklist, isReferralPayout, resolvePayoutTarget } from "@/lib/finance/payout-operations";
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
      company: {
        select: {
          id: true,
          slug: true,
          name: true,
          payoutBankName: true,
          payoutBik: true,
          payoutAccount: true,
          payoutCorrespondentAccount: true,
          payoutCardLast4: true,
        },
      },
      requestedBy: { select: { id: true, uuid: true, email: true, name: true } },
      approvedBy: { select: { id: true, uuid: true, email: true, name: true } },
    },
  });

  const companyIds = [...new Set(items.flatMap((item) => (item.companyId ? [item.companyId] : [])))];

  const now = new Date();
  const [subscriptions, companyPayouts] = await Promise.all([
    prisma.userSubscription.findMany({
      where: {
        status: { in: ["ACTIVE", "EXPIRED"] },
        subscription: { companyId: { in: companyIds.length ? companyIds : [-1] } },
      },
      select: {
        status: true,
        activatedAt: true,
        expiresAt: true,
        subscription: { select: { companyId: true, name: true, price: true } },
      },
    }),
    prisma.financeOperation.findMany({
      where: {
        companyId: { in: companyIds.length ? companyIds : [-1] },
        type: "PAYOUT_REQUEST",
        status: { in: ["PENDING_APPROVAL", "APPROVED", "PAID"] },
      },
      select: { companyId: true, type: true, status: true, amount: true },
    }),
  ]);
  const revenueRows = subscriptions.map((item) => ({
    companyId: item.subscription.companyId!,
    name: item.subscription.name,
    price: item.subscription.price,
    status: item.status,
    activatedAt: item.activatedAt,
    expiresAt: item.expiresAt,
  }));
  const snapshots = new Map(
    companyIds.map((companyId) => [
      companyId,
      calculateCompanyFinancialSnapshot(companyId, revenueRows, companyPayouts, now),
    ]),
  );
  const referralCoverages = new Map(
    await Promise.all(
      items
        .filter(isReferralPayout)
        .map(async (item) => [item.uuid, await calculateCompanyReferralPayoutCoverage(item.requestedById!, item)] as const),
    ),
  );

  return NextResponse.json({
    items: items.map((item) => {
      const companySnapshot =
        item.companyId && snapshots.has(item.companyId)
          ? evaluatePayoutCoverage(snapshots.get(item.companyId)!, item)
          : null;
      const referralSnapshot = referralCoverages.get(item.uuid) ?? null;
      return {
        ...item,
        payoutTarget: resolvePayoutTarget(item),
        payoutChecklist: buildPayoutChecklist(item, companySnapshot, referralSnapshot),
        companySnapshot,
        referralSnapshot,
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;

  const actor = await actorFromSession(session);
  if (!actor || !financeAccess(actor).canEdit) {
    return NextResponse.json({ message: "Finance request creation is not allowed" }, { status: 403 });
  }

  return NextResponse.json(
    { message: "Create payouts from a company balance or from the PR agent cabinet. Free-form finance payouts are disabled." },
    { status: 410 },
  );
}
