import { fetchWithTimeout, SESSION_RESTORE_TIMEOUT_MS } from "./fetch-timeout";

const STORAGE_ACCESS = "wb_access_token";
const STORAGE_REFRESH = "wb_refresh_token";
const STORAGE_USER = "wb_user";
/** Same name as `src/middleware.ts` — allows Edge middleware to verify JWT */
const ACCESS_COOKIE = "wb_access_token";
const EMAIL_GUARD_STORAGE = "wb_email_guard_id";
const CLIENT_HOME = "/app";
const PUBLIC_AUTH_ROUTES = new Set([
  "/",
  "/landing",
  "/login",
  "/register",
  "/forgot-password",
  "/oauth/vkid/complete",
  "/mobile-entry",
  "/mobile-login",
  "/mobile-register",
  "/mobile-forgot-password",
  "/company/register",
]);

function setAccessCookie(accessToken: string) {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 7;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${ACCESS_COOKIE}=${encodeURIComponent(accessToken)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

function clearAccessCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${ACCESS_COOKIE}=; Path=/; Max-Age=0`;
}

export type StoredUser = {
  id: string;
  legacyId?: number;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  accountStatus?: "ACTIVE" | "FROZEN_PENDING_DELETION";
  deletionScheduledAt?: string | null;
};

/** Read cached user from localStorage (client only). */
export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export type AuthTokensResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: string;
  needsCategoryOnboarding?: boolean;
  user: StoredUser;
};

const ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN", "MANAGER", "SUPPORT"]);
const CLIENT_APP_ROLES = new Set(["CLIENT", "ADMIN", "SUPER_ADMIN", "MANAGER"]);

function safeRequestedNext(requestedNext: string | null) {
  if (requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//")) {
    const nextPath = requestedNext.split(/[?#]/, 1)[0] || "/";
    if (!PUBLIC_AUTH_ROUTES.has(nextPath)) return requestedNext;
  }
  return null;
}

export function authenticatedDestination(
  user: Pick<StoredUser, "role">,
  requestedNext: string | null,
  options: { preferClientApp?: boolean } = {},
) {
  const safeNext = safeRequestedNext(requestedNext);
  if (options.preferClientApp && safeNext && CLIENT_APP_ROLES.has(user.role)) {
    return safeNext;
  }
  if (ADMIN_ROLES.has(user.role)) {
    return user.role === "SUPPORT" ? "/admin/support" : "/admin";
  }
  if (user.role === "COMPANY") return "/company";
  if (safeNext) return safeNext;
  return CLIENT_HOME;
}

function apiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined") return "/backend-api";
  return "http://localhost:3001/api";
}

function createEmailGuardId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `guard-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function getEmailGuardId() {
  if (typeof window === "undefined") return createEmailGuardId();
  const existing = localStorage.getItem(EMAIL_GUARD_STORAGE);
  if (existing) return existing;
  const next = createEmailGuardId();
  localStorage.setItem(EMAIL_GUARD_STORAGE, next);
  return next;
}

function emailRequestHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-NearLoy-Email-Guard": getEmailGuardId(),
  };
}

export function setStoredSession(data: AuthTokensResponse) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_ACCESS, data.accessToken);
  localStorage.setItem(STORAGE_REFRESH, data.refreshToken);
  localStorage.setItem(STORAGE_USER, JSON.stringify(data.user));
  setAccessCookie(data.accessToken);
}

export function clearStoredSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_ACCESS);
  localStorage.removeItem(STORAGE_REFRESH);
  localStorage.removeItem(STORAGE_USER);
  clearAccessCookie();
}

export function clearStoredSessionIfAccessToken(expectedAccessToken: string | null) {
  if (getAccessToken() !== expectedAccessToken) return false;
  clearStoredSession();
  return true;
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_ACCESS);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_REFRESH);
}

export async function refreshStoredSession(): Promise<AuthTokensResponse | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetchWithTimeout(
      `${apiBase()}/auth/refresh`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      },
      SESSION_RESTORE_TIMEOUT_MS,
    );
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.accessToken) {
      if ([400, 401, 403].includes(res.status) && getRefreshToken() === refreshToken) {
        clearStoredSession();
      }
      return null;
    }

    if (getRefreshToken() !== refreshToken) {
      return null;
    }

    setStoredSession(data as AuthTokensResponse);
    return data as AuthTokensResponse;
  } catch {
    return null;
  }
}

export async function register(body: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthTokensResponse | { message: string | string[] }> {
  try {
    const res = await fetchWithTimeout(`${apiBase()}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        message: data.message ?? `HTTP ${res.status}`,
      };
    }
    return data as AuthTokensResponse;
  } catch {
    return { message: "API is unavailable. Please check backend connection." };
  }
}

export async function requestRegistrationCode(body: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role?: "CLIENT" | "COMPANY" | "MANAGER";
  prManagerCareer?: boolean;
  locale?: "ru" | "en";
  termsAccepted: boolean;
}): Promise<{ success: true; email: string; expiresAt: string } | { message: string | string[] }> {
  try {
    const res = await fetchWithTimeout(`${apiBase()}/auth/register/request-code`, {
      method: "POST",
      headers: emailRequestHeaders(),
      body: JSON.stringify(body),
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        message: data.message ?? `HTTP ${res.status}`,
      };
    }
    return data as { success: true; email: string; expiresAt: string };
  } catch {
    return { message: "API is unavailable. Please check backend connection." };
  }
}

export async function requestPasswordResetCode(body: {
  email: string;
  locale?: "ru" | "en";
}): Promise<{ success: true; email: string; expiresAt: string } | { message: string | string[] }> {
  try {
    const res = await fetchWithTimeout(`${apiBase()}/auth/password-reset/request-code`, {
      method: "POST",
      headers: emailRequestHeaders(),
      body: JSON.stringify(body),
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        message: data.message ?? `HTTP ${res.status}`,
      };
    }
    return data as { success: true; email: string; expiresAt: string };
  } catch {
    return { message: "API is unavailable. Please check backend connection." };
  }
}

export async function confirmPasswordReset(body: {
  email: string;
  code: string;
  password: string;
  confirmPassword: string;
}): Promise<{ success: true } | { message: string | string[] }> {
  try {
    const res = await fetchWithTimeout(`${apiBase()}/auth/password-reset/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        message: data.message ?? `HTTP ${res.status}`,
      };
    }
    return { success: true };
  } catch {
    return { message: "API is unavailable. Please check backend connection." };
  }
}

export async function verifyRegistrationCode(body: {
  email: string;
  code: string;
}): Promise<AuthTokensResponse | { message: string | string[] }> {
  try {
    const res = await fetchWithTimeout(`${apiBase()}/auth/register/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        message: data.message ?? `HTTP ${res.status}`,
      };
    }
    return data as AuthTokensResponse;
  } catch {
    return { message: "API is unavailable. Please check backend connection." };
  }
}

export async function login(body: {
  email: string;
  password: string;
}): Promise<AuthTokensResponse | { message: string }> {
  try {
    const res = await fetchWithTimeout(`${apiBase()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        message: Array.isArray(data.message)
          ? data.message.join(", ")
          : data.message ?? `Login failed (HTTP ${res.status})`,
      };
    }
    return data as AuthTokensResponse;
  } catch {
    return { message: "API is unavailable. Please check backend connection." };
  }
}

export async function loginWithTelegramMiniApp(
  initData: string,
): Promise<AuthTokensResponse | { message: string }> {
  try {
    const res = await fetchWithTimeout(`${apiBase()}/auth/telegram-mini-app`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        message: Array.isArray(data.message)
          ? data.message.join(", ")
          : data.message ?? `Telegram login failed (HTTP ${res.status})`,
      };
    }
    return data as AuthTokensResponse;
  } catch {
    return { message: "API is unavailable. Please check backend connection." };
  }
}

export function vkIdLoginUrl(requestedNext?: string | null) {
  const params = new URLSearchParams();
  if (requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//")) {
    params.set("next", requestedNext);
  }
  const suffix = params.toString();
  return `${apiBase()}/oauth/vkid/start${suffix ? `?${suffix}` : ""}`;
}

export async function completeVkIdLogin(ticket: string): Promise<(AuthTokensResponse & { redirectAfter?: string | null }) | { message: string }> {
  try {
    const res = await fetchWithTimeout(`${apiBase()}/oauth/vkid/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket }),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        message: Array.isArray(data.message)
          ? data.message.join(", ")
          : data.message ?? `VK ID login failed (HTTP ${res.status})`,
      };
    }
    return data as AuthTokensResponse & { redirectAfter?: string | null };
  } catch {
    return { message: "API is unavailable. Please check backend connection." };
  }
}

export async function loginWithMaxMiniApp(
  initData: string,
): Promise<AuthTokensResponse | { message: string }> {
  try {
    const res = await fetchWithTimeout(`${apiBase()}/auth/max-mini-app`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        message: Array.isArray(data.message)
          ? data.message.join(", ")
          : data.message ?? `MAX login failed (HTTP ${res.status})`,
      };
    }
    return data as AuthTokensResponse;
  } catch {
    return { message: "API is unavailable. Please check backend connection." };
  }
}

async function linkMiniAppIdentity(
  path: string,
  initData: string,
): Promise<{ linked: true; provider: string } | { message: string }> {
  try {
    const res = await fetchWithTimeout(`${apiBase()}${path}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ initData }),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.linked !== true) {
      return {
        message: Array.isArray(data.message)
          ? data.message.join(", ")
          : data.message ?? `Mini-app link failed (HTTP ${res.status})`,
      };
    }
    return { linked: true, provider: String(data.provider ?? "mini-app") };
  } catch {
    return { message: "API is unavailable. Please check backend connection." };
  }
}

export function linkTelegramMiniApp(initData: string) {
  return linkMiniAppIdentity("/auth/telegram-mini-app/link", initData);
}

export function linkMaxMiniApp(initData: string) {
  return linkMiniAppIdentity("/auth/max-mini-app/link", initData);
}

export async function createVkIdLinkUrl(next?: string | null): Promise<{ url: string } | { message: string }> {
  try {
    const res = await fetchWithTimeout(`${apiBase()}/oauth/vkid/link/start`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ next }),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || typeof data.url !== "string") {
      return {
        message: Array.isArray(data.message)
          ? data.message.join(", ")
          : data.message ?? `VK ID link failed (HTTP ${res.status})`,
      };
    }
    return { url: data.url };
  } catch {
    return { message: "API is unavailable. Please check backend connection." };
  }
}

export type VkIdStatus = {
  linked: boolean;
  canUnlink: boolean;
  unlinkBlockedReason: string | null;
};

export async function getVkIdStatus(): Promise<VkIdStatus | { message: string }> {
  try {
    const res = await fetchWithTimeout(`${apiBase()}/oauth/vkid/status`, {
      method: "GET",
      headers: authHeaders(),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || typeof data.linked !== "boolean") {
      return {
        message: Array.isArray(data.message)
          ? data.message.join(", ")
          : data.message ?? `VK ID status failed (HTTP ${res.status})`,
      };
    }
    return {
      linked: data.linked,
      canUnlink: Boolean(data.canUnlink),
      unlinkBlockedReason: typeof data.unlinkBlockedReason === "string" ? data.unlinkBlockedReason : null,
    };
  } catch {
    return { message: "API is unavailable. Please check backend connection." };
  }
}

export async function unlinkVkId(): Promise<VkIdStatus | { message: string }> {
  try {
    const res = await fetchWithTimeout(`${apiBase()}/oauth/vkid/link`, {
      method: "DELETE",
      headers: authHeaders(),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || typeof data.linked !== "boolean") {
      return {
        message: Array.isArray(data.message)
          ? data.message.join(", ")
          : data.message ?? `VK ID unlink failed (HTTP ${res.status})`,
      };
    }
    return {
      linked: data.linked,
      canUnlink: Boolean(data.canUnlink),
      unlinkBlockedReason: typeof data.unlinkBlockedReason === "string" ? data.unlinkBlockedReason : null,
    };
  } catch {
    return { message: "API is unavailable. Please check backend connection." };
  }
}

function authHeaders(): HeadersInit {
  const t = getAccessToken();
  return {
    "Content-Type": "application/json",
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

export async function changePassword(body: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: true } | { error: string }> {
  const res = await fetchWithTimeout(`${apiBase()}/auth/change-password`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(data.message)
      ? data.message.join(", ")
      : data.message ?? `HTTP ${res.status}`;
    return { error: msg };
  }
  return { success: true };
}

export async function freezeAccount(): Promise<
  { success: true; deletionScheduledAt: string } | { error: string }
> {
  const res = await fetchWithTimeout(`${apiBase()}/auth/account/freeze`, {
    method: "POST",
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(data.message)
      ? data.message.join(", ")
      : data.message ?? `HTTP ${res.status}`;
    return { error: msg };
  }
  return {
    success: true,
    deletionScheduledAt: data.deletionScheduledAt as string,
  };
}

export async function reactivateAccount(): Promise<AuthTokensResponse | { message: string }> {
  const res = await fetchWithTimeout(`${apiBase()}/auth/account/reactivate`, {
    method: "POST",
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      message: Array.isArray(data.message)
        ? data.message.join(", ")
        : data.message ?? "Reactivate failed",
    };
  }
  return data as AuthTokensResponse;
}

export async function confirmEmailChangeToken(token: string) {
  const res = await fetchWithTimeout(`${apiBase()}/auth/email-change/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false as const,
      message: Array.isArray(data.message) ? data.message.join(", ") : data.message ?? "Email change failed",
    };
  }
  return {
    ok: true as const,
    data: data as { success: true; email: string; message: string },
  };
}
