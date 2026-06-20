import "dotenv/config";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const token = process.env.TELEGRAM_BOT_TOKEN;
const proxyUrl = process.env.TELEGRAM_PROXY_URL;
const webAppUrl = process.env.TELEGRAM_WEB_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://nearloy.app/";

if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set.");

const body = {
  menu_button: {
    type: "web_app",
    text: "Открыть NearLoy",
    web_app: {
      url: webAppUrl,
    },
  },
};

const response = await undiciFetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
  ...(proxyUrl ? { dispatcher: new ProxyAgent(proxyUrl) } : {}),
});

const data = await response.json().catch(() => null);
if (!response.ok || !data?.ok) {
  throw new Error(`setChatMenuButton failed: ${response.status} ${JSON.stringify(data)}`);
}

console.log(`Telegram menu button set: ${webAppUrl}`);
