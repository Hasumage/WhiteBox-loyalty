jest.mock("@/lib/prisma", () => ({
  prisma: {
    category: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
    company: { findUnique: jest.fn() },
    companyMember: { findFirst: jest.fn() },
    companyVerificationApplication: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock("@/lib/telegram/telegram-service", () => ({
  escapeTelegramHtml: (value: string) => value,
  sendTelegramMessage: jest.fn(),
}));
jest.mock("bcrypt", () => ({
  hash: jest.fn(async () => "hashed-company-password"),
}));

import { prisma } from "@/lib/prisma";
import * as bcrypt from "bcrypt";
import {
  createCompanyVerificationApplication,
  createExistingCompanyVerificationApplication,
  onlyDigits,
  parseCompanyApplicationPayload,
} from "./company-applications";

const mockedPrisma = jest.mocked(prisma, { shallow: false });
const mockedBcrypt = jest.mocked(bcrypt);

process.env.PASSPORT_STORAGE_SECRET = "test-secret-with-enough-length";

describe("company application helpers", () => {
  const base = {
    employmentType: "SELF_EMPLOYED",
    identityVerificationMode: "FULL",
    contactName: "Max",
    contactEmail: "MAX@EXAMPLE.COM",
    password: "secure-password",
    passwordConfirm: "secure-password",
    companyName: "Coffee Club",
    businessCategory: "Coffee",
    legalLastName: "Пастухов",
    legalFirstName: "Максим",
    legalMiddleName: "",
    birthDate: "2000-01-01",
    legalInn: "123456789012",
    passportSeries: "1234",
    passportNumber: "567890",
    passportIssuedBy: "ОВД Тестового района",
    passportIssuedAt: "2020-01-01",
    passportPhotoProvided: true,
    consentAccepted: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("normalizes self-employed payload", () => {
    const payload = parseCompanyApplicationPayload(base);
    expect(payload.contactEmail).toBe("max@example.com");
    expect(payload.legalFullName).toBe("Пастухов Максим");
  });

  it("requires password and matching confirmation for company account creation", () => {
    expect(() => parseCompanyApplicationPayload({ ...base, password: "short", passwordConfirm: "short" })).toThrow("Password");
    expect(() => parseCompanyApplicationPayload({ ...base, passwordConfirm: "another-password" })).toThrow("Passwords do not match");
  });

  it("does not ask an existing company owner to create a second password", () => {
    const payload = parseCompanyApplicationPayload({ ...base, password: "", passwordConfirm: "" }, { existingCompany: true });

    expect(payload.contactEmail).toBe("max@example.com");
  });

  it("requires 12 digit INN for self-employed", () => {
    expect(() => parseCompanyApplicationPayload({ ...base, legalInn: "123" })).toThrow("12 digits");
  });

  it("blocks applicants younger than 16", () => {
    const nextYear = new Date().getUTCFullYear() + 1;
    expect(() => parseCompanyApplicationPayload({ ...base, birthDate: `${nextYear}-01-01` })).toThrow("16");
  });

  it("does not require payout or registration fields during the first intake", () => {
    const payload = parseCompanyApplicationPayload({ ...base, employmentType: "INDIVIDUAL_ENTREPRENEUR" });

    expect(payload.legalOgrnip).toBeUndefined();
    expect(payload.payoutBankName).toBeUndefined();
  });

  it("does not allow legacy deferred mode to bypass full verification", () => {
    expect(() => parseCompanyApplicationPayload({
      ...base,
      identityVerificationMode: "DEFERRED",
      passportSeries: "",
      passportNumber: "",
      passportIssuedBy: "",
      passportIssuedAt: "",
      passportPhotoProvided: false,
      verificationDeferralReason: "I want to test the cabinet first and will provide passport verification before subscriptions and payouts.",
    })).toThrow("passport data");
  });

  it("requires passport data and photo for full verification", () => {
    expect(() => parseCompanyApplicationPayload({ ...base, passportPhotoProvided: false })).toThrow("Passport photo");
    expect(() => parseCompanyApplicationPayload({ ...base, passportNumber: "" })).toThrow("passport data");
  });

  it("does not keep non-digits in financial identifiers", () => {
    expect(onlyDigits("BIK 044-525", 9)).toBe("044525");
  });

  it("creates company owner user and links the first company membership", async () => {
    const payload = parseCompanyApplicationPayload(base);
    mockedPrisma.category.findFirst.mockResolvedValue({ id: 9 } as never);
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedPrisma.company.findUnique.mockResolvedValue(null);

    const tx = {
      user: { create: jest.fn().mockResolvedValue({ id: 41, email: "max@example.com" }) },
      company: { create: jest.fn().mockResolvedValue({ id: 77 }) },
      userCompany: { create: jest.fn().mockResolvedValue({ id: 1 }) },
      companyMember: { create: jest.fn().mockResolvedValue({ id: 2, role: "OWNER" }) },
      companyVerificationApplication: { create: jest.fn().mockResolvedValue({ id: 5, uuid: "application-1" }) },
      passportVerificationFile: { create: jest.fn() },
    };
    mockedPrisma.$transaction.mockImplementation(async (callback) => callback(tx as never));

    const result = await createCompanyVerificationApplication({ payload });

    expect(mockedBcrypt.hash).toHaveBeenCalledWith("secure-password", 12);
    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "max@example.com",
        name: "Max",
        role: "COMPANY",
        passwordHash: "hashed-company-password",
      }),
    });
    expect(tx.company.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerUserId: 41,
        isActive: false,
        identityVerificationCompleted: false,
        verificationStatus: "SUBMITTED",
      }),
    });
    expect(tx.userCompany.create).toHaveBeenCalledWith({ data: { userId: 41, companyId: 77 } });
    expect(tx.companyMember.create).toHaveBeenCalledWith({
      data: { userId: 41, companyId: 77, role: "OWNER" },
    });
    expect(result.user.id).toBe(41);
  });

  it("creates a verification request for an existing owner without duplicating the company account", async () => {
    const payload = parseCompanyApplicationPayload({ ...base, password: "", passwordConfirm: "" }, { existingCompany: true });
    mockedPrisma.companyMember.findFirst.mockResolvedValue({
      role: "OWNER",
      user: { name: "Current Owner", email: "owner@example.com" },
      company: { id: 77, name: "Aurora Coffee", identityVerificationCompleted: false, verificationStatus: "DRAFT" },
    } as never);
    mockedPrisma.companyVerificationApplication.findFirst.mockResolvedValue(null);

    const tx = {
      company: { update: jest.fn().mockResolvedValue({ id: 77, verificationStatus: "SUBMITTED" }) },
      companyVerificationApplication: { create: jest.fn().mockResolvedValue({ id: 8, uuid: "existing-request" }) },
      passportVerificationFile: { create: jest.fn() },
    };
    mockedPrisma.$transaction.mockImplementation(async (callback) => callback(tx as never));

    const result = await createExistingCompanyVerificationApplication({ userId: 41, payload });

    expect(mockedBcrypt.hash).not.toHaveBeenCalled();
    expect(tx.company.update).toHaveBeenCalledWith({
      where: { id: 77 },
      data: expect.objectContaining({ verificationStatus: "SUBMITTED", identityVerificationCompleted: false }),
    });
    expect(tx.companyVerificationApplication.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 77,
        companyName: "Aurora Coffee",
        contactEmail: "owner@example.com",
      }),
    });
    expect(result.application.uuid).toBe("existing-request");
  });

  it("does not create a second open verification request for the same company", async () => {
    const payload = parseCompanyApplicationPayload({ ...base, password: "", passwordConfirm: "" }, { existingCompany: true });
    mockedPrisma.companyMember.findFirst.mockResolvedValue({
      role: "OWNER",
      user: { name: "Current Owner", email: "owner@example.com" },
      company: { id: 77, name: "Aurora Coffee", identityVerificationCompleted: false, verificationStatus: "SUBMITTED" },
    } as never);
    mockedPrisma.companyVerificationApplication.findFirst.mockResolvedValue({ uuid: "active-request" } as never);

    await expect(createExistingCompanyVerificationApplication({ userId: 41, payload })).rejects.toThrow(
      "already being reviewed",
    );
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });
});
