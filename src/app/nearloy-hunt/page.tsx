import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Box, MapPinned, Swords, Trophy, WalletCards, Zap } from "lucide-react";
import { MarketingFooter } from "@/components/landing/MarketingFooter";
import { MarketingHeader } from "@/components/landing/MarketingHeader";
import { MarketingPageReveal } from "@/components/landing/MarketingPageReveal";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nearloy.ru").replace(/\/$/, "");

const title = "Nearloy Hunt — городская игра с персонажами, карточками и боями";
const description =
  "Nearloy Hunt — игровая ветка NearLoy: публикуйте места, собирайте персонажей из коробок, прокачивайте команду, побеждайте в боях и получайте NearCoin.";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "Nearloy Hunt",
    "NearLoy Hunt",
    "городская игра",
    "коллекция персонажей",
    "карточная игра",
    "NearCoin",
    "игра про места",
    "социальная сеть про город",
  ],
  alternates: { canonical: "/nearloy-hunt" },
  openGraph: {
    type: "website",
    siteName: "NearLoy",
    locale: "ru_RU",
    title,
    description,
    url: "/nearloy-hunt",
    images: [{ url: "/hunt-assets/cards/creatures/chai-flare.webp", width: 1200, height: 630, alt: "Персонажи Nearloy Hunt" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/hunt-assets/cards/creatures/chai-flare.webp"],
  },
};

const characters = [
  {
    name: "Чайро",
    element: "Огонь",
    image: "/hunt-assets/cards/creatures/chai-flare.webp",
    text: "Боевой стартовый герой для первых дуэлей и быстрых атак.",
    tone: "from-amber-300/22 via-orange-400/12 to-rose-400/12",
  },
  {
    name: "Тайдли",
    element: "Вода",
    image: "/hunt-assets/cards/water-route.webp",
    text: "Водный проводник, который помогает держать темп и контролировать поле.",
    tone: "from-cyan-200/24 via-sky-400/12 to-blue-500/12",
  },
  {
    name: "Блуми",
    element: "Природа",
    image: "/hunt-assets/cards/nature-sprout.webp",
    text: "Милый спутник с природной стихией и полезной командной ролью.",
    tone: "from-lime-200/24 via-emerald-400/12 to-cyan-400/10",
  },
  {
    name: "Неон",
    element: "Музыка",
    image: "/hunt-assets/cards/neon-sound.webp",
    text: "Ритм, удача и яркий стиль для игроков, которые любят риск.",
    tone: "from-fuchsia-300/20 via-cyan-300/12 to-violet-500/14",
  },
];

const mechanics = [
  { icon: MapPinned, title: "Посты о местах", text: "Игроки отмечают кафе, прогулки, районы и городские находки. Хорошие посты помогают получать валюту и открывать коробки." },
  { icon: Box, title: "Коробки и коллекция", text: "В коробках выпадают персонажи разных стихий и редкости. Повторки помогают прокачивать любимых героев." },
  { icon: Swords, title: "Тактические бои", text: "Команда выходит на арену, занимает точки резонанса, использует способности и контрит стихии соперника." },
  { icon: Trophy, title: "Кубки и рейтинг", text: "Победы дают кубки, а сезонный лидерборд показывает сильнейших игроков Nearloy Hunt." },
];

const seoFaq = [
  {
    question: "Что такое Nearloy Hunt?",
    answer: "Nearloy Hunt — это игровая часть NearLoy, где пользователи публикуют места, собирают карточки персонажей, прокачивают команду и участвуют в боях.",
  },
  {
    question: "Как получить персонажей в Nearloy Hunt?",
    answer: "Персонажи выпадают из коробок. Коробки можно открывать за NearCoin, который игрок получает за активность, обучение, победы и игровые события.",
  },
  {
    question: "Nearloy Hunt связан с обычным NearLoy?",
    answer: "Да. Nearloy Hunt дополняет NearLoy: городские посты, партнёры, бонусы и игровая коллекция работают как части одной экосистемы.",
  },
];

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

function CharacterCard({ character }: { character: (typeof characters)[number] }) {
  return (
    <article className="group overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.24)] transition duration-300 hover:-translate-y-1 hover:border-cyan-100/24">
      <div className={`relative overflow-hidden rounded-[22px] bg-gradient-to-br ${character.tone}`}>
        <Image
          src={character.image}
          alt={`${character.name} — персонаж Nearloy Hunt стихии ${character.element}`}
          width={520}
          height={520}
          className="aspect-square w-full object-contain p-4 drop-shadow-[0_24px_32px_rgba(0,0,0,0.34)] transition duration-300 group-hover:scale-[1.04]"
        />
        <div className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/32 px-3 py-1 text-xs font-semibold text-white/84 backdrop-blur">
          {character.element}
        </div>
      </div>
      <div className="p-3">
        <h3 className="text-xl font-semibold text-white">{character.name}</h3>
        <p className="mt-2 text-sm leading-6 text-white/58">{character.text}</p>
      </div>
    </article>
  );
}

export default function NearloyHuntLandingPage() {
  const appJsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: "Nearloy Hunt",
    url: `${SITE_URL}/nearloy-hunt`,
    applicationCategory: "Game",
    gamePlatform: "Web, Telegram Mini App",
    genre: ["городская игра", "коллекционная карточная игра", "тактическая игра"],
    description,
    publisher: {
      "@type": "Organization",
      name: "NearLoy",
      url: SITE_URL,
    },
  };
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: seoFaq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#02050a] text-white">
      <JsonLd data={appJsonLd} />
      <JsonLd data={faqJsonLd} />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(251,191,36,0.12),transparent_24%),radial-gradient(circle_at_48%_76%,rgba(168,85,247,0.10),transparent_30%),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:auto,auto,auto,80px_80px,80px_80px]" />
      <MarketingHeader active="hunt" />
      <MarketingPageReveal>
        <section className="relative z-10 mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8 lg:py-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-100/18 bg-cyan-100/10 px-4 py-2 text-sm font-semibold text-cyan-100">
              <Zap className="h-4 w-4" />
              Городская игра внутри NearLoy
            </div>
            <h1 className="mt-7 max-w-4xl text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
              Nearloy Hunt: собирай персонажей и открывай город заново
            </h1>
            <p className="mt-6 max-w-2xl text-xl leading-9 text-white/64">
              Публикуйте интересные места, получайте NearCoin, открывайте коробки с героями, прокачивайте команду и сражайтесь на арене. Hunt превращает обычную прогулку, кафе или районную находку в игровой прогресс.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/login?next=/hunt" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-base font-semibold text-[#07101e] shadow-[0_0_34px_rgba(255,255,255,0.18)] transition hover:bg-white/90">
                Играть в Nearloy Hunt
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/hunt/public" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/7 px-6 text-base font-semibold text-white transition hover:bg-white/12">
                Смотреть ленту мест
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {characters.map((character) => (
                <CharacterCard key={character.name} character={character} />
              ))}
            </div>
          </div>
        </section>

        <section className="relative z-10 border-y border-white/10 bg-white/[0.035] py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100/64">Как это работает</p>
              <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">Hunt соединяет соцсеть про места и тактическую коллекционную игру</h2>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {mechanics.map((item) => (
                <article key={item.title} className="rounded-[28px] border border-white/10 bg-black/24 p-6">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-100/14 bg-cyan-100/10 text-cyan-100">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 text-xl font-semibold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/58">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative z-10 py-16">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100/64">Персонажи и стихии</p>
              <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">У каждого героя есть роль, стихия и стиль боя</h2>
              <p className="mt-4 text-lg leading-8 text-white/60">
                Огонь, вода, природа, ветер, музыка, свет и тьма влияют на урон и выбор контрпиков. В бою важны не только редкость и уровень, но и позиция на поле, резонанс, щиты, критический шанс, отбрасывание и грамотный выбор способности.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  ["NearCoin", "Валюта для коробок, улучшений и игровых действий."],
                  ["Резонанс", "Энергия боя: захватывайте точки, чтобы быстрее включать способности."],
                  ["Кубки", "Рейтинг и сезонная цель для игроков, которые любят соревноваться."],
                  ["Коллекция", "Карточки персонажей, повторки, редкость, уровни и бонусные статы."],
                ].map(([name, text]) => (
                  <div key={name} className="rounded-3xl border border-white/10 bg-white/[0.045] p-5">
                    <p className="font-semibold text-white">{name}</p>
                    <p className="mt-2 text-sm leading-6 text-white/56">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.045] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.24)]">
              <Image
                src="/hunt-assets/ui/nearloy-cup.png"
                alt="Кубок Nearloy Hunt для рейтинга игроков"
                width={1024}
                height={1024}
                className="mx-auto aspect-square max-h-[520px] w-full object-contain p-4 drop-shadow-[0_28px_42px_rgba(34,211,238,0.22)]"
              />
            </div>
          </div>
        </section>

        <section className="relative z-10 border-y border-white/10 bg-white/[0.035] py-14">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:px-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100/64">NearLoy + Hunt</p>
              <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">Игра помогает NearLoy находить места, которым уже доверяют люди</h2>
              <p className="mt-4 text-lg leading-8 text-white/60">
                Обычный NearLoy хранит бонусы, статусы, партнёров и QR-профиль. Nearloy Hunt добавляет живую активность: игроки сами показывают, какие места интересны, где стоит появиться партнёрам и какие районы уже набирают спрос.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { icon: WalletCards, title: "Для клиентов", text: "Бонусы, статусы, персонажи и награды в одном аккаунте." },
                { icon: BadgeCheck, title: "Для партнёров", text: "Появляется понятный сигнал интереса к месту и району." },
                { icon: MapPinned, title: "Для города", text: "Лента помогает открывать маршруты, кафе, парки и локальные находки." },
              ].map((item) => (
                <article key={item.title} className="rounded-[28px] border border-white/10 bg-black/24 p-5">
                  <item.icon className="h-6 w-6 text-lime-100" />
                  <h3 className="mt-4 font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/56">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative z-10 py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100/64">FAQ</p>
            <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">Коротко о Nearloy Hunt</h2>
            <div className="mt-8 grid gap-3">
              {seoFaq.map((item) => (
                <article key={item.question} className="rounded-[28px] border border-white/10 bg-white/[0.045] p-6">
                  <h3 className="text-lg font-semibold text-white">{item.question}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/58">{item.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative z-10 px-4 pb-16 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 rounded-[32px] border border-cyan-100/18 bg-cyan-100/10 p-6 shadow-[0_28px_90px_rgba(34,211,238,0.08)] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Готовы попробовать Hunt?</h2>
              <p className="mt-2 text-sm leading-6 text-white/62">Откройте игру, пройдите обучение с Лирой и соберите первую команду из трёх персонажей.</p>
            </div>
            <Link href="/login?next=/hunt" className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-sm font-semibold text-[#07101e] transition hover:bg-white/90">
              Начать игру
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <MarketingFooter />
      </MarketingPageReveal>
    </main>
  );
}
