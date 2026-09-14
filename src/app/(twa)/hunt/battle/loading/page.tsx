"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Radar, Sparkles, UsersRound } from "lucide-react";
import { YandexRtbAd } from "@/components/ads/YandexRtbAd";
import { readHuntBattleMatch } from "@/lib/api/twa-client";

const STORAGE_KEY = "nearloy-hunt-battle-state";
const MIN_VISIBLE_MS = 900;
const LOADING_AD_BLOCK_ID =
  process.env.NEXT_PUBLIC_YANDEX_RSYA_HUNT_BANNER_BLOCK_ID ||
  process.env.NEXT_PUBLIC_YANDEX_RSYA_HUNT_SHOP_BANNER_BLOCK_ID;

type StoredBattleState = {
  mode?: string;
  matchId?: string | null;
  savedAt?: string;
};

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

export default function HuntBattleLoadingPage() {
  const router = useRouter();
  const startedAt = useRef(Date.now());
  const [matchId, setMatchId] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const stage = useMemo(() => {
    if (seconds < 4) return "Проверяем силу отряда";
    if (seconds < 12) return "Ищем равного соперника";
    if (seconds < 22) return "Расширяем диапазон подбора";
    return "Подготавливаем арену";
  }, [seconds]);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const stored = raw
      ? (() => {
          try {
            return JSON.parse(raw) as StoredBattleState;
          } catch {
            return null;
          }
        })()
      : null;
    if (!stored?.matchId || stored.mode !== "random") {
      router.replace("/hunt/battle");
      return;
    }
    setMatchId(stored.matchId);
  }, [router]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!matchId) return;
    let active = true;
    let redirecting = false;
    const poll = async () => {
      const result = await readHuntBattleMatch(matchId);
      if (!active || redirecting) return;
      if (!result.ok) {
        setNotice("Матч не найден или устарел. Вернитесь в лобби и начните поиск заново.");
        return;
      }
      if (result.data.status === "ACTIVE" || result.data.status === "FINISHED") {
        redirecting = true;
        const delay = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt.current));
        window.setTimeout(() => {
          if (active) router.replace("/hunt/battle/arena");
        }, delay);
      }
    };
    void poll();
    const timer = window.setInterval(poll, 1250);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [matchId, router]);

  return (
    <main className="flex h-dvh max-h-dvh flex-col overflow-hidden px-4 pb-[104px] pt-3 text-white">
      <div className="mb-3 shrink-0 rounded-3xl border border-cyan-200/16 bg-white/[0.045] px-4 py-3 shadow-[0_16px_34px_rgba(0,0,0,0.24)] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 text-sm text-white/72">
            <Radar className="h-4 w-4 shrink-0 text-cyan-100" />
            <span className="truncate">{stage}</span>
          </span>
          <b className="shrink-0 font-mono text-xl text-cyan-50">
            {formatTime(seconds)}
          </b>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#9af0ff,#8b5cf6,#ff79c6)] transition-[width] duration-300"
            style={{ width: `${Math.min(100, (seconds / 30) * 100)}%` }}
          />
        </div>
      </div>

      <section className="relative grid min-h-[300px] flex-1 overflow-hidden rounded-[28px] border border-cyan-200/18 bg-[radial-gradient(circle_at_50%_22%,rgba(154,240,255,0.13),rgba(12,18,32,0.94)_42%,rgba(3,7,18,0.98))] px-5 py-4 shadow-[0_0_52px_rgba(103,232,249,0.11)]">
        <div className="pointer-events-none absolute inset-0 opacity-45">
          <span className="absolute left-8 top-14 h-20 w-20 rounded-full border border-cyan-200/12" />
          <span className="absolute bottom-16 right-6 h-28 w-28 rounded-full border border-fuchsia-300/10" />
          <span className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/8" />
        </div>

        <div className="pointer-events-none absolute left-1/2 top-[63%] flex h-72 w-72 -translate-x-1/2 -translate-y-1/2 items-center justify-center opacity-78">
          <div className="absolute inset-0 rounded-full border border-cyan-100/10" />
          <div className="absolute inset-4 animate-[hunt-search-spin_7s_linear_infinite] rounded-full border border-dashed border-cyan-100/18" />
          <div className="absolute inset-11 animate-[hunt-search-spin_4.8s_linear_infinite_reverse] rounded-full border border-dashed border-fuchsia-200/14" />
          <div className="hunt-search-orbit absolute inset-7">
            <span className="hunt-search-satellite hunt-search-satellite-user">
              <UsersRound className="h-5 w-5 text-cyan-100" />
            </span>
            <span className="hunt-search-satellite hunt-search-satellite-hunt">
              <Sparkles className="h-5 w-5 text-fuchsia-100" />
            </span>
          </div>
          <div className="relative flex h-40 w-40 items-center justify-center">
            <Image
              src="/hunt-assets/ui/nearloy-cup.png"
              width={160}
              height={160}
              alt=""
              priority
            />
          </div>
        </div>

        <div className="relative z-10 self-start pt-8 text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/72">
            Случайный бой
          </p>
          <h1 className="mt-2 text-3xl font-semibold drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)]">
            Ищем соперника
          </h1>
          <p className="mx-auto mt-3 max-w-[280px] text-sm leading-6 text-white/68 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
            Подбираем игрока близкого уровня и готовим матч.
          </p>
        </div>

        {notice && (
          <div className="relative z-10 self-end rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-50">
            {notice}
          </div>
        )}
      </section>

      <div className="mt-2 max-h-[118px] shrink-0 overflow-hidden rounded-3xl">
        <YandexRtbAd
          blockId={LOADING_AD_BLOCK_ID}
          pageNumber={1}
          placement="hunt-battle-loading"
          type="banner"
          className="max-h-[118px] overflow-hidden rounded-3xl p-2"
        />
      </div>

      <style jsx global>{`
        @keyframes hunt-search-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes hunt-search-pulse {
          0%, 100% { transform: scale(1); opacity: 0.78; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        .hunt-search-orbit {
          animation: hunt-search-spin 9s linear infinite;
          transform-origin: center;
        }
        .hunt-search-satellite {
          position: absolute;
          display: flex;
          width: 48px;
          height: 48px;
          align-items: center;
          justify-content: center;
          border-radius: 18px;
          border: 1px solid rgba(154, 240, 255, 0.18);
          background:
            linear-gradient(145deg, rgba(154, 240, 255, 0.15), rgba(139, 92, 246, 0.11)),
            rgba(5, 12, 24, 0.64);
          box-shadow:
            0 12px 28px rgba(0, 0, 0, 0.28),
            0 0 24px rgba(103, 232, 249, 0.12);
          backdrop-filter: blur(10px);
        }
        .hunt-search-satellite svg {
          animation: hunt-search-pulse 1.9s ease-in-out infinite;
        }
        .hunt-search-satellite-user {
          left: 0;
          top: 58%;
          animation: hunt-search-counter-spin 9s linear infinite;
        }
        .hunt-search-satellite-hunt {
          right: 4px;
          top: 22%;
          border-color: rgba(244, 114, 182, 0.2);
          animation: hunt-search-counter-spin 9s linear infinite, hunt-search-breathe 2.2s ease-in-out infinite;
          box-shadow:
            0 12px 28px rgba(0, 0, 0, 0.28),
            0 0 26px rgba(244, 114, 182, 0.12);
        }
        .hunt-search-satellite-user {
          animation: hunt-search-counter-spin 9s linear infinite, hunt-search-breathe 1.9s ease-in-out infinite;
        }
        @keyframes hunt-search-counter-spin {
          from { rotate: 0deg; }
          to { rotate: -360deg; }
        }
        @keyframes hunt-search-breathe {
          0%, 100% {
            scale: 1;
            opacity: 0.78;
          }
          50% {
            scale: 1.08;
            opacity: 1;
          }
        }
      `}</style>
    </main>
  );
}
