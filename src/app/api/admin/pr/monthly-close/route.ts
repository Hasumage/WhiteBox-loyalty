import { NextResponse, type NextRequest } from "next/server";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { canClosePreviousPrMonth, closePreviousCompanyReferralMonth } from "@/lib/company-referrals/monthly-close";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;

  const access = await requireAdminScope(session, "PR", "canApprove");
  if (!access.ok) return access.response;
  if (access.actor.role !== "SUPER_ADMIN") {
    return NextResponse.json({ message: "Only super admins can close PR month." }, { status: 403 });
  }
  if (!canClosePreviousPrMonth()) {
    return NextResponse.json({ message: "PR month can be closed only on the first day of the month." }, { status: 409 });
  }

  const result = await closePreviousCompanyReferralMonth({ actorUserId: session.userId });
  return NextResponse.json(result);
}
