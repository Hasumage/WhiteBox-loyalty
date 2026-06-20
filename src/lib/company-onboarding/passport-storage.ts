import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PassportVerificationFile } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ALGORITHM = "aes-256-gcm";
const EXTENSION = ".wbpass";

export type PassportUploadInput = {
  buffer: Buffer;
  originalName?: string | null;
  mimeType: string;
  size: number;
};

export type StoredPassportUpload = PassportUploadInput & {
  storageKey: string;
  sha256: string;
  encryptionIv: string;
  encryptionTag: string;
};

function storageDir() {
  return path.resolve(process.cwd(), process.env.PASSPORT_STORAGE_DIR || "storage/private/passport-verifications");
}

function storagePath(storageKey: string) {
  const safeKey = storageKey.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(storageDir(), `${safeKey}${EXTENSION}`);
}

function encryptionKey() {
  const secret = process.env.PASSPORT_STORAGE_SECRET || process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("PASSPORT_STORAGE_SECRET or JWT_SECRET is required for passport photo encryption.");
  }
  return createHash("sha256").update(secret).digest();
}

export async function encryptAndStorePassportUpload(input: PassportUploadInput): Promise<StoredPassportUpload> {
  await mkdir(storageDir(), { recursive: true });

  const storageKey = randomUUID();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(input.buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  const sha256 = createHash("sha256").update(input.buffer).digest("hex");

  await writeFile(storagePath(storageKey), encrypted, { flag: "wx" });

  return {
    ...input,
    storageKey,
    sha256,
    encryptionIv: iv.toString("base64"),
    encryptionTag: tag.toString("base64"),
  };
}

export async function readEncryptedPassportFile(file: PassportVerificationFile) {
  const encrypted = await readFile(storagePath(file.storageKey));
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(file.encryptionIv, "base64"));
  decipher.setAuthTag(Buffer.from(file.encryptionTag, "base64"));
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export async function readEncryptedPassportBlob(file: Pick<PassportVerificationFile, "storageKey">) {
  return readFile(storagePath(file.storageKey));
}

export async function deletePassportStorageFile(storageKey: string) {
  await rm(storagePath(storageKey), { force: true });
}

export async function deletePassportFilesForApplication(applicationId: number) {
  const files = await prisma.passportVerificationFile.findMany({
    where: { applicationId },
    select: { storageKey: true },
  });

  for (const file of files) {
    await deletePassportStorageFile(file.storageKey);
  }

  await prisma.passportVerificationFile.deleteMany({ where: { applicationId } });
  return { deleted: files.length };
}

export async function syncPassportStorage() {
  await mkdir(storageDir(), { recursive: true });

  const dbFiles = await prisma.passportVerificationFile.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, storageKey: true },
  });
  const dbKeys = new Set(dbFiles.map((file) => file.storageKey));

  const diskEntries = await readdir(storageDir(), { withFileTypes: true });
  const diskKeys = new Set(
    diskEntries
      .filter((entry) => entry.isFile() && entry.name.endsWith(EXTENSION))
      .map((entry) => entry.name.slice(0, -EXTENSION.length)),
  );

  const missing = dbFiles.filter((file) => !diskKeys.has(file.storageKey));
  const orphanKeys = Array.from(diskKeys).filter((key) => !dbKeys.has(key));

  for (const file of missing) {
    await prisma.passportVerificationFile.update({
      where: { id: file.id },
      data: { status: "MISSING", missingAt: new Date() },
    });
  }

  for (const key of orphanKeys) {
    await deletePassportStorageFile(key);
  }

  return {
    activeDbRecords: dbFiles.length,
    encryptedFilesOnDisk: diskKeys.size,
    missingFiles: missing.length,
    orphanFilesDeleted: orphanKeys.length,
  };
}

export async function passportFileExists(storageKey: string) {
  try {
    return (await stat(storagePath(storageKey))).isFile();
  } catch {
    return false;
  }
}
