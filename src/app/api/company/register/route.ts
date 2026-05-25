import { NextResponse, type NextRequest } from "next/server";
import {
  createCompanyVerificationApplication,
  notifyAdminsAboutCompanyApplication,
  parseCompanyApplicationPayload,
} from "@/lib/company-onboarding/company-applications";
import { deletePassportStorageFile, encryptAndStorePassportUpload, type StoredPassportUpload } from "@/lib/company-onboarding/passport-storage";

export const runtime = "nodejs";

function getClientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

function isUploadLike(value: unknown): value is File {
  return typeof value === "object" && value !== null && "size" in value && "type" in value;
}

function validatePassportPhoto(value: unknown, required: boolean) {
  if (!isUploadLike(value) || value.size <= 0) {
    if (!required) return;
    throw new Error("Passport photo is required for manual verification.");
  }
  if (value.size > 8 * 1024 * 1024) {
    throw new Error("Passport photo must be smaller than 8 MB.");
  }
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
  if (!allowedTypes.has(value.type)) {
    throw new Error("Passport photo must be JPG, PNG, WEBP or HEIC.");
  }
}

async function readCompanyRegisterPayload(request: NextRequest): Promise<{
  raw: Record<string, unknown>;
  passportUpload?: StoredPassportUpload;
}> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const passportPhoto = form.get("passportPhoto");
    validatePassportPhoto(passportPhoto, true);
    let passportUpload: StoredPassportUpload | undefined;
    if (isUploadLike(passportPhoto) && passportPhoto.size > 0) {
      const passportFile = passportPhoto as File;
      const buffer = Buffer.from(await passportFile.arrayBuffer());
      passportUpload = await encryptAndStorePassportUpload({
        buffer,
        originalName: passportFile.name || null,
        mimeType: passportFile.type,
        size: passportFile.size,
      });
    }
    const payload = Object.fromEntries(
      Array.from(form.entries())
        .filter(([, value]) => !isUploadLike(value))
        .map(([key, value]) => [key, String(value)]),
    ) as Record<string, unknown>;
    payload.consentAccepted = payload.consentAccepted === "true" || payload.consentAccepted === "on";
    payload.identityVerificationMode = "FULL";
    payload.passportPhotoProvided = Boolean(passportUpload);
    return { raw: payload, passportUpload };
  }

  const raw = (await request.json()) as Record<string, unknown>;
  raw.consentAccepted = raw.consentAccepted === true;
  raw.identityVerificationMode = "FULL";
  // Full verification requires a real encrypted upload, not a JSON assertion.
  raw.passportPhotoProvided = false;
  return { raw };
}

export async function POST(request: NextRequest) {
  let passportUpload: StoredPassportUpload | undefined;
  try {
    const parsed = await readCompanyRegisterPayload(request);
    passportUpload = parsed.passportUpload;
    const raw = parsed.raw;
    const payload = parseCompanyApplicationPayload(raw);
    const result = await createCompanyVerificationApplication({
      payload,
      passportUpload,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    passportUpload = undefined;
    const notification = await notifyAdminsAboutCompanyApplication(result.application.uuid);

    return NextResponse.json({
      ok: true,
      applicationUuid: result.application.uuid,
      companyId: result.company.id,
      notification,
      message: "Verification request submitted. We will contact you after manual review.",
    });
  } catch (error) {
    if (passportUpload) {
      await deletePassportStorageFile(passportUpload.storageKey).catch(() => undefined);
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to submit company verification request." },
      { status: 400 },
    );
  }
}
