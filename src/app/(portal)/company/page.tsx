"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Banknote, BellRing, BookOpen, CheckCircle2, CircleAlert, Coins, ExternalLink, QrCode, ReceiptText, RefreshCw, Send, Sparkles, TrendingUp, Users, WalletCards, X } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { companyBilling, companyDashboard, companyTelegramStatus, createCompanyTelegramLink, type CompanyBillingData, type CompanyDashboard, type TelegramConnectionStatus } from "@/lib/api/company-client";
import { getCompanyBillingWarning } from "@/lib/company-billing-warning";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/features/subscriptions";

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);
}

const roleNames = { OWNER: "Владелец", MANAGER: "Руководитель", CASHIER: "Кассир" } as const;

type ChartTooltipPayload = {
  color?: string;
  name?: string;
  value?: number | string;
  dataKey?: string;
};

function compactNumber(value: number) {
  return new Intl.NumberFormat("ru-RU", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function chartDateLabel(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" }).format(new Date(value));
}

function buildActivityChart(operations: CompanyDashboard["recentOperations"]) {
  const buckets = new Map<string, { date: string; earned: number; spent: number; revenue: number; operations: number }>();
  const today = new Date();
  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    const key = date.toISOString().slice(0, 10);
    buckets.set(key, { date: key, earned: 0, spent: 0, revenue: 0, operations: 0 });
  }

  for (const operation of operations) {
    const key = new Date(operation.createdAt).toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.operations += 1;
    if (operation.kind === "SUBSCRIPTION") bucket.revenue += operation.amount ?? 0;
    if (operation.kind === "POINTS" && operation.direction === "EARN") bucket.earned += operation.points ?? 0;
    if (operation.kind === "POINTS" && operation.direction === "SPEND") bucket.spent += operation.points ?? 0;
  }

  return [...buckets.values()].map((item) => ({
    ...item,
    label: chartDateLabel(item.date),
  }));
}

function buildPointsSplitChart(activity: ReturnType<typeof buildActivityChart>) {
  const earned = activity.reduce((sum, item) => sum + item.earned, 0);
  const spent = activity.reduce((sum, item) => sum + item.spent, 0);
  return {
    earned,
    spent,
    total: earned + spent,
    data: [
      { label: "Начислено", value: earned, fill: "#67e8f9" },
      { label: "Списано", value: spent, fill: "#fcd34d" },
    ].filter((item) => item.value > 0),
  };
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: ChartTooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-[#071018]/95 px-3 py-2 text-xs shadow-2xl shadow-black/40">
      <p className="mb-1 font-semibold text-white">{label}</p>
      <div className="space-y-1">
        {payload.map((item) => (
          <p key={item.dataKey ?? item.name} className="flex items-center justify-between gap-4 text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <span className="font-semibold text-white">{item.value}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

export default function CompanyPortalPage() {
  const [dashboard, setDashboard] = useState<CompanyDashboard | null>(null);
  const [billing, setBilling] = useState<CompanyBillingData | null>(null);
  const [error, setError] = useState("");
  const [telegramStatus, setTelegramStatus] = useState<TelegramConnectionStatus | null>(null);
  const [telegramLink, setTelegramLink] = useState("");
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramError, setTelegramError] = useState("");
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  useEffect(() => {
    companyDashboard()
      .then((data) => {
        setDashboard(data);
        const tutorialKey = `nearloy:company-tutorial:${data.company.name}`;
        setTutorialOpen(window.localStorage.getItem(tutorialKey) !== "complete");
      })
      .catch((reason: Error) => setError(reason.message));
    companyBilling()
      .then(setBilling)
      .catch(() => {
        // Billing status is a helpful warning, but the dashboard should stay usable without it.
      });
    companyTelegramStatus()
      .then(setTelegramStatus)
      .catch(() => setTelegramError("Не удалось проверить подключение Telegram."));
  }, []);

  const metrics = dashboard?.metrics;
  // #SubNearloyCode: клиентские подписочные операции не показываем, пока модуль отключён.
  const recentOperations = (dashboard?.recentOperations ?? []).filter(
    (operation) => SUBSCRIPTIONS_ENABLED || operation.kind !== "SUBSCRIPTION",
  );
  const activityChart = useMemo(() => buildActivityChart(recentOperations), [recentOperations]);
  const pointsSplit = useMemo(() => buildPointsSplitChart(activityChart), [activityChart]);
  const tutorial = [
    { title: "Найдите клиента", detail: "Отсканируйте QR или найдите клиента по имени и email на кассе.", icon: QrCode },
    { title: "Начислите баллы", detail: "Введите сумму покупки: уровень клиента сам определит размер кэшбэка.", icon: Coins },
    { title: "Погасите услугу", detail: "Для активной подписки выдавайте услугу в один клик, лимиты защищены системой.", icon: WalletCards },
    { title: "Следите за доходом", detail: "Финансы показывают уже заработанную сумму и будущий остаток подписок.", icon: Banknote },
  ];
  const tutorialSteps = SUBSCRIPTIONS_ENABLED ? tutorial : tutorial.filter((step) => step.icon !== WalletCards);
  const safeTutorialStep = Math.min(tutorialStep, tutorialSteps.length - 1);
  const TutorialIcon = tutorialSteps[safeTutorialStep].icon;
  const billingWarning = getCompanyBillingWarning(billing);

  function closeTutorial() {
    if (dashboard) window.localStorage.setItem(`nearloy:company-tutorial:${dashboard.company.name}`, "complete");
    setTutorialOpen(false);
  }

  async function refreshTelegramStatus() {
    setTelegramLoading(true);
    setTelegramError("");
    try {
      setTelegramStatus(await companyTelegramStatus());
    } catch {
      setTelegramError("Не удалось обновить статус Telegram.");
    } finally {
      setTelegramLoading(false);
    }
  }

  async function connectTelegram() {
    setTelegramLoading(true);
    setTelegramError("");
    try {
      const link = await createCompanyTelegramLink();
      setTelegramLink(link.deepLink);
      window.open(link.deepLink, "_blank", "noopener,noreferrer");
    } catch {
      setTelegramError("Не удалось создать ссылку подключения.");
    } finally {
      setTelegramLoading(false);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <header className="relative overflow-hidden rounded-[1.35rem] border border-cyan-300/15 bg-[radial-gradient(circle_at_86%_8%,rgba(103,232,249,0.15),transparent_34%),linear-gradient(120deg,rgba(17,24,39,0.98),rgba(8,9,12,0.98))] p-4 sm:rounded-[1.75rem] sm:p-8">
        <div className="relative z-10 max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100 sm:mb-4 sm:text-xs sm:tracking-[0.24em]">
            <Sparkles className="h-3.5 w-3.5" /> Рабочая область партнёра
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">{dashboard?.company.name ?? "Кабинет компании"}</h1>
            {dashboard && <Badge className="bg-white text-black">{roleNames[dashboard.memberRole]}</Badge>}
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            Обслуживайте клиентов по QR, отслеживайте подписки и управляйте деньгами в одном рабочем пространстве.
          </p>
          <div className="mt-5 grid gap-3 sm:mt-6 sm:flex sm:flex-wrap">
            <Button asChild size="lg" className="w-full rounded-xl sm:w-auto">
              <Link href="/company/clients"><QrCode /> Сканировать QR клиента</Link>
            </Button>
            {/* #SubNearloyCode: вход в правила клиентских подписок скрыт до запуска. */}
            {SUBSCRIPTIONS_ENABLED && (
              <Button asChild size="lg" variant="secondary" className="w-full rounded-xl sm:w-auto">
                <Link href="/company/subscriptions"><WalletCards /> Правила подписок</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-300/20 bg-red-400/10 p-4 text-sm text-red-100">
          <CircleAlert className="h-5 w-5 shrink-0" /> {error}
        </div>
      )}

      {billingWarning && (
        <Card
          className={`overflow-hidden py-0 ${
            billingWarning.tone === "danger"
              ? "border-red-300/25 bg-[linear-gradient(110deg,rgba(248,113,113,0.14),rgba(255,255,255,0.025))]"
              : "border-amber-300/25 bg-[linear-gradient(110deg,rgba(251,191,36,0.13),rgba(255,255,255,0.025))]"
          }`}
        >
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${
                  billingWarning.tone === "danger"
                    ? "border-red-200/25 bg-red-300/10 text-red-100"
                    : "border-amber-200/25 bg-amber-300/10 text-amber-100"
                }`}
              >
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <p className="text-base font-semibold">{billingWarning.title}</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">{billingWarning.description}</p>
              </div>
            </div>
            <Button asChild className="w-full shrink-0 rounded-xl sm:w-auto">
              <Link href="/company/billing">
                {billingWarning.cta} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {tutorialOpen && (
        <Card className="overflow-hidden border-cyan-300/20 bg-[linear-gradient(110deg,rgba(103,232,249,0.1),rgba(255,255,255,0.025))] py-0">
          <CardContent className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5">
            <div className="flex gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-200/10 text-cyan-100">
                <TutorialIcon className="h-6 w-6" />
              </span>
              <div>
                <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                  <BookOpen className="h-3.5 w-3.5" /> Быстрый старт {safeTutorialStep + 1} / {tutorialSteps.length}
                </p>
                <h2 className="text-lg font-semibold">{tutorialSteps[safeTutorialStep].title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{tutorialSteps[safeTutorialStep].detail}</p>
              </div>
            </div>
            <div className="grid gap-2 sm:flex sm:items-center">
              <Button variant="ghost" size="sm" onClick={closeTutorial}><X /> Пропустить</Button>
              <Button
                size="sm"
                onClick={() => safeTutorialStep === tutorialSteps.length - 1 ? closeTutorial() : setTutorialStep((step) => step + 1)}
              >
                {safeTutorialStep === tutorialSteps.length - 1 ? "Начать работу" : "Далее"} <ArrowRight />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: "Клиенты", value: metrics?.customers ?? "-", detail: "в программе лояльности", icon: Users },
          { label: "Активные подписки", value: metrics?.activeSubscribers ?? "-", detail: "платящих клиентов", icon: WalletCards },
          { label: "Текущий доход", value: metrics ? money(metrics.recognizedSubscriptionRevenue) : "-", detail: metrics ? `+${money(metrics.dailySubscriptionRevenue)} в день` : "по прошедшим дням", icon: Banknote },
          { label: "Начислено баллов", value: metrics?.pointsAwarded ?? "-", detail: "через покупки", icon: ReceiptText },
        ]
          .filter((item) => SUBSCRIPTIONS_ENABLED || (item.icon !== WalletCards && item.icon !== Banknote))
          .map(({ label, value, detail, icon: Icon }) => (
          <Card key={label} className="glass overflow-hidden border-white/10 py-0">
            <CardContent className="flex min-h-[132px] items-start justify-between gap-2 p-4 sm:gap-3 sm:p-5">
              <div>
                <p className="line-clamp-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-xs sm:tracking-[0.18em]">{label}</p>
                <p className="mt-2 text-2xl font-semibold sm:mt-3 sm:text-3xl">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
              </div>
              <span className="rounded-2xl border border-cyan-200/15 bg-cyan-200/[0.06] p-2 text-cyan-100 sm:p-3">
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </span>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="glass overflow-hidden border-white/10 py-0">
          <CardContent className="p-4 sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <TrendingUp className="h-5 w-5 text-cyan-100" /> Пульс операций
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">Баллы, списания и выручка за последние 7 дней</p>
              </div>
              <Badge variant="outline" className="shrink-0">{recentOperations.length}</Badge>
            </div>
            <div className="h-56 w-full sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityChart} margin={{ left: -18, right: 4, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="companyEarned" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#67e8f9" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#67e8f9" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="companySpent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fcd34d" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#fcd34d" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "rgba(255,255,255,0.48)", fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "rgba(255,255,255,0.42)", fontSize: 11 }} tickFormatter={(value) => compactNumber(Number(value))} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="earned" name="Начислено" stroke="#67e8f9" fill="url(#companyEarned)" strokeWidth={2.5} />
                  <Area type="monotone" dataKey="spent" name="Списано" stroke="#fcd34d" fill="url(#companySpent)" strokeWidth={2.5} />
                  {SUBSCRIPTIONS_ENABLED && <Area type="monotone" dataKey="revenue" name="Выручка" stroke="#c4b5fd" fill="rgba(196,181,253,0.08)" strokeWidth={2.5} />}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass overflow-hidden border-white/10 py-0">
          <CardContent className="p-4 sm:p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Оборот баллов</h2>
              <p className="mt-1 text-sm text-muted-foreground">Что реально происходило с баллами за 7 дней</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-center xl:grid-cols-1">
              <div className="relative h-40 sm:h-44 xl:h-40">
                {pointsSplit.total > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pointsSplit.data}
                        dataKey="value"
                        nameKey="label"
                        innerRadius="62%"
                        outerRadius="86%"
                        paddingAngle={4}
                        stroke="rgba(255,255,255,0.08)"
                        strokeWidth={1}
                      >
                        {pointsSplit.data.map((entry) => (
                          <Cell key={entry.label} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-white/10 text-center text-sm text-muted-foreground">
                    Пока нет оборота
                  </div>
                )}
                {pointsSplit.total > 0 && (
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-3xl font-semibold tabular-nums">{pointsSplit.total}</span>
                    <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">баллов</span>
                  </div>
                )}
              </div>
              <div className="grid gap-2">
                <div className="rounded-2xl border border-cyan-200/15 bg-cyan-300/[0.06] px-3 py-3">
                  <p className="text-xs text-muted-foreground">Начислено клиентам</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-cyan-100">{pointsSplit.earned}</p>
                </div>
                <div className="rounded-2xl border border-amber-200/15 bg-amber-300/[0.06] px-3 py-3">
                  <p className="text-xs text-muted-foreground">Списано на покупки</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-100">{pointsSplit.spent}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-3">
                  <p className="text-xs text-muted-foreground">Активных операций</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{recentOperations.length}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.8fr]">
        <Card className="glass border-white/10 py-0">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-5 grid gap-3 sm:flex sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Последние операции</h2>
                <p className="text-sm text-muted-foreground">
                  {SUBSCRIPTIONS_ENABLED ? "Подписки, начисления и списания баллов" : "Начисления и списания баллов"}
                </p>
              </div>
              <Button asChild variant="ghost" size="sm" className="w-full justify-center sm:w-auto">
                <Link href="/company/clients">Открыть кассу <ArrowRight /></Link>
              </Button>
            </div>
            <div className="space-y-2">
              {recentOperations.map((operation) => (
                <div key={operation.uuid} className="grid gap-3 rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3 sm:flex sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="rounded-xl border border-cyan-200/10 bg-cyan-200/[0.05] p-2 text-cyan-100">
                      {operation.kind === "SUBSCRIPTION" ? <WalletCards className="h-4 w-4" /> : <Coins className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{operation.customer} · {operation.title}</p>
                      <p className="text-xs text-muted-foreground">{new Date(operation.createdAt).toLocaleString("ru-RU")}</p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    {operation.kind === "SUBSCRIPTION" ? (
                      <p className="text-sm font-semibold">{money(operation.amount ?? 0)}</p>
                    ) : (
                      <p className={`text-sm font-semibold ${operation.direction === "SPEND" ? "text-amber-200" : "text-cyan-100"}`}>
                        {operation.direction === "SPEND" ? "-" : "+"}{operation.points ?? 0} баллов
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {dashboard && recentOperations.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/12 p-8 text-center text-sm text-muted-foreground">
                  {SUBSCRIPTIONS_ENABLED
                    ? "Первая подписка или операция с баллами появится здесь после обслуживания клиента."
                    : "Первая операция с баллами появится здесь после обслуживания клиента."}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-white/10 py-0">
          <CardContent className="space-y-4 p-4 sm:p-6">
            <h2 className="text-lg font-semibold">Контроль сегодня</h2>
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Заявки на вывод</p>
              <p className="mt-2 text-3xl font-semibold">{metrics?.pendingPayouts ?? "-"}</p>
              <Button asChild variant="outline" className="mt-4 w-full rounded-xl">
                <Link href="/company/payments">Финансы</Link>
              </Button>
            </div>
            <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] p-4">
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-2xl border border-cyan-200/15 bg-cyan-200/[0.08] p-3 text-cyan-100">
                  <BellRing className="h-5 w-5" />
                </span>
                <Badge className={telegramStatus?.connected ? "bg-emerald-400/15 text-emerald-100" : "bg-white/10 text-white"}>
                  {telegramStatus?.connected ? "Telegram подключён" : "Telegram не подключён"}
                </Badge>
              </div>
              <h3 className="mt-4 text-sm font-semibold">Уведомления в Telegram</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Получайте важные события компании: заявки, выплаты, оплату подписки и системные напоминания.
              </p>
              {telegramStatus?.connected && (
                <p className="mt-2 flex items-center gap-2 text-xs text-emerald-100">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Аккаунт готов получать уведомления.
                </p>
              )}
              {telegramError && <p className="mt-2 text-xs text-red-100">{telegramError}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {telegramStatus?.connected ? (
                  <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={refreshTelegramStatus} disabled={telegramLoading}>
                    <RefreshCw className="h-4 w-4" /> Обновить статус
                  </Button>
                ) : (
                  <Button type="button" size="sm" className="rounded-xl" onClick={connectTelegram} disabled={telegramLoading || telegramStatus?.canConnect === false}>
                    <Send className="h-4 w-4" /> Подключить
                  </Button>
                )}
                {telegramLink && (
                  <Button asChild variant="ghost" size="sm" className="rounded-xl">
                    <a href={telegramLink} target="_blank" rel="noreferrer">
                      Открыть ссылку <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
            {SUBSCRIPTIONS_ENABLED ? (
              <>
                <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] p-4">
                  <p className="text-sm font-semibold">Контрольных услуг: {metrics?.activeEntitlements ?? "-"}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Правила погашения не позволят выдать ежедневный бонус дважды в один период.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Будущий доход подписок</p>
                  <p className="mt-2 text-xl font-semibold">{metrics ? money(metrics.potentialSubscriptionRevenue) : "-"}</p>
                </div>
              </>
            ) : (
              <div className="grid gap-3">
                <Link href="/company/clients" className="flex items-center justify-between rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] p-4 transition hover:border-cyan-200/30 hover:bg-cyan-300/[0.08]">
                  <span>
                    <span className="block text-sm font-semibold">Касса и клиенты</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">Поиск, QR и быстрые начисления баллов.</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-cyan-100" />
                </Link>
                <Link href="/company/loyalty" className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition hover:border-white/20 hover:bg-white/[0.055]">
                  <span>
                    <span className="block text-sm font-semibold">Уровни и баллы</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">Пороги покупок и проценты начисления.</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
