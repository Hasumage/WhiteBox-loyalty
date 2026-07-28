"use client";

import { useEffect, useState } from "react";
import {
  getAccessToken,
  loginWithTelegramMiniApp,
  setStoredSession,
} from "@/lib/api/auth-client";

type TelegramWebApp = {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
};

type CapacitorRuntime = {
  isNativePlatform?: () => boolean;
};

declare global {
  interface Window {
    Capacitor?: CapacitorRuntime;
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

const TELEGRAM_SDK_SRC = "https://telegram.org/js/telegram-web-app.js";
const TELEGRAM_SDK_TIMEOUT_MS = 5_000;

function isCapacitorRuntime() {
  const params = new URLSearchParams(window.location.search);
  return params.get("app") === "capacitor" || window.Capacitor?.isNativePlatform?.() === true;
}

function loadTelegramWebApp() {
  const loadedWebApp = window.Telegram?.WebApp;
  if (loadedWebApp) {
    return Promise.resolve(loadedWebApp);
  }

  return new Promise<TelegramWebApp | undefined>((resolve) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-nearloy-telegram-sdk="true"]',
    );
    const script = existingScript ?? document.createElement("script");
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      resolve(window.Telegram?.WebApp);
    };

    const timeoutId = window.setTimeout(finish, TELEGRAM_SDK_TIMEOUT_MS);
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", finish, { once: true });

    if (!existingScript) {
      script.src = TELEGRAM_SDK_SRC;
      script.async = true;
      script.dataset.nearloyTelegramSdk = "true";
      document.head.appendChild(script);
    }
  });
}

function isJwtStale(token: string | null) {
  if (!token) return true;
  const [, payload] = token.split(".");
  if (!payload) return true;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = JSON.parse(window.atob(padded)) as { exp?: number };
    if (!decoded.exp) return true;
    return decoded.exp * 1000 <= Date.now() + 30_000;
  } catch {
    return true;
  }
}

export function TelegramMiniAppAuthBootstrap() {
  const [authing, setAuthing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (isCapacitorRuntime()) return;

      const webApp = await loadTelegramWebApp();
      if (cancelled || !webApp) return;

      webApp.ready?.();
      webApp.expand?.();

      const initData = webApp.initData;
      if (!initData) return;

      const existingToken = getAccessToken();
      if (!isJwtStale(existingToken)) return;

      setAuthing(true);
      const result = await loginWithTelegramMiniApp(initData);
      if (cancelled) return;

      if ("accessToken" in result && result.accessToken) {
        setStoredSession(result);
        window.dispatchEvent(new Event("nearloy:auth-updated"));
        window.location.reload();
        return;
      }

      setAuthing(false);
      // No scary UI here: unlinked users can still sign in normally.
      console.info(
        "NearLoy linked client auth skipped:",
        "message" in result ? result.message : "Unknown response",
      );
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!authing) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/80 px-6 text-center backdrop-blur-xl">
      <div className="glass max-w-xs rounded-3xl border border-cyan-200/20 p-6 shadow-[0_0_40px_rgba(103,232,249,0.12)]">
        <p className="text-lg font-semibold text-foreground">Входим в NearLoy</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Проверяем вход и открываем вашу NearLoy-сессию.
        </p>
      </div>
    </div>
  );
}
