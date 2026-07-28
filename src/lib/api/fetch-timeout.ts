export const DEFAULT_API_TIMEOUT_MS = 12_000;
export const SESSION_RESTORE_TIMEOUT_MS = 8_000;
export const CLIENT_BOOTSTRAP_TIMEOUT_MS = 10_000;

function createTimeoutError() {
  const error = new Error("Request timed out");
  error.name = "TimeoutError";
  return error;
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_API_TIMEOUT_MS,
) {
  if (init.signal?.aborted) {
    const error = new Error("Request aborted");
    error.name = "AbortError";
    throw error;
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const abortFromCaller = () => controller.abort();
  init.signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) throw createTimeoutError();
    throw error;
  } finally {
    clearTimeout(timeoutId);
    init.signal?.removeEventListener("abort", abortFromCaller);
  }
}

export async function promiseWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs = DEFAULT_API_TIMEOUT_MS,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(createTimeoutError()), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
