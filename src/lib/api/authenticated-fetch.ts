import { clearStoredSession, getAccessToken, refreshStoredSession } from "./auth-client";

export const AUTH_RECOVERY_EVENT = "nearloy:auth-recovery";

export type AuthRecoveryState = "checking" | "restored" | "failed";

export type AuthRecoveryEventDetail = {
  state: AuthRecoveryState;
};

type FetchRecoveryOptions = {
  retry?: boolean;
  redirectOnFailure?: boolean;
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

async function recoverSession() {
  if (recoveryPromise) return recoveryPromise;

  recoveryPromise = (async () => {
    emitAuthRecovery("checking");

    try {
      const restored = await refreshStoredSession();
      if (restored?.accessToken) {
        emitAuthRecovery("restored");
        return true;
      }
      clearStoredSession();
      emitAuthRecovery("failed");
      return false;
    } catch {
      clearStoredSession();
      emitAuthRecovery("failed");
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
  const next = encodeURIComponent(currentUrl || "/");
  window.setTimeout(() => {
    window.location.assign(`/login?next=${next}`);
  }, 700);
}

export async function fetchWithAuthRecovery(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: FetchRecoveryOptions = {},
) {
  const { retry = true, redirectOnFailure = true } = options;
  const firstResponse = await fetch(input, withFreshAuthorization(init));

  if (!retry || firstResponse.status !== 401) {
    return firstResponse;
  }

  const restored = await recoverSession();
  if (!restored) {
    if (redirectOnFailure) redirectToLogin();
    return firstResponse;
  }

  const retryResponse = await fetch(input, withFreshAuthorization(init));
  if (retryResponse.status === 401) {
    clearStoredSession();
    emitAuthRecovery("failed");
    if (redirectOnFailure) redirectToLogin();
  }

  return retryResponse;
}
