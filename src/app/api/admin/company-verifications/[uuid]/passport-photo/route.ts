import { NextResponse, type NextRequest } from "next/server";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { readKycPassportPhotoByApplicationUuid } from "@/lib/company-onboarding/kyc-vault";
import { readEncryptedPassportFile } from "@/lib/company-onboarding/passport-storage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function readUuid(params: { uuid?: string } | Promise<{ uuid?: string }>) {
  return Promise.resolve(params).then((resolved) => resolved.uuid ?? "");
}

export async function GET(
  request: NextRequest,
  context: { params: { uuid?: string } | Promise<{ uuid?: string }> },
) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "COMPANY_VERIFICATIONS", "canView");
  if (!access.ok) return access.response;

  const uuid = await readUuid(context.params);
  const kycPhoto = await readKycPassportPhotoByApplicationUuid(uuid, {
    actorUserId: session.userId,
    request,
    reason: "Admin opened passport photo",
  });
  if (kycPhoto) {
    return new NextResponse(kycPhoto.buffer, {
      headers: {
        "Content-Type": kycPhoto.mimeType,
        "Content-Disposition": `inline; filename="${kycPhoto.originalName || "passport-photo"}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const application = await prisma.companyVerificationApplication.findUnique({
    where: { uuid },
    select: {
      id: true,
      passportFiles: {
        where: { status: "ACTIVE" },
        orderBy: { uploadedAt: "desc" },
        take: 1,
      },
    },
  });

  const file = application?.passportFiles[0];
  if (!application || !file) {
    return NextResponse.json({ message: "Passport photo not found for this application" }, { status: 404 });
  }

  try {
    const buffer = await readEncryptedPassportFile(file);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${file.originalName || "passport-photo"}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    await prisma.passportVerificationFile.update({
      where: { id: file.id },
      data: { status: "MISSING", missingAt: new Date() },
    });
    return NextResponse.json({ message: "Encrypted passport file is missing or cannot be decrypted" }, { status: 410 });
  }
}
