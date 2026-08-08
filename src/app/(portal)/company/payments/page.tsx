"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, CircleAlert, Clock3, CreditCard, ReceiptText, ShieldCheck, TrendingUp, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { companyFinance, requestCompanyPayout } from "@/lib/api/company-client";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/features/subscriptions";

type FinanceData = Awaited<ReturnType<typeof companyFinance>>;
const MINIMUM_PAYOUT_RUB = 5_000;

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" }).format(value);
}

export default function CompanyPaymentsPage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const requestedAmount = Number(amount);
  const exceedsAvailable = Boolean(data && Number.isFinite(requestedAmount) && requestedAmount > data.availableForPayout);
  const belowMinimum = Boolean(amount && Number.isFinite(requestedAmount) && requestedAmount < MINIMUM_PAYOUT_RUB);
  const canRequestPayout = Boolean(data && requestedAmount >= MINIMUM_PAYOUT_RUB && !exceedsAvailable);

  async function load() {
    try {
      setData(await companyFinance());
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Финансы недоступны.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function requestPayout() {
    if (!Number.isFinite(requestedAmount) || requestedAmount < MINIMUM_PAYOUT_RUB) {
      setError(`Минимальная сумма вывода - ${money(MINIMUM_PAYOUT_RUB)}.`);
      return;
    }
    try {
      setError("");
      setMessage("");
      await requestCompanyPayout({ amount: Number(amount), details });
      setAmount("");
      setDetails("");
      setMessage("Заявка отправлена на подтверждение NearLoy.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось отправить заявку.");
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_0%_0%,rgba(103,232,249,0.14),transparent_34%),rgba(255,255,255,0.035)] p-4 sm:p-5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100 sm:text-xs">Расчёты</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Финансы компании</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Запросы на выплаты, сохранённые способы оплаты и прозрачная история согласований.</p>
      </header>

      {(message || error) && (
        <div className={`rounded-2xl border p-4 text-sm ${error ? "border-red-300/20 bg-red-400/10 text-red-100" : "border-cyan-300/20 bg-cyan-300/[0.06] text-cyan-50"}`}>
          {error || message}
        </div>
      )}

      <section className={`grid grid-cols-2 gap-2 sm:gap-3 ${SUBSCRIPTIONS_ENABLED ? "xl:grid-cols-5" : "xl:grid-cols-3"}`}>
        {/* #SubNearloyCode: метрики дохода клиентских подписок скрыты до запуска модуля. */}
        {SUBSCRIPTIONS_ENABLED && (
          <Card className="overflow-hidden border-cyan-300/20 bg-[linear-gradient(140deg,rgba(103,232,249,0.085),rgba(255,255,255,0.025))] py-0">
            <CardContent className="relative min-h-36 p-4 sm:p-5">
              <span className="mb-3 inline-flex rounded-xl border border-cyan-200/15 bg-cyan-200/[0.06] p-2.5 text-cyan-100 sm:mb-4">
                <Wallet className="h-5 w-5" />
              </span>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground sm:text-xs">Текущий доход</p>
              <p className="mt-2 break-words text-2xl font-semibold leading-tight sm:text-3xl">{data ? money(data.recognizedSubscriptionRevenue) : "-"}</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">Заработано по прошедшим дням</p>
            </CardContent>
          </Card>
        )}
        <Card className="col-span-2 overflow-hidden border-emerald-300/25 bg-[linear-gradient(140deg,rgba(52,211,153,0.12),rgba(255,255,255,0.025))] py-0 sm:col-span-1">
          <CardContent className="relative min-h-36 p-4 sm:p-5">
            <span className="mb-3 inline-flex rounded-xl border border-emerald-200/20 bg-emerald-200/[0.08] p-2.5 text-emerald-100 sm:mb-4">
              <ArrowUpRight className="h-5 w-5" />
            </span>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground sm:text-xs">Доступно к выводу</p>
            <p className="mt-2 break-words text-3xl font-semibold leading-tight text-emerald-50">{data ? money(data.availableForPayout) : "-"}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              После выплат и заявок в резерве
            </p>
          </CardContent>
        </Card>
        {/* #SubNearloyCode: прогноз и счётчик клиентских подписок возвращаются вместе с SUBSCRIPTIONS_ENABLED. */}
        {SUBSCRIPTIONS_ENABLED && (
          <>
            <Card className="overflow-hidden border-cyan-300/20 bg-[linear-gradient(140deg,rgba(103,232,249,0.085),rgba(255,255,255,0.025))] py-0">
              <CardContent className="min-h-36 p-4 sm:p-5">
                <span className="mb-3 inline-flex rounded-xl border border-cyan-200/15 bg-cyan-200/[0.06] p-2.5 text-cyan-100 sm:mb-4">
                  <TrendingUp className="h-5 w-5" />
                </span>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground sm:text-xs">Потенциал</p>
                <p className="mt-2 break-words text-2xl font-semibold leading-tight sm:text-3xl">{data ? money(data.potentialSubscriptionRevenue) : "-"}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Остаток активных сроков{data ? ` · +${money(data.dailySubscriptionRevenue)} в день` : ""}
                </p>
              </CardContent>
            </Card>
            <Card className="glass border-white/10 py-0">
              <CardContent className="min-h-36 p-4 sm:p-5">
                <ReceiptText className="mb-3 h-5 w-5 text-cyan-100 sm:mb-4" />
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground sm:text-xs">Подписчиков</p>
                <p className="mt-2 text-2xl font-semibold sm:text-3xl">{data?.activeSubscribers ?? "-"}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Активные клиенты подписок</p>
              </CardContent>
            </Card>
          </>
        )}
        <Card className="glass border-white/10 py-0">
          <CardContent className="min-h-36 p-4 sm:p-5">
            <Clock3 className="mb-3 h-5 w-5 text-cyan-100 sm:mb-4" />
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground sm:text-xs">В резерве</p>
            <p className="mt-2 break-words text-2xl font-semibold leading-tight sm:text-3xl">{data ? money(data.reservedPayouts) : "-"}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Заявки на рассмотрении или одобрены</p>
          </CardContent>
        </Card>
      </section>

      {/* #SubNearloyCode: пояснение по расчёту дохода клиентских подписок скрыто до запуска. */}
      {SUBSCRIPTIONS_ENABLED && (
        <p className="rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3 text-xs leading-5 text-muted-foreground">
          Текущий источник средств: активированные клиентами подписки. Доступно к выводу = признанный доход по прошедшим дням - оплаченные выплаты - заявки в резерве. До подключения платёжного провайдера это расчётный баланс, а не подтверждение фактического поступления денег.
        </p>
      )}

      <Card className="border-cyan-300/15 bg-cyan-300/[0.035] py-0">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-200/[0.07] text-cyan-100">
              <CreditCard className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="font-semibold">Сохранённые способы оплаты</h2>
              {data?.savedPaymentMethod ? (
                <p className="mt-1 break-words text-sm text-muted-foreground">
                  {data.savedPaymentMethod.title}
                  {data.savedPaymentMethod.cardLast4 ? ` · •••• ${data.savedPaymentMethod.cardLast4}` : ""}
                  {data.savedPaymentMethod.cardType ? ` · ${data.savedPaymentMethod.cardType}` : ""}
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Сохранённых карт пока нет.</p>
              )}
            </div>
          </div>
          <p className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-xs leading-5 text-muted-foreground sm:max-w-xl sm:border-0 sm:bg-transparent sm:p-0 sm:text-sm">
            NearLoy не хранит данные карт. Способ оплаты безопасно хранится на стороне YooKassa.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[430px_minmax(0,1fr)]">
        <Card className="border-cyan-300/15 bg-cyan-300/[0.035] py-0">
          <CardContent className="space-y-4 p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold sm:text-base"><ArrowUpRight className="h-4 w-4" /> Запросить вывод</h2>
            <p className="text-sm text-muted-foreground">Сервер зарезервирует только доступную заработанную сумму. Минимальный вывод - {money(MINIMUM_PAYOUT_RUB)}.</p>
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/10 px-3 py-3 text-sm">
              <span className="text-muted-foreground">Можно запросить</span>
              <button
                type="button"
                onClick={() => setAmount(String(data?.availableForPayout ?? ""))}
                className="text-right font-semibold text-emerald-100 transition hover:text-white"
              >
                {data ? money(data.availableForPayout) : "-"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" className="glass h-10 rounded-xl border-white/10 text-xs" onClick={() => setAmount(String(MINIMUM_PAYOUT_RUB))}>
                Минимум
              </Button>
              <Button type="button" variant="secondary" className="glass h-10 rounded-xl border-white/10 text-xs" onClick={() => setAmount(String(data?.availableForPayout ?? ""))}>
                Всё доступное
              </Button>
            </div>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Сумма вывода</span>
              <Input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min={MINIMUM_PAYOUT_RUB} max={data?.availableForPayout} placeholder="Сумма от 5 000 ₽" className="h-12 rounded-xl" />
            </label>
            {belowMinimum && (
              <p className="flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/[0.08] px-3 py-2 text-xs text-amber-100">
                <CircleAlert className="h-4 w-4 shrink-0" /> Для заявки нужно минимум {money(MINIMUM_PAYOUT_RUB)}.
              </p>
            )}
            {exceedsAvailable && (
              <p className="flex items-center gap-2 rounded-xl border border-red-300/20 bg-red-300/[0.08] px-3 py-2 text-xs text-red-100">
                <CircleAlert className="h-4 w-4 shrink-0" /> Сумма выше доступного остатка.
              </p>
            )}
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Комментарий</span>
              <textarea
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="Реквизиты, назначение или пометка для команды"
                className="min-h-24 w-full resize-y rounded-xl border border-input bg-transparent p-3 text-sm outline-none focus:border-cyan-200/40"
              />
            </label>
            <Button onClick={() => void requestPayout()} disabled={!canRequestPayout} className="h-12 w-full rounded-xl"><CreditCard /> Создать заявку</Button>
            <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-100" /> Выплаты доступны только подтверждённой компании.</p>
          </CardContent>
        </Card>

        <Card className="glass border-white/10 py-0">
          <CardContent className="p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-semibold">История операций</h2>
              <Badge variant="outline">{data?.operations.length ?? 0}</Badge>
            </div>
            <div className="space-y-2">
              {data?.operations.map((operation) => (
                <div key={operation.uuid} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{operation.title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(operation.createdAt).toLocaleString("ru-RU")}</p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <p className="font-semibold tabular-nums">{money(operation.amount)}</p>
                    <Badge variant="outline">{operation.status}</Badge>
                  </div>
                </div>
              ))}
              {data && data.operations.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm leading-6 text-muted-foreground sm:p-8">Финансовых операций пока нет.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
