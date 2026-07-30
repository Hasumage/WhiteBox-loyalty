import { requestOpenAiResponses } from "./openai-responses";

const originalEnv = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  OPENAI_GATEWAY_URL: process.env.OPENAI_GATEWAY_URL,
  OPENAI_GATEWAY_SECRET: process.env.OPENAI_GATEWAY_SECRET,
};

describe("requestOpenAiResponses", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("uses the configured server gateway before the direct provider", async () => {
    process.env.OPENAI_GATEWAY_URL = "https://api.example.test/api/internal/ai/responses";
    process.env.OPENAI_GATEWAY_SECRET = "gateway-secret";
    process.env.OPENAI_API_KEY = "direct-provider-key";
    const response = { ok: true } as Response;
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(response);

    await expect(requestOpenAiResponses({ model: "test-model", input: "Привет" })).resolves.toBe(response);

    expect(fetchSpy).toHaveBeenCalledWith(
      process.env.OPENAI_GATEWAY_URL,
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ai-gateway-secret": "gateway-secret",
        },
        body: JSON.stringify({ model: "test-model", input: "Привет" }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("does not call the provider when gateway credentials are incomplete", async () => {
    process.env.OPENAI_GATEWAY_URL = "https://api.example.test/api/internal/ai/responses";
    delete process.env.OPENAI_GATEWAY_SECRET;
    process.env.OPENAI_API_KEY = "direct-provider-key";
    const fetchSpy = jest.spyOn(global, "fetch");

    await expect(requestOpenAiResponses({ input: "Привет" })).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("falls back to the direct provider outside gateway deployments", async () => {
    delete process.env.OPENAI_GATEWAY_URL;
    delete process.env.OPENAI_GATEWAY_SECRET;
    process.env.OPENAI_API_KEY = "direct-provider-key";
    process.env.OPENAI_BASE_URL = "https://provider.example.test/v1/";
    const response = { ok: true } as Response;
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(response);

    await expect(requestOpenAiResponses({ input: "Привет" })).resolves.toBe(response);

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://provider.example.test/v1/responses",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer direct-provider-key",
          "Content-Type": "application/json",
        },
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
