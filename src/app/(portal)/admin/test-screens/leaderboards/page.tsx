import { BadgeCheck, Coffee, Compass, HandHeart, Heart, MapPinned, Medal, MessageSquareText, Route, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConceptPageShell } from "../concept-components";

const boards = [
  { title: "Helpful Explorers", description: "Люди, которые исправляют адреса, оставляют полезные отзывы и предлагают партнёров.", icon: HandHeart, metric: "helpful actions" },
  { title: "Map Scouts", description: "Пользователи, открывающие маршруты и новые районы. Не про траты, а про исследование.", icon: MapPinned, metric: "routes planned" },
  { title: "Category Curators", description: "Пользователи, которые собирают подборки и сохраняют качественные места в категориях.", icon: Coffee, metric: "saved picks" },
];

const rows = [
  ["Maksim", "Coffee guide", "7 helpful routes", Heart, "warm"],
  ["Emma", "Map scout", "5 address fixes", ShieldCheck, "safe"],
  ["Noah", "Wellness curator", "4 partner reviews", MessageSquareText, "kind"],
  ["Sofia", "City explorer", "3 new districts", Compass, "bright"],
];

export default function LeaderboardsConceptPage() {
  return (
    <ConceptPageShell
      eyebrow="Kind competition"
      title="Добрые лидерборды"
      description="Лидерборд не должен говорить “ты беднее”. Он должен показывать вклад, помощь, исследование и вдохновляющие роли. Сравнение денег запрещаем как продуктовый принцип."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {boards.map((board) => {
          const Icon = board.icon;
          return (
            <div key={board.title} className="rounded-[2rem] border border-white/10 bg-slate-950/65 p-5">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary"><Icon className="h-7 w-7" /></div>
              <h2 className="text-xl font-semibold">{board.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{board.description}</p>
              <Badge variant="outline" className="mt-4 border-white/10">rank by {board.metric}</Badge>
            </div>
          );
        })}
      </div>
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">This week: Community helpers</h2>
            <p className="text-sm text-muted-foreground">Ранги мягкие: highlight вкладов, без проигравших.</p>
          </div>
          <Badge className="gap-1 bg-white text-black"><UsersRound className="h-3 w-3" /> opt-in</Badge>
        </div>
        <div className="grid gap-3">
          {rows.map(([name, role, detail, Icon], index) => {
            const Glyph = Icon as typeof Heart;
            return (
              <div key={name as string} className="flex items-center gap-3 rounded-3xl border border-white/10 bg-slate-950/45 p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black text-sm font-bold">{index + 1}</span>
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary"><Glyph className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1"><span className="block font-semibold">{name as string}</span><span className="block text-sm text-muted-foreground">{role as string} · {detail as string}</span></span>
                {index === 0 ? <Medal className="h-5 w-5 text-amber-200" /> : <BadgeCheck className="h-5 w-5 text-muted-foreground" />}
              </div>
            );
          })}
        </div>
      </section>
      <div className="rounded-3xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
        <Sparkles className="mr-1 inline h-4 w-4" />
        Правило: лидерборды NearLoy должны ранжировать вклад и исследование, а не сумму денег.
      </div>
    </ConceptPageShell>
  );
}
