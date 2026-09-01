"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Boxes, Heart, RefreshCw, Sparkles, Users, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminGetHuntDashboard, type AdminHuntDashboardResponse } from "@/lib/api/admin-client";
import { cn } from "@/lib/utils";
import { HuntAdminTabs } from "./_components/hunt-admin-tabs";

function mediaSrc(url?: string | null) {
  if (!url) return "/hunt-assets/cards/compass-light.webp";
  if (url.startsWith("/hunt/cards/")) return url.replace("/hunt/cards/", "/hunt-assets/cards/");
  if (url.startsWith("/hunt/shop/")) return url.replace("/hunt/shop/", "/hunt-assets/shop/");
  return url;
}

function StatCard({ title, value, icon: Icon, tone = "cyan" }: { title: string; value: string | number; icon: typeof Users; tone?: "cyan" | "violet" | "amber" | "emerald" }) {
  const toneClass = {
    cyan: "border-cyan-200/18 bg-cyan-200/8 text-cyan-100",
    violet: "border-violet-200/18 bg-violet-200/8 text-violet-100",
    amber: "border-amber-200/18 bg-amber-200/8 text-amber-100",
    emerald: "border-emerald-200/18 bg-emerald-200/8 text-emerald-100",
  }[tone];
  return (
    <Card className="border-white/10 bg-white/[0.045]">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold">{value}</p>
        </div>
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl border", toneClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminHuntDashboardPage() {
  const [data, setData] = useState<AdminHuntDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setData(await adminGetHuntDashboard());
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const maxPosts = useMemo(() => Math.max(1, ...(data?.postsByDay.map((day) => day.posts) ?? [1])), [data]);

  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_15%_0%,rgba(103,232,249,0.18),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.075),rgba(255,255,255,0.025))] p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Badge variant="outline" className="border-cyan-200/25 bg-cyan-300/10 text-cyan-100">
              <Sparkles className="h-3.5 w-3.5" /> Nearloy Hunt
            </Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Дашборд Hunt</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Пульс игровой ветки: игроки, посты, карточки, экономика NearCoin и очередь модерации.</p>
          </div>
          <Button variant="secondary" disabled={loading} onClick={() => void load()} className="glass border-white/10">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Обновить
          </Button>
        </div>
      </section>

      <HuntAdminTabs />

      {!data && !loading && <div className="rounded-2xl border border-red-300/20 bg-red-300/10 p-4 text-sm text-red-50">Нет доступа к Hunt или API временно недоступен.</div>}

      {data && (
        <>
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard title="Игроки" value={data.summary.players} icon={Users} />
            <StatCard title="Активные за 7 дней" value={data.summary.activePlayers} icon={Activity} tone="emerald" />
            <StatCard title="Посты" value={data.summary.publishedPosts} icon={Sparkles} tone="violet" />
            <StatCard title="Карточки" value={data.summary.cards} icon={WalletCards} />
            <StatCard title="Лайки" value={data.summary.likes} icon={Heart} tone="amber" />
            <StatCard title="Открыто боксов" value={data.summary.boxesOpened} icon={Boxes} tone="violet" />
            <StatCard title="NearCoin выдано" value={data.summary.nearCoinIssued} icon={Sparkles} tone="emerald" />
            <StatCard title="Открытые жалобы" value={data.summary.openReports} icon={AlertTriangle} tone="amber" />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-white/10 bg-card/70">
              <CardHeader>
                <CardTitle>Активность за 7 дней</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-7 items-end gap-2">
                {data.postsByDay.map((day) => (
                  <div key={day.date} className="space-y-2">
                    <div className="flex h-36 items-end rounded-2xl border border-white/10 bg-white/[0.035] p-1.5">
                      <div className="w-full rounded-xl bg-[linear-gradient(180deg,#67e8f9,#a855f7)]" style={{ height: `${Math.max(8, (day.posts / maxPosts) * 100)}%` }} />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-semibold">{day.posts}</p>
                      <p className="text-[10px] text-muted-foreground">{day.date.slice(5)}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-card/70">
              <CardHeader>
                <CardTitle>Модерация</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  ["Flagged", data.moderation.flagged],
                  ["Reviewing", data.moderation.reviewing],
                  ["Actioned", data.moderation.actioned],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className="text-lg font-semibold">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card className="border-white/10 bg-card/70">
              <CardHeader>
                <CardTitle>Топ персонажей</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.topCharacters.map((character) => (
                  <div key={character.uuid} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                    <img src={mediaSrc(character.imageUrl)} alt="" className="h-12 w-12 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{character.name}</p>
                      <p className="text-xs text-muted-foreground">{character.element} · {character.rarity}</p>
                    </div>
                    <Badge variant="outline" className="border-cyan-200/20 text-cyan-100">x{character.ownedCount}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-card/70">
              <CardHeader>
                <CardTitle>Топ игроков</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.topPlayers.map((player) => (
                  <div key={player.uuid} className="grid grid-cols-[1fr_auto] gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{player.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{player.email}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold">ур. {player.level}</p>
                      <p className="text-xs text-muted-foreground">{player.cardsOwnedCount} карт</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
