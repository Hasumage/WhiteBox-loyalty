import { existsSync, readFileSync } from "node:fs";
import { request as httpsRequest } from "node:https";
import { resolve } from "node:path";
import httpsProxyAgentModule from "https-proxy-agent";

const { HttpsProxyAgent } = httpsProxyAgentModule;

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

  const botMode = process.env.TELEGRAM_LOCAL_BOT || (process.env.TELEGRAM_DEV_BOT_TOKEN ? "dev" : "prod");
  const isDevBot = botMode === "dev";
  const token = isDevBot ? process.env.TELEGRAM_DEV_BOT_TOKEN : process.env.TELEGRAM_BOT_TOKEN;
  const proxyUrl = process.env.TELEGRAM_PROXY_URL;

  if (!token) {
    throw new Error(`${isDevBot ? "TELEGRAM_DEV_BOT_TOKEN" : "TELEGRAM_BOT_TOKEN"} is not set.`);
  }

  console.log(`Telegram Bot API ping bot: ${botMode}`);

  if (proxyUrl) {
    console.log(`Telegram proxy enabled: ${redactProxyUrl(proxyUrl)}`);
  } else {
    console.log("Telegram proxy disabled. Using direct connection.");
  }

  const response = proxyUrl
    ? await fetchViaHttpsProxy(`https://api.telegram.org/bot${token}/getMe`, proxyUrl)
    : await fetch(`https://api.telegram.org/bot${token}/getMe`);

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Telegram getMe failed: ${response.status} ${body}`);
  }

  const data = await response.json();
  console.log(`Telegram Bot API ping OK: @${data.result.username} (${data.result.id})`);
}

function fetchViaHttpsProxy(url, proxyUrl) {
  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      new URL(url),
      {
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
    request.end();
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
