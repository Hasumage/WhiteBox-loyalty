import type { AdminAiActor, AdminAiChatMessage, AdminAiPendingAction } from "@/lib/admin-ai/types";
import { requestOpenAiResponses } from "@/lib/ai/openai-responses";

export type AdminAiOpenAiContextItem = {
  moduleId: string;
  moduleDescription: string;
  intent: string;
  reply: string;
  data?: Record<string, unknown>;
  table?: {
    title: string;
    summary?: string;
    totalRows?: number;
  };
  pendingAction?: Pick<AdminAiPendingAction, "type" | "title" | "description"> | null;
};

function compactHistory(history: AdminAiChatMessage[]) {
  return history
    .slice(-10)
    .map((message) => `${message.role === "user" ? "Админ" : "AI"}: ${message.content.slice(0, 900)}`)
    .join("\n");
}

function safeJson(value: unknown) {
  return JSON.stringify(
    value,
    (_key, item) => {
      if (typeof item === "bigint") return item.toString();
      if (item instanceof Date) return item.toISOString();
      return item;
    },
    2,
  );
}

export async function askAdminAiOpenAi(params: {
  actor: AdminAiActor;
  message: string;
  history: AdminAiChatMessage[];
  context: AdminAiOpenAiContextItem[];
  imageDataUrl?: string;
}) {
  const model = process.env.OPENAI_ADMIN_ASSISTANT_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.4-nano";
  const maxOutputTokens = Math.min(
    1000,
    Math.max(260, Number(process.env.OPENAI_ADMIN_ASSISTANT_MAX_OUTPUT_TOKENS ?? 680)),
  );
  const allowed = params.actor.permissions
    .filter((permission) => permission.canView)
    .map((permission) => `${permission.scope}: view=${permission.canView}, edit=${permission.canEdit}, approve=${permission.canApprove}`)
    .join("; ");

  const toolContext = params.context.length
    ? safeJson(
        params.context.map((item) => ({
          source: item.moduleId,
          sourceDescription: item.moduleDescription,
          intent: item.intent,
          facts: item.reply,
          table: item.table ?? null,
          data: item.data ?? null,
          safeActionAvailable: item.pendingAction ?? null,
        })),
      )
    : "Нет подходящих внутренних источников. Отвечай общими словами или задай уточняющий вопрос.";

  const prompt = [
    "Ты настоящий AI-помощник админки NearLoy, подключённый к OpenAI. Ты не список заготовленных команд.",
    "Отвечай по-русски, живо, коротко и по делу. Не используй Markdown-разметку, звёздочки для жирного текста, технические переменные, JSON и названия внутренних модулей.",
    "Если пользователь просит таблицу, а ниже есть готовая таблица, кратко объясни итог и скажи, что таблица показана ниже.",
    "У тебя нет прямого доступа к БД. Ниже есть безопасные снимки из внутренних источников, уже отфильтрованные по правам текущего админа. Используй их как источник правды.",
    "Если внутренний источник уже дал готовые цифры по запросу, отвечай этими цифрами сразу. Не задавай уточняющий вопрос, если смысл запроса понятен из контекста.",
    params.imageDataUrl
      ? "К запросу приложено изображение. Рассмотри его как визуальный контекст: скриншот, фото, макет, чек или документ. Не утверждай невидимые детали; если изображение нечёткое, скажи, что именно не читается."
      : null,
    "Если фактов недостаточно — честно скажи, чего не хватает, и задай один короткий уточняющий вопрос.",
    "Не выдумывай цифры, даты, статусы, пользователей, компании, деньги и причины ошибок.",
    "Нельзя менять пароли, роли, доступы, ключи, токены, платёжные реквизиты, способы оплаты, провайдеров и критическую инфраструктуру.",
    "Безопасные действия можно только предложить на подтверждение, если они пришли в контексте как safeActionAvailable.",
    "Если пользователь просит действие, а safeActionAvailable нет — объясни, что можешь подготовить план или попросить уточнить объект.",
    "",
    `Роль админа: ${params.actor.role}. Доступы: ${allowed || "нет доступных разделов"}.`,
    "",
    "История диалога:",
    compactHistory(params.history) || "Пусто.",
    "",
    "Разрешённый контекст из внутренних источников:",
    toolContext,
    "",
    `Запрос админа: ${params.message}`,
  ].filter(Boolean).join("\n");

  const input = params.imageDataUrl
    ? [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: params.imageDataUrl, detail: "low" },
          ],
        },
      ]
    : prompt;

  const response = await requestOpenAiResponses({
    model,
    store: false,
    max_output_tokens: maxOutputTokens,
    reasoning: { effort: "none" },
    input,
  });

  if (!response) {
    throw new Error("AI transport is not configured.");
  }
  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as {
      error?: { code?: string };
      code?: string;
    } | null;
    const providerCode = errorPayload?.error?.code ?? errorPayload?.code;
    throw new Error(`AI request failed (${response.status}${providerCode ? `: ${providerCode}` : ""}).`);
  }
  const payload = (await response.json().catch(() => null)) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  } | null;
  const text =
    payload?.output_text ??
    payload?.output?.flatMap((item) => item.content ?? []).map((content) => content.text).filter(Boolean).join("\n");

  return text?.trim() || null;
}
