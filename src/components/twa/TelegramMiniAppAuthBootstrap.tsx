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

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
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
    const webApp = window.Telegram?.WebApp;
    webApp?.ready?.();
    webApp?.expand?.();

    const initData = webApp?.initData;
    if (!initData) return;

    const existingToken = getAccessToken();
    if (!isJwtStale(existingToken)) return;

    let cancelled = false;
    setAuthing(true);

    void (async () => {
      const result = await loginWithTelegramMiniApp(initData);
      if (cancelled) return;

      if ("accessToken" in result && result.accessToken) {
        setStoredSession(result);
        window.dispatchEvent(new Event("whitebox:auth-updated"));
        window.location.reload();
        return;
      }

      setAuthing(false);
      // No scary UI here: unlinked Telegram users can still sign in normally.
      console.info(
        "WhiteBox Telegram Mini App auth skipped:",
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
        <p className="text-lg font-semibold text-foreground">Входим через Telegram</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Проверяем подпись Mini App и открываем вашу WhiteBox-сессию.
        </p>
      </div>
    </div>
  );
}
