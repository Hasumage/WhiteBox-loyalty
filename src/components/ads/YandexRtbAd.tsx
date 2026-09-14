"use client";

import Script from "next/script";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type YandexRtbAdProps = {
  blockId?: string;
  pageNumber: number;
  placement: string;
  className?: string;
  type?: "feed" | "banner";
};

declare global {
  interface Window {
    yaContextCb?: Array<() => void>;
    Ya?: {
      Context?: {
        AdvManager?: {
          render?: (options: { blockId: string; renderTo: string; async?: boolean; pageNumber?: number; type?: "feed" }) => void;
        };
      };
    };
  }
}

function isRtbEnabled(blockId?: string) {
  return Boolean(blockId?.trim()) && process.env.NEXT_PUBLIC_YANDEX_RSYA_ENABLED === "true";
}

function safeIdPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function shouldKeepFallbackVisible() {
  if (process.env.NODE_ENV !== "production") return true;
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

function shouldSkipRtbRuntime() {
  if (process.env.NEXT_PUBLIC_YANDEX_RSYA_RUN_LOCAL === "true") return false;
  if (process.env.NODE_ENV !== "production") return true;
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

export function YandexRtbAd({ blockId, pageNumber, placement, className, type = "feed" }: YandexRtbAdProps) {
  const enabled = isRtbEnabled(blockId);
  const skipRuntime = shouldSkipRtbRuntime();
  const [hidden, setHidden] = useState(false);
  const renderTo = useMemo(
    () => `yandex_rtb_${safeIdPart(placement)}_${safeIdPart(blockId ?? "disabled")}_${pageNumber}`,
    [blockId, pageNumber, placement],
  );

  useEffect(() => {
    if (!enabled || !blockId || skipRuntime) return;
    setHidden(false);
    const target = document.getElementById(renderTo);
    if (!target) return;
    let mounted = true;
    let settled = false;
    const hasRenderedAd = () => target.children.length > 0 || target.textContent?.trim();
    const markRendered = () => {
      if (hasRenderedAd()) settled = true;
    };
    const observer = new MutationObserver(markRendered);
    observer.observe(target, { childList: true, subtree: true, characterData: true });
    const fallbackTimer = window.setTimeout(() => {
      if (!settled && !hasRenderedAd() && !shouldKeepFallbackVisible()) setHidden(true);
      observer.disconnect();
    }, 4200);

    const render = () => {
      if (!mounted || !document.getElementById(renderTo)) return;
      const renderOptions: { blockId: string; renderTo: string; async: boolean; pageNumber: number; type?: "feed" } = {
        blockId,
        renderTo,
        async: true,
        pageNumber,
      };
      if (type === "feed") renderOptions.type = "feed";
      window.Ya?.Context?.AdvManager?.render?.(renderOptions);
    };

    target.innerHTML = "";
    if (window.Ya?.Context?.AdvManager?.render) {
      render();
    } else {
      window.yaContextCb = window.yaContextCb || [];
      window.yaContextCb.push(render);
    }

    return () => {
      mounted = false;
      window.clearTimeout(fallbackTimer);
      observer.disconnect();
    };
  }, [blockId, enabled, pageNumber, renderTo, skipRuntime, type]);

  if (!enabled || hidden) return null;

  return (
    <aside className={cn("min-w-0 max-w-full rounded-3xl border border-cyan-200/12 bg-white/[0.025] p-3", className)} aria-label="Реклама">
      <div className="mb-2 flex items-center justify-between px-1 text-[10px] uppercase tracking-[0.18em] text-white/34">
        <span>Реклама</span>
        <span>РСЯ</span>
      </div>
      {!skipRuntime && <Script id="nearloy-yandex-rsya" src="https://yandex.ru/ads/system/context.js" strategy="afterInteractive" async />}
      <div className="w-full min-w-0 max-w-full rounded-2xl" style={{ maxHeight: 300, overflow: "clip" }}>
        <div id={renderTo} className="min-h-[96px]" />
      </div>
    </aside>
  );
}
