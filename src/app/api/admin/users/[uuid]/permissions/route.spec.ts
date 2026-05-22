jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/admin/require-admin-session", () => ({
  requireAdminSession: jest.fn(),
  isAuthResponse: (value: unknown) => value instanceof Response,
}));

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import { GET, PUT } from "./route";

const mockedRequireAdminSession = jest.mocked(requireAdminSession);
const mockedPrisma = jest.mocked(prisma, { shallow: false });
type MockPermissionTransaction = {
  adminUserPermission: { upsert: jest.Mock };
  auditEvent: { create: jest.Mock };
};

describe("admin user permissions route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireAdminSession.mockResolvedValue({ userId: 1, email: "super@test.local", role: "SUPER_ADMIN" });
  });

  it("returns safe default permissions for support users", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 2,
      uuid: "support-user",
      name: "Support",
      email: "support@test.local",
      role: "SUPPORT",
      permissions: [],
    } as never);

    const res = await GET(new NextRequest("http://localhost/api/admin/users/support-user/permissions"), {
      params: { uuid: "support-user" },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.permissions.find((permission: { scope: string }) => permission.scope === "SUPPORT")).toMatchObject({
      canView: true,
      canEdit: true,
      canApprove: false,
    });
    expect(body.permissions.find((permission: { scope: string }) => permission.scope === "COMPANY_VERIFICATIONS")).toMatchObject({
      canView: false,
      canEdit: false,
      canApprove: false,
    });
  });

  it("allows super admin to persist sanitized permissions and audit the change", async () => {
    mockedPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 1, role: "SUPER_ADMIN", email: "super@test.local", name: "Super", permissions: [] } as never)
      .mockResolvedValueOnce({ id: 2, uuid: "manager-user", email: "manager@test.local", role: "MANAGER", permissions: [] } as never)
      .mockResolvedValueOnce({
        id: 2,
        uuid: "manager-user",
        name: "Manager",
        email: "manager@test.local",
        role: "MANAGER",
        permissions: [{ scope: "FINANCE", canView: true, canEdit: true, canApprove: false }],
      } as never);

    const tx = {
      adminUserPermission: { upsert: jest.fn() },
      auditEvent: { create: jest.fn() },
    };
    (mockedPrisma.$transaction as unknown as jest.Mock).mockImplementationOnce(
      async (callback: (tx: MockPermissionTransaction) => Promise<unknown>) => callback(tx),
    );

    const res = await PUT(
      new NextRequest("http://localhost/api/admin/users/manager-user/permissions", {
        method: "PUT",
        body: JSON.stringify({
          permissions: [
            { scope: "FINANCE", canView: true, canEdit: true, canApprove: false },
            { scope: "NOT_A_SCOPE", canView: true, canEdit: true, canApprove: true },
          ],
        }),
      }),
      { params: { uuid: "manager-user" } },
    );

    expect(res.status).toBe(200);
    expect(tx.adminUserPermission.upsert).toHaveBeenCalled();
    const financeCall = tx.adminUserPermission.upsert.mock.calls.find(
      ([call]) => call.where.userId_scope.scope === "FINANCE",
    )?.[0];
    expect(financeCall).toMatchObject({
      where: { userId_scope: { userId: 2, scope: "FINANCE" } },
      update: { canView: false, canEdit: false, canApprove: false },
    });
    expect(tx.adminUserPermission.upsert.mock.calls.some(([call]) => call.where.userId_scope.scope === "NOT_A_SCOPE")).toBe(false);
    expect(tx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "Admin permissions updated" }),
    }));
  });

  it("blocks managers from editing access settings", async () => {
    mockedRequireAdminSession.mockResolvedValue({ userId: 3, email: "manager@test.local", role: "MANAGER" });
    mockedPrisma.user.findUnique.mockResolvedValue({ id: 3, role: "MANAGER", email: "manager@test.local", permissions: [] } as never);

    const res = await PUT(
      new NextRequest("http://localhost/api/admin/users/support-user/permissions", {
        method: "PUT",
        body: JSON.stringify({ permissions: [] }),
      }),
      { params: { uuid: "support-user" } },
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.message).toContain("Access settings permission");
  });
});
