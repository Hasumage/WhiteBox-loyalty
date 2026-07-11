import { BadRequestException, Body, Controller, Headers, Post, Res, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MAX_GATEWAY_OUTPUT_TOKENS = 1500;

@Controller("internal/ai")
export class AiGatewayController {
  constructor(private readonly config: ConfigService) {}

  @Post("responses")
  async responses(
    @Headers("x-ai-gateway-secret") secret: string | undefined,
    @Body() body: unknown,
    @Res() res: Response,
  ) {
    this.assertGatewaySecret(secret);
    const apiKey = this.config.get<string>("OPENAI_API_KEY")?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException("AI provider key is not configured.");
    }

    const requestBody = this.sanitizeRequestBody(body);
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    }).catch((error) => {
      throw new ServiceUnavailableException(error instanceof Error ? error.message : "AI provider request failed.");
    });

    const contentType = response.headers.get("content-type") ?? "application/json";
    const payload = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => "");

    return res.status(response.status).type(contentType).send(payload);
  }

  private assertGatewaySecret(secret: string | undefined) {
    const expected = this.config.get<string>("AI_GATEWAY_SECRET")?.trim();
    if (!expected || expected.length < 24) {
      throw new ServiceUnavailableException("AI gateway is not configured.");
    }
    if (!secret || secret !== expected) {
      throw new UnauthorizedException("Invalid AI gateway secret.");
    }
  }

  private sanitizeRequestBody(body: unknown): Record<string, unknown> {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new BadRequestException("AI request body must be an object.");
    }

    const requestBody: Record<string, unknown> = { ...(body as Record<string, unknown>), store: false };
    const configuredMaxOutputTokens = Number(requestBody.max_output_tokens);
    requestBody.max_output_tokens =
      Number.isFinite(configuredMaxOutputTokens) && configuredMaxOutputTokens > 0
        ? Math.min(Math.floor(configuredMaxOutputTokens), MAX_GATEWAY_OUTPUT_TOKENS)
        : MAX_GATEWAY_OUTPUT_TOKENS;
    return requestBody;
  }
}
