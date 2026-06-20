import { NextResponse, type NextRequest } from "next/server";
import { isUserAuthResponse, requireUserSession } from "@/lib/auth/require-user-session";
import {
  createExistingCompanyVerificationApplication,
  notifyAdminsAboutCompanyApplication,
  parseCompanyApplicationPayload,
} from "@/lib/company-onboarding/company-applications";
import {
  deletePassportStorageFile,
  encryptAndStorePassportUpload,
  type StoredPassportUpload,
} from "@/lib/company-onboarding/passport-storage";

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
    throw new Error("Для полной верификации загрузите фото паспорта.");
  }
  if (value.size > 8 * 1024 * 1024) {
    throw new Error("Размер фото паспорта не должен превышать 8 МБ.");
  }
  if (!new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]).has(value.type)) {
    throw new Error("Фото паспорта должно быть в формате JPG, PNG, WEBP или HEIC.");
  }
}

function publicErrorMessage(message: string) {
  const messages = new Map([
    ["Only the company owner can submit verification.", "Заявку на верификацию может отправить только владелец компании."],
    ["Company verification is already complete.", "Компания уже прошла верификацию."],
    ["A verification request is already being reviewed.", "У компании уже есть заявка на рассмотрении."],
    ["Choose employment type.", "Выберите тип занятости."],
    ["Fill in required fields.", "Заполните обязательные данные заявки."],
    ["Self-employed applicant INN must contain 12 digits.", "Для самозанятого укажите ИНН из 12 цифр."],
    ["IP applicant INN must contain 10 or 12 digits.", "Для ИП укажите ИНН из 10 или 12 цифр."],
    ["Company access is available only for applicants aged 16 or older.", "Заявителю должно быть не менее 16 лет."],
    ["Enter a valid email.", "Укажите корректный email."],
    ["Fill in passport data.", "Заполните паспортные данные."],
    ["Passport photo is required for full verification.", "Для полной верификации загрузите фото паспорта."],
    ["Consent is required.", "Подтвердите согласие на обработку данных."],
  ]);
  return messages.get(message) ?? message;
}

export async function POST(request: NextRequest) {
  let passportUpload: StoredPassportUpload | undefined;
  try {
    const session = await requireUserSession(request);
    if (isUserAuthResponse(session)) return session;
    if (session.role !== "COMPANY") {
      return NextResponse.json({ message: "Заявка доступна только аккаунту компании." }, { status: 403 });
    }

    const form = await request.formData();
    const passportPhoto = form.get("passportPhoto");
    validatePassportPhoto(passportPhoto, true);
    if (isUploadLike(passportPhoto) && passportPhoto.size > 0) {
      passportUpload = await encryptAndStorePassportUpload({
        buffer: Buffer.from(await passportPhoto.arrayBuffer()),
        originalName: passportPhoto.name || null,
        mimeType: passportPhoto.type,
        size: passportPhoto.size,
      });
    }

    const raw = Object.fromEntries(
      Array.from(form.entries())
        .filter(([, value]) => !isUploadLike(value))
        .map(([key, value]) => [key, String(value)]),
    ) as Record<string, unknown>;
    raw.consentAccepted = raw.consentAccepted === "true" || raw.consentAccepted === "on";
    raw.identityVerificationMode = "FULL";
    raw.passportPhotoProvided = Boolean(passportUpload);

    const payload = parseCompanyApplicationPayload(raw, { existingCompany: true });
    const result = await createExistingCompanyVerificationApplication({
      userId: session.userId,
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
      notification,
      message: "Заявка на верификацию отправлена администраторам NearLoy.",
    });
  } catch (error) {
    if (passportUpload) {
      await deletePassportStorageFile(passportUpload.storageKey).catch(() => undefined);
    }
    const internalMessage = error instanceof Error ? error.message : "Не удалось отправить заявку на верификацию.";
    const status = internalMessage.includes("already being reviewed") ? 409 : 400;
    return NextResponse.json({ message: publicErrorMessage(internalMessage) }, { status });
  }
}
