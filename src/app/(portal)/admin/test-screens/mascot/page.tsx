import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConceptPageShell } from "../concept-components";
import { Bell, Heart, MapPinned, MessageCircle, Sparkles, Star, Zap } from "lucide-react";

export default function MascotConceptPage() {
  return (
    <ConceptPageShell
      eyebrow="Mascot experiment"
      title="NearLoy mascot"
      description="Проба дружелюбного персонажа в духе Duolingo: эмоциональные подсказки, мягкие nudges, реакции на достижения и onboarding. Нарисовано CSS/SVG прямо на странице, без ассетов."
    >
      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-cyan-300/15 via-slate-950 to-emerald-300/10 p-8 text-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.16),transparent_30%)]" />
          <div className="relative mx-auto h-72 w-64">
            <div className="absolute left-1/2 top-10 h-44 w-44 -translate-x-1/2 rounded-[3rem] bg-white shadow-[0_30px_80px_rgba(255,255,255,0.12)]" />
            <div className="absolute left-11 top-20 h-12 w-12 rounded-full bg-slate-950" />
            <div className="absolute right-11 top-20 h-12 w-12 rounded-full bg-slate-950" />
            <div className="absolute left-[4.7rem] top-[5.4rem] h-3 w-3 rounded-full bg-white" />
            <div className="absolute right-[4.7rem] top-[5.4rem] h-3 w-3 rounded-full bg-white" />
            <div className="absolute left-1/2 top-32 h-8 w-14 -translate-x-1/2 rounded-b-full border-b-4 border-slate-950" />
            <div className="absolute left-3 top-36 h-16 w-10 -rotate-12 rounded-full bg-white" />
            <div className="absolute right-3 top-36 h-16 w-10 rotate-12 rounded-full bg-white" />
            <div className="absolute bottom-7 left-16 h-16 w-10 rounded-full bg-white" />
            <div className="absolute bottom-7 right-16 h-16 w-10 rounded-full bg-white" />
            <div className="absolute left-1/2 top-4 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-[1.4rem] bg-slate-950 text-white shadow-[0_18px_42px_rgba(0,0,0,0.35)]">
              <Sparkles className="h-8 w-8" />
            </div>
            <div className="absolute left-1/2 bottom-0 -z-0 h-8 w-44 -translate-x-1/2 rounded-full bg-black/40 blur-xl" />
          </div>
          <h2 className="relative mt-2 text-2xl font-semibold">Boxie</h2>
          <p className="relative mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Не сова и не зверёк, а маленький живой NearLoy-спутник: помогает, радуется прогрессу и не стыдит пользователя.</p>
        </div>

        <div className="grid gap-4">
          {[
            ["Celebration", "Появляется при достижении, новом штампе или уровне компании.", Star],
            ["Gentle nudge", "Через 10 минут предлагает обновить данные или продолжить активность мягко, без давления.", Bell],
            ["Map buddy", "Подсказывает ближайшие точки, маршруты и бесплатные discovery-действия.", MapPinned],
            ["Empty state friend", "Когда у пользователя нули, объясняет первый шаг, а не показывает пустоту.", Heart],
          ].map(([title, detail, Icon]) => {
            const Glyph = Icon as typeof Star;
            return (
              <Card key={title as string} className="glass border-white/10 bg-slate-950/50 py-0">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary"><Glyph className="h-6 w-6" /></div>
                  <div><h3 className="font-semibold">{title as string}</h3><p className="mt-1 text-sm text-muted-foreground">{detail as string}</p></div>
                </CardContent>
              </Card>
            );
          })}
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5">
            <Badge className="mb-3 bg-white text-black"><MessageCircle className="h-3 w-3" /> sample phrases</Badge>
            <div className="space-y-2 text-sm">
              <p className="rounded-2xl bg-slate-950/70 p-3">“Хочешь, покажу 3 места рядом, где можно просто посмотреть карту?”</p>
              <p className="rounded-2xl bg-slate-950/70 p-3">“Ты почти собрал Coffee Explorer. Остался один маршрут.”</p>
              <p className="rounded-2xl bg-slate-950/70 p-3">“Красиво! Новый QR-стиль открыт.”</p>
            </div>
            <Button className="mt-4 w-full" disabled><Zap className="mr-2 h-4 w-4" /> Animate later</Button>
          </div>
        </div>
      </section>
    </ConceptPageShell>
  );
}
