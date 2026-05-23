jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    companyVerificationApplication: {
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}));

jest.mock("@/lib/admin/require-admin-session", () => ({
  requireAdminSession: jest.fn(),
  isAuthResponse: (value: unknown) => value instanceof Response,
}));

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import { GET } from "./route";

const mockedRequireAdminSession = jest.mocked(requireAdminSession);
const mockedPrisma = jest.mocked(prisma, { shallow: false });

describe("admin company verifications list route", () => {
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
  });

  it("returns paginated verification requests with summary counts", async () => {
    mockedPrisma.companyVerificationApplication.count.mockResolvedValue(1);
    mockedPrisma.companyVerificationApplication.findMany.mockResolvedValue([
      {
        id: 1,
        uuid: "application-1",
        status: "SUBMITTED",
        companyName: "Coffee Lab",
        contactEmail: "owner@test.local",
      },
    ] as never);
    mockedPrisma.companyVerificationApplication.groupBy.mockResolvedValue([
      { status: "SUBMITTED", _count: { status: 1 } },
    ] as never);

    const res = await GET(new NextRequest("http://localhost/api/admin/company-verifications?query=coffee&status=SUBMITTED"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.summary.SUBMITTED).toBe(1);
    expect(mockedPrisma.companyVerificationApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 12,
        where: expect.objectContaining({ status: "SUBMITTED" }),
      }),
    );
  });
});
