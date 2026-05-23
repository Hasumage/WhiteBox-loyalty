jest.mock("@/lib/prisma", () => ({
  prisma: {
    telegramMessageQueue: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    notificationDelivery: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    auditEvent: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/admin/require-admin-session", () => ({
  requireAdminSession: jest.fn(),
  isAuthResponse: (value: unknown) => value instanceof Response,
}));

jest.mock("@/lib/admin/require-admin-scope", () => ({
  requireAdminScope: jest.fn(),
}));

import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";

const mockedRequireAdminSession = jest.mocked(requireAdminSession);
const mockedRequireAdminScope = jest.mocked(requireAdminScope);
const mockedPrisma = jest.mocked(prisma, { shallow: false });

describe("admin system health route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireAdminSession.mockResolvedValue({ userId: 1, email: "admin@test.local", role: "SUPER_ADMIN" });
    mockedRequireAdminScope.mockResolvedValue({ ok: true, actor: {}, permission: {} } as never);
  });

  it("returns system health with Telegram queue and developer incidents", async () => {
    mockedPrisma.telegramMessageQueue.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    mockedPrisma.telegramMessageQueue.findMany.mockResolvedValue([
      {
        id: "queue-1",
        status: "FAILED",
        recipientRole: "owner",
        recipientLabel: "Owner",
        recipientChatId: "1348887499",
        text: "Long Telegram payload",
        parseMode: "HTML",
        replyMarkup: null,
        source: "company-verification",
        sourceId: "app-1",
        priority: 20,
        attempts: 2,
        telegramMessageId: null,
        lastError: "Telegram 500",
        nextRetryAt: new Date("2026-05-22T12:00:00.000Z"),
        sentAt: null,
        createdAt: new Date("2026-05-22T11:00:00.000Z"),
        updatedAt: new Date("2026-05-22T11:30:00.000Z"),
      },
    ] as never);

    mockedPrisma.notificationDelivery.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(0);
    mockedPrisma.notificationDelivery.findMany.mockResolvedValue([
      {
        id: "delivery-1",
        recipientRole: "admin",
        recipientLabel: "Admin",
        recipientChatId: "1348887499",
        attempts: 1,
        lastError: "Bad Gateway",
        nextRetryAt: null,
        createdAt: new Date("2026-05-22T10:00:00.000Z"),
        updatedAt: new Date("2026-05-22T10:05:00.000Z"),
        lead: { uuid: "lead-uuid", name: "Lead", company: "Retail" },
      },
    ] as never);

    mockedPrisma.auditEvent.findMany.mockResolvedValue([
      {
        id: "audit-1",
        level: "CRITICAL",
        category: "SYSTEM",
        action: "Telegram delivery fire",
        details: "Failures reached threshold",
        actorLabel: "WhiteBox Telegram Queue",
        targetLabel: null,
        result: "SUCCESS",
        tags: ["TELEGRAM", "TELEGRAM_FIRE"],
        linkUrl: null,
        linkLabel: null,
        createdAt: new Date("2026-05-22T10:10:00.000Z"),
      },
    ] as never);

    const res = await GET(new NextRequest("http://localhost/api/admin/system-health"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockedRequireAdminScope).toHaveBeenCalledWith(
      { userId: 1, email: "admin@test.local", role: "SUPER_ADMIN" },
      "AUDIT",
      "canView",
    );
    expect(body.summary).toMatchObject({
      openIssues: 4,
      criticalIncidents: 1,
      telegramQueueFailed: 2,
      telegramQueueDue: 1,
      leadTelegramFailed24h: 1,
    });
    expect(body.telegram.queue.recent[0]).toMatchObject({
      id: "queue-1",
      recipientChatId: "...7499",
      lastError: "Telegram 500",
    });
    expect(body.developerIncidents[0]).toMatchObject({
      id: "audit-1",
      level: "CRITICAL",
      action: "Telegram delivery fire",
    });
  });

  it("resolves developer incidents without deleting the audit trail", async () => {
    mockedPrisma.auditEvent.findFirst.mockResolvedValue({
      id: "audit-1",
      tags: ["TELEGRAM", "TELEGRAM_FIRE"],
      details: "Failures reached threshold",
    } as never);
    mockedPrisma.auditEvent.update.mockResolvedValue({
      id: "audit-1",
      tags: ["TELEGRAM", "TELEGRAM_FIRE", "RESOLVED"],
    } as never);

    const res = await POST(
      new NextRequest("http://localhost/api/admin/system-health", {
        method: "POST",
        body: JSON.stringify({ action: "resolveDeveloperIncident", id: "audit-1" }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockedRequireAdminScope).toHaveBeenCalledWith(
      { userId: 1, email: "admin@test.local", role: "SUPER_ADMIN" },
      "AUDIT",
      "canEdit",
    );
    expect(mockedPrisma.auditEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "audit-1" },
        data: expect.objectContaining({
          level: "INFO",
          tags: ["TELEGRAM", "TELEGRAM_FIRE", "RESOLVED"],
        }),
      }),
    );
    expect(body).toMatchObject({ ok: true, incident: { id: "audit-1" } });
  });
});
