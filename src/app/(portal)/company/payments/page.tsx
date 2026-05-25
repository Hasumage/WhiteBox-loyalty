"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Clock3, CreditCard, ReceiptText, ShieldCheck, TrendingUp, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { companyFinance, requestCompanyPayout } from "@/lib/api/company-client";

type FinanceData = Awaited<ReturnType<typeof companyFinance>>;

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" }).format(value);
}

export default function CompanyPaymentsPage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      setData(await companyFinance());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Финансы недоступны.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function requestPayout() {
    try {
      await requestCompanyPayout({ amount: Number(amount), details });
      setAmount("");
      setDetails("");
      setMessage("Заявка отправлена на подтверждение WhiteBox.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось отправить заявку.");
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">Расчёты</p>
        <h1 className="text-3xl font-semibold">Финансы компании</h1>
        <p className="mt-2 text-sm text-muted-foreground">Прогноз подписок, запросы на выплаты и прозрачная история согласований.</p>
      </header>

      {(message || error) && (
        <div className={`rounded-2xl border p-4 text-sm ${error ? "border-red-300/20 bg-red-400/10 text-red-100" : "border-cyan-300/20 bg-cyan-300/[0.06] text-cyan-50"}`}>
          {error || message}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="overflow-hidden border-cyan-300/20 bg-[linear-gradient(140deg,rgba(103,232,249,0.085),rgba(255,255,255,0.025))] py-0">
          <CardContent className="relative p-5">
            <span className="mb-4 inline-flex rounded-xl border border-cyan-200/15 bg-cyan-200/[0.06] p-2.5 text-cyan-100">
              <Wallet className="h-5 w-5" />
            </span>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Текущий доход</p>
            <p className="mt-2 text-3xl font-semibold">{data ? money(data.subscriptionGross) : "-"}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Стоимость активных оформленных подписок</p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-cyan-300/20 bg-[linear-gradient(140deg,rgba(103,232,249,0.085),rgba(255,255,255,0.025))] py-0">
          <CardContent className="p-5">
            <span className="mb-4 inline-flex rounded-xl border border-cyan-200/15 bg-cyan-200/[0.06] p-2.5 text-cyan-100">
              <TrendingUp className="h-5 w-5" />
            </span>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Потенциал / месяц</p>
            <p className="mt-2 text-3xl font-semibold">{data ? money(data.monthlyRecurringRevenue) : "-"}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Если активные подписки продлятся</p>
          </CardContent>
        </Card>
        <Card className="glass border-white/10 py-0">
          <CardContent className="p-5">
            <ReceiptText className="mb-4 h-5 w-5 text-cyan-100" />
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Подписчиков</p>
            <p className="mt-2 text-3xl font-semibold">{data?.activeSubscribers ?? "-"}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Активные клиенты подписок</p>
          </CardContent>
        </Card>
        <Card className="glass border-white/10 py-0">
          <CardContent className="p-5">
            <Clock3 className="mb-4 h-5 w-5 text-cyan-100" />
            <p className="text-xs uppercase tracking-widest text-muted-foreground">В обработке</p>
            <p className="mt-2 text-3xl font-semibold">{data?.operations.filter((operation) => operation.status === "PENDING_APPROVAL").length ?? "-"}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Заявки на выплату</p>
          </CardContent>
        </Card>
      </section>

      <p className="rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3 text-xs leading-5 text-muted-foreground">
        Показатели отражают доход по подпискам до комиссий, налогов и подтверждения выплат. Чистую прибыль можно будет считать после подключения правил удержаний.
      </p>

      <div className="grid gap-4 xl:grid-cols-[430px_minmax(0,1fr)]">
        <Card className="border-cyan-300/15 bg-cyan-300/[0.035] py-0">
          <CardContent className="space-y-4 p-5">
            <h2 className="flex items-center gap-2 font-semibold"><ArrowUpRight className="h-4 w-4" /> Запросить вывод</h2>
            <p className="text-sm text-muted-foreground">Заявка будет сверена с фактически оплаченными подписками и подтверждена финансовым сотрудником WhiteBox.</p>
            <Input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min={1} placeholder="Сумма, ₽" className="h-12 rounded-xl" />
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="Комментарий к выплате (необязательно)"
              className="min-h-24 w-full resize-y rounded-xl border border-input bg-transparent p-3 text-sm outline-none focus:border-cyan-200/40"
            />
            <Button onClick={() => void requestPayout()} disabled={!Number(amount)} className="h-12 w-full rounded-xl"><CreditCard /> Создать заявку</Button>
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-cyan-100" /> Выплаты доступны только подтверждённой компании.</p>
          </CardContent>
        </Card>

        <Card className="glass border-white/10 py-0">
          <CardContent className="p-5">
            <h2 className="mb-4 font-semibold">История операций</h2>
            <div className="space-y-2">
              {data?.operations.map((operation) => (
                <div key={operation.uuid} className="flex flex-col justify-between gap-3 rounded-2xl border border-white/10 p-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="font-semibold">{operation.title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(operation.createdAt).toLocaleString("ru-RU")}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-semibold">{money(operation.amount)}</p>
                    <Badge variant="outline">{operation.status}</Badge>
                  </div>
                </div>
              ))}
              {data && data.operations.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-muted-foreground">Финансовых операций пока нет.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
