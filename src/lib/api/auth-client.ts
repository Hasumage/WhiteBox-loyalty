const STORAGE_ACCESS = "wb_access_token";
const STORAGE_REFRESH = "wb_refresh_token";
const STORAGE_USER = "wb_user";
/** Same name as `src/middleware.ts` — allows Edge middleware to verify JWT */
const ACCESS_COOKIE = "wb_access_token";
const CLIENT_HOME = "/app";
const PUBLIC_AUTH_ROUTES = new Set(["/", "/landing", "/login", "/register", "/company/register"]);

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

export function authenticatedDestination(user: Pick<StoredUser, "role">, requestedNext: string | null) {
  if (ADMIN_ROLES.has(user.role)) {
    return user.role === "SUPPORT" ? "/admin/support" : "/admin";
  }
  if (user.role === "COMPANY") return "/company";
  if (requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//")) {
    const nextPath = requestedNext.split(/[?#]/, 1)[0] || "/";
    if (!PUBLIC_AUTH_ROUTES.has(nextPath)) return requestedNext;
  }
  return CLIENT_HOME;
}

function apiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
  return base.replace(/\/$/, "");
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

  const res = await fetch(`${apiBase()}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.accessToken) {
    clearStoredSession();
    return null;
  }

  setStoredSession(data as AuthTokensResponse);
  return data as AuthTokensResponse;
}

export async function register(body: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthTokensResponse | { message: string | string[] }> {
  try {
    const res = await fetch(`${apiBase()}/auth/register`, {
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
    const res = await fetch(`${apiBase()}/auth/login`, {
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
    const res = await fetch(`${apiBase()}/auth/telegram-mini-app`, {
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
  const res = await fetch(`${apiBase()}/auth/change-password`, {
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
  const res = await fetch(`${apiBase()}/auth/account/freeze`, {
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
  const res = await fetch(`${apiBase()}/auth/account/reactivate`, {
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
  const res = await fetch(`${apiBase()}/auth/email-change/confirm`, {
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
