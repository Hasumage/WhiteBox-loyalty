import { NextResponse, type NextRequest } from "next/server";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { createCompanyReferralPayoutRequest, getCompanyReferralDashboard } from "@/lib/company-referrals/company-referrals";

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
