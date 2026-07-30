import "dotenv/config";
import { request as httpsRequest } from "node:https";
import httpsProxyAgentModule from "https-proxy-agent";

const { HttpsProxyAgent } = httpsProxyAgentModule;

const botMode = process.env.TELEGRAM_LOCAL_BOT || "prod";
const isDevBot = botMode === "dev";
const token = isDevBot ? process.env.TELEGRAM_DEV_BOT_TOKEN : process.env.TELEGRAM_BOT_TOKEN;
const proxyUrl = process.env.TELEGRAM_PROXY_URL;
const webhookUrl = isDevBot ? process.env.TELEGRAM_DEV_WEBHOOK_URL : process.env.TELEGRAM_WEBHOOK_URL;
const secretToken = isDevBot
  ? process.env.TELEGRAM_DEV_WEBHOOK_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET
  : process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token) throw new Error(`${isDevBot ? "TELEGRAM_DEV_BOT_TOKEN" : "TELEGRAM_BOT_TOKEN"} is not set.`);
if (!webhookUrl) throw new Error(`${isDevBot ? "TELEGRAM_DEV_WEBHOOK_URL" : "TELEGRAM_WEBHOOK_URL"} is not set.`);

const body = {
  url: webhookUrl,
  allowed_updates: ["callback_query", "message"],
  ...(secretToken ? { secret_token: secretToken } : {}),
};

const response = proxyUrl ? await fetchViaHttpsProxy(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
}, proxyUrl) : await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const data = await response.json().catch(() => null);
if (!response.ok || !data?.ok) {
  throw new Error(`setWebhook failed: ${response.status} ${JSON.stringify(data)}`);
}

console.log(`Telegram webhook set for ${botMode}: ${webhookUrl}`);

function fetchViaHttpsProxy(url, init, proxyUrl) {
  return new Promise((resolve, reject) => {
    const requestBody = init.body;
    const request = httpsRequest(
      new URL(url),
      {
        method: init.method || "GET",
        headers: {
          ...(init.headers || {}),
          ...(requestBody ? { "Content-Length": Buffer.byteLength(requestBody).toString() } : {}),
        },
        agent: new HttpsProxyAgent(proxyUrl),
        timeout: 15_000,
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({
            ok: response.statusCode >= 200 && response.statusCode < 300,
            status: response.statusCode,
            text: async () => text,
            json: async () => JSON.parse(text),
          });
        });
      },
    );

    request.on("timeout", () => request.destroy(new Error("Telegram proxy request timed out.")));
    request.on("error", reject);
    if (requestBody) request.write(requestBody);
    request.end();
  });
}
