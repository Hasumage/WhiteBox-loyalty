import { NextResponse, type NextRequest } from "next/server";
import { isUserAuthResponse, requireUserSession } from "@/lib/auth/require-user-session";
import { createCompanyReferralPayoutRequest, getCompanyReferralDashboard } from "@/lib/company-referrals/company-referrals";

export const runtime = "nodejs";

function publicOrigin(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_ORIGIN || process.env.NEXT_PUBLIC_FRONTEND_URL;
  if (configured) return configured.replace(/\/$/, "");
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const session = await requireUserSession(request);
  if (isUserAuthResponse(session)) return session;

  const dashboard = await getCompanyReferralDashboard(session.userId);
  return NextResponse.json({
    ...dashboard,
    link: `${publicOrigin(request)}/company/register?ref=${encodeURIComponent(dashboard.code)}`,
  });
}

export async function POST(request: NextRequest) {
  const session = await requireUserSession(request);
  if (isUserAuthResponse(session)) return session;

  const body = (await request.json().catch(() => ({}))) as { amount?: number | string };
  const amount = Number(body.amount);

  try {
    const operation = await createCompanyReferralPayoutRequest(session.userId, amount);
    const dashboard = await getCompanyReferralDashboard(session.userId);
    return NextResponse.json({
      ok: true,
      operationUuid: operation.uuid,
      dashboard: {
        ...dashboard,
        link: `${publicOrigin(request)}/company/register?ref=${encodeURIComponent(dashboard.code)}`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Не удалось создать заявку на выплату." },
      { status: 400 },
    );
  }
}

