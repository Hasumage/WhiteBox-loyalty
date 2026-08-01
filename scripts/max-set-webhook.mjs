import "dotenv/config";

const token = process.env.MAX_BOT_TOKEN;
const webhookUrl = process.env.MAX_WEBHOOK_URL;
const secret = process.env.MAX_WEBHOOK_SECRET;
const apiBase = (process.env.MAX_API_BASE_URL || "https://platform-api2.max.ru").replace(/\/$/, "");

if (!token) throw new Error("MAX_BOT_TOKEN is not set.");
if (!webhookUrl) throw new Error("MAX_WEBHOOK_URL is not set.");

const body = {
  url: webhookUrl,
  update_types: ["message_created", "bot_started"],
  ...(secret ? { secret } : {}),
};

const response = await fetch(`${apiBase}/subscriptions`, {
  method: "POST",
  headers: {
    Authorization: token,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const data = await response.json().catch(() => null);
if (!response.ok) {
  throw new Error(`MAX webhook setup failed: ${response.status} ${JSON.stringify(data)}`);
}

console.log(`MAX webhook set: ${webhookUrl}`);
