import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarCheck,
  ChevronDown,
  Crown,
  Dumbbell,
  Gift,
  Handshake,
  HeartHandshake,
  LockKeyhole,
  MapPinned,
  MessageCircle,
  Network,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  TicketPercent,
  Target,
  Trophy,
  WalletCards,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ConceptPageShell } from "../concept-components";

const needs = [
  {
    icon: Store,
    title: "Проверенные партнёры",
    text: "Не чат на тысячу людей, а круг верифицированных компаний: понятно кто чем занимается, где точки, какие подписки и репутация.",
  },
  {
    icon: HeartHandshake,
    title: "Тёплые интро вместо холодного спама",
    text: "Форма интро заставляет описать цель, пользу второй стороне, срок и формат. Получатель видит не «давайте дружить», а конкретное предложение.",
  },
  {
    icon: WalletCards,
    title: "Коллаборации и выручка",
    text: "Совместные подписки, cross-promo, бандлы и локальные акции. Клуб должен превращать связи в понятные предложения для клиентов.",
  },
  {
    icon: ShieldCheck,
    title: "Доверие и безопасность",
    text: "Правила клуба, антиспам, аудит действий, verified-only доступ и репутация, которая растёт от полезных действий, а не от шума.",
  },
  {
    icon: MapPinned,
    title: "Локальные возможности рядом",
    text: "Карта показывает не только адреса, а поводы: кто рядом ищет партнёра, где можно сделать pop-up, кому нужна точка выдачи или совместное событие.",
  },
  {
    icon: Trophy,
    title: "Практические разборы бизнеса",
    text: "Не мотивационные посты, а кейсы: тарифы подписок, удержание, возвраты, точки, юридическая гигиена и что реально сработало у похожих компаний.",
  },
];

const rooms = [
  ["Founders circle", "Закрытая лента владельцев", "18 новых инсайтов"],
  ["Collab desk", "Запросы на партнёрства", "7 тёплых интро"],
  ["Local Moscow", "Соседние точки и события", "12 возможностей"],
  ["Subscription lab", "Тарифы, уровни, retention", "5 разборов"],
];

const feed = [
  {
    tag: "intro",
    title: "Кофейня ищет wellness-партнёра на утренний абонемент",
    text: "Нужен зал или студия йоги рядом с Цветным. Идея: 3 месяца кофе + 4 тренировки, общий QR и единая подписка.",
    cta: "Предложить интро",
  },
  {
    tag: "deal",
    title: "Барбершоп готов дать 10 мест для теста подписки",
    text: "Нужна компания с мужской аудиторией: спорт, авто, одежда. NearLoy посчитает retention и cashback без ручных таблиц.",
    cta: "Собрать бандл",
  },
  {
    tag: "ask",
    title: "Какой минимальный порог списания баллов поставить?",
    text: "Салон красоты хочет снизить микро-транзакции. Нужен опыт тех, у кого уже есть частые маленькие списания.",
    cta: "Ответить опытом",
  },
];

const journeys = [
  [Search, "Найти подходящего партнёра", "Фильтр по сфере, городу, аудитории, среднему чеку, категориям и готовности делать совместный продукт."],
  [MessageCircle, "Отправить структурированное интро", "Вместо свободного чата: цель, что даю, что прошу, срок пилота, кто принимает решение."],
  [Handshake, "Согласовать условия", "Стороны видят вклад каждой компании, цену, правила баллов, ответственность и статус согласования."],
  [WalletCards, "Выпустить совместную подписку", "Два разных предложения объединяются в одну карточку, QR и историю клиента внутри NearLoy."],
];

const collaborationIdeas = [
  {
    icon: MessageCircle,
    title: "Интро-заявка",
    problem: "Сейчас предприниматели пишут друг другу хаотично и получают игнор.",
    solution: "NearLoy превращает сообщение в мини-бриф: кто я, какая аудитория, что предлагаю, какой пилот и что нужно от партнёра.",
    result: "Получатель за 20 секунд понимает, стоит ли отвечать.",
  },
  {
    icon: MapPinned,
    title: "Карта поводов",
    problem: "Просто видеть компании на карте мало. Непонятно, зачем с ними связываться.",
    solution: "На карте появляются активные поводы: ищу партнёра на выходные, готов принять pop-up, нужна точка выдачи, делаю локальный бандл.",
    result: "Взаимодействие начинается с конкретного события, а не с холодного знакомства.",
  },
  {
    icon: Trophy,
    title: "Разбор подписки",
    problem: "Компания не понимает, как сделать подписку, чтобы её покупали и не было убытка.",
    solution: "Клуб даёт формат публичного или приватного разбора: цена, период, бонусные дни, cashback, уровни, риски и примеры похожих компаний.",
    result: "Предприниматель выходит не с советом «делай лучше», а с готовым черновиком тарифа.",
  },
];

const trustSignals = [
  [BadgeCheck, "Verified business", "Компания прошла проверку и имеет активный профиль."],
  [Star, "Useful answers", "Помогает другим не рекламой, а рабочими ответами."],
  [Network, "Warm intros", "Интро закрываются без жалоб и холодного спама."],
  [ShieldCheck, "Clean record", "Нет спорных действий, жалоб и нарушений правил клуба."],
];

const clubRules = [
  "В клуб попадают только верифицированные владельцы или уполномоченные сотрудники компаний.",
  "Нельзя писать холодные массовые предложения. Любое интро должно объяснять пользу для второй стороны.",
  "Репутация растёт за подтверждённые действия: полезные ответы, закрытые интро, аккуратные коллаборации.",
  "NearLoy не продаёт доступ к людям. Клуб помогает строить доверие и совместные продукты внутри системы.",
];

function GlowCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <Card className={`overflow-hidden border-white/10 bg-slate-950/70 py-0 shadow-[0_30px_90px_rgba(0,0,0,0.28)] ${className}`}>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}

function MiniButton({ children, variant = "dark" }: { children: React.ReactNode; variant?: "dark" | "light" | "cyan" }) {
  const tone =
    variant === "light"
      ? "bg-white text-black"
      : variant === "cyan"
        ? "border-cyan-200/30 bg-cyan-300/12 text-cyan-50"
        : "border-white/10 bg-white/[0.06] text-white";
  return <span className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold ${tone}`}>{children}</span>;
}

export default function ClubConceptPage() {
  return (
    <ConceptPageShell
      eyebrow="Private founders club"
      title="Клуб NearLoy"
      description="Прототип закрытого клуба предпринимателей внутри NearLoy: верифицированные участники, тёплые интро, совместные подписки, карта возможностей и репутация, которая строится на полезных действиях."
    >
      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <GlowCard className="relative min-h-[420px]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.16),transparent_26%),radial-gradient(circle_at_86%_20%,rgba(34,211,238,0.18),transparent_32%)]" />
          <div className="relative">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <Badge className="mb-3 bg-white text-black"><LockKeyhole className="mr-1 h-3 w-3" /> invite only</Badge>
                <h2 className="text-2xl font-semibold">Клубный пульт предпринимателя</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/60">Один экран для деловых связей: комнаты, запросы, интро, сделки и быстрый переход в инструменты NearLoy.</p>
              </div>
              <MiniButton variant="light"><Crown className="h-4 w-4" /> Founder pass</MiniButton>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["27", "участников рядом"],
                ["8", "открытых интро"],
                ["4", "идеи бандлов"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-3xl border border-white/10 bg-black/25 p-4">
                  <p className="text-3xl font-semibold">{value}</p>
                  <p className="mt-1 text-sm text-white/50">{label}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[0.82fr_1.18fr]">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-semibold">Комнаты</p>
                  <Radio className="h-4 w-4 text-cyan-100" />
                </div>
                <div className="space-y-2">
                  {rooms.map(([title, text, count]) => (
                    <div key={title} className="rounded-2xl border border-white/10 bg-black/20 p-3 transition hover:border-cyan-200/25 hover:bg-cyan-300/10">
                      <p className="font-semibold">{title}</p>
                      <p className="mt-1 text-xs text-white/45">{text}</p>
                      <p className="mt-2 text-xs text-cyan-100">{count}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="font-semibold">Живая лента клуба</p>
                  <MiniButton variant="cyan"><Sparkles className="h-4 w-4" /> создать запрос</MiniButton>
                </div>
                <div className="space-y-3">
                  {feed.map((item) => (
                    <div key={item.title} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-cyan-200/20 bg-cyan-300/10 text-cyan-100">{item.tag}</Badge>
                        <p className="text-sm text-white/45">только verified</p>
                      </div>
                      <p className="font-semibold">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-white/55">{item.text}</p>
                      <div className="mt-3"><MiniButton>{item.cta}<ArrowRight className="h-4 w-4" /></MiniButton></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </GlowCard>

        <GlowCard className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(125,211,252,0.18),transparent_30%)]" />
          <div className="relative">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold">Карта доверия</h2>
                <p className="mt-2 text-sm leading-6 text-white/55">Не рейтинг богатства, а сеть полезности: кто может помочь, с кем уже были сделки, кто подходит для интро.</p>
              </div>
              <Network className="h-7 w-7 text-cyan-100" />
            </div>

            <div className="relative mx-auto h-[320px] max-w-[520px] rounded-[2rem] border border-white/10 bg-black/25">
              <div className="absolute left-[10%] top-[16%] h-px w-[52%] rotate-[18deg] bg-cyan-100/25" />
              <div className="absolute left-[34%] top-[42%] h-px w-[48%] -rotate-[24deg] bg-white/20" />
              <div className="absolute bottom-[24%] left-[18%] h-px w-[62%] rotate-[-4deg] bg-cyan-100/20" />
              {[
                ["Coffee", "left-[8%] top-[14%]", "bg-amber-300/15"],
                ["Fitness", "right-[10%] top-[26%]", "bg-emerald-300/15"],
                ["Beauty", "left-[34%] top-[42%]", "bg-rose-300/15"],
                ["Auto", "left-[16%] bottom-[18%]", "bg-sky-300/15"],
                ["Books", "right-[18%] bottom-[16%]", "bg-violet-300/15"],
              ].map(([label, position, tone]) => (
                <div key={label} className={`absolute ${position} flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white/15 ${tone} text-sm font-semibold shadow-[0_18px_55px_rgba(0,0,0,0.35)]`}>
                  {label}
                </div>
              ))}
              <div className="absolute left-1/2 top-1/2 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[2.2rem] border border-white/25 bg-white text-black shadow-[0_0_60px_rgba(255,255,255,0.24)]">
                <Handshake className="h-9 w-9" />
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {trustSignals.map(([Icon, title, text]) => {
                const Glyph = Icon as typeof BadgeCheck;
                return (
                  <div key={title as string} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <Glyph className="mb-3 h-5 w-5 text-cyan-100" />
                    <p className="font-semibold">{title as string}</p>
                    <p className="mt-1 text-sm leading-5 text-white/50">{text as string}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </GlowCard>
      </section>

      <section className="relative overflow-hidden rounded-[2rem] border border-cyan-200/15 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.18),transparent_34%),rgba(2,6,23,0.94)] p-6">
        <div className="pointer-events-none absolute inset-x-10 top-24 hidden h-px bg-gradient-to-r from-transparent via-cyan-100/30 to-transparent xl:block" />
        <div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <Badge className="mb-3 bg-white text-black"><WalletCards className="mr-1 h-3 w-3" /> co-subscription builder</Badge>
            <h2 className="text-3xl font-semibold tracking-tight">Конструктор совместной подписки</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
              Практичный интерфейс: две компании заполняют свои части отдельно, NearLoy проверяет совместимость и плавно собирает одну карточку подписки для клиента.
            </p>
          </div>
          <MiniButton variant="cyan"><Sparkles className="h-4 w-4" /> preview готов</MiniButton>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_0.72fr_1fr] xl:items-stretch">
          <div className="rounded-[2rem] border border-amber-200/20 bg-amber-300/[0.07] p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-200 text-amber-950">
                  <Store className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-amber-100/60">company a</p>
                  <h3 className="text-xl font-semibold">Urban Coffee</h3>
                </div>
              </div>
              <Badge variant="outline" className="border-amber-200/25 bg-black/20 text-amber-100">кофе</Badge>
            </div>
            <div className="space-y-3">
              {[
                ["Вклад", "12 напитков в месяц"],
                ["Себестоимость", "≈ 1 080 ₽"],
                ["Клиентская ценность", "утренний ритуал + привычка заходить"],
                ["Лимиты", "1 напиток в день, без алкогольного меню"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/35">{label}</p>
                  <p className="mt-1 font-semibold">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="mb-3 flex items-center gap-2 font-semibold"><Gift className="h-4 w-4 text-amber-100" /> Бонус компании</p>
              <p className="text-sm leading-6 text-white/60">+5% cashback за покупки вне подписки, если клиент активировал совместный тариф.</p>
            </div>
          </div>

          <div className="relative flex flex-col items-center justify-center rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
            <div className="absolute -left-6 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-200/20 bg-slate-950 text-cyan-100 xl:flex">
              <ArrowRight className="h-5 w-5" />
            </div>
            <div className="absolute -right-6 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-200/20 bg-slate-950 text-cyan-100 xl:flex">
              <ArrowRight className="h-5 w-5 rotate-180" />
            </div>
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-white text-black shadow-[0_0_50px_rgba(255,255,255,0.24)]">
              <Handshake className="h-8 w-8" />
            </div>
            <p className="text-center text-xs uppercase tracking-[0.24em] text-cyan-100/55">merge logic</p>
            <h3 className="mt-2 text-center text-xl font-semibold">NearLoy собирает общий продукт</h3>
            <div className="my-5 h-10 w-px bg-gradient-to-b from-transparent via-white/25 to-transparent" />
            <div className="grid w-full gap-2">
              {[
                ["цена", "2 990 ₽ / 3 месяца"],
                ["выручка", "60% coffee / 40% fitness"],
                ["баллы", "каждая компания начисляет свои"],
                ["QR", "одна карточка клиента"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
                  <span className="text-white/45">{label}</span>
                  <span className="font-semibold">{value}</span>
                </div>
              ))}
            </div>
            <ChevronDown className="mt-5 h-6 w-6 animate-bounce text-cyan-100/60" />
          </div>

          <div className="rounded-[2rem] border border-emerald-200/20 bg-emerald-300/[0.07] p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-200 text-emerald-950">
                  <Dumbbell className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-emerald-100/60">company b</p>
                  <h3 className="text-xl font-semibold">Pulse Studio</h3>
                </div>
              </div>
              <Badge variant="outline" className="border-emerald-200/25 bg-black/20 text-emerald-100">fitness</Badge>
            </div>
            <div className="space-y-3">
              {[
                ["Вклад", "6 тренировок в месяц"],
                ["Себестоимость", "≈ 1 440 ₽"],
                ["Клиентская ценность", "здоровье + причина возвращаться"],
                ["Лимиты", "только групповые слоты до 17:00"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/35">{label}</p>
                  <p className="mt-1 font-semibold">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="mb-3 flex items-center gap-2 font-semibold"><TicketPercent className="h-4 w-4 text-emerald-100" /> Бонус компании</p>
              <p className="text-sm leading-6 text-white/60">Первое персональное занятие со скидкой 20%, если клиент продлил совместную подписку.</p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-[2rem] border border-white/15 bg-white text-black shadow-[0_28px_90px_rgba(255,255,255,0.12)]">
          <div className="grid gap-0 overflow-hidden rounded-[2rem] lg:grid-cols-[1fr_280px]">
            <div className="p-6">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge className="bg-black text-white">совместная подписка</Badge>
                <Badge variant="outline" className="border-black/10 text-black">coffee + fitness</Badge>
                <Badge variant="outline" className="border-black/10 text-black">3 месяца</Badge>
              </div>
              <h3 className="text-3xl font-semibold tracking-tight">Morning Energy Club</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-black/60">
                Для клиентов, которые хотят начать день с кофе и движения: 12 напитков Urban Coffee, 6 тренировок Pulse Studio, общий QR, прозрачные лимиты и отдельная история использования.
              </p>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {[
                  ["2 990 ₽", "цена пакета"],
                  ["18", "полезных посещений"],
                  ["+80", "стартовых баллов"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-2xl border border-black/10 bg-black/[0.035] p-4">
                    <p className="text-2xl font-semibold">{value}</p>
                    <p className="text-sm text-black/50">{label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col justify-between bg-slate-950 p-6 text-white">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/40">client card</p>
                <div className="mt-4 rounded-[1.5rem] border border-white/15 bg-white/[0.08] p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <WalletCards className="h-6 w-6 text-cyan-100" />
                    <Badge className="bg-cyan-100 text-cyan-950">active</Badge>
                  </div>
                  <p className="text-lg font-semibold">Morning Energy</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {["coffee", "fitness", "QR", "bonus"].map((item) => (
                      <div key={item} className="rounded-xl border border-white/10 bg-black/25 p-3 text-center text-xs font-semibold">{item}</div>
                    ))}
                  </div>
                </div>
              </div>
              <MiniButton variant="light"><Sparkles className="h-4 w-4" /> опубликовать пилот</MiniButton>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-950 p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-black">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Что нужно предпринимателям в NearLoy</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Клуб должен решать практические задачи бизнеса, а не быть ещё одним шумным чатом. Ниже - ядро пользы.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {needs.map(({ icon: Icon, title, text }) => (
            <div key={title} className="group rounded-3xl border border-white/10 bg-white/[0.035] p-5 transition hover:-translate-y-0.5 hover:border-cyan-200/25 hover:bg-cyan-300/[0.07]">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-cyan-100">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <GlowCard>
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-300/15 text-cyan-100">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Путь пользователя</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Как предприниматель взаимодействует с системой, а затем с другими участниками.</p>
            </div>
          </div>
          <div className="space-y-3">
            {journeys.map(([Icon, title, text], index) => {
              const Glyph = Icon as typeof Search;
              return (
                <div key={title as string} className="flex gap-4 rounded-3xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-black">
                    <Glyph className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-white/35">шаг {index + 1}</p>
                    <p className="mt-1 font-semibold">{title as string}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{text as string}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </GlowCard>

        <GlowCard>
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Карточка участника клуба</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Мини-профиль должен быстро отвечать: кто это, чем полезен, можно ли доверять, как начать разговор.</p>
            </div>
            <Badge className="bg-white text-black">verified</Badge>
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.14),transparent_28%),rgba(255,255,255,0.035)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] border border-cyan-200/30 bg-cyan-300/10 text-cyan-50">
                  <BriefcaseBusiness className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold">Urban Retail</h3>
                  <p className="text-sm text-muted-foreground">кофе, локальные подписки, Москва</p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-right">
                <p className="text-xs text-white/45">trust score</p>
                <p className="text-2xl font-semibold text-cyan-100">86</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {[
                ["12", "интро закрыто"],
                ["4", "коллаборации"],
                ["98%", "ответы вовремя"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xl font-semibold">{value}</p>
                  <p className="text-xs text-white/45">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <MiniButton variant="light"><MessageCircle className="h-4 w-4" /> запросить интро</MiniButton>
              <MiniButton><CalendarCheck className="h-4 w-4" /> позвать в событие</MiniButton>
              <MiniButton variant="cyan"><WalletCards className="h-4 w-4" /> собрать бандл</MiniButton>
            </div>
          </div>
        </GlowCard>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-950 p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-black">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Другие понятные механики взаимодействия</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Я докрутил идеи так, чтобы каждая начиналась с практической боли предпринимателя и заканчивалась действием в NearLoy, а не просто “пообщались в клубе”.
            </p>
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {collaborationIdeas.map(({ icon: Icon, title, problem, solution, result }) => (
            <div key={title} className="rounded-[1.8rem] border border-white/10 bg-white/[0.035] p-5">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-100">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">{title}</h3>
              <div className="mt-4 space-y-3 text-sm leading-6">
                <div className="rounded-2xl border border-red-300/15 bg-red-500/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-100/70">боль</p>
                  <p className="mt-1 text-white/70">{problem}</p>
                </div>
                <div className="rounded-2xl border border-cyan-200/15 bg-cyan-300/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/70">как решаем</p>
                  <p className="mt-1 text-white/70">{solution}</p>
                </div>
                <div className="rounded-2xl border border-emerald-200/15 bg-emerald-300/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/70">результат</p>
                  <p className="mt-1 text-white/70">{result}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-amber-200/15 bg-amber-300/[0.05] p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-300/15 text-amber-100">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Правила, чтобы клуб не превратился в базар</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">Вот здесь надо быть строгими. Клуб ценен только пока внутри мало шума и много доверия.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {clubRules.map((rule, index) => (
            <div key={rule} className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-amber-100/55">правило {index + 1}</p>
              <p className="mt-2 text-sm leading-6 text-white/75">{rule}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
        <div className="mb-5 flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Что потом подключить к реальной системе</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Company verification", "в клуб только после проверки компании"],
            ["Subscriptions", "создание совместных подписок из сделки"],
            ["Audit", "история интро, жалоб, апрувов и доверенных действий"],
            ["Map", "локальные возможности рядом с точками компании"],
          ].map(([title, text]) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <p className="font-semibold">{title}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </ConceptPageShell>
  );
}
