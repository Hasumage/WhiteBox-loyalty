"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Boxes, Heart, RefreshCw, Search, Sparkles, TrendingUp, Users, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { adminGetHuntPlayers, type AdminHuntPlayersResponse } from "@/lib/api/admin-client";
import { cn } from "@/lib/utils";
import { HuntAdminTabs } from "../_components/hunt-admin-tabs";

function StatCard({ title, value, icon: Icon }: { title: string; value: string | number; icon: typeof Users }) {
  return (
    <Card className="border-white/10 bg-white/[0.045]">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold">{value}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-200/18 bg-cyan-200/8 text-cyan-100">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminHuntPlayersPage() {
  const [data, setData] = useState<AdminHuntPlayersResponse | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setData(await adminGetHuntPlayers());
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = data?.players ?? [];
    if (!needle) return rows;
    return rows.filter((player) => [player.name, player.email, player.uuid].join(" ").toLowerCase().includes(needle));
  }, [data, query]);
  const maxBucket = Math.max(1, ...(data?.levelBuckets.map((bucket) => bucket.count) ?? [1]));

  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.075),rgba(255,255,255,0.025))] p-6">
        <Badge variant="outline" className="border-cyan-200/25 bg-cyan-300/10 text-cyan-100">
          <Users className="h-3.5 w-3.5" /> Nearloy Hunt
        </Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Статистика игроков</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Кто играет, сколько постит, сколько собирает карточек и где сейчас основная масса уровней.</p>
      </section>

      <HuntAdminTabs />

      {!data && !loading && <div className="rounded-2xl border border-red-300/20 bg-red-300/10 p-4 text-sm text-red-50">Нет доступа к аналитике Hunt.</div>}

      {data && (
        <>
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-6">
            <StatCard title="Игроки" value={data.summary.players} icon={Users} />
            <StatCard title="Средний ур." value={data.summary.avgLevel} icon={TrendingUp} />
            <StatCard title="Средне карт" value={data.summary.avgCards} icon={WalletCards} />
            <StatCard title="NearCoin" value={data.summary.totalNearCoin} icon={Sparkles} />
            <StatCard title="Посты" value={data.summary.totalPosts} icon={Activity} />
            <StatCard title="Лайки" value={data.summary.totalLikes} icon={Heart} />
          </section>

          <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <Card className="border-white/10 bg-card/70">
              <CardHeader>
                <CardTitle>Распределение уровней</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.levelBuckets.map((bucket) => (
                  <div key={bucket.label} className="grid grid-cols-[56px_1fr_36px] items-center gap-3">
                    <span className="text-sm text-muted-foreground">{bucket.label}</span>
                    <div className="h-3 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-[linear-gradient(90deg,#67e8f9,#a855f7)]" style={{ width: `${Math.max(4, (bucket.count / maxBucket) * 100)}%` }} />
                    </div>
                    <span className="text-right text-sm font-semibold">{bucket.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-card/70">
              <CardContent className="p-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск игрока" className="border-white/10 bg-white/[0.035] pl-9" />
                </div>
              </CardContent>
            </Card>
          </section>

          <Card className="border-white/10 bg-card/70">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Игроки</CardTitle>
              <Button variant="secondary" disabled={loading} onClick={() => void load()} className="glass border-white/10">
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Обновить
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b border-white/10">
                    <th className="py-3 pr-4">Игрок</th>
                    <th className="py-3 pr-4">Уровень</th>
                    <th className="py-3 pr-4">NearCoin</th>
                    <th className="py-3 pr-4">Посты</th>
                    <th className="py-3 pr-4">Лайки</th>
                    <th className="py-3 pr-4">Боксы</th>
                    <th className="py-3 pr-4">Карты</th>
                    <th className="py-3">Туториал</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((player) => (
                    <tr key={player.uuid} className="border-b border-white/5">
                      <td className="py-3 pr-4">
                        <p className="font-semibold">{player.name}</p>
                        <p className="text-xs text-muted-foreground">{player.email}</p>
                      </td>
                      <td className="py-3 pr-4">{player.level} · {player.xp} xp</td>
                      <td className="py-3 pr-4">{player.influenceBalance} / {player.lifetimeInfluence}</td>
                      <td className="py-3 pr-4">{player.postsCount}</td>
                      <td className="py-3 pr-4">{player.likesReceivedCount}</td>
                      <td className="py-3 pr-4">{player.boxesOpenedCount}</td>
                      <td className="py-3 pr-4">{player.cardsOwnedCount}</td>
                      <td className="py-3">
                        <Badge variant={player.tutorialCompletedAt ? "default" : "secondary"}>{player.tutorialCompletedAt ? "готово" : "нет"}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
