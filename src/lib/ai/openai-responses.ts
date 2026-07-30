export async function requestOpenAiResponses(body: Record<string, unknown>) {
  const timeoutMs = 30_000;
  const gatewayUrl = process.env.OPENAI_GATEWAY_URL?.trim();
  if (gatewayUrl) {
    const gatewaySecret = process.env.OPENAI_GATEWAY_SECRET?.trim();
    if (!gatewaySecret) return null;
    return fetch(gatewayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ai-gateway-secret": gatewaySecret,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const baseUrl = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
  return fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}
