"use client";

import Script from "next/script";
import { useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";

type YandexRtbAdProps = {
  blockId?: string;
  pageNumber: number;
  placement: string;
  className?: string;
};

declare global {
  interface Window {
    yaContextCb?: Array<() => void>;
    Ya?: {
      Context?: {
        AdvManager?: {
          render?: (options: { blockId: string; renderTo: string; async?: boolean; pageNumber?: number }) => void;
        };
      };
    };
  }
}

function isRtbEnabled(blockId?: string) {
  return Boolean(blockId?.trim()) && process.env.NEXT_PUBLIC_YANDEX_RSYA_ENABLED !== "false";
}

function safeIdPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

export function YandexRtbAd({ blockId, pageNumber, placement, className }: YandexRtbAdProps) {
  const enabled = isRtbEnabled(blockId);
  const renderTo = useMemo(
    () => `yandex_rtb_${safeIdPart(placement)}_${safeIdPart(blockId ?? "disabled")}_${pageNumber}`,
    [blockId, pageNumber, placement],
  );

  useEffect(() => {
    if (!enabled || !blockId) return;
    const target = document.getElementById(renderTo);
    if (!target) return;

    const render = () => {
      window.Ya?.Context?.AdvManager?.render?.({
        blockId,
        renderTo,
        async: true,
        pageNumber,
      });
    };

    target.innerHTML = "";
    if (window.Ya?.Context?.AdvManager?.render) {
      render();
      return;
    }

    window.yaContextCb = window.yaContextCb || [];
    window.yaContextCb.push(render);
  }, [blockId, enabled, pageNumber, renderTo]);

  if (!enabled) return null;

  return (
    <aside className={cn("rounded-3xl border border-cyan-200/12 bg-white/[0.025] p-3", className)} aria-label="Реклама">
      <div className="mb-2 flex items-center justify-between px-1 text-[10px] uppercase tracking-[0.18em] text-white/34">
        <span>Реклама</span>
        <span>РСЯ</span>
      </div>
      <Script id="nearloy-yandex-rsya" src="https://yandex.ru/ads/system/context.js" strategy="afterInteractive" async />
      <div id={renderTo} className="min-h-[96px] overflow-hidden rounded-2xl" />
    </aside>
  );
}
