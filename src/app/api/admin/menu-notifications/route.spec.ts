jest.mock("@/lib/prisma", () => ({
  prisma: {
    companyVerificationApplication: {
      count: jest.fn(),
    },
    telegramMessageQueue: {
      count: jest.fn(),
    },
    auditEvent: {
      count: jest.fn(),
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

describe("admin menu notifications route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireAdminSession.mockResolvedValue({ userId: 1, email: "admin@test.local", role: "ADMIN" });
  });

  it("returns open company verification counters for menu item and section", async () => {
    mockedPrisma.companyVerificationApplication.count.mockResolvedValue(23);
    mockedPrisma.telegramMessageQueue.count.mockResolvedValue(2);
    mockedPrisma.auditEvent.count.mockResolvedValue(1);

    const res = await GET(new NextRequest("http://localhost/api/admin/menu-notifications"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items["/admin/company-verifications"]).toBe(23);
    expect(body.items["/admin/system-health"]).toBe(3);
    expect(body.sections["admin.nav.usersPartners"]).toBe(23);
    expect(body.sections["admin.nav.system"]).toBe(3);
    expect(mockedPrisma.companyVerificationApplication.count).toHaveBeenCalledWith({
      where: { status: { in: ["SUBMITTED", "REVIEWING"] } },
    });
  });

  it("hides manager counters from support users", async () => {
    mockedRequireAdminSession.mockResolvedValue({ userId: 2, email: "support@test.local", role: "SUPPORT" });

    const res = await GET(new NextRequest("http://localhost/api/admin/menu-notifications"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toEqual({});
    expect(body.sections).toEqual({});
    expect(mockedPrisma.companyVerificationApplication.count).not.toHaveBeenCalled();
    expect(mockedPrisma.telegramMessageQueue.count).not.toHaveBeenCalled();
    expect(mockedPrisma.auditEvent.count).not.toHaveBeenCalled();
  });
});
