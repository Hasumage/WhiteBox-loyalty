import { NextResponse, type NextRequest } from "next/server";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { retryLeadNotifications } from "@/lib/leads/landing-leads";

export const runtime = "nodejs";

type Params = { params: Promise<{ uuid: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const supportAccess = await requireAdminScope(session, "SUPPORT", "canEdit");
  if (!supportAccess.ok) {
    const prAccess = await requireAdminScope(session, "PR", "canEdit");
    if (!prAccess.ok) return supportAccess.response;
  }

  const { uuid } = await params;
  const result = await retryLeadNotifications(uuid);
  return NextResponse.json({ ok: true, result });
}
