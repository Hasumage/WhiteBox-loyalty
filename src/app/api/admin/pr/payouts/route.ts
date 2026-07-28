import { NextResponse, type NextRequest } from "next/server";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { createCompanyReferralPayoutRequest, getCompanyReferralDashboard } from "@/lib/company-referrals/company-referrals";
import { prisma } from "@/lib/prisma";
import { encryptPrPayoutCard, normalizePrPayoutRequisitesInput } from "@/lib/pr-payout/requisites";
import { notifySuperAdminsPrPayoutCreated } from "@/lib/telegram/notification-module";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "PR", "canView");
  if (!access.ok) return access.response;

  const dashboard = await getCompanyReferralDashboard(session.userId);
  return NextResponse.json(dashboard);
}

export async function POST(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "PR", "canEdit");
  if (!access.ok) return access.response;

  const body = (await request.json().catch(() => ({}))) as { amount?: number | string };
  const amount = Number(body.amount);
  try {
    const operation = await createCompanyReferralPayoutRequest(session.userId, amount);
    await notifySuperAdminsPrPayoutCreated(operation.uuid).catch((error) => {
      console.warn("[admin.pr.payouts] Telegram payout notification failed", error);
    });
    const dashboard = await getCompanyReferralDashboard(session.userId);
    return NextResponse.json({
      operation: {
        uuid: operation.uuid,
        amount: Number(operation.amount),
        status: operation.status,
        createdAt: operation.createdAt.toISOString(),
      },
      dashboard,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to create payout request" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "PR", "canEdit");
  if (!access.ok) return access.response;

  const body = (await request.json().catch(() => ({}))) as {
    bankCode?: unknown;
    phone?: unknown;
    cardNumber?: unknown;
  };

  try {
    const normalized = normalizePrPayoutRequisitesInput(body);
    const card = normalized.cardNumber ? encryptPrPayoutCard(normalized.cardNumber) : null;

    await prisma.user.update({
      where: { id: session.userId },
      data: {
        prPayoutBankCode: normalized.bankCode,
        prPayoutBankName: normalized.bankName,
        prPayoutPhone: normalized.phone,
        prPayoutCardEncrypted: card?.encrypted ?? null,
        prPayoutCardIv: card?.iv ?? null,
        prPayoutCardTag: card?.tag ?? null,
        prPayoutCardLast4: card?.last4 ?? null,
        prPayoutRequisitesUpdatedAt: new Date(),
      },
    });

    return NextResponse.json(await getCompanyReferralDashboard(session.userId));
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Не удалось сохранить реквизиты." },
      { status: 400 },
    );
  }
}
