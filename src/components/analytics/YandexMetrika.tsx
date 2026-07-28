"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

const DEFAULT_YANDEX_METRIKA_ID = "111014909";
const MAX_HIT_ATTEMPTS = 20;
const HIT_RETRY_DELAY_MS = 150;

const PRIVATE_PATH_PREFIXES = [
  "/admin",
  "/company/settings",
  "/company/team",
  "/company/billing",
  "/company/loyalty",
  "/company/clients",
  "/company/finance",
  "/company/ai",
  "/company/compliance",
  "/settings",
  "/scan",
  "/profile",
  "/history",
  "/subscriptions",
];

declare global {
  interface Window {
    ym?: (counterId: number, method: string, ...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

function getMetrikaId() {
  const rawId = process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID || DEFAULT_YANDEX_METRIKA_ID;
  const metrikaId = Number(rawId);

  return Number.isFinite(metrikaId) && metrikaId > 0 ? metrikaId : null;
}

function shouldTrackPath(pathname: string | null) {
  if (!pathname) {
    return false;
  }

  return !PRIVATE_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function YandexMetrika() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastHitRef = useRef<string | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const metrikaId = getMetrikaId();
  const shouldTrack = shouldTrackPath(pathname);
  const search = searchParams.toString();

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!metrikaId || !shouldTrack) {
      return;
    }

    const url = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (lastHitRef.current === url) {
      return;
    }

    let attempts = 0;

    const sendHit = () => {
      attempts += 1;

      if (typeof window.ym === "function") {
        window.ym(metrikaId, "hit", url, {
          title: document.title,
          referer: document.referrer,
        });
        lastHitRef.current = url;
        return;
      }

      if (attempts < MAX_HIT_ATTEMPTS) {
        retryTimerRef.current = window.setTimeout(sendHit, HIT_RETRY_DELAY_MS);
      }
    };

    sendHit();
  }, [metrikaId, pathname, search, shouldTrack]);

  if (!metrikaId || !shouldTrack) {
    return null;
  }

  return (
    <>
      <Script
        id="nearloy-yandex-metrika"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            (function(m,e,t,r,i,k,a){
              m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
              m[i].l=1*new Date();
              for (var j = 0; j < document.scripts.length; j++) { if (document.scripts[j].src === r) { return; } }
              k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a);
            })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js?id=${metrikaId}', 'ym');

            ym(${metrikaId}, 'init', {
              ssr: true,
              defer: true,
              webvisor: true,
              clickmap: true,
              ecommerce: 'dataLayer',
              accurateTrackBounce: true,
              trackLinks: true
            });
          `,
        }}
      />
      <noscript>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://mc.yandex.ru/watch/${metrikaId}`} style={{ position: "absolute", left: "-9999px" }} alt="" />
        </div>
      </noscript>
    </>
  );
}
