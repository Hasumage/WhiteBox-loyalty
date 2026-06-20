import { EventEmitter } from "node:events";
import { request as httpsRequest } from "node:https";
import {
  buildLeadInlineKeyboard,
  escapeTelegramHtml,
  redactProxyUrl,
  renderLandingLeadHtmlMessage,
  sendTelegramMessage,
} from "./telegram-service";

jest.mock("node:https", () => ({
  request: jest.fn(),
}));

jest.mock("https-proxy-agent", () => {
  const HttpsProxyAgent = jest.fn().mockImplementation((url: string) => ({ url }));
  return { __esModule: true, default: { HttpsProxyAgent }, HttpsProxyAgent };
});

const mockedHttpsRequest = jest.mocked(httpsRequest);

function mockProxyRequestError(error: Error) {
  mockedHttpsRequest.mockImplementationOnce(() => {
    const request = new EventEmitter() as EventEmitter & {
      write: jest.Mock;
      end: jest.Mock;
      destroy: jest.Mock;
    };
    request.write = jest.fn();
    request.destroy = jest.fn((destroyError?: Error) => request.emit("error", destroyError ?? error));
    request.end = jest.fn(() => request.emit("error", error));
    return request as never;
  });
}

function mockProxyRequestSuccess(body: unknown, statusCode = 200) {
  mockedHttpsRequest.mockImplementationOnce((_url, _options, callback) => {
    const request = new EventEmitter() as EventEmitter & {
      write: jest.Mock;
      end: jest.Mock;
      destroy: jest.Mock;
    };
    request.write = jest.fn();
    request.destroy = jest.fn();
    request.end = jest.fn(() => {
      const response = new EventEmitter() as EventEmitter & {
        statusCode: number;
        statusMessage: string;
        headers: Record<string, string>;
      };
      response.statusCode = statusCode;
      response.statusMessage = statusCode === 200 ? "OK" : "Error";
      response.headers = { "content-type": "application/json" };
      callback?.(response as never);
      response.emit("data", Buffer.from(JSON.stringify(body)));
      response.emit("end");
    });
    return request as never;
  });
}

describe("telegram service helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("escapes telegram HTML", () => {
    expect(escapeTelegramHtml("A&B <tag>")).toBe("A&amp;B &lt;tag&gt;");
  });

  it("renders safe HTML message", () => {
    const text = renderLandingLeadHtmlMessage({
      leadUuid: "lead-1",
      createdAt: new Date("2026-05-16T00:00:00.000Z"),
      lead: {
        name: "Max <script>",
        contact: "maksim@example.com",
        message: "Coffee & loyalty",
      },
    });

    expect(text).toContain("<b>Новая заявка с лендинга NearLoy</b>");
    expect(text).toContain("Max &lt;script&gt;");
    expect(text).toContain("Coffee &amp; loyalty");
  });

  it("builds lead actions", () => {
    expect(buildLeadInlineKeyboard({ leadUuid: "lead-1", leadUrl: "https://nearloy.test/admin/leads/1", contact: "@Hasumage" })).toEqual({
      inline_keyboard: [
        [{ text: "Открыть заявку", url: "https://nearloy.test/admin/leads/1" }],
        [{ text: "Открыть контакт в Telegram", url: "https://t.me/Hasumage" }],
        [
          { text: "В работу", callback_data: "lead:lead-1:in_progress" },
          { text: "Закрыть", callback_data: "lead:lead-1:closed" },
        ],
      ],
    });
  });

  it("does not send localhost urls to telegram inline buttons", () => {
    expect(buildLeadInlineKeyboard({ leadUrl: "http://localhost:3000/admin/leads/1" })?.inline_keyboard).toEqual([
      [
        { text: "В работу", callback_data: "lead:in_progress" },
        { text: "Закрыть", callback_data: "lead:closed" },
      ],
    ]);
  });

  it("redacts proxy credentials", () => {
    expect(redactProxyUrl("http://user:pass@127.0.0.1:10809")).toBe("http://***:***@127.0.0.1:10809/");
  });

  it("retries transient Telegram network errors when proxy is configured", async () => {
    mockProxyRequestError(new Error("ECONNRESET"));
    mockProxyRequestSuccess({ ok: true, result: { message_id: 42 } });

    await expect(
      sendTelegramMessage({
        botToken: "bot-token",
        chatId: "8074263460",
        text: "ping",
        proxyUrl: "http://127.0.0.1:10809",
      }),
    ).resolves.toEqual({ ok: true, result: { message_id: 42 } });

    expect(mockedHttpsRequest).toHaveBeenCalledTimes(2);
  });
});
