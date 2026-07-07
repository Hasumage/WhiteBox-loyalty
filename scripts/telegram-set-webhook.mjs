import "dotenv/config";
import { ProxyAgent, fetch as undiciFetch } from "undici";

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

const response = await undiciFetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
  ...(proxyUrl ? { dispatcher: new ProxyAgent(proxyUrl) } : {}),
});

const data = await response.json().catch(() => null);
if (!response.ok || !data?.ok) {
  throw new Error(`setWebhook failed: ${response.status} ${JSON.stringify(data)}`);
}

console.log(`Telegram webhook set for ${botMode}: ${webhookUrl}`);
