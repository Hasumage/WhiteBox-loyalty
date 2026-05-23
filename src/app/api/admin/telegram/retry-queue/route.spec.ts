jest.mock("@/lib/admin/require-admin-session", () => ({
  requireAdminSession: jest.fn(),
  isAuthResponse: (value: unknown) => value instanceof Response,
}));

jest.mock("@/lib/admin/require-admin-scope", () => ({
  requireAdminScope: jest.fn(),
}));

jest.mock("@/lib/telegram/telegram-queue", () => ({
  processTelegramMessageQueue: jest.fn(),
}));

import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { processTelegramMessageQueue } from "@/lib/telegram/telegram-queue";
import { POST } from "./route";

const mockedRequireAdminSession = jest.mocked(requireAdminSession);
const mockedRequireAdminScope = jest.mocked(requireAdminScope);
const mockedProcessTelegramMessageQueue = jest.mocked(processTelegramMessageQueue);

describe("admin telegram retry queue route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requires Telegram edit access and drains queued messages", async () => {
    mockedRequireAdminSession.mockResolvedValue({ userId: 1, email: "admin@test.local", role: "SUPER_ADMIN" });
    mockedRequireAdminScope.mockResolvedValue({ ok: true, actor: {}, permission: {} } as never);
    mockedProcessTelegramMessageQueue.mockResolvedValue({ processed: 2, sent: 1, failed: 1, results: [] });

    const res = await POST(new NextRequest("http://localhost/api/admin/telegram/retry-queue", { method: "POST" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockedRequireAdminScope).toHaveBeenCalledWith(
      { userId: 1, email: "admin@test.local", role: "SUPER_ADMIN" },
      "TELEGRAM",
      "canEdit",
    );
    expect(body).toMatchObject({ ok: true, result: { processed: 2, sent: 1, failed: 1 } });
  });
});
