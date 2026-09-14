"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, RefreshCw, Settings, Shield, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getHuntLeaderboard,
  type HuntLeaderboard,
} from "@/lib/api/twa-client";
import { cn } from "@/lib/utils";
import { huntInteractiveClass } from "../_components/hunt-ui";

function formatReset(resetsAt: string | null) {
  if (!resetsAt) return "Сезон обновляется каждые 60 дней";
  const ms = new Date(resetsAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "Сезон скоро обновится";
  const days = Math.ceil(ms / 86400000);
  return `Сброс через ${days} д.`;
}

export default function HuntLeaderboardPage() {
  const [data, setData] = useState<HuntLeaderboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const top = useMemo(() => data?.players.slice(0, 3) ?? [], [data]);
  const rest = useMemo(() => data?.players.slice(3) ?? [], [data]);

  async function load() {
    setNotice(null);
    const result = await getHuntLeaderboard();
    if (result.ok) setData(result.data);
    else setNotice("Не удалось загрузить лидерборд.");
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="min-h-full px-4 pb-24 pt-5 text-white">
      <header className="mb-4 flex items-center justify-between gap-3">
        <Link
          href="/hunt"
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]",
            huntInteractiveClass,
          )}
          aria-label="Назад"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Button
          type="button"
          onClick={() => void load()}
          variant="ghost"
          className={cn(
            "h-11 rounded-full border border-white/10 bg-white/[0.04] px-4",
            huntInteractiveClass,
          )}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Обновить
        </Button>
      </header>

      <section className="mb-4 overflow-hidden rounded-3xl border border-cyan-200/20 bg-[radial-gradient(circle_at_50%_0%,rgba(154,240,255,0.24),rgba(10,17,30,0.92)_48%,rgba(3,7,18,0.98))] p-5 shadow-[0_0_48px_rgba(103,232,249,0.12)]">
        <div className="flex items-center gap-4">
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
            <Image
              src="/hunt-assets/ui/nearloy-cup.png"
              width={80}
              height={80}
              alt=""
              priority
            />
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/74">
              Hunt сезон
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Кубки Nearloy</h1>
            <p className="mt-1 text-sm text-white/58">
              {formatReset(data?.resetsAt ?? null)}
            </p>
          </div>
        </div>
      </section>

      {notice && (
        <div className="mb-4 rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-50">
          {notice}
        </div>
      )}

      {data?.currentUser.profileVisibility === "PRIVATE" && (
        <section className="mb-4 rounded-3xl border border-amber-200/24 bg-amber-200/10 p-4 text-amber-50 shadow-[0_0_34px_rgba(251,191,36,0.08)]">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold">Профиль скрыт</h2>
              <p className="mt-1 text-sm leading-5 text-amber-50/78">
                Сейчас ты не участвуешь в Hunt-рейтинге. Перейди по этой кнопке в настройки и измени видимость профиля на public, чтобы попасть в рейтинг.
              </p>
              <Link
                href="/settings/account"
                className={cn(
                  "mt-3 inline-flex h-10 items-center gap-2 rounded-2xl border border-amber-100/24 bg-amber-100/12 px-3 text-sm font-semibold text-amber-50",
                  huntInteractiveClass,
                )}
              >
                <Settings className="h-4 w-4" />
                Открыть настройки
              </Link>
            </div>
          </div>
        </section>
      )}

      {loading ? (
        <div className="flex min-h-56 items-center justify-center text-cyan-100">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3">
          {top.length > 0 && (
            <section className="grid gap-2">
              {top.map((player) => (
                <article
                  key={player.userUuid}
                  className="rounded-3xl border border-cyan-200/22 bg-cyan-200/[0.08] p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-200/20 bg-slate-950 text-lg font-black text-cyan-50">
                      #{player.rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-base font-semibold">
                        {player.name}
                      </h2>
                      <p className="text-xs text-white/48">
                        Ур. {player.level} · карт {player.cardsOwnedCount}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 rounded-full border border-cyan-200/16 bg-slate-950/72 px-3 py-2 text-sm font-black text-cyan-50">
                      <Image
                        src="/hunt-assets/ui/nearloy-cup.png"
                        width={18}
                        height={18}
                        alt=""
                      />
                      {player.huntTrophies}
                    </span>
                  </div>
                </article>
              ))}
            </section>
          )}

          <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
            {rest.length === 0 && top.length === 0 ? (
              <div className="p-5 text-center text-sm text-white/54">
                Лидерборд пока пуст.
              </div>
            ) : (
              rest.map((player) => (
                <article
                  key={player.userUuid}
                  className="flex items-center gap-3 border-b border-white/8 px-4 py-3 last:border-b-0"
                >
                  <span className="w-8 text-sm font-black text-white/48">
                    #{player.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {player.name}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-white/45">
                      <Shield className="h-3 w-3" />
                      Ур. {player.level}
                    </p>
                  </div>
                  <span className="flex items-center gap-1 text-sm font-black text-cyan-50">
                    <Trophy className="h-4 w-4 text-cyan-100" />
                    {player.huntTrophies}
                  </span>
                </article>
              ))
            )}
          </section>
        </div>
      )}
    </main>
  );
}
