const mockedPrisma = {
  passportVerificationFile: {
    findMany: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
};

jest.mock("@/lib/prisma", () => ({ prisma: mockedPrisma }));

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  deletePassportStorageFile,
  encryptAndStorePassportUpload,
  readEncryptedPassportFile,
  type StoredPassportUpload,
  syncPassportStorage,
} from "./passport-storage";

function dbFile(stored: StoredPassportUpload) {
  return {
    ...stored,
    originalName: stored.originalName ?? null,
    id: 1,
    uuid: "file-uuid",
    applicationId: 1,
    status: "ACTIVE" as const,
    uploadedAt: new Date(),
    deletedAt: null,
    missingAt: null,
  };
}

describe("passport storage", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "nearloy-passport-test-"));
    process.env.PASSPORT_STORAGE_DIR = dir;
    process.env.PASSPORT_STORAGE_SECRET = "test-secret-with-enough-length";
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    delete process.env.PASSPORT_STORAGE_DIR;
    delete process.env.PASSPORT_STORAGE_SECRET;
  });

  it("encrypts and decrypts a passport upload", async () => {
    const stored = await encryptAndStorePassportUpload({
      buffer: Buffer.from("passport-photo"),
      originalName: "passport.jpg",
      mimeType: "image/jpeg",
      size: 14,
    });

    const decrypted = await readEncryptedPassportFile(dbFile(stored));

    expect(decrypted.toString()).toBe("passport-photo");
    expect(stored.sha256).toHaveLength(64);
  });

  it("removes encrypted files from disk", async () => {
    const stored = await encryptAndStorePassportUpload({
      buffer: Buffer.from("passport-photo"),
      originalName: "passport.jpg",
      mimeType: "image/jpeg",
      size: 14,
    });

    await deletePassportStorageFile(stored.storageKey);
    await expect(readEncryptedPassportFile(dbFile(stored))).rejects.toThrow();
  });

  it("marks missing DB records and deletes orphan disk files during sync", async () => {
    await writeFile(path.join(dir, "orphan.wbpass"), "encrypted");
    mockedPrisma.passportVerificationFile.findMany.mockResolvedValue([
      { id: 7, storageKey: "missing-db-file" },
    ]);

    const result = await syncPassportStorage();

    expect(result.missingFiles).toBe(1);
    expect(result.orphanFilesDeleted).toBe(1);
    expect(mockedPrisma.passportVerificationFile.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 7 }, data: expect.objectContaining({ status: "MISSING" }) }),
    );
  });
});
