import "dotenv/config";

const MOSCOW_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_REPORT_TIME = "23:00";
const DEFAULT_REQUEST_TIMEOUT_MS = 45_000;

const args = new Set(process.argv.slice(2));
const runOnce = args.has("--once");
const printNext = args.has("--print-next");

function envFlag(name, defaultValue = false) {
  const value = process.env[name];
  if (value == null || value === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function parseReportTime(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? DEFAULT_REPORT_TIME);
  if (!match) return { hours: 23, minutes: 0 };

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return { hours: 23, minutes: 0 };
  }

  return { hours, minutes };
}

function nextMoscowRunAt(now = new Date()) {
  const { hours, minutes } = parseReportTime(process.env.DAILY_REPORT_TIME_MSK);
  const nowInMoscow = new Date(now.getTime() + MOSCOW_UTC_OFFSET_MS);
  const year = nowInMoscow.getUTCFullYear();
  const month = nowInMoscow.getUTCMonth();
  const day = nowInMoscow.getUTCDate();
  let targetMs = Date.UTC(year, month, day, hours - 3, minutes, 0, 0);

  if (targetMs <= now.getTime()) {
    targetMs += DAY_MS;
  }

  return new Date(targetMs);
}

function formatMoscow(date) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Moscow",
  }).format(date);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBaseUrl() {
  const explicit = process.env.DAILY_REPORT_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const port = process.env.DAILY_REPORT_PORT || process.env.PORT;
  if (port) return `http://127.0.0.1:${port}`;

  const origin = process.env.FRONTEND_ORIGIN?.split(",")[0]?.trim();
  if (origin) return origin.replace(/\/+$/, "");

  return "http://127.0.0.1:3000";
}

async function postDailyReport() {
  const secret = process.env.DAILY_REPORT_SECRET;
  if (!secret) {
    throw new Error("DAILY_REPORT_SECRET is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Number(process.env.DAILY_REPORT_REQUEST_TIMEOUT_MS || DEFAULT_REQUEST_TIMEOUT_MS),
  );

  try {
    const response = await fetch(`${getBaseUrl()}/api/admin/reports/daily`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-daily-report-secret": secret,
      },
      body: JSON.stringify({ trigger: "daily-report-scheduler" }),
      signal: controller.signal,
    });
    const rawBody = await response.text();
    let body = null;
    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        body = null;
      }
    }

    if (!response.ok) {
      const details = body?.errors?.join("; ") || body?.message || rawBody || response.statusText;
      throw new Error(`HTTP ${response.status}: ${details}`);
    }

    return body;
  } finally {
    clearTimeout(timeout);
  }
}

async function sendWithRetry() {
  const attempts = Math.max(1, Number(process.env.DAILY_REPORT_RETRY_ATTEMPTS || 3));
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await postDailyReport();
      console.log(
        `[daily-report] Sent ${result.sent}/${result.recipients} Telegram report(s) for ${formatMoscow(new Date())}.`,
      );
      return result;
    } catch (error) {
      lastError = error;
      console.error(`[daily-report] Attempt ${attempt}/${attempts} failed: ${error.message}`);
      if (attempt < attempts) {
        await sleep(Math.min(attempt * 60_000, 5 * 60_000));
      }
    }
  }

  throw lastError;
}

async function loop() {
  if (envFlag("DAILY_REPORT_RUN_ON_START")) {
    await sendWithRetry();
  }

  while (true) {
    const nextRun = nextMoscowRunAt();
    const delay = Math.max(0, nextRun.getTime() - Date.now());
    console.log(`[daily-report] Next Telegram report at ${formatMoscow(nextRun)}.`);
    await sleep(delay);
    await sendWithRetry();
    await sleep(1_000);
  }
}

if (printNext) {
  console.log(formatMoscow(nextMoscowRunAt()));
  process.exit(0);
}

if (process.env.DAILY_REPORT_SCHEDULER_ENABLED === "false" && !runOnce) {
  console.log("[daily-report] Scheduler disabled by DAILY_REPORT_SCHEDULER_ENABLED=false.");
  process.exit(0);
}

if (runOnce) {
  await sendWithRetry();
} else {
  await loop();
}
