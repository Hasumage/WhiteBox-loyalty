import {
  clearStoredSessionIfAccessToken,
  getAccessToken,
  getRefreshToken,
  refreshStoredSession,
} from "./auth-client";
import { fetchWithTimeout } from "./fetch-timeout";

export const AUTH_RECOVERY_EVENT = "nearloy:auth-recovery";

export type AuthRecoveryState = "checking" | "restored" | "failed";

export type AuthRecoveryEventDetail = {
  state: AuthRecoveryState;
};

type FetchRecoveryOptions = {
  retry?: boolean;
  redirectOnFailure?: boolean;
  emitRecoveryEvents?: boolean;
  timeoutMs?: number;
};

let recoveryPromise: Promise<boolean> | null = null;

function emitAuthRecovery(state: AuthRecoveryState) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AuthRecoveryEventDetail>(AUTH_RECOVERY_EVENT, { detail: { state } }));
}

function withFreshAuthorization(init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const token = getAccessToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else {
    headers.delete("Authorization");
  }

  return {
    ...init,
    headers,
  };
}

async function recoverSession(emitEvents = true) {
  if (recoveryPromise) return recoveryPromise;

  recoveryPromise = (async () => {
    if (emitEvents) emitAuthRecovery("checking");

    try {
      const restored = await refreshStoredSession();
      if (restored?.accessToken) {
        if (emitEvents) emitAuthRecovery("restored");
        return true;
      }
      if (emitEvents) emitAuthRecovery("failed");
      return false;
    } catch {
      if (emitEvents) emitAuthRecovery("failed");
      return false;
    } finally {
      const clearPromise = () => {
        recoveryPromise = null;
      };
      if (typeof window === "undefined") {
        clearPromise();
      } else {
        window.setTimeout(clearPromise, 0);
      }
    }
  })();

  return recoveryPromise;
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const isCapacitorApp =
    window.location.search.includes("app=capacitor") ||
    window.localStorage.getItem("nearloy:capacitor-app") === "1";
  const params = new URLSearchParams({ next: currentUrl || "/" });
  if (isCapacitorApp) params.set("app", "capacitor");
  const loginPath = isCapacitorApp ? "/mobile-login" : "/login";
  window.setTimeout(() => {
    window.location.assign(`${loginPath}?${params.toString()}`);
  }, 700);
}

export async function fetchWithAuthRecovery(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: FetchRecoveryOptions = {},
) {
  const { retry = true, redirectOnFailure = true, emitRecoveryEvents = true, timeoutMs } = options;
  const firstResponse = await fetchWithTimeout(input, withFreshAuthorization(init), timeoutMs);

  if (!retry || firstResponse.status !== 401) {
    return firstResponse;
  }

  const restored = await recoverSession(emitRecoveryEvents);
  if (!restored) {
    if (redirectOnFailure && !getRefreshToken()) redirectToLogin();
    return firstResponse;
  }

  const retryAccessToken = getAccessToken();
  const retryResponse = await fetchWithTimeout(input, withFreshAuthorization(init), timeoutMs);
  if (retryResponse.status === 401) {
    clearStoredSessionIfAccessToken(retryAccessToken);
    if (emitRecoveryEvents) emitAuthRecovery("failed");
    if (redirectOnFailure && !getRefreshToken()) redirectToLogin();
  }

  return retryResponse;
}
