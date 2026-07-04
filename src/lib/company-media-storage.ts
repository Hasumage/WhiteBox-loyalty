import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const MIME_EXTENSIONS = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

export const COMPANY_MEDIA_MAX_BYTES = 4 * 1024 * 1024;

export function companyMediaStorageDir() {
  return path.resolve(process.cwd(), process.env.COMPANY_MEDIA_STORAGE_DIR || "storage/public/company-media");
}

export function companyMediaStoragePath(storageKey: string) {
  const safeKey = storageKey.replace(/[^a-zA-Z0-9_.-]/g, "");
  return path.join(companyMediaStorageDir(), safeKey);
}

export function assertCompanyMediaMime(mimeType: string) {
  if (!MIME_EXTENSIONS.has(mimeType)) {
    throw new Error("Поддерживаются только JPG, PNG и WEBP.");
  }
}

export async function storeCompanyMediaFile(input: {
  buffer: Buffer;
  mimeType: string;
  originalName?: string | null;
}) {
  assertCompanyMediaMime(input.mimeType);
  if (input.buffer.length > COMPANY_MEDIA_MAX_BYTES) {
    throw new Error("Файл не должен быть больше 4 МБ.");
  }
  await mkdir(companyMediaStorageDir(), { recursive: true });
  const extension = MIME_EXTENSIONS.get(input.mimeType) ?? ".bin";
  const storageKey = `${randomUUID()}${extension}`;
  await writeFile(companyMediaStoragePath(storageKey), input.buffer, { flag: "wx" });
  return {
    storageKey,
    fileName: input.originalName || storageKey,
    mimeType: input.mimeType,
    size: input.buffer.length,
    sha256: createHash("sha256").update(input.buffer).digest("hex"),
  };
}

export async function readCompanyMediaFile(storageKey: string) {
  return readFile(companyMediaStoragePath(storageKey));
}

export async function deleteCompanyMediaFile(storageKey: string | null | undefined) {
  if (!storageKey) return;
  await rm(companyMediaStoragePath(storageKey), { force: true });
}

export function companyMediaUrl(storageKey: string | null | undefined) {
  return storageKey ? `/api/company/media/files/${encodeURIComponent(storageKey)}` : null;
}
