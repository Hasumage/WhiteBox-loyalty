jest.mock("@/lib/prisma", () => ({
  prisma: {
    adminTask: { findUnique: jest.fn(), update: jest.fn() },
    auditEvent: { findUnique: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/admin/require-admin-session", () => ({
  requireAdminSession: jest.fn(),
  isAuthResponse: (value: unknown) => value instanceof Response,
}));

jest.mock("@/lib/admin/require-admin-scope", () => ({
  requireAdminScope: jest.fn(),
}));

jest.mock("@/lib/admin/admin-tasks", () => ({
  requiredScopeForAdminTask: (source: string) => (source === "AUDIT" ? "AUDIT" : "FINANCE"),
  syncAdminTasksFromSignals: jest.fn(),
}));

import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { prisma } from "@/lib/prisma";
import { PATCH } from "./route";

const mockedPrisma = jest.mocked(prisma, { shallow: false });
const mockedRequireAdminSession = jest.mocked(requireAdminSession);
const mockedRequireAdminScope = jest.mocked(requireAdminScope);

describe("admin task detail route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireAdminSession.mockResolvedValue({ userId: 7, email: "owner@test.local", role: "SUPER_ADMIN" });
    mockedRequireAdminScope.mockResolvedValue({ ok: true, actor: {}, permission: {} } as never);
    mockedPrisma.adminTask.findUnique.mockResolvedValue({
      uuid: "task-1",
      source: "AUDIT",
      sourceKey: "audit:event-1",
      status: "OPEN",
    } as never);
    mockedPrisma.auditEvent.findUnique.mockResolvedValue({ tags: ["TELEGRAM"], details: "Failure" } as never);
    mockedPrisma.auditEvent.update.mockResolvedValue({} as never);
    mockedPrisma.adminTask.update.mockResolvedValue({ uuid: "task-1", status: "RESOLVED" } as never);
    (mockedPrisma.$transaction as unknown as jest.Mock).mockImplementation(
      async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma),
    );
  });

  it("resolves an audit task together with its originating audit event", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost/api/admin/tasks/task-1", {
        method: "PATCH",
        body: JSON.stringify({ action: "resolve" }),
      }),
      { params: { uuid: "task-1" } },
    );

    expect(response.status).toBe(200);
    expect(mockedRequireAdminScope).toHaveBeenCalledWith(
      { userId: 7, email: "owner@test.local", role: "SUPER_ADMIN" },
      "AUDIT",
      "canEdit",
    );
    expect(mockedPrisma.auditEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "event-1" }, data: expect.objectContaining({ level: "INFO" }) }),
    );
    expect(mockedPrisma.adminTask.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { uuid: "task-1" }, data: expect.objectContaining({ status: "RESOLVED", resolvedById: 7 }) }),
    );
  });
});
