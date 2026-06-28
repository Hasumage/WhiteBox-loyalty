"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Banknote, BookOpen, CircleAlert, Coins, QrCode, ReceiptText, Sparkles, Users, WalletCards, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { companyBilling, companyDashboard, type CompanyBillingData, type CompanyDashboard } from "@/lib/api/company-client";
import { getCompanyBillingWarning } from "@/lib/company-billing-warning";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/features/subscriptions";

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);
}

const roleNames = { OWNER: "Владелец", MANAGER: "Руководитель", CASHIER: "Кассир" } as const;

export default function CompanyPortalPage() {
  const [dashboard, setDashboard] = useState<CompanyDashboard | null>(null);
  const [billing, setBilling] = useState<CompanyBillingData | null>(null);
  const [error, setError] = useState("");
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
  }, []);

  const metrics = dashboard?.metrics;
  const recentOperations = (dashboard?.recentOperations ?? []).filter(
    (operation) => SUBSCRIPTIONS_ENABLED || operation.kind !== "SUBSCRIPTION",
  );
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
  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-[1.75rem] border border-cyan-300/15 bg-[radial-gradient(circle_at_86%_8%,rgba(103,232,249,0.15),transparent_34%),linear-gradient(120deg,rgba(17,24,39,0.98),rgba(8,9,12,0.98))] p-6 sm:p-8">
        <div className="relative z-10 max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
            <Sparkles className="h-3.5 w-3.5" /> Partner workspace
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{dashboard?.company.name ?? "Кабинет компании"}</h1>
            {dashboard && <Badge className="bg-white text-black">{roleNames[dashboard.memberRole]}</Badge>}
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            Обслуживайте клиентов по QR, отслеживайте подписки и управляйте деньгами в одном рабочем пространстве.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-xl">
              <Link href="/company/clients"><QrCode /> Сканировать QR клиента</Link>
            </Button>
            {SUBSCRIPTIONS_ENABLED && (
              <Button asChild size="lg" variant="secondary" className="rounded-xl">
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
            <Button asChild className="shrink-0 rounded-xl">
              <Link href="/company/billing">
                {billingWarning.cta} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {tutorialOpen && (
        <Card className="overflow-hidden border-cyan-300/20 bg-[linear-gradient(110deg,rgba(103,232,249,0.1),rgba(255,255,255,0.025))] py-0">
          <CardContent className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
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
            <div className="flex items-center gap-2">
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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Клиенты", value: metrics?.customers ?? "-", detail: "в программе лояльности", icon: Users },
          { label: "Активные подписки", value: metrics?.activeSubscribers ?? "-", detail: "платящих клиентов", icon: WalletCards },
          { label: "Текущий доход", value: metrics ? money(metrics.recognizedSubscriptionRevenue) : "-", detail: metrics ? `+${money(metrics.dailySubscriptionRevenue)} в день` : "по прошедшим дням", icon: Banknote },
          { label: "Начислено баллов", value: metrics?.pointsAwarded ?? "-", detail: "через покупки", icon: ReceiptText },
        ]
          .filter((item) => SUBSCRIPTIONS_ENABLED || (item.icon !== WalletCards && item.icon !== Banknote))
          .map(({ label, value, detail, icon: Icon }) => (
          <Card key={label} className="glass overflow-hidden border-white/10 py-0">
            <CardContent className="flex items-start justify-between gap-3 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                <p className="mt-3 text-3xl font-semibold">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
              </div>
              <span className="rounded-2xl border border-cyan-200/15 bg-cyan-200/[0.06] p-3 text-cyan-100">
                <Icon className="h-5 w-5" />
              </span>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.8fr]">
        <Card className="glass border-white/10 py-0">
          <CardContent className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Последние операции</h2>
                <p className="text-sm text-muted-foreground">
                  {SUBSCRIPTIONS_ENABLED ? "Подписки, начисления и списания баллов" : "Начисления и списания баллов"}
                </p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/company/clients">Открыть кассу <ArrowRight /></Link>
              </Button>
            </div>
            <div className="space-y-2">
              {recentOperations.map((operation) => (
                <div key={operation.uuid} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="rounded-xl border border-cyan-200/10 bg-cyan-200/[0.05] p-2 text-cyan-100">
                      {operation.kind === "SUBSCRIPTION" ? <WalletCards className="h-4 w-4" /> : <Coins className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{operation.customer} · {operation.title}</p>
                      <p className="text-xs text-muted-foreground">{new Date(operation.createdAt).toLocaleString("ru-RU")}</p>
                    </div>
                  </div>
                  <div className="text-right">
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
          <CardContent className="space-y-4 p-6">
            <h2 className="text-lg font-semibold">Контроль сегодня</h2>
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Заявки на вывод</p>
              <p className="mt-2 text-3xl font-semibold">{metrics?.pendingPayouts ?? "-"}</p>
              <Button asChild variant="outline" className="mt-4 w-full rounded-xl">
                <Link href="/company/payments">Финансы</Link>
              </Button>
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
              <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] p-4">
                <p className="text-sm font-semibold">Мы создаём кое-что потрясающее</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  В первой версии компании работают с клиентами, QR, баллами и уровнями. Подписки вернутся отдельным стабильным обновлением.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
