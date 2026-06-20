jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    companyVerificationApplication: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    company: {
      update: jest.fn(),
    },
    passportVerificationFile: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        companyVerificationApplication: { findUnique: jest.fn(), update: jest.fn() },
        company: { update: jest.fn() },
        companyBillingAccount: { upsert: jest.fn() },
        auditEvent: { create: jest.fn() },
        adminTask: { updateMany: jest.fn() },
      }),
    ),
  },
}));

jest.mock("@/lib/admin/require-admin-session", () => ({
  requireAdminSession: jest.fn(),
  isAuthResponse: (value: unknown) => value instanceof Response,
}));

jest.mock("@/lib/company-onboarding/kyc-vault", () => ({
  persistKycRecordFromApplication: jest.fn(),
}));

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import { persistKycRecordFromApplication } from "@/lib/company-onboarding/kyc-vault";
import { PATCH } from "./route";

const mockedRequireAdminSession = jest.mocked(requireAdminSession);
const mockedPrisma = jest.mocked(prisma, { shallow: false });
const mockedPersistKycRecordFromApplication = jest.mocked(persistKycRecordFromApplication);
type MockVerificationTransaction = {
  companyVerificationApplication: { findUnique: jest.Mock; update: jest.Mock };
  company: { update: jest.Mock };
  companyBillingAccount: { upsert: jest.Mock };
  auditEvent: { create: jest.Mock };
  adminTask: { updateMany: jest.Mock };
};

describe("admin company verification detail route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireAdminSession.mockResolvedValue({ userId: 1, email: "admin@test.local", role: "ADMIN" });
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      role: "ADMIN",
      email: "admin@test.local",
      permissions: [
        { scope: "COMPANY_VERIFICATIONS", canView: true, canEdit: true, canApprove: true },
      ],
    } as never);
    mockedPrisma.passportVerificationFile.findMany.mockResolvedValue([]);
    mockedPrisma.passportVerificationFile.deleteMany.mockResolvedValue({ count: 0 } as never);
  });

  it("approves an application and activates linked company", async () => {
    mockedPrisma.companyVerificationApplication.findUnique
      .mockResolvedValueOnce({ uuid: "application-1", status: "APPROVED", company: { id: 42, isActive: true } } as never);

    const tx = {
      companyVerificationApplication: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, companyId: 42, identityVerificationMode: "FULL", status: "REVIEWING" }),
        update: jest.fn(),
      },
      company: { update: jest.fn() },
      companyBillingAccount: { upsert: jest.fn() },
      auditEvent: { create: jest.fn() },
      adminTask: { updateMany: jest.fn() },
    };
    (mockedPrisma.$transaction as unknown as jest.Mock).mockImplementationOnce(
      async (callback: (tx: MockVerificationTransaction) => Promise<unknown>) => callback(tx),
    );

    const res = await PATCH(
      new NextRequest("http://localhost/api/admin/company-verifications/application-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "APPROVED" }),
      }),
      { params: { uuid: "application-1" } },
    );

    expect(res.status).toBe(200);
    expect(tx.companyVerificationApplication.update).toHaveBeenCalledWith({
      where: { uuid: "application-1" },
      data: { status: "APPROVED" },
    });
    expect(tx.company.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: expect.objectContaining({
        isActive: true,
        verificationStatus: "APPROVED",
        passportVerificationStatus: "APPROVED",
        identityVerificationCompleted: true,
      }),
    });
    expect(tx.companyBillingAccount.upsert).toHaveBeenCalledWith({
      where: { companyId: 42 },
      create: expect.objectContaining({
        companyId: 42,
        status: "TRIAL",
        trialStartedAt: expect.any(Date),
        trialEndsAt: expect.any(Date),
      }),
      update: {},
    });
    expect(tx.adminTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sourceKey: "verification:application-1" }),
        data: expect.objectContaining({ status: "RESOLVED", resolvedById: 1 }),
      }),
    );
    expect(mockedPersistKycRecordFromApplication).toHaveBeenCalledWith(
      "application-1",
      "APPROVED",
      expect.objectContaining({ actorUserId: 1 }),
    );
  });

  it("rejects a new action after a final decision has been recorded", async () => {
    const tx = {
      companyVerificationApplication: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, companyId: 42, identityVerificationMode: "FULL", status: "APPROVED" }),
        update: jest.fn(),
      },
      company: { update: jest.fn() },
      companyBillingAccount: { upsert: jest.fn() },
      auditEvent: { create: jest.fn() },
      adminTask: { updateMany: jest.fn() },
    };
    (mockedPrisma.$transaction as unknown as jest.Mock).mockImplementationOnce(
      async (callback: (tx: MockVerificationTransaction) => Promise<unknown>) => callback(tx),
    );

    const res = await PATCH(
      new NextRequest("http://localhost/api/admin/company-verifications/application-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "REJECTED" }),
      }),
      { params: { uuid: "application-1" } },
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.message).toContain("cannot be changed");
    expect(tx.companyVerificationApplication.update).not.toHaveBeenCalled();
    expect(tx.company.update).not.toHaveBeenCalled();
  });
});
