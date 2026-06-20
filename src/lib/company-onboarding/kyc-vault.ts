import { createDecipheriv, createHash } from "node:crypto";
import type { CompanyKycAccessAction, CompanyVerificationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptPassportData, type ManualPassportData } from "./passport-data";
import {
  deletePassportStorageFile,
  readEncryptedPassportBlob,
  type StoredPassportUpload,
} from "./passport-storage";

const ALGORITHM = "aes-256-gcm";

type RequestLike = {
  headers: {
    get(name: string): string | null;
  };
};

type ActorContext = {
  actorUserId?: number | null;
  reason?: string | null;
  request?: RequestLike;
};

type KycTx = Prisma.TransactionClient;

function encryptionKey() {
  const secret = process.env.PASSPORT_STORAGE_SECRET || process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("PASSPORT_STORAGE_SECRET or JWT_SECRET is required for KYC vault encryption.");
  }
  return createHash("sha256").update(secret).digest();
}

function clientIp(request?: RequestLike) {
  if (!request) return null;
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
}

function userAgent(request?: RequestLike) {
  return request?.headers.get("user-agent") ?? null;
}

async function createAccessLog(
  tx: KycTx,
  kycRecordId: number,
  action: CompanyKycAccessAction,
  context: ActorContext = {},
) {
  await tx.companyKycAccessLog.create({
    data: {
      kycRecordId,
      actorUserId: context.actorUserId ?? null,
      action,
      reason: context.reason ?? null,
      ipAddress: clientIp(context.request),
      userAgent: userAgent(context.request),
    },
  });
}

export function decryptKycPassportPhoto(input: {
  encrypted: Buffer | Uint8Array;
  iv: string;
  tag: string;
}) {
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(input.iv, "base64"));
  decipher.setAuthTag(Buffer.from(input.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(input.encrypted)), decipher.final()]);
}

export async function persistKycRecordFromApplication(
  applicationUuid: string,
  status: Extract<CompanyVerificationStatus, "APPROVED" | "REJECTED">,
  context: ActorContext = {},
) {
  const application = await prisma.companyVerificationApplication.findUnique({
    where: { uuid: applicationUuid },
    include: {
      passportFiles: {
        where: { status: "ACTIVE" },
        orderBy: { uploadedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!application?.companyId) {
    throw new Error("Company verification application is not linked to a company.");
  }

  const file = application.passportFiles[0];
  let passportPhotoEncrypted: Uint8Array<ArrayBuffer> | undefined;
  if (file) {
    passportPhotoEncrypted = Uint8Array.from(await readEncryptedPassportBlob(file));
  }

  const record = await prisma.$transaction(async (tx) => {
    const kycRecord = await tx.companyKycRecord.upsert({
      where: { companyId: application.companyId! },
      create: {
        companyId: application.companyId!,
        applicationId: application.id,
        status,
        employmentType: application.employmentType,
        identityVerificationMode: application.identityVerificationMode,
        legalFirstName: application.legalFirstName,
        legalMiddleName: application.legalMiddleName,
        legalLastName: application.legalLastName,
        birthDate: application.birthDate,
        legalFullName: application.legalFullName,
        legalInn: application.legalInn,
        legalOgrnip: application.legalOgrnip,
        legalRegistrationRegion: application.legalRegistrationRegion,
        passportEncryptedPayload: application.passportEncryptedPayload,
        passportEncryptionIv: application.passportEncryptionIv,
        passportEncryptionTag: application.passportEncryptionTag,
        passportLast4: application.passportLast4,
        passportPhotoEncrypted,
        passportPhotoEncryptionIv: file?.encryptionIv ?? null,
        passportPhotoEncryptionTag: file?.encryptionTag ?? null,
        passportPhotoMimeType: file?.mimeType ?? null,
        passportPhotoOriginalName: file?.originalName ?? null,
        passportPhotoSize: file?.size ?? null,
        passportPhotoSha256: file?.sha256 ?? null,
        passportPhotoDeletedAt: null,
        passportPhotoDeletedById: null,
      },
      update: {
        applicationId: application.id,
        status,
        employmentType: application.employmentType,
        identityVerificationMode: application.identityVerificationMode,
        legalFirstName: application.legalFirstName,
        legalMiddleName: application.legalMiddleName,
        legalLastName: application.legalLastName,
        birthDate: application.birthDate,
        legalFullName: application.legalFullName,
        legalInn: application.legalInn,
        legalOgrnip: application.legalOgrnip,
        legalRegistrationRegion: application.legalRegistrationRegion,
        passportEncryptedPayload: application.passportEncryptedPayload,
        passportEncryptionIv: application.passportEncryptionIv,
        passportEncryptionTag: application.passportEncryptionTag,
        passportLast4: application.passportLast4,
        ...(file
          ? {
              passportPhotoEncrypted,
              passportPhotoEncryptionIv: file.encryptionIv,
              passportPhotoEncryptionTag: file.encryptionTag,
              passportPhotoMimeType: file.mimeType,
              passportPhotoOriginalName: file.originalName,
              passportPhotoSize: file.size,
              passportPhotoSha256: file.sha256,
              passportPhotoDeletedAt: null,
              passportPhotoDeletedById: null,
            }
          : {}),
      },
    });

    await createAccessLog(tx, kycRecord.id, "UPSERT_FROM_VERIFICATION", context);

    if (file) {
      await tx.passportVerificationFile.update({
        where: { id: file.id },
        data: { status: "DELETED", deletedAt: new Date() },
      });
    }

    return kycRecord;
  });

  if (file) {
    await deletePassportStorageFile(file.storageKey).catch(() => undefined);
  }

  return record;
}

export async function revealKycPassportDataByApplicationUuid(applicationUuid: string, context: ActorContext = {}) {
  const record = await prisma.companyKycRecord.findFirst({
    where: { application: { uuid: applicationUuid } },
    include: { accessLogs: { orderBy: { createdAt: "desc" }, take: 20, include: { actor: { select: { name: true, email: true } } } } },
  });

  if (!record) return null;
  if (!record.passportEncryptedPayload || !record.passportEncryptionIv || !record.passportEncryptionTag) {
    return { record, passportData: null as ManualPassportData | null };
  }

  const passportData = decryptPassportData({
    payload: record.passportEncryptedPayload,
    iv: record.passportEncryptionIv,
    tag: record.passportEncryptionTag,
  });

  await prisma.$transaction(async (tx) => {
    await createAccessLog(tx, record.id, "REVEAL_DATA", context);
  });

  return { record, passportData };
}

export async function readKycPassportPhotoByApplicationUuid(applicationUuid: string, context: ActorContext = {}) {
  const record = await prisma.companyKycRecord.findFirst({
    where: { application: { uuid: applicationUuid } },
    select: {
      id: true,
      passportPhotoEncrypted: true,
      passportPhotoEncryptionIv: true,
      passportPhotoEncryptionTag: true,
      passportPhotoMimeType: true,
      passportPhotoOriginalName: true,
    },
  });

  if (
    !record?.passportPhotoEncrypted ||
    !record.passportPhotoEncryptionIv ||
    !record.passportPhotoEncryptionTag ||
    !record.passportPhotoMimeType
  ) {
    return null;
  }

  const buffer = decryptKycPassportPhoto({
    encrypted: record.passportPhotoEncrypted,
    iv: record.passportPhotoEncryptionIv,
    tag: record.passportPhotoEncryptionTag,
  });

  await prisma.$transaction(async (tx) => {
    await createAccessLog(tx, record.id, "VIEW_PHOTO", context);
  });

  return {
    buffer,
    mimeType: record.passportPhotoMimeType,
    originalName: record.passportPhotoOriginalName,
  };
}

export async function deleteKycPassportPhotoByApplicationUuid(applicationUuid: string, context: ActorContext = {}) {
  const record = await prisma.companyKycRecord.findFirst({
    where: { application: { uuid: applicationUuid } },
    select: { id: true },
  });

  if (!record) return null;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.companyKycRecord.update({
      where: { id: record.id },
      data: {
        passportPhotoEncrypted: null,
        passportPhotoEncryptionIv: null,
        passportPhotoEncryptionTag: null,
        passportPhotoMimeType: null,
        passportPhotoOriginalName: null,
        passportPhotoSize: null,
        passportPhotoSha256: null,
        passportPhotoDeletedAt: new Date(),
        passportPhotoDeletedById: context.actorUserId ?? null,
      },
    });
    await createAccessLog(tx, record.id, "DELETE_PHOTO", context);
    return updated;
  });
}

export type KycVaultUploadSnapshot = StoredPassportUpload;
