import "dotenv/config";
import { request as httpsRequest } from "node:https";
import httpsProxyAgentModule from "https-proxy-agent";

const { HttpsProxyAgent } = httpsProxyAgentModule;
const token = process.env.TELEGRAM_BOT_TOKEN;
const proxyUrl = process.env.TELEGRAM_PROXY_URL;
const localWebhookUrl = process.env.TELEGRAM_LOCAL_WEBHOOK_URL || "http://127.0.0.1:3000/api/telegram/webhook";
const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
const once = process.argv.includes("--once");
const fromNow = process.argv.includes("--from-now");
const retryDelayMs = Number(process.env.TELEGRAM_LOCAL_POLL_RETRY_MS ?? 3000);

if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set.");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function fetchViaHttpsProxy(url, init = {}) {
  return new Promise((resolve, reject) => {
    const body = init.body;
    const request = httpsRequest(
      new URL(url),
      {
        method: init.method || "GET",
        headers: {
          ...(init.headers || {}),
          ...(body ? { "Content-Length": Buffer.byteLength(body).toString() } : {}),
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
    if (body) request.write(body);
    request.end();
  });
}

async function telegram(method, params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) query.set(key, String(value));
  }
  const suffix = query.toString() ? `?${query}` : "";
  const url = `https://api.telegram.org/bot${token}/${method}${suffix}`;
  const response = proxyUrl ? await fetchViaHttpsProxy(url) : await fetch(url);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok || !data?.ok) {
    throw new Error(`${method} failed: ${response.status} ${JSON.stringify(data)}`);
  }
  return data.result;
}

async function forwardUpdate(update) {
  const headers = { "Content-Type": "application/json" };
  if (secretToken) headers["x-telegram-bot-api-secret-token"] = secretToken;

  const response = await fetch(localWebhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(update),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`local webhook failed: ${response.status} ${JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  console.log(`Telegram local polling -> ${localWebhookUrl}`);
  if (proxyUrl) console.log("Telegram proxy enabled.");
  console.log(`Worker mode: transient errors retry every ${retryDelayMs}ms.`);

  let offset;
  if (fromNow) {
    const latest = await telegram("getUpdates", {
      limit: 1,
      offset: -1,
      allowed_updates: JSON.stringify(["message", "callback_query"]),
    });
    if (latest[0]?.update_id !== undefined) offset = latest[0].update_id + 1;
    console.log(`Skipping backlog. Starting from update offset ${offset ?? "current"}.`);
  }

  do {
    let updates;
    try {
      updates = await telegram("getUpdates", {
        timeout: once ? 0 : 25,
        limit: 20,
        offset,
        allowed_updates: JSON.stringify(["message", "callback_query"]),
      });
    } catch (error) {
      console.error(`[poll] Telegram getUpdates failed: ${errorMessage(error)}`);
      if (once) throw error;
      await sleep(retryDelayMs);
      continue;
    }

    for (const update of updates) {
      try {
        const result = await forwardUpdate(update);
        offset = update.update_id + 1;
        const text = update.message?.text || update.callback_query?.data || "update";
        console.log(`Processed ${update.update_id}: ${text} -> ${JSON.stringify(result)}`);
      } catch (error) {
        console.error(`[poll] Local webhook failed for update ${update.update_id}: ${errorMessage(error)}`);
        if (once) throw error;
        await sleep(retryDelayMs);
        break;
      }
    }

    if (once) {
      if (offset !== undefined && updates.length > 0) {
        await telegram("getUpdates", { timeout: 0, limit: 1, offset });
      }
      break;
    }
  } while (true);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
