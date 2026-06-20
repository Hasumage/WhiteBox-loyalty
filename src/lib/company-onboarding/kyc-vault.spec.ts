import { encryptPassportData } from "./passport-data";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    companyVerificationApplication: { findUnique: jest.fn() },
    companyKycRecord: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock("./passport-storage", () => ({
  readEncryptedPassportBlob: jest.fn(),
  deletePassportStorageFile: jest.fn(),
}));

import { prisma } from "@/lib/prisma";
import {
  deleteKycPassportPhotoByApplicationUuid,
  persistKycRecordFromApplication,
  revealKycPassportDataByApplicationUuid,
} from "./kyc-vault";
import { deletePassportStorageFile, readEncryptedPassportBlob } from "./passport-storage";

const mockedPrisma = jest.mocked(prisma, { shallow: false });
const mockedReadEncryptedPassportBlob = jest.mocked(readEncryptedPassportBlob);
const mockedDeletePassportStorageFile = jest.mocked(deletePassportStorageFile);

function txMock() {
  return {
    companyKycRecord: {
      upsert: jest.fn().mockResolvedValue({ id: 77, uuid: "kyc-uuid" }),
      update: jest.fn().mockResolvedValue({ id: 77, passportPhotoDeletedAt: new Date("2026-06-12T10:00:00Z") }),
    },
    companyKycAccessLog: { create: jest.fn() },
    passportVerificationFile: { update: jest.fn() },
  };
}

describe("kyc-vault", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PASSPORT_STORAGE_SECRET = "test-secret-with-enough-length";
    mockedDeletePassportStorageFile.mockResolvedValue(undefined);
    mockedPrisma.$transaction.mockImplementation(async (callback: (tx: ReturnType<typeof txMock>) => Promise<unknown>) =>
      callback(txMock()),
    );
  });

  it("persists verification data into encrypted KYC storage and removes the legacy file", async () => {
    const encryptedPassport = encryptPassportData({
      series: "1234",
      number: "567890",
      issuedAt: "2020-01-01",
      issuedBy: "MVD",
      departmentCode: "770-001",
    });
    const encryptedBlob = Buffer.from("encrypted-photo");
    const file = {
      id: 9,
      storageKey: "passport/app/file.bin",
      encryptionIv: "iv",
      encryptionTag: "tag",
      mimeType: "image/jpeg",
      originalName: "passport.jpg",
      size: 2048,
      sha256: "hash",
    };

    mockedPrisma.companyVerificationApplication.findUnique.mockResolvedValue({
      id: 5,
      uuid: "app-uuid",
      companyId: 42,
      employmentType: "SELF_EMPLOYED",
      identityVerificationMode: "FULL",
      legalFirstName: "Ivan",
      legalMiddleName: null,
      legalLastName: "Ivanov",
      birthDate: new Date("1990-01-01"),
      legalFullName: "Ivan Ivanov",
      legalInn: "123456789012",
      legalOgrnip: null,
      legalRegistrationRegion: null,
      passportEncryptedPayload: encryptedPassport.payload,
      passportEncryptionIv: encryptedPassport.iv,
      passportEncryptionTag: encryptedPassport.tag,
      passportLast4: "7890",
      passportFiles: [file],
    } as never);
    mockedReadEncryptedPassportBlob.mockResolvedValue(encryptedBlob);

    const tx = txMock();
    mockedPrisma.$transaction.mockImplementationOnce(async (callback: (tx: ReturnType<typeof txMock>) => Promise<unknown>) =>
      callback(tx),
    );

    await persistKycRecordFromApplication("app-uuid", "APPROVED", { actorUserId: 1, reason: "approved" });

    expect(tx.companyKycRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 42 },
        create: expect.objectContaining({
          companyId: 42,
          passportLast4: "7890",
          passportPhotoEncrypted: Uint8Array.from(encryptedBlob),
          passportPhotoMimeType: "image/jpeg",
        }),
      }),
    );
    expect(tx.companyKycAccessLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "UPSERT_FROM_VERIFICATION", actorUserId: 1 }),
      }),
    );
    expect(tx.passportVerificationFile.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 9 }, data: expect.objectContaining({ status: "DELETED" }) }),
    );
    expect(mockedDeletePassportStorageFile).toHaveBeenCalledWith("passport/app/file.bin");
  });

  it("reveals encrypted passport data and records the access", async () => {
    const encryptedPassport = encryptPassportData({
      series: "1234",
      number: "567890",
      issuedAt: "2020-01-01",
      issuedBy: "MVD",
      departmentCode: "770-001",
    });
    mockedPrisma.companyKycRecord.findFirst.mockResolvedValue({
      id: 77,
      passportEncryptedPayload: encryptedPassport.payload,
      passportEncryptionIv: encryptedPassport.iv,
      passportEncryptionTag: encryptedPassport.tag,
      accessLogs: [],
    } as never);
    const tx = txMock();
    mockedPrisma.$transaction.mockImplementationOnce(async (callback: (tx: ReturnType<typeof txMock>) => Promise<unknown>) =>
      callback(tx),
    );

    const result = await revealKycPassportDataByApplicationUuid("app-uuid", { actorUserId: 2 });

    expect(result?.passportData).toEqual(
      expect.objectContaining({ series: "1234", number: "567890", departmentCode: "770-001" }),
    );
    expect(tx.companyKycAccessLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kycRecordId: 77, action: "REVEAL_DATA", actorUserId: 2 }),
      }),
    );
  });

  it("deletes only the stored passport photo and logs the action", async () => {
    mockedPrisma.companyKycRecord.findFirst.mockResolvedValue({ id: 77 } as never);
    const tx = txMock();
    mockedPrisma.$transaction.mockImplementationOnce(async (callback: (tx: ReturnType<typeof txMock>) => Promise<unknown>) =>
      callback(tx),
    );

    await deleteKycPassportPhotoByApplicationUuid("app-uuid", { actorUserId: 3 });

    expect(tx.companyKycRecord.update).toHaveBeenCalledWith({
      where: { id: 77 },
      data: expect.objectContaining({
        passportPhotoEncrypted: null,
        passportPhotoDeletedById: 3,
      }),
    });
    expect(tx.companyKycAccessLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kycRecordId: 77, action: "DELETE_PHOTO", actorUserId: 3 }),
      }),
    );
  });
});
