import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ProxyAgent, fetch as undiciFetch } from "undici";

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;

    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");

    process.env[key] ??= value;
  }
}

function redactProxyUrl(proxyUrl) {
  try {
    const url = new URL(proxyUrl);
    if (url.username || url.password) {
      url.username = "***";
      url.password = "***";
    }
    return url.toString();
  } catch {
    return "<invalid proxy url>";
  }
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env"));

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const proxyUrl = process.env.TELEGRAM_PROXY_URL;

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set.");
  }

  if (proxyUrl) {
    console.log(`Telegram proxy enabled: ${redactProxyUrl(proxyUrl)}`);
  } else {
    console.log("Telegram proxy disabled. Using direct connection.");
  }

  let response;
  try {
    response = await undiciFetch(`https://api.telegram.org/bot${token}/getMe`, {
      dispatcher: proxyUrl ? new ProxyAgent(proxyUrl) : undefined,
    });
  } catch (error) {
    if (!proxyUrl) throw error;
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Telegram proxy failed: ${message}. Retrying direct connection.`);
    response = await undiciFetch(`https://api.telegram.org/bot${token}/getMe`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Telegram getMe failed: ${response.status} ${body}`);
  }

  const data = await response.json();
  console.log(`Telegram Bot API ping OK: @${data.result.username} (${data.result.id})`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
