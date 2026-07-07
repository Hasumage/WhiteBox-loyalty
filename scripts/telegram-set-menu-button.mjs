import "dotenv/config";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const botMode = process.env.TELEGRAM_LOCAL_BOT || "prod";
const isDevBot = botMode === "dev";
const token = isDevBot ? process.env.TELEGRAM_DEV_BOT_TOKEN : process.env.TELEGRAM_BOT_TOKEN;
const proxyUrl = process.env.TELEGRAM_PROXY_URL;
const webAppUrl = isDevBot
  ? process.env.TELEGRAM_DEV_WEB_APP_URL || process.env.TELEGRAM_WEB_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://nearloy.up.railway.app/"
  : process.env.TELEGRAM_WEB_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://nearloy.up.railway.app/";

if (!token) throw new Error(`${isDevBot ? "TELEGRAM_DEV_BOT_TOKEN" : "TELEGRAM_BOT_TOKEN"} is not set.`);

function nearloyWebAppUrl(path = "/app") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  try {
    const url = new URL(webAppUrl);
    return new URL(normalizedPath, url.origin).toString();
  } catch {
    return `${webAppUrl.replace(/\/$/, "")}${normalizedPath}`;
  }
}

const menuUrl = nearloyWebAppUrl();

const body = {
  menu_button: {
    type: "web_app",
    text: "Открыть NearLoy",
    web_app: {
      url: menuUrl,
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

console.log(`Telegram menu button set for ${botMode}: ${menuUrl}`);
