import { Award, CalendarHeart, Crown, Handshake, Medal, QrCode, Sparkles, Trophy, TrendingUp, UsersRound } from "lucide-react";
import { ConceptLinkCard, ConceptPageShell } from "./concept-components";

const screens = [
  {
    href: "/season-pass",
    title: "Боевой пропуск",
    description: "TWA-прототип сезонного loyalty pass: уровни, миссии, reward track.",
    icon: Crown,
  },
  {
    href: "/admin/test-screens/stamps",
    title: "Живые штампы",
    description: "Коллекции категорий, районов, сезонных меню и коллабораций компаний.",
    icon: Medal,
  },
  {
    href: "/admin/test-screens/achievements",
    title: "Достижения",
    description: "Этичные достижения за исследование, настройку профиля и полезные действия.",
    icon: Award,
  },
  {
    href: "/admin/test-screens/events",
    title: "Временные события",
    description: "Coffee Week, Wellness Weekend, Map Hunt и партнёрские события.",
    icon: CalendarHeart,
  },
  {
    href: "/admin/test-screens/leaderboards",
    title: "Добрые лидерборды",
    description: "Без токсичного сравнения денег: вклад, discovery, помощь, категории.",
    icon: UsersRound,
  },
  {
    href: "/admin/test-screens/qr-styles",
    title: "Progressive QR styles",
    description: "Стили QR, статусы профиля и category-themed визуальные награды.",
    icon: QrCode,
  },
  {
    href: "/admin/test-screens/mascot",
    title: "Маскот",
    description: "Пробный дружелюбный персонаж в духе Duolingo, но под WhiteBox.",
    icon: Sparkles,
  },
  {
    href: "/admin/test-screens/business-model",
    title: "Бизнес модель",
    description: "Комиссия с подписок, 999 ₽ floor, налоги, платежи, затраты и сценарии рентабельности.",
    icon: TrendingUp,
  },
  {
    href: "/admin/test-screens/club",
    title: "Клуб",
    description: "Приватное сообщество предпринимателей: интро, коллаборации, доверие и сделки внутри WhiteBox.",
    icon: Handshake,
  },
];

export default function TestScreensPage() {
  return (
    <ConceptPageShell
      eyebrow="Prototype lab"
      title="Тестовые экраны"
      description="Изолированная песочница продуктовых идей. Здесь нет бэка, миграций и API: только визуальные прототипы, которые можно быстро показать, обсудить и удалить."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {screens.map((screen) => <ConceptLinkCard key={screen.href} {...screen} />)}
      </div>
      <div className="rounded-3xl border border-white/10 bg-muted/10 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold">Зачем этот раздел</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Мы можем проверять геймификацию до тяжёлой архитектуры: понять, не выглядит ли идея токсично, насколько она мотивирует без покупок и какие экраны стоит переносить в реальную разработку.
            </p>
          </div>
        </div>
      </div>
    </ConceptPageShell>
  );
}





