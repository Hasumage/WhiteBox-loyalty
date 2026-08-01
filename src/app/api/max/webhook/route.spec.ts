jest.mock("@/lib/max/max-bot", () => ({
  handleMaxUpdate: jest.fn(),
}));

import { NextRequest } from "next/server";
import { handleMaxUpdate } from "@/lib/max/max-bot";
import { POST } from "./route";

const mockedHandleMaxUpdate = handleMaxUpdate as jest.Mock;

describe("MAX webhook route", () => {
  const originalSecret = process.env.MAX_WEBHOOK_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.MAX_WEBHOOK_SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.MAX_WEBHOOK_SECRET;
    else process.env.MAX_WEBHOOK_SECRET = originalSecret;
  });

  it("passes valid updates to the MAX bot module", async () => {
    mockedHandleMaxUpdate.mockResolvedValue({ ok: true, welcome: true });

    const response = await POST(
      new NextRequest("http://localhost/api/max/webhook", {
        method: "POST",
        body: JSON.stringify({ update_type: "bot_started", user: { id: "max-user-1" } }),
      }),
    );

    await expect(response.json()).resolves.toEqual({ ok: true, welcome: true });
    expect(response.status).toBe(200);
    expect(mockedHandleMaxUpdate).toHaveBeenCalledWith({
      update_type: "bot_started",
      user: { id: "max-user-1" },
    });
  });

  it("rejects invalid webhook secrets", async () => {
    process.env.MAX_WEBHOOK_SECRET = "secret";

    const response = await POST(
      new NextRequest("http://localhost/api/max/webhook", {
        method: "POST",
        headers: { "x-max-bot-api-secret": "bad" },
        body: JSON.stringify({ update_type: "bot_started" }),
      }),
    );

    expect(response.status).toBe(401);
    expect(mockedHandleMaxUpdate).not.toHaveBeenCalled();
  });

  it("returns 200 for processing errors to avoid webhook retry spam", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockedHandleMaxUpdate.mockRejectedValue(new Error("database down"));

    const response = await POST(
      new NextRequest("http://localhost/api/max/webhook", {
        method: "POST",
        body: JSON.stringify({ update_type: "message_created" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      message: "max_message_processing_failed",
    });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
