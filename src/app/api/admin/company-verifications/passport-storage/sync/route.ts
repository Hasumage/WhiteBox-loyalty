import { NextResponse, type NextRequest } from "next/server";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { syncPassportStorage } from "@/lib/company-onboarding/passport-storage";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "COMPANY_VERIFICATIONS", "canEdit");
  if (!access.ok) return access.response;

  const result = await syncPassportStorage();
  return NextResponse.json({ ok: true, result });
}
