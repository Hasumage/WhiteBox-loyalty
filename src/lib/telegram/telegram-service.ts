import { request as httpsRequest, type Agent as HttpsAgent } from "node:https";
import httpsProxyAgentModule from "https-proxy-agent";

export type TelegramRecipient = {
  chatId: string;
  label?: string;
  role?: string;
};

export type LandingLead = {
  name: string;
  company?: string;
  contact: string;
  business?: string;
  message: string;
};

const { HttpsProxyAgent } = httpsProxyAgentModule as typeof import("https-proxy-agent");

export function renderLandingLeadMessage(lead: LandingLead) {
  return [
    "Новая заявка с лендинга NearLoy",
    "",
    `Имя: ${lead.name}`,
    `Компания: ${lead.company || "не указано"}`,
    `Контакт: ${lead.contact}`,
    `Сфера: ${lead.business || "не указано"}`,
    "",
    "Сообщение:",
    lead.message,
  ].join("\n");
}

export function renderLandingLeadHtmlMessage(params: {
  lead: LandingLead;
  leadUuid: string;
  createdAt?: Date;
}) {
  const { lead, leadUuid } = params;
  const createdAt = params.createdAt ?? new Date();
  const safe = (value?: string | null) => escapeTelegramHtml(value?.trim() || "не указано");

  return [
    "✨ <b>Новая заявка с лендинга NearLoy</b>",
    `<code>${escapeTelegramHtml(leadUuid)}</code>`,
    "",
    `👤 <b>Имя:</b> ${safe(lead.name)}`,
    `🏢 <b>Компания:</b> ${safe(lead.company)}`,
    `📨 <b>Контакт:</b> ${safe(lead.contact)}`,
    `🧭 <b>Сфера:</b> ${safe(lead.business)}`,
    `🕒 <b>Создано:</b> ${escapeTelegramHtml(createdAt.toLocaleString("ru-RU"))}`,
    "",
    "💬 <b>Сообщение</b>",
    escapeTelegramHtml(lead.message),
  ].join("\n");
}

export function escapeTelegramHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildLeadInlineKeyboard(params: { leadUuid?: string; leadUrl?: string; contact?: string }) {
  const rows: Array<Array<{ text: string; url?: string; callback_data?: string }>> = [];

  if (params.leadUrl && isTelegramSafeUrl(params.leadUrl)) {
    rows.push([{ text: "Открыть заявку", url: params.leadUrl }]);
  }

  const telegramUsername = params.contact?.trim().match(/^@?([a-zA-Z0-9_]{5,32})$/)?.[1];
  if (telegramUsername && !params.contact?.includes("@", 1)) {
    rows.push([{ text: "Открыть контакт в Telegram", url: `https://t.me/${telegramUsername}` }]);
  }

  rows.push([
    { text: "В работу", callback_data: params.leadUuid ? `lead:${params.leadUuid}:in_progress` : "lead:in_progress" },
    { text: "Закрыть", callback_data: params.leadUuid ? `lead:${params.leadUuid}:closed` : "lead:closed" },
  ]);

  return rows.length > 0 ? { inline_keyboard: rows } : undefined;
}

function isTelegramSafeUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      host !== "localhost" &&
      host !== "127.0.0.1" &&
      host !== "::1" &&
      !host.endsWith(".local")
    );
  } catch {
    return false;
  }
}

export function redactProxyUrl(proxyUrl: string) {
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

type TelegramFetchInit = {
  method: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  proxyUrl?: string;
};

const TELEGRAM_RETRY_DELAYS_MS = [350, 900, 1800];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableTelegramResponse(status: number) {
  return status === 429 || status >= 500;
}

function fetchViaHttpsProxy(url: string, init: TelegramFetchInit) {
  return new Promise<Response>((resolve, reject) => {
    const body = init.body;
    const request = httpsRequest(
      new URL(url),
      {
        method: init.method,
        headers: {
          ...(init.headers ?? {}),
          ...(body ? { "Content-Length": Buffer.byteLength(body).toString() } : {}),
        },
        agent: new HttpsProxyAgent(init.proxyUrl!) as unknown as HttpsAgent,
        timeout: 15_000,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        response.on("end", () => {
          resolve(
            new Response(Buffer.concat(chunks), {
              status: response.statusCode ?? 0,
              statusText: response.statusMessage,
              headers: response.headers as HeadersInit,
            }),
          );
        });
      },
    );

    request.on("timeout", () => request.destroy(new Error("Telegram proxy request timed out.")));
    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

async function telegramFetch(url: string, init: TelegramFetchInit) {
  const { proxyUrl, ...fetchInit } = init;

  for (let attempt = 0; attempt <= TELEGRAM_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = proxyUrl ? await fetchViaHttpsProxy(url, init) : await fetch(url, fetchInit);

      if (!isRetryableTelegramResponse(response.status) || attempt === TELEGRAM_RETRY_DELAYS_MS.length) {
        return response;
      }

      await response.arrayBuffer().catch(() => undefined);
    } catch (error) {
      if (attempt === TELEGRAM_RETRY_DELAYS_MS.length) throw error;
    }

    await sleep(TELEGRAM_RETRY_DELAYS_MS[attempt]);
  }

  throw new Error("Telegram request failed after retries.");
}

export async function sendTelegramMessage(params: {
  botToken: string;
  chatId: string;
  text: string;
  parseMode?: "HTML";
  replyMarkup?: unknown;
  proxyUrl?: string;
}) {
  const response = await telegramFetch(`https://api.telegram.org/bot${params.botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: params.chatId,
      text: params.text,
      parse_mode: params.parseMode,
      reply_markup: params.replyMarkup,
      disable_web_page_preview: true,
    }),
    proxyUrl: params.proxyUrl,
  });

  const body = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(`Telegram sendMessage failed: ${response.status} ${body}`);
  }

  return JSON.parse(body) as { ok: true; result: { message_id: number } };
}

export async function answerTelegramCallbackQuery(params: {
  botToken: string;
  callbackQueryId: string;
  text: string;
  showAlert?: boolean;
  proxyUrl?: string;
}) {
  const response = await telegramFetch(`https://api.telegram.org/bot${params.botToken}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: params.callbackQueryId,
      text: params.text,
      show_alert: params.showAlert ?? false,
    }),
    proxyUrl: params.proxyUrl,
  });

  const body = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(`Telegram answerCallbackQuery failed: ${response.status} ${body}`);
  }

  return JSON.parse(body) as { ok: true; result: true };
}

export async function sendTelegramBroadcast(params: {
  botToken: string;
  recipients: TelegramRecipient[];
  text: string;
  parseMode?: "HTML";
  replyMarkup?: unknown;
  proxyUrl?: string;
}) {
  const results = await Promise.allSettled(
    params.recipients.map((recipient) =>
      sendTelegramMessage({
        botToken: params.botToken,
        chatId: recipient.chatId,
        text: params.text,
        parseMode: params.parseMode,
        replyMarkup: params.replyMarkup,
        proxyUrl: params.proxyUrl,
      }),
    ),
  );

  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length > 0) throw new Error(`Telegram broadcast failed for ${failed.length} recipient(s).`);

  return results.map((result, index) => ({ recipient: params.recipients[index], result }));
}

export async function pingTelegramBot(params: { botToken: string; proxyUrl?: string }) {
  const response = await telegramFetch(`https://api.telegram.org/bot${params.botToken}/getMe`, {
    method: "GET",
    proxyUrl: params.proxyUrl,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Telegram getMe failed: ${response.status} ${body}`);
  }

  return (await response.json()) as {
    ok: true;
    result: { id: number; is_bot: boolean; first_name: string; username?: string };
  };
}
