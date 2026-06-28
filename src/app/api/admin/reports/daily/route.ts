import { NextResponse, type NextRequest } from "next/server";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { buildDailyReportSnapshot, formatDailyReport, sendDailyReport } from "@/lib/reports/daily-report";

export const runtime = "nodejs";

function hasReportSecret(request: NextRequest) {
  const secret = process.env.DAILY_REPORT_SECRET;
  if (!secret) return false;

  const headerSecret = request.headers.get("x-daily-report-secret");
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return headerSecret === secret || bearer === secret;
}

async function requireAdminOrSecret(request: NextRequest) {
  if (hasReportSecret(request)) return null;

  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  return null;
}

export async function GET(request: NextRequest) {
  const authResponse = await requireAdminOrSecret(request);
  if (authResponse) return authResponse;

  const snapshot = await buildDailyReportSnapshot();
  return NextResponse.json({
    ok: true,
    snapshot,
    text: formatDailyReport(snapshot),
  });
}

export async function POST(request: NextRequest) {
  const authResponse = await requireAdminOrSecret(request);
  if (authResponse) return authResponse;

  const delivery = await sendDailyReport();
  return NextResponse.json(delivery, { status: delivery.ok ? 200 : 503 });
}
