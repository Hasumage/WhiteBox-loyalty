import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Calculator,
  Coins,
  CreditCard,
  FileText,
  Landmark,
  Percent,
  Receipt,
  Scale,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ConceptPageShell } from "../concept-components";

const FLOOR_FEE = 999;
const RECOMMENDED_RATE = 0.07;
const LAUNCH_RATE = 0.05;
const MANAGED_PAYMENTS_RATE = 0.1;
const ACQUIRING_RATE = 0.028;
const USN_INCOME_RATE = 0.06;

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

function money(value: number) {
  return rub.format(Math.round(value));
}

function partnerInvoice(gmv: number, rate: number) {
  return Math.max(FLOOR_FEE, gmv * rate);
}

function servicingCost(gmv: number) {
  if (gmv === 0) return 120;
  if (gmv < 25_000) return 180;
  if (gmv < 100_000) return 260;
  return 420;
}

function unitEconomics(gmv: number, rate = RECOMMENDED_RATE, nearloyPaysAcquiring = true) {
  const commission = gmv * rate;
  const invoice = partnerInvoice(gmv, rate);
  const acquiring = nearloyPaysAcquiring ? gmv * ACQUIRING_RATE : 0;
  const tax = invoice * USN_INCOME_RATE;
  const support = servicingCost(gmv);
  const net = invoice - acquiring - tax - support;

  return { commission, invoice, acquiring, tax, support, net };
}

const gmvRows = [0, 10_000, 15_000, 50_000, 150_000, 300_000].map((gmv) => ({
  gmv,
  launch: partnerInvoice(gmv, LAUNCH_RATE),
  recommended: partnerInvoice(gmv, RECOMMENDED_RATE),
  managed: partnerInvoice(gmv, MANAGED_PAYMENTS_RATE),
  net: unitEconomics(gmv).net,
}));

const portfolioRows = [
  { partners: 25, avgGmv: 15_000 },
  { partners: 50, avgGmv: 25_000 },
  { partners: 100, avgGmv: 50_000 },
  { partners: 250, avgGmv: 100_000 },
].map((row) => {
  const unit = unitEconomics(row.avgGmv);
  return {
    ...row,
    monthlyRevenue: unit.invoice * row.partners,
    monthlyNet: unit.net * row.partners,
  };
});

const costRows = [
  ["Сервер, БД, backups, мониторинг", "8 000 - 35 000 ₽", "На старте можно держать скромно, но бэкапы и мониторинг не режем."],
  ["Платежи и эквайринг", "~2.5 - 3.5% от оборота", "Лучше выносить как pass-through или учитывать в комиссии."],
  ["Онлайн-касса / чеки / ОФД", "2 000 - 8 000 ₽", "Нужно, если NearLoy принимает оплату от физлиц и формирует чек."],
  ["Бухгалтерия и отчётность", "5 000 - 20 000 ₽", "УСН, акты, агентские отчёты, сверка выплат партнёрам."],
  ["Поддержка и модерация", "15 000 - 80 000 ₽", "Верификации, спорные платежи, восстановление доступа, ручные проверки."],
  ["Юридический контур", "5 000 - 40 000 ₽", "Оферта, агентский договор, политика ПД, согласия, регламенты удаления паспортов."],
  ["Карты / геокодер / email", "2 000 - 20 000 ₽", "Зависит от API-лимитов, писем, уведомлений и активности пользователей."],
];

const incomeRows = [
  ["Floor-доступ", "999 ₽/мес", "Партнёр платит минимум, пока комиссия с подписок меньше 999-1000 ₽."],
  ["Комиссия с подписок", "7% база", "Главный доход. Не выглядит грабительски и покрывает сервис при нормальном обороте."],
  ["Managed payments", "+2-3 п.п.", "Если NearLoy сам тащит эквайринг, чеки, возвраты и payout-сверку."],
  ["Премиум-аналитика", "1 490-2 990 ₽/мес", "Не pay-to-win, а отчёты: retention, LTV, активные подписки, точки роста."],
  ["Доп. сотрудники", "199-499 ₽/мес за seat", "Когда у компании несколько менеджеров, но базовый владелец бесплатный."],
  ["Enterprise/onboarding", "15 000-50 000 ₽ разово", "Настройка большой сети, импорт клиентов, кастомные роли, обучение."],
  ["Ускоренные выплаты", "0.5-1% опционально", "Только добровольно: быстрее payout, но обычная выплата остаётся доступной."],
];

const taxRows = [
  ["УСН доходы", "6%", "Стартовый режим, если расходы небольшие и юридическая модель считает доходом именно комиссию NearLoy."],
  ["УСН доходы-расходы", "15% с прибыли", "Может стать выгоднее, если NearLoy сам оплачивает эквайринг, рекламу, поддержку и фонд оплаты труда."],
  ["НДС на УСН", "порог 20 млн ₽ в 2026", "До 20 млн ₽ дохода за 2025 год ФНС указывает автоматическое освобождение; выше порога появляются НДС-обязанности."],
  ["Сотрудники", "30% взносов", "Если нанимать людей официально, фонд оплаты труда резко влияет на точку безубыточности."],
  ["Персональные данные", "152-ФЗ", "Паспорта, Telegram ID и платежные данные требуют согласий, регламентов доступа и уведомления/учёта оператора ПД."],
  ["54-ФЗ", "ККТ и электронные чеки", "Если деньги от физлиц принимает NearLoy, нужно заранее спроектировать чеки и фискализацию."],
];

const recommendationCards = [
  {
    icon: Percent,
    title: "Базовая ставка: 7%",
    text: "Оптимальный старт: не выглядит как налог на бизнес, но даёт запас на поддержку, налоги и ошибки роста.",
  },
  {
    icon: WalletCards,
    title: "999 ₽ как floor, а не сверху",
    text: "Формула: счёт партнёру = max(999 ₽, комиссия с подписок). Так нет странного двойного платежа.",
  },
  {
    icon: CreditCard,
    title: "10% только если NearLoy несёт платежи",
    text: "Если платформа платит эквайринг, ККТ, возвраты и выплаты, 7% станет тонко. Тогда нужен 9.5-10% пакет.",
  },
];

const sourceRows = [
  ["ФНС: упрощённая система налогообложения", "УСН 6% / 15%", "https://www.nalog.gov.ru/rn77/taxation/TAXES/usn/"],
  ["ФНС: НДС при УСН", "порог 20 млн ₽ и ставки НДС", "https://www.nalog.gov.ru/rn77/taxation/taxes/nds_usn/"],
  ["ФНС: интернет-расчёты и ККТ", "чеки и фискальные документы", "https://www.nalog.gov.ru/rn50/news/activities_fts/14798229/"],
  ["ЮKassa: комиссии", "ориентиры по эквайрингу", "https://yookassa.ru/docs/support/payments/fees"],
  ["ФНС: страховые взносы", "зарплатная нагрузка", "https://www.nalog.gov.ru/rn77/taxation/insprem/"],
  ["РКН: портал персональных данных", "оператор ПД и уведомления", "https://pd.rkn.gov.ru/"],
];

function MetricCard({ label, value, hint, icon: Icon }: { label: string; value: string; hint: string; icon: typeof TrendingUp }) {
  return (
    <Card className="border-white/10 bg-slate-950/70 py-0">
      <CardContent className="p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">{label}</p>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-100">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="text-3xl font-semibold text-white">{value}</p>
        <p className="mt-2 text-sm leading-6 text-white/55">{hint}</p>
      </CardContent>
    </Card>
  );
}

function MiniTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
      <div className="grid border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-[0.18em] text-white/45" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((column) => <div key={column} className="p-4">{column}</div>)}
      </div>
      {rows.map((row, index) => (
        <div key={index} className="grid border-b border-white/10 last:border-b-0" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
          {row.map((cell, cellIndex) => (
            <div key={`${index}-${cellIndex}`} className="p-4 text-sm leading-6 text-white/75">
              {cell}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function BusinessModelConceptPage() {
  const waiverAtSeven = Math.ceil(1000 / RECOMMENDED_RATE);
  const normalNet = unitEconomics(50_000).net;
  const partnersFor60k = Math.ceil(60_000 / normalNet);

  return (
    <ConceptPageShell
      eyebrow="Business model lab"
      title="Бизнес модель NearLoy"
      description="Расчёт стартовой экономики: основной доход с подписок, честный floor 999 ₽, обязательные затраты, налоги, платежи и точка, где модель начинает дышать без кринж-монетизации. Это не юридическое заключение, а продуктово-финансовая модель для обсуждения с бухгалтером и платёжным провайдером."
    >
      <section className="grid gap-4 xl:grid-cols-4">
        <MetricCard label="рекомендация" value="7%" hint="Комиссия с оборота подписок как базовая ставка для запуска." icon={Percent} />
        <MetricCard label="минимум" value="999 ₽" hint="Fair floor: партнёр платит не 999 плюс комиссию, а максимум из двух значений." icon={Banknote} />
        <MetricCard label="free access" value={money(waiverAtSeven)} hint="Оборот подписок, после которого 7% комиссии перекрывают 999 ₽ доступа." icon={BadgeCheck} />
        <MetricCard label="break-even" value={`${partnersFor60k} партн.`} hint="Примерно столько партнёров по 50k ₽ GMV нужно для покрытия 60k ₽ базовых затрат." icon={Calculator} />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {recommendationCards.map(({ icon: Icon, title, text }) => (
          <Card key={title} className="overflow-hidden border-white/10 bg-slate-950 py-0">
            <CardContent className="p-5">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-black">
                <Icon className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="rounded-[2rem] border border-cyan-200/15 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_34%),rgba(2,6,23,0.82)] p-6">
        <div className="mb-5 flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
          <div>
            <Badge className="mb-3 bg-cyan-100 text-cyan-950"><Sparkles className="mr-1 h-3 w-3" /> Главная формула</Badge>
            <h2 className="text-2xl font-semibold">Счёт партнёру = max(999 ₽, GMV подписок × ставка)</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
              Так компания без подписок платит понятную подписку, а компания с оборотом фактически получает доступ бесплатно: платит только комиссию, которая уже доказала ценность NearLoy.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-white/65">
            При 7% порог 999-1000 ₽ достигается примерно на {money(waiverAtSeven)} подписочного оборота в месяц.
          </div>
        </div>
        <MiniTable
          columns={["GMV подписок", "5% launch", "7% base", "10% managed", "Net при 7%*"]}
          rows={gmvRows.map((row) => [money(row.gmv), money(row.launch), money(row.recommended), money(row.managed), money(row.net)])}
        />
        <p className="mt-3 text-xs leading-5 text-white/45">
          * Net грубо считает УСН 6%, обслуживание партнёра и эквайринг 2.8%, если NearLoy несёт его сам. Если эквайринг проходит как pass-through за счёт партнёра, маржа выше.
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-white/10 bg-slate-950/70 py-0">
          <CardContent className="p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Портфельные сценарии</h2>
                <p className="mt-1 text-sm text-muted-foreground">Что будет с MRR, если партнёры начнут приносить реальный оборот подписок.</p>
              </div>
            </div>
            <MiniTable
              columns={["Партнёры", "Средний GMV", "MRR NearLoy", "После переменных"]}
              rows={portfolioRows.map((row) => [row.partners, money(row.avgGmv), money(row.monthlyRevenue), money(row.monthlyNet)])}
            />
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/70 py-0">
          <CardContent className="p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-300/15 text-emerald-100">
                <Coins className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Вывод по ставке</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  5% хороши как welcome-тариф на 60-90 дней. 7% — здоровая базовая ставка. 10% — только когда NearLoy берёт на себя платежную операционку, фискализацию, возвраты, антифрод и сверку выплат.
                </p>
              </div>
            </div>
            <div className="grid gap-3">
              {[
                ["< 15k ₽ GMV", `партнёр платит floor ${money(FLOOR_FEE)}`],
                ["15k-100k ₽ GMV", "7% начинает честно масштабироваться"],
                ["> 100k ₽ GMV", "можно давать volume discount 6% при низкой нагрузке"],
                ["managed payments", "9.5-10% или 7% + pass-through эквайринга"],
              ].map(([title, text]) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="font-semibold">{title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="border-white/10 bg-slate-950/70 py-0">
          <CardContent className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <Receipt className="h-6 w-6 text-cyan-100" />
              <h2 className="text-xl font-semibold">Обязательные затраты</h2>
            </div>
            <div className="grid gap-3">
              {costRows.map(([title, amount, note]) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{title}</p>
                    <Badge variant="outline" className="border-white/15 bg-white/[0.04]">{amount}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{note}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/70 py-0">
          <CardContent className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <WalletCards className="h-6 w-6 text-emerald-100" />
              <h2 className="text-xl font-semibold">Доходы без кринжа</h2>
            </div>
            <div className="grid gap-3">
              {incomeRows.map(([title, amount, note]) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{title}</p>
                    <Badge variant="outline" className="border-cyan-200/20 bg-cyan-300/10 text-cyan-100">{amount}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{note}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="rounded-[2rem] border border-amber-200/15 bg-amber-300/[0.05] p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-300/15 text-amber-100">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Налоги, платежи и юридическая модель</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Самое важное решение: NearLoy должен быть агентом/платформой, где доход NearLoy — комиссия, а не весь оборот подписок. Это надо оформить договором и проверить с бухгалтером, иначе налоговая база может стать болезненной.
            </p>
          </div>
        </div>
        <MiniTable columns={["Блок", "Ориентир", "Что это значит"]} rows={taxRows} />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {[
          [Landmark, "Модель А: агентская", "Рекомендуется. NearLoy принимает/сопровождает подписки, удерживает комиссию, партнёру уходит остальное. Нужны договор, отчёты агента, корректная фискализация."],
          [CreditCard, "Модель B: платежи у партнёра", "Самая простая юридически: партнёр сам принимает деньги, NearLoy выставляет ему SaaS/commission invoice. Минус: меньше контроля и хуже UX подписок."],
          [AlertTriangle, "Модель C: merchant of record", "Не для старта. NearLoy продаёт всё от себя, несёт возвраты, чеки, НДС-риски и потребительскую ответственность. Комиссия ниже 10-12% опасна."],
        ].map(([Icon, title, text]) => {
          const Glyph = Icon as typeof Landmark;
          return (
            <Card key={title as string} className="border-white/10 bg-slate-950/70 py-0">
              <CardContent className="p-5">
                <Glyph className="mb-4 h-7 w-7 text-primary" />
                <h3 className="text-lg font-semibold">{title as string}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text as string}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-950 p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-black">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Правильный стартовый пакет</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Что я бы зафиксировал в продукте на старте, чтобы экономика и доверие не дрались друг с другом.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Starter", "max(999 ₽, 7% GMV)", "Для обычной компании без сложных выплат."],
            ["Launch", "5% на 90 дней", "Аккуратный вход для первых партнёров и теста ценности."],
            ["Managed", "10%", "NearLoy закрывает платежи, чеки, возвраты и сверку."],
            ["Scale", "6-7%", "Для сетей с большим GMV и низкой support-нагрузкой."],
          ].map(([title, price, note]) => (
            <div key={title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-sm text-muted-foreground">{title}</p>
              <p className="mt-2 text-2xl font-semibold">{price}</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
        <div className="mb-5 flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Источники и допущения</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sourceRows.map(([title, note, href]) => (
            <a key={href} href={href} target="_blank" rel="noreferrer" className="group rounded-2xl border border-white/10 bg-slate-950/55 p-4 transition hover:border-primary/35">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{note}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
              </div>
            </a>
          ))}
        </div>
        <p className="mt-5 text-xs leading-5 text-muted-foreground">
          Расчёты используют допущения: УСН 6% по доходу NearLoy, эквайринг 2.8%, комиссия как агентское вознаграждение, без зарплаты основателя. Перед продом модель нужно подтвердить с бухгалтером, юристом и выбранным платёжным провайдером.
        </p>
      </section>
    </ConceptPageShell>
  );
}
