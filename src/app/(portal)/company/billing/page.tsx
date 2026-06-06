"use client";

import { useEffect, useState } from "react";
import { BadgePercent, CalendarClock, CheckCircle2, CreditCard, Gift, ReceiptText, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyCompanyBillingPromo, companyBilling, payCompanyBillingInvoice } from "@/lib/api/company-client";

type Data = Awaited<ReturnType<typeof companyBilling>>;
const money = (value: number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" }).format(value);

export default function CompanyBillingPage() {
  const [data, setData] = useState<Data | null>(null);
  const [promo, setPromo] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      setData(await companyBilling());
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить абонентскую плату.");
    }
  }

  useEffect(() => { void load(); }, []);

  const invoice = data?.invoice;
  const trialEndsAt = data?.account.status === "TRIAL" ? data.account.trialEndsAt : null;

  return (
    <div className="space-y-6">
      <header>
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
          <ReceiptText className="h-4 w-4" /> WhiteBox Club
        </p>
        <h1 className="text-3xl font-semibold">Абонентская плата</h1>
        <p className="mt-2 text-muted-foreground">
          Комиссия 12% с продаж подписок автоматически уменьшает ежемесячный платёж WhiteBox.
        </p>
      </header>

      {message && <div className="rounded-2xl border border-red-300/20 bg-red-300/10 p-4 text-sm text-red-100">{message}</div>}

      {trialEndsAt && (
        <section className="rounded-[2rem] border border-cyan-200/20 bg-[radial-gradient(circle_at_10%_10%,rgba(103,232,249,0.18),transparent_45%),rgba(255,255,255,0.03)] p-6">
          <Gift className="h-7 w-7 text-cyan-100" />
          <h2 className="mt-4 text-2xl font-semibold">30 дней WhiteBox бесплатно</h2>
          <p className="mt-2 text-muted-foreground">Тестовый период действует до {new Date(trialEndsAt).toLocaleDateString("ru-RU")}.</p>
        </section>
      )}

      {invoice && (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={ReceiptText} label="Базовая стоимость" value={money(Number(invoice.baseFee))} />
          <Metric icon={BadgePercent} label="Скидка по промокоду" value={`-${money(Number(invoice.promoDiscountAmount))}`} />
          <Metric icon={CheckCircle2} label="Зачтено комиссией" value={`-${money(Number(invoice.commissionCreditAmount))}`} />
          <Metric icon={CreditCard} label="К оплате" value={money(Number(invoice.amountDue))} accent />
        </section>
      )}

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
          <h2 className="flex items-center gap-2 font-semibold"><BadgePercent className="h-4 w-4" /> Промокод</h2>
          <div className="mt-4 flex gap-2">
            <Input value={promo} onChange={(event) => setPromo(event.target.value.toUpperCase())} placeholder="Введите промокод" />
            <Button disabled={!promo.trim()} onClick={async () => {
              try {
                setData(await applyCompanyBillingPromo(promo));
                setPromo("");
                setMessage("Промокод применён.");
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Промокод недоступен.");
              }
            }}>Применить</Button>
          </div>
        </div>

        <div className="rounded-3xl border border-cyan-200/15 bg-cyan-300/[0.035] p-5">
          <h2 className="flex items-center gap-2 font-semibold"><Wallet className="h-4 w-4" /> Баланс WhiteBox</h2>
          <p className="mt-3 text-3xl font-semibold">{money(data?.availableBalance ?? 0)}</p>
          <p className="mt-2 text-sm text-muted-foreground">Оплата списывается из заработанного и доступного компании баланса.</p>
          <Button
            className="mt-4 w-full"
            disabled={!invoice || invoice.status !== "OPEN" || Number(invoice.amountDue) > (data?.availableBalance ?? 0)}
            onClick={async () => {
              try {
                setData(await payCompanyBillingInvoice());
                setMessage("Абонентская плата успешно оплачена.");
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Не удалось оплатить счёт.");
              }
            }}
          >
            <CreditCard /> Оплатить с баланса
          </Button>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">
        <h2 className="mb-4 flex items-center gap-2 font-semibold"><CalendarClock className="h-4 w-4" /> История начислений</h2>
        <div className="space-y-2">
          {data?.history.length
            ? data.history.map((row) => (
              <div key={row.uuid} className="flex flex-wrap justify-between gap-2 rounded-2xl border border-white/10 p-4 text-sm">
                <span>{new Date(row.periodStartsAt).toLocaleDateString("ru-RU")} — {new Date(row.periodEndsAt).toLocaleDateString("ru-RU")}</span>
                <strong>{row.status}: {money(row.amountDue)}</strong>
              </div>
            ))
            : <p className="text-sm text-muted-foreground">История счетов пока пуста.</p>}
        </div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value, accent = false }: { icon: typeof ReceiptText; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-3xl border p-5 ${accent ? "border-cyan-200/25 bg-cyan-300/10" : "border-white/10 bg-white/[0.035]"}`}>
      <Icon className="h-5 w-5 text-cyan-100" />
      <p className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
