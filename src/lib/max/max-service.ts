import { Agent, fetch as undiciFetch } from "undici";

export type MaxMessageAttachment = {
  type: string;
  payload: unknown;
};

type MaxSendMessageParams = {
  userId?: string | number | bigint | null;
  chatId?: string | number | bigint | null;
  text: string;
  attachments?: MaxMessageAttachment[];
};

const MAX_API_BASE = "https://platform-api2.max.ru";
const insecureMaxTlsAgent = new Agent({ connect: { rejectUnauthorized: false } });

function maxApiBase() {
  return (process.env.MAX_API_BASE_URL || MAX_API_BASE).replace(/\/$/, "");
}

function maxBotToken() {
  return process.env.MAX_BOT_TOKEN?.trim() || "";
}

function targetParam(params: MaxSendMessageParams) {
  if (params.chatId !== undefined && params.chatId !== null && String(params.chatId).trim()) {
    return { key: "chat_id", value: String(params.chatId) };
  }
  if (params.userId !== undefined && params.userId !== null && String(params.userId).trim()) {
    return { key: "user_id", value: String(params.userId) };
  }
  return null;
}

export async function sendMaxMessage(params: MaxSendMessageParams) {
  const token = maxBotToken();
  if (!token) throw new Error("MAX_BOT_TOKEN is not configured.");

  const target = targetParam(params);
  if (!target) throw new Error("MAX message target is missing.");

  const url = new URL(`${maxApiBase()}/messages`);
  url.searchParams.set(target.key, target.value);

  const init = {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: params.text,
      ...(params.attachments?.length ? { attachments: params.attachments } : {}),
    }),
  };
  const response = process.env.MAX_TLS_REJECT_UNAUTHORIZED === "false"
    ? await undiciFetch(url, { ...init, dispatcher: insecureMaxTlsAgent })
    : await fetch(url, init);
  const body = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(`MAX sendMessage failed: ${response.status} ${body}`);
  }
  return body ? JSON.parse(body) : { ok: true };
}
