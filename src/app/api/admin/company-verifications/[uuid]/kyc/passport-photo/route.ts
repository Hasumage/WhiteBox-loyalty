import { NextResponse, type NextRequest } from "next/server";

import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { deleteKycPassportPhotoByApplicationUuid } from "@/lib/company-onboarding/kyc-vault";

export const runtime = "nodejs";

async function readUuid(params: { uuid?: string } | Promise<{ uuid?: string }>) {
  const resolved = await params;
  return resolved.uuid ?? "";
}

export async function DELETE(
  request: NextRequest,
  context: { params: { uuid?: string } | Promise<{ uuid?: string }> },
) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) {
    return session;
  }

  const access = await requireAdminScope(session, "COMPANY_VERIFICATIONS", "canEdit");
  if (!access.ok) {
    return access.response;
  }

  const uuid = await readUuid(context.params);
  if (!uuid) {
    return NextResponse.json({ message: "Verification uuid is required." }, { status: 400 });
  }

  const record = await deleteKycPassportPhotoByApplicationUuid(uuid, {
    actorUserId: session.userId,
    request,
    reason: "Admin deleted stored passport photo",
  });

  if (!record) {
    return NextResponse.json({ message: "KYC record not found for this application." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    passportPhotoDeletedAt: record.passportPhotoDeletedAt,
  });
}
