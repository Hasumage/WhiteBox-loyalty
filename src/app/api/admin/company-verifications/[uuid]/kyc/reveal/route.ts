import { NextResponse, type NextRequest } from "next/server";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { revealKycPassportDataByApplicationUuid } from "@/lib/company-onboarding/kyc-vault";

export const runtime = "nodejs";

function readUuid(params: { uuid?: string } | Promise<{ uuid?: string }>) {
  return Promise.resolve(params).then((resolved) => resolved.uuid ?? "");
}

export async function POST(
  request: NextRequest,
  context: { params: { uuid?: string } | Promise<{ uuid?: string }> },
) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "COMPANY_VERIFICATIONS", "canView");
  if (!access.ok) return access.response;

  const uuid = await readUuid(context.params);
  const body = (await request.json().catch(() => ({}))) as { reason?: string };
  const result = await revealKycPassportDataByApplicationUuid(uuid, {
    actorUserId: session.userId,
    request,
    reason: body.reason || "Admin revealed encrypted passport data",
  });

  if (!result) {
    return NextResponse.json({ message: "KYC record not found for this application" }, { status: 404 });
  }

  return NextResponse.json({
    passportData: result.passportData,
    accessLogs: result.record.accessLogs,
  });
}
