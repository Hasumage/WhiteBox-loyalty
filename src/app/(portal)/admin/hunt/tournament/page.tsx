"use client";

import { CalendarClock, Crown, Play, Settings2, Sparkles, Swords, Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HuntAdminTabs } from "../_components/hunt-admin-tabs";

const rounds = [
  { title: "Регистрация", status: "draft", text: "Открыть набор участников, лимиты карт и правила допуска." },
  { title: "Квалификация", status: "test", text: "Случайные пары, короткие матчи и базовая таблица очков." },
  { title: "Плей-офф", status: "locked", text: "Сетка top-16 после накопления боевой статистики." },
];

export default function AdminHuntTournamentPage() {
  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_80%_0%,rgba(168,85,247,0.18),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.075),rgba(255,255,255,0.025))] p-6">
        <Badge variant="outline" className="border-violet-200/25 bg-violet-300/10 text-violet-100">
          <Trophy className="h-3.5 w-3.5" /> Nearloy Hunt
        </Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Турнир</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Тестовый центр будущих сезонов: расписание, правила, матч-коды, призы и ручной контроль старта.</p>
      </section>

      <HuntAdminTabs />

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card className="border-white/10 bg-card/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Swords className="h-5 w-5 text-cyan-100" /> Тестовый сезон
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {rounds.map((round, index) => (
              <div key={round.title} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 md:grid-cols-[40px_1fr_auto] md:items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-200/18 bg-cyan-200/8 text-cyan-100">{index + 1}</div>
                <div>
                  <p className="font-semibold">{round.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{round.text}</p>
                </div>
                <Badge variant={round.status === "locked" ? "secondary" : "outline"} className={round.status === "test" ? "border-cyan-200/20 text-cyan-100" : ""}>{round.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-white/10 bg-card/70">
            <CardHeader>
              <CardTitle>Быстрые настройки</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                ["Участники", "16-64 игроков", Users],
                ["Карты", "уровень 1-30", Sparkles],
                ["Расписание", "ручной старт", CalendarClock],
                ["Призы", "NearCoin + коробки", Crown],
              ].map(([label, value, Icon]) => (
                <div key={label as string} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-cyan-100">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{label as string}</span>
                    <span className="text-xs text-muted-foreground">{value as string}</span>
                  </span>
                </div>
              ))}
              <Button className="w-full" disabled>
                <Play className="h-4 w-4" /> Запустить тест
              </Button>
              <Button variant="secondary" className="glass w-full border-white/10" disabled>
                <Settings2 className="h-4 w-4" /> Настроить правила
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
