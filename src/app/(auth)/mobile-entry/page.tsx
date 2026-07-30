"use client";

import { useEffect } from "react";
import { TwaLoadingScreen } from "@/components/twa/TwaLoadingScreen";
import {
  authenticatedDestination,
  getRefreshToken,
  refreshStoredSession,
} from "@/lib/api/auth-client";
import { SESSION_RESTORE_TIMEOUT_MS } from "@/lib/api/fetch-timeout";

const DEFAULT_NEXT = "/app?app=capacitor";
const MOBILE_LANGUAGE_SELECTED_KEY = "nearloy:mobile-language-selected";

function readSafeNext() {
  if (typeof window === "undefined") return DEFAULT_NEXT;
  const requestedNext = new URLSearchParams(window.location.search).get("next");
  return requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : DEFAULT_NEXT;
}

function mobileLoginHref(next: string) {
  const params = new URLSearchParams({ app: "capacitor", next });
  return `/mobile-login?${params.toString()}`;
}

function mobileLanguageHref(next: string) {
  const params = new URLSearchParams({ app: "capacitor", next });
  return `/mobile-language?${params.toString()}`;
}

function withCapacitorFlag(href: string) {
  const [pathWithSearch, hash = ""] = href.split("#", 2);
  const [path, search = ""] = pathWithSearch.split("?", 2);
  const params = new URLSearchParams(search);
  params.set("app", "capacitor");
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}

export default function MobileEntryPage() {
  useEffect(() => {
    let cancelled = false;
    const next = readSafeNext();

    const replaceHard = (href: string) => {
      if (!cancelled) window.location.replace(href);
    };

    const goToLogin = () => {
      replaceHard(mobileLoginHref(next));
    };

    try {
      window.localStorage.setItem("nearloy:capacitor-app", "1");
      if (!window.localStorage.getItem(MOBILE_LANGUAGE_SELECTED_KEY)) {
        replaceHard(mobileLanguageHref(next));
        return () => {
          cancelled = true;
        };
      }
    } catch {
      // Native WebView can deny storage in edge cases; routing still works.
    }

    if (!getRefreshToken()) {
      goToLogin();
      return () => {
        cancelled = true;
      };
    }

    const timeoutId = window.setTimeout(goToLogin, SESSION_RESTORE_TIMEOUT_MS + 1500);

    void refreshStoredSession()
      .then((data) => {
        if (cancelled) return;
        window.clearTimeout(timeoutId);

        if (data?.accessToken) {
          window.dispatchEvent(new Event("nearloy:auth-updated"));
          replaceHard(withCapacitorFlag(authenticatedDestination(data.user, next)));
          return;
        }

        goToLogin();
      })
      .catch(goToLogin);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  return <TwaLoadingScreen title="Готовим вход" subtitle="Проверяем сохранённую сессию NearLoy." />;
}
