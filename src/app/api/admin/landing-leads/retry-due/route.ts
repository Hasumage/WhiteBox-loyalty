import { NextResponse, type NextRequest } from "next/server";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { processLandingLeadRetryQueue } from "@/lib/leads/landing-leads";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const supportAccess = await requireAdminScope(session, "SUPPORT", "canEdit");
  if (!supportAccess.ok) {
    const prAccess = await requireAdminScope(session, "PR", "canEdit");
    if (!prAccess.ok) return supportAccess.response;
  }

  const result = await processLandingLeadRetryQueue();
  return NextResponse.json({ ok: true, result });
}
