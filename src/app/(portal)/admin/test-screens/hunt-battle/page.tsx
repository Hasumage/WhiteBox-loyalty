import { BadgeCheck, Bolt, Brain, ChevronRight, CircleDot, Clover, Heart, MapPin, Music, Shield, Sparkles, Swords, Waves, Wind } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ConceptPageShell } from "../concept-components";

type Fighter = {
  name: string;
  element: string;
  icon: typeof Sparkles;
  image: string;
  hp: number;
  role: string;
  active?: boolean;
  dimmed?: boolean;
};

const playerTeam: Fighter[] = [
  {
    name: "Bloom Sprout",
    element: "Природа",
    icon: Clover,
    image: "/hunt-assets/cards/nature-sprout.webp",
    hp: 82,
    role: "связка",
    active: true,
  },
  {
    name: "Map Tide",
    element: "Вода",
    icon: Waves,
    image: "/hunt-assets/cards/water-route.webp",
    hp: 68,
    role: "контроль",
  },
  {
    name: "Neon Echo",
    element: "Музыка",
    icon: Music,
    image: "/hunt-assets/cards/creatures/neon-sound.webp",
    hp: 54,
    role: "ритм",
  },
];

const rivalTeam: Fighter[] = [
  {
    name: "Chai Flare",
    element: "Огонь",
    icon: Bolt,
    image: "/hunt-assets/cards/creatures/chai-flare.webp",
    hp: 74,
    role: "натиск",
  },
  {
    name: "Metro Breeze",
    element: "Ветер",
    icon: Wind,
    image: "/hunt-assets/cards/creatures/metro-breeze.webp",
    hp: 61,
    role: "сдвиг",
    active: true,
  },
  {
    name: "Aurora Ticket",
    element: "Свет",
    icon: Sparkles,
    image: "/hunt-assets/cards/creatures/aurora-ticket.webp",
    hp: 88,
    role: "щит",
    dimmed: true,
  },
];

const turnCards = [
  { title: "Связать", text: "Выберите двух своих персонажей. Второй усиливает действие первого.", icon: Brain, active: true },
  { title: "Сместить", text: "Поменяйте позицию и сбейте подготовку противника.", icon: Wind },
  { title: "Отразить", text: "Сохраните резонанс и снизьте входящий удар.", icon: Shield },
];

const roundSignals = [
  ["Поле", "Тихий парк", Clover],
  ["Пульс", "+2 к природе", CircleDot],
  ["Риск", "Огонь отвечает", Bolt],
];

function FighterCard({ fighter, side }: { fighter: Fighter; side: "player" | "rival" }) {
  const Icon = fighter.icon;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border bg-[#050914] shadow-[0_18px_55px_rgba(0,0,0,0.35)]",
        fighter.active ? "border-cyan-200/55" : "border-white/10",
        fighter.dimmed && "opacity-62",
      )}
    >
      <div className="relative aspect-[4/5]">
        <img src={fighter.image} alt="" className={cn("absolute inset-0 h-full w-full object-contain object-center", side === "rival" && "scale-x-[-1]")} />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black via-black/72 to-transparent" />
        <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-white/12 bg-black/48 px-2 py-1 text-[10px] font-semibold text-white">
          <Icon className="h-3 w-3 text-cyan-100" />
          {fighter.element}
        </div>
        {fighter.active ? (
          <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-cyan-100/45 bg-cyan-100/16 text-cyan-100">
            <BadgeCheck className="h-4 w-4" />
          </span>
        ) : null}
        <div className="absolute inset-x-2 bottom-2">
          <p className="truncate text-sm font-semibold text-white">{fighter.name}</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-[0.12em] text-white/52">{fighter.role}</span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-100">
              <Heart className="h-3 w-3" />
              {fighter.hp}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/12">
            <div className="h-full rounded-full bg-gradient-to-r from-rose-300 to-cyan-200" style={{ width: `${fighter.hp}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamStrip({ fighters, side }: { fighters: Fighter[]; side: "player" | "rival" }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {fighters.map((fighter) => (
        <FighterCard key={fighter.name} fighter={fighter} side={side} />
      ))}
    </div>
  );
}

export default function HuntBattleConceptPage() {
  return (
    <ConceptPageShell
      eyebrow="Nearloy Hunt"
      title="Командный бой без автобоя"
      description="Тестовый вертикальный экран боя внутри приложения. Идея: игрок каждый ход собирает связку из нескольких персонажей, читает поле раунда и вручную решает, чем рисковать."
    >
      <section className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[2.3rem] border border-cyan-200/20 bg-[#020711] p-3 shadow-[0_35px_120px_rgba(0,0,0,0.55)]">
          <div className="min-h-[780px] overflow-hidden rounded-[1.9rem] border border-white/10 bg-[radial-gradient(circle_at_50%_0%,rgba(103,232,249,0.18),transparent_31%),radial-gradient(circle_at_15%_35%,rgba(34,197,94,0.12),transparent_28%),linear-gradient(180deg,#07111f,#030610)] px-4 py-5 text-white">
            <header className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-100/72">Бой Hunt</p>
                <h2 className="mt-1 text-2xl font-semibold">Резонанс мест</h2>
              </div>
              <Badge className="border-cyan-200/25 bg-cyan-200/10 text-cyan-50">ход 2 / 6</Badge>
            </header>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {roundSignals.map(([label, value, Icon]) => {
                const Glyph = Icon as typeof Sparkles;
                return (
                  <div key={label as string} className="rounded-2xl border border-white/10 bg-white/[0.055] p-2">
                    <Glyph className="h-4 w-4 text-cyan-100" />
                    <p className="mt-2 text-[10px] uppercase tracking-[0.15em] text-white/38">{label as string}</p>
                    <p className="mt-0.5 truncate text-xs font-semibold">{value as string}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-white/54">Команда соперника</span>
                <span className="text-cyan-100">2 связки</span>
              </div>
              <TeamStrip fighters={rivalTeam} side="rival" />
            </div>

            <div className="relative my-5 rounded-3xl border border-cyan-200/18 bg-cyan-200/[0.055] p-3">
              <div className="absolute inset-x-12 top-1/2 h-px bg-gradient-to-r from-transparent via-cyan-100/55 to-transparent" />
              <div className="relative flex items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] border border-cyan-100/35 bg-[#061523] shadow-[0_0_35px_rgba(103,232,249,0.22)]">
                  <Swords className="h-7 w-7 text-cyan-100" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-white/60">
                <span>Ваш резонанс</span>
                <span className="font-semibold text-cyan-50">64%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[64%] rounded-full bg-gradient-to-r from-cyan-200 via-emerald-200 to-lime-300" />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-white/54">Ваша команда</span>
                <span className="text-cyan-100">выбрано 2 / 3</span>
              </div>
              <TeamStrip fighters={playerTeam} side="player" />
            </div>

            <section className="mt-5 space-y-2">
              {turnCards.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-cyan-200/40 hover:bg-cyan-200/10",
                    item.active ? "border-cyan-200/35 bg-cyan-200/12" : "border-white/10 bg-white/[0.045]",
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/24 text-cyan-100">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{item.title}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-white/52">{item.text}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-white/42" />
                </button>
              ))}
            </section>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/55 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-cyan-100" />
              <h2 className="text-xl font-semibold">Механика: резонанс вместо автобоя</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {[
                ["Команда 3 на 3", "В бой берётся несколько персонажей. Один действует, второй усиливает, третий держит защитный контур."],
                ["Поле раунда", "Каждый ход приложение показывает контекст места: парк, вода, шум, свет, вечер. Это меняет силу стихий."],
                ["Связки", "Игрок выбирает пару персонажей и действие: связать, сместить, отразить или накопить резонанс."],
                ["Без автобоя", "Сервер считает итог после выбора игрока, но не играет за него. Решение остаётся ручным и коротким."],
              ].map(([title, text]) => (
                <div key={title} className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="font-semibold">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-cyan-200/15 bg-cyan-200/[0.045] p-5">
            <div className="mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-cyan-100" />
              <h2 className="text-xl font-semibold">Почему это подходит Nearloy Hunt</h2>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Бой не отрывается от идеи приложения: посты и места дают карточки, карточки имеют стихии, а бой использует контекст места как часть тактики. Можно играть быстро в веб-приложении: один ход это 2-3 тапа, без сложной 3D-сцены и без тяжёлого real-time.
            </p>
          </div>
        </div>
      </section>
    </ConceptPageShell>
  );
}
