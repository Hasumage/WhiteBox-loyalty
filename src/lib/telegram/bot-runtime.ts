export type TelegramBotMode = "dev" | "prod";

export type TelegramBotRuntime = {
  mode: TelegramBotMode;
  token: string | undefined;
  username: string;
  webAppBase: string | undefined;
  source: "telegram-webhook" | "telegram-webhook-dev";
};

function explicitMode(value?: string | null): TelegramBotMode | null {
  if (value === "dev") return "dev";
  if (value === "prod") return "prod";
  return null;
}

export function resolveTelegramBotMode(mode?: TelegramBotMode | null): TelegramBotMode {
  if (mode) return mode;
  const localMode = explicitMode(process.env.TELEGRAM_LOCAL_BOT);
  if (localMode) return localMode;
  return process.env.NODE_ENV === "production" ? "prod" : "dev";
}

export function resolveTelegramBotRuntime(mode?: TelegramBotMode | null): TelegramBotRuntime {
  const resolvedMode = resolveTelegramBotMode(mode);
  const isProduction = process.env.NODE_ENV === "production";

  if (resolvedMode === "dev") {
    return {
      mode: "dev",
      token: process.env.TELEGRAM_DEV_BOT_TOKEN || (!isProduction ? process.env.TELEGRAM_BOT_TOKEN : undefined),
      username: (process.env.TELEGRAM_DEV_BOT_USERNAME || process.env.TELEGRAM_BOT_USERNAME || "nearloy_bot").replace(/^@/, ""),
      webAppBase: process.env.TELEGRAM_DEV_WEB_APP_URL || process.env.TELEGRAM_WEB_APP_URL,
      source: "telegram-webhook-dev",
    };
  }

  return {
    mode: "prod",
    token: process.env.TELEGRAM_BOT_TOKEN || (!isProduction ? process.env.TELEGRAM_DEV_BOT_TOKEN : undefined),
    username: (process.env.TELEGRAM_BOT_USERNAME || (!isProduction ? process.env.TELEGRAM_DEV_BOT_USERNAME : undefined) || "nearloy_bot").replace(/^@/, ""),
    webAppBase: process.env.TELEGRAM_WEB_APP_URL || (!isProduction ? process.env.TELEGRAM_DEV_WEB_APP_URL : undefined),
    source: "telegram-webhook",
  };
}
