export type TwaCacheReadResult<T> = {
  data: T;
  hit: boolean;
  expired: boolean;
  storedAt: number | null;
};

const CACHE_PREFIX = "wb:twa-cache:v7:";
const CACHE_MARKER_COOKIE = "wb_twa_cache_touch";
const DEFAULT_TTL_MS = 2 * 60 * 1000;
const DEFAULT_STALE_MS = 15 * 60 * 1000;

type CacheEnvelope<T> = {
  storedAt: number;
  expiresAt: number;
  data: T;
};

function safeNow() {
  return Date.now();
}

function userScope() {
  if (typeof window === "undefined") return "server";
  try {
    const raw = window.localStorage.getItem("wb_user");
    if (!raw) return "anonymous";
    const parsed = JSON.parse(raw) as { id?: string; email?: string };
    return parsed.id || parsed.email || "anonymous";
  } catch {
    return "anonymous";
  }
}

function storageKey(key: string) {
  return `${CACHE_PREFIX}${userScope()}:${key}`;
}

function touchCacheCookie() {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CACHE_MARKER_COOKIE}=${safeNow()}; Path=/; Max-Age=${60 * 60}; SameSite=Lax${secure}`;
}

export function readTwaCache<T>(key: string, fallback: T, staleMs = DEFAULT_STALE_MS): TwaCacheReadResult<T> {
  if (typeof window === "undefined") {
    return { data: fallback, hit: false, expired: true, storedAt: null };
  }

  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (!raw) return { data: fallback, hit: false, expired: true, storedAt: null };

    const envelope = JSON.parse(raw) as CacheEnvelope<T>;
    const now = safeNow();
    const tooOld = now - envelope.storedAt > staleMs;
    if (tooOld) {
      window.localStorage.removeItem(storageKey(key));
      return { data: fallback, hit: false, expired: true, storedAt: null };
    }

    return {
      data: envelope.data,
      hit: true,
      expired: now > envelope.expiresAt,
      storedAt: envelope.storedAt,
    };
  } catch {
    return { data: fallback, hit: false, expired: true, storedAt: null };
  }
}

export function writeTwaCache<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS) {
  if (typeof window === "undefined") return;
  try {
    const storedAt = safeNow();
    const envelope: CacheEnvelope<T> = {
      storedAt,
      expiresAt: storedAt + ttlMs,
      data,
    };
    window.localStorage.setItem(storageKey(key), JSON.stringify(envelope));
    touchCacheCookie();
  } catch {
    // Browser storage can be unavailable or full. In that case the API fallback still works.
  }
}

export function clearTwaCache() {
  if (typeof window === "undefined") return;
  try {
    const prefix = `${CACHE_PREFIX}${userScope()}:`;
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(prefix)) window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore cache cleanup failures; mutations still complete on the API side.
  }
}

export function getTwaCacheAgeMs(key: string) {
  const snapshot = readTwaCache(key, null, Number.MAX_SAFE_INTEGER);
  return snapshot.storedAt ? safeNow() - snapshot.storedAt : null;
}
