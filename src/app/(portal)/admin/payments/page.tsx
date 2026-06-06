"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  ReceiptText,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { adminListPayments, type AdminPaymentRow, type AdminPaymentStatus, type AdminPaymentsResponse } from "@/lib/api/admin-client";

const STATUS_FILTERS: Array<{ value: AdminPaymentStatus | ""; label: string }> = [
  { value: "", label: "Все" },
  { value: "PENDING", label: "Ожидают" },
  { value: "WAITING_FOR_CAPTURE", label: "Холд" },
  { value: "SUCCEEDED", label: "Оплачены" },
  { value: "CANCELED", label: "Отменены" },
  { value: "FAILED", label: "Ошибки" },
  { value: "REFUNDED", label: "Возвраты" },
];

const STATUS_COPY: Record<AdminPaymentStatus, { label: string; tone: string; icon: typeof Clock3 }> = {
  PENDING: { label: "Ожидает оплаты", tone: "border-amber-400/25 bg-amber-500/10 text-amber-100", icon: Clock3 },
  WAITING_FOR_CAPTURE: { label: "Ожидает списания", tone: "border-sky-400/25 bg-sky-500/10 text-sky-100", icon: Clock3 },
  SUCCEEDED: { label: "Оплачен", tone: "border-emerald-400/25 bg-emerald-500/10 text-emerald-100", icon: CheckCircle2 },
  CANCELED: { label: "Отменен", tone: "border-white/10 bg-white/5 text-muted-foreground", icon: XCircle },
  FAILED: { label: "Ошибка", tone: "border-red-400/25 bg-red-500/10 text-red-100", icon: AlertTriangle },
  REFUNDED: { label: "Возврат", tone: "border-violet-400/25 bg-violet-500/10 text-violet-100", icon: RefreshCw },
};

function money(value: string | number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 2 }).format(Number(value || 0));
}

function dateTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function paymentPlan(payment: AdminPaymentRow) {
  if (payment.plan) return payment.plan.name;
  return payment.purpose === "USER_SUBSCRIPTION_BUNDLE" ? "Парная подписка" : "Подписка";
}

function PaymentStatusBadge({ status }: { status: AdminPaymentStatus }) {
  const copy = STATUS_COPY[status];
  const Icon = copy.icon;
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${copy.tone}`}>
      <Icon className="h-3.5 w-3.5" />
      {copy.label}
    </span>
  );
}

function SummaryCard({ icon: Icon, label, value, hint }: { icon: typeof CreditCard; label: string; value: string; hint: string }) {
  return (
    <Card className="glass border-white/10 bg-white/[0.025]">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
          <p className="mt-3 text-3xl font-semibold">{value}</p>
          <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
        </div>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100 shadow-[0_0_30px_rgba(103,232,249,0.12)]">
          <Icon className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  );
}

export default function AdminPaymentsPage() {
  const [data, setData] = useState<AdminPaymentsResponse | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AdminPaymentStatus | "">("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(nextPage = page) {
    setLoading(true);
    setError(null);
    const result = await adminListPayments({ query: query.trim(), status, page: nextPage, limit: 20 });
    if (!result) {
      setError("Не удалось загрузить платежи. Проверьте доступ к финансам и API.");
      setData(null);
    } else {
      setData(result);
      setPage(result.page);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const dangerCount = useMemo(() => {
    if (!data) return 0;
    return data.summary.failed + data.summary.canceled + data.summary.refunded;
  }, [data]);

  return (
    <div className="space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.18),transparent_36%),linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] p-8 shadow-[0_0_70px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100">
              <CreditCard className="h-4 w-4" />
              YooKassa
            </span>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight">Платежи</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Все клиентские оплаты подписок: статус провайдера, пользователь, компания, сумма и ссылка на оплату при незавершенном платеже.
            </p>
          </div>
          <Button variant="secondary" onClick={() => void load(page)} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Обновить
          </Button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={ReceiptText} label="Оплачено" value={money(data?.summary.succeededAmount ?? 0)} hint={`${data?.summary.succeeded ?? 0} успешных платежей`} />
        <SummaryCard icon={Clock3} label="В ожидании" value={String((data?.summary.pending ?? 0) + (data?.summary.waitingForCapture ?? 0))} hint="Клиенты еще не завершили оплату" />
        <SummaryCard icon={CheckCircle2} label="В выборке" value={String(data?.total ?? 0)} hint="Платежей по текущим фильтрам" />
        <SummaryCard icon={AlertTriangle} label="Требуют внимания" value={String(dangerCount)} hint="Ошибки, отмены и возвраты" />
      </div>

      <Card className="glass border-white/10">
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void load(1);
                }}
                placeholder="Поиск по email, имени, компании, плану или ID платежа"
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 pl-11 pr-4 text-sm outline-none transition focus:border-cyan-200/45 focus:ring-2 focus:ring-cyan-300/15"
              />
            </div>
            <Button onClick={() => void load(1)} className="gap-2">
              <Search className="h-4 w-4" />
              Найти
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((item) => (
              <button
                key={item.value || "all"}
                type="button"
                onClick={() => setStatus(item.value)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${status === item.value ? "border-white bg-white text-black" : "border-white/10 bg-white/[0.04] text-muted-foreground hover:text-white"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-red-100">{error}</div>
      )}

      <div className="space-y-3">
        {loading && !data ? (
          <Card className="glass border-white/10"><CardContent className="p-8 text-muted-foreground">Загружаю платежи...</CardContent></Card>
        ) : data?.items.length ? (
          data.items.map((payment) => (
            <Card key={payment.uuid} className="glass border-white/10 bg-white/[0.02] transition hover:border-cyan-200/25">
              <CardContent className="grid gap-5 p-5 xl:grid-cols-[1.15fr_0.8fr_0.8fr_auto] xl:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <PaymentStatusBadge status={payment.status} />
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted-foreground">{payment.provider}</span>
                  </div>
                  <h2 className="mt-3 truncate text-lg font-semibold">{paymentPlan(payment)}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{payment.description}</p>
                  <p className="mt-2 font-mono text-xs text-muted-foreground">{payment.uuid}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Клиент</p>
                  <p className="mt-2 truncate font-semibold">{payment.user.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{payment.user.email}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Компания</p>
                  <p className="mt-2 truncate font-semibold">{payment.company?.name ?? "-"}</p>
                  <p className="text-sm text-muted-foreground">Создан: {dateTime(payment.createdAt)}</p>
                  <p className="text-sm text-muted-foreground">Оплачен: {dateTime(payment.paidAt)}</p>
                </div>

                <div className="flex flex-col items-start gap-3 xl:items-end">
                  <p className="text-2xl font-semibold">{money(payment.amount)}</p>
                  {payment.confirmationUrl && payment.status === "PENDING" && (
                    <a href={payment.confirmationUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-sm hover:bg-white/10">
                      Ссылка оплаты <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {payment.providerPaymentId && <p className="max-w-[220px] truncate font-mono text-xs text-muted-foreground">{payment.providerPaymentId}</p>}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="glass border-white/10"><CardContent className="p-8 text-muted-foreground">Платежи по этим условиям не найдены.</CardContent></Card>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Страница {data?.page ?? page} / {data?.totalPages ?? 1}</span>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={loading || page <= 1} onClick={() => void load(page - 1)}>Назад</Button>
          <Button variant="secondary" disabled={loading || page >= (data?.totalPages ?? 1)} onClick={() => void load(page + 1)}>Далее</Button>
        </div>
      </div>
    </div>
  );
}
