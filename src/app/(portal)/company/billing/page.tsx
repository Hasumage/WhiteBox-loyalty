
"use client";

import { Suspense, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BadgePercent,
  CalendarClock,
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  Loader2,
  RefreshCw,
  ReceiptText,
  ShieldCheck,
  Trash2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  applyCompanyBillingPromo,
  companyBilling,
  createCompanyBillingCheckout,
  deleteCompanyBillingPaymentMethod,
  getCompanyBillingPayment,
  payCompanyBillingInvoice,
  payCompanyBillingWithSavedPaymentMethod,
} from "@/lib/api/company-client";

type Data = Awaited<ReturnType<typeof companyBilling>>;

function money(value: number | string | null | undefined) {
  const amount = typeof value === "string" ? Number(value) : value ?? 0;
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" }).format(Number(amount) || 0);
}

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

export default function CompanyBillingPage() {
  return (
    <Suspense
      fallback={
        <main className="space-y-6 p-8 text-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-100" />
          <p className="text-muted-foreground">Загружаю оплату подписки...</p>
        </main>
      }
    >
      <CompanyBillingContent />
    </Suspense>
  );
}

function CompanyBillingContent() {
  const searchParams = useSearchParams();
  const paymentUuid = searchParams.get("payment");
  const [data, setData] = useState<Data | null>(null);
  const [promo, setPromo] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "error" | "success">("info");
  const [loading, setLoading] = useState(true);
  const [balancePaying, setBalancePaying] = useState(false);
  const [checkoutPaying, setCheckoutPaying] = useState(false);
  const [savedMethodPaying, setSavedMethodPaying] = useState(false);
  const [deletingPaymentMethod, setDeletingPaymentMethod] = useState(false);
  const [syncingPayment, setSyncingPayment] = useState(false);
  const [savePaymentMethod, setSavePaymentMethod] = useState(false);
  const [checkCooldownUntil, setCheckCooldownUntil] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  async function load() {
    setLoading(true);
    try {
      const next = await companyBilling();
      setData(next);
      setMessage("");
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить подписку NearLoy.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!checkCooldownUntil) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [checkCooldownUntil]);

  useEffect(() => {
    if (!paymentUuid) return;
    let cancelled = false;

    async function syncPayment() {
      setSyncingPayment(true);
      setMessageTone("info");
      setMessage("Проверяю оплату YooKassa...");
      try {
        const result = await getCompanyBillingPayment(paymentUuid!);
        if (cancelled) return;
        if (result.status === "SUCCEEDED") {
          setMessageTone("success");
          setMessage("Оплата через YooKassa прошла успешно. Подписка NearLoy продлена.");
          await load();
        } else if (result.status === "FAILED" || result.status === "CANCELED" || result.status === "EXPIRED") {
          setMessageTone("error");
          setMessage("YooKassa не подтвердила оплату. Попробуйте оплатить ещё раз.");
        } else {
          setMessageTone("info");
          setMessage("Оплата создана. Если вы уже оплатили счёт, статус обновится после подтверждения YooKassa.");
        }
        window.history.replaceState(null, "", "/company/billing");
      } catch (error) {
        if (!cancelled) {
          setMessageTone("error");
          setMessage(error instanceof Error ? error.message : "Не удалось проверить оплату YooKassa.");
        }
      } finally {
        if (!cancelled) setSyncingPayment(false);
      }
    }

    void syncPayment();
    return () => {
      cancelled = true;
    };
  }, [paymentUuid]);

  async function payWithSavedMethod() {
    setSavedMethodPaying(true);
    try {
      const payment = await payCompanyBillingWithSavedPaymentMethod();
      if (payment.status === "SUCCEEDED") {
        setMessageTone("success");
        setMessage("Оплата сохранённым способом прошла успешно.");
      } else {
        setMessageTone("info");
        setMessage("Платёж сохранённым способом создан. Статус обновится после подтверждения YooKassa.");
      }
      await load();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Не удалось оплатить сохранённым способом.");
    } finally {
      setSavedMethodPaying(false);
    }
  }

  async function deleteSavedMethod() {
    setDeletingPaymentMethod(true);
    try {
      await deleteCompanyBillingPaymentMethod();
      setMessageTone("success");
      setMessage("Сохранённый способ оплаты удалён.");
      await load();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Не удалось удалить способ оплаты.");
    } finally {
      setDeletingPaymentMethod(false);
    }
  }

  const invoice = data?.invoice;
  const isTrialActive = data?.account?.status === "TRIAL";
  const trialEndsAt = formatDate(data?.account?.trialEndsAt);
  const invoiceClosed = invoice?.status === "PAID" || invoice?.status === "WAIVED";
  const amountDue = invoiceClosed ? 0 : Number(invoice?.amountDue ?? 0);
  const activePayment = amountDue > 0 ? data?.activePayment ?? null : null;
  const billingHistory = [...(data?.history ?? [])].sort((left, right) => {
    const rightTime = new Date(right.createdAt).getTime();
    const leftTime = new Date(left.createdAt).getTime();
    return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
  });
  const cooldownLeftMs = checkCooldownUntil ? Math.max(0, checkCooldownUntil - nowMs) : 0;
  const checkBlocked = cooldownLeftMs > 0;
  const cooldownLeftMinutes = Math.max(1, Math.ceil(cooldownLeftMs / 60_000));
  const canPayFromBalance = Boolean(data && amountDue > 0 && Number(data.availableBalance) >= amountDue);

  function cooldownStorageKey(paymentUuid: string) {
    return `nearloy-company-billing-payment-check:${paymentUuid}`;
  }

  function startPaymentCheckCooldown(paymentUuid: string) {
    const until = Date.now() + 5 * 60 * 1000;
    setCheckCooldownUntil(until);
    window.localStorage.setItem(cooldownStorageKey(paymentUuid), String(until));
  }

  function clearPaymentCheckCooldown(paymentUuid: string) {
    setCheckCooldownUntil(null);
    window.localStorage.removeItem(cooldownStorageKey(paymentUuid));
  }

  useEffect(() => {
    if (!activePayment?.uuid) {
      setCheckCooldownUntil(null);
      return;
    }
    const stored = Number(window.localStorage.getItem(cooldownStorageKey(activePayment.uuid)));
    setCheckCooldownUntil(Number.isFinite(stored) && stored > Date.now() ? stored : null);
  }, [activePayment?.uuid]);

  async function applyPromo() {
    if (!promo.trim()) return;
    try {
      const result = await applyCompanyBillingPromo(promo.trim());
      setData((current) => current ? { ...current, invoice: result.invoice } : current);
      setMessageTone("success");
      setMessage("Промокод применён. Сумма обновлена.");
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Промокод не применён.");
    }
  }

  async function payFromBalance() {
    if (!canPayFromBalance) return;
    setBalancePaying(true);
    try {
      await payCompanyBillingInvoice();
      setMessageTone("success");
      setMessage("Подписка NearLoy оплачена с баланса компании.");
      await load();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Не удалось оплатить счёт с баланса.");
    } finally {
      setBalancePaying(false);
    }
  }

  async function payViaYooKassa() {
    if (activePayment?.confirmationUrl) {
      window.open(activePayment.confirmationUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setCheckoutPaying(true);
    try {
      const checkout = await createCompanyBillingCheckout(savePaymentMethod);
      if (!checkout.confirmationUrl) throw new Error("YooKassa не вернула ссылку на оплату.");
      window.location.assign(checkout.confirmationUrl);
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Не удалось создать оплату YooKassa.");
      setCheckoutPaying(false);
    }
  }

  async function checkReservedPayment() {
    if (!activePayment) return;
    setSyncingPayment(true);
    try {
      const result = await getCompanyBillingPayment(activePayment.uuid);
      if (result.status === "SUCCEEDED") {
        setMessageTone("success");
        setMessage("Оплата подтверждена. Подписка NearLoy продлена.");
        clearPaymentCheckCooldown(activePayment.uuid);
        await load();
      } else if (result.status === "FAILED" || result.status === "CANCELED" || result.status === "EXPIRED") {
        setMessageTone("error");
        setMessage("Эта ссылка уже не активна. Можно создать новую оплату.");
        clearPaymentCheckCooldown(activePayment.uuid);
        await load();
      } else {
        setMessageTone("info");
        setMessage("Оплата пока не подтверждена. Если вы уже оплатили, статус может обновиться в течение 15 минут.");
        startPaymentCheckCooldown(activePayment.uuid);
      }
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Не удалось проверить оплату.");
      startPaymentCheckCooldown(activePayment.uuid);
    } finally {
      setSyncingPayment(false);
    }
  }

  return (
    <main className="space-y-4 p-4 text-foreground sm:space-y-6 sm:p-8">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100">Биллинг</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Подписка NearLoy</h1>
        </div>
        <ReceiptText className="h-5 w-5 shrink-0 text-cyan-100" />
      </header>

      {message ? <StatusMessage tone={messageTone}>{message}</StatusMessage> : null}
      {syncingPayment ? <StatusMessage tone="info">Проверяю оплату YooKassa...</StatusMessage> : null}

      {loading ? (
        <div className="rounded-[1.75rem] border border-border bg-card p-5 sm:rounded-[2rem] sm:p-8">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-100" />
          <p className="mt-4 text-muted-foreground">Загружаю данные подписки...</p>
        </div>
      ) : data ? (
        <>
          <section className="overflow-hidden rounded-[1.75rem] border border-cyan-300/25 bg-[radial-gradient(circle_at_0%_0%,rgba(34,211,238,0.18),transparent_36%),rgba(8,12,18,0.94)] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.32)] sm:rounded-[2rem] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/80">Статус подписки</p>
                <p className="mt-2 break-words text-4xl font-semibold leading-none text-cyan-50 sm:text-5xl">
                  {amountDue > 0 ? money(amountDue) : "Оплачено"}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {amountDue > 0
                    ? `Баланс компании: ${money(data.availableBalance)}`
                    : isTrialActive
                      ? `Тестовый период до ${trialEndsAt}`
                      : "Доступ компании активен."}
                </p>
              </div>
              <span className={`rounded-2xl border p-3 ${amountDue > 0 ? "border-cyan-200/20 bg-cyan-300/10 text-cyan-100" : "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"}`}>
                {amountDue > 0 ? <CreditCard className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
              </span>
            </div>

            {activePayment?.confirmationUrl ? (
              <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-amber-100">
                  <Clock3 className="h-4 w-4" /> Платёж зарезервирован
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Сумма: {money(activePayment.amount)} · статус: {activePayment.status}
                  {activePayment.expiresAt ? ` · до ${formatDate(activePayment.expiresAt)}` : ""}
                </p>
              </div>
            ) : null}

            {amountDue > 0 ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Button type="button" disabled={checkoutPaying} onClick={payViaYooKassa} className="h-12 rounded-xl">
                  <ActionIcon loading={checkoutPaying} icon={activePayment?.confirmationUrl ? ExternalLink : CreditCard} />
                  {activePayment?.confirmationUrl ? "Открыть оплату" : "Оплатить YooKassa"}
                </Button>
                {activePayment?.confirmationUrl ? (
                  <Button type="button" variant="secondary" disabled={syncingPayment || checkBlocked} onClick={checkReservedPayment} className="h-12 rounded-xl">
                    <ActionIcon loading={syncingPayment} icon={RefreshCw} />
                    {checkBlocked ? `${cooldownLeftMinutes} мин.` : "Проверить"}
                  </Button>
                ) : (
                  <Button type="button" disabled={!canPayFromBalance || balancePaying} onClick={payFromBalance} variant="secondary" className="h-12 rounded-xl">
                    <ActionIcon loading={balancePaying} icon={Wallet} />
                    С баланса
                  </Button>
                )}
              </div>
            ) : null}
            {amountDue > 0 && !activePayment?.confirmationUrl ? (
              <label className="mt-3 flex items-start gap-3 rounded-2xl border border-cyan-300/15 bg-black/20 p-3 text-xs leading-5 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={savePaymentMethod}
                  onChange={(event) => setSavePaymentMethod(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-cyan-300"
                  disabled={checkoutPaying}
                />
                <span>
                  <span className="block font-semibold text-foreground">Сохранить карту для следующих оплат</span>
                  NearLoy не хранит данные карт.
                </span>
              </label>
            ) : null}
          </section>

          {amountDue > 0 ? (
            <section className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-4">
              <Metric icon={ReceiptText} label="Базовая цена" value={money(invoice?.baseFee ?? 4990)} />
              <Metric icon={BadgePercent} label="Скидка" value={`-${money(invoice?.promoDiscountAmount ?? 0)}`} />
              <Metric icon={CheckCircle2} label="Зачёт комиссии" value={`-${money(invoice?.commissionCreditAmount ?? 0)}`} />
              <Metric icon={CreditCard} label="К оплате" value={money(amountDue)} accent />
            </section>
          ) : null}

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[1.75rem] border border-border bg-card p-4 sm:rounded-[2rem] sm:p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold sm:text-xl">
                <BadgePercent className="h-5 w-5 text-cyan-100" /> Промокод
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">Если менеджер выдал скидку, примените её до оплаты.</p>
              <div className="mt-4 grid gap-2 sm:mt-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-3">
                <Input value={promo} onChange={(event) => setPromo(event.target.value.toUpperCase())} placeholder="Введите промокод" className="h-12 rounded-xl" />
                <Button type="button" onClick={applyPromo} disabled={!promo.trim()} className="h-12 rounded-xl">Применить</Button>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-cyan-300/20 bg-cyan-300/10 p-4 sm:rounded-[2rem] sm:p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold sm:text-xl">
                <ShieldCheck className="h-5 w-5 text-cyan-100" /> Способ оплаты
              </h2>
              {data.savedPaymentMethod ? (
                <div className="mt-4 rounded-2xl border border-cyan-300/25 bg-background/55 p-3 sm:p-4">
                  <div className="space-y-4">
                    <div className="flex min-w-0 gap-3">
                      <CreditCard className="mt-1 h-5 w-5 shrink-0 text-cyan-100" />
                      <div className="min-w-0">
                        <p className="font-semibold">Сохранённый способ оплаты</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {data.savedPaymentMethod.title}
                          {data.savedPaymentMethod.cardLast4 ? ` · •••• ${data.savedPaymentMethod.cardLast4}` : ""}
                          {data.savedPaymentMethod.cardType ? ` · ${data.savedPaymentMethod.cardType}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <Button type="button" disabled={amountDue <= 0 || savedMethodPaying} onClick={payWithSavedMethod} variant="secondary" className="h-11 w-full rounded-xl">
                        <ActionIcon loading={savedMethodPaying} icon={CreditCard} />
                        Оплатить сохранённым
                      </Button>
                      <Button type="button" disabled={deletingPaymentMethod} onClick={deleteSavedMethod} variant="secondary" className="h-11 w-full rounded-xl sm:w-auto">
                        <ActionIcon loading={deletingPaymentMethod} icon={Trash2} />
                        Удалить
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-background/45 p-4 text-sm leading-6 text-muted-foreground">
                  Сохранённой карты пока нет. Её можно добавить при оплате через YooKassa в верхнем блоке.
                </div>
              )}
              {!canPayFromBalance && amountDue > 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Для оплаты с баланса не хватает средств. Используйте YooKassa.</p>
              ) : null}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-border bg-card p-4 sm:rounded-[2rem] sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold sm:text-xl">
              <CalendarClock className="h-5 w-5 text-cyan-100" /> История оплат
            </h2>
            <div className="mt-4 space-y-2 sm:mt-5 sm:space-y-3">
              {billingHistory.length ? billingHistory.map((row) => (
                <div key={row.uuid} className="grid gap-2 rounded-2xl border border-border bg-background/60 p-3 sm:p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div>
                    <p className="font-semibold">{money(row.paidAmount ?? row.amountDue)}</p>
                    <p className="text-sm text-muted-foreground">Статус: {row.status}</p>
                  </div>
                  <p className="text-sm text-muted-foreground md:text-right">{formatDate(row.createdAt)}</p>
                </div>
              )) : <p className="text-muted-foreground">История оплат пока пустая.</p>}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

function StatusMessage({ tone, children }: { tone: "info" | "error" | "success"; children: ReactNode }) {
  const toneClass = tone === "error"
    ? "border-red-400/30 bg-red-500/10 text-red-100"
    : tone === "success"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
      : "border-cyan-300/25 bg-cyan-300/10 text-cyan-50";
  return <div className={`rounded-[1.5rem] border px-4 py-3 text-sm leading-6 sm:px-5 sm:py-4 sm:text-base ${toneClass}`}>{children}</div>;
}

function ActionIcon({ loading, icon: Icon }: { loading: boolean; icon: LucideIcon }) {
  return (
    <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
      <Icon className={`absolute h-4 w-4 transition-opacity ${loading ? "opacity-0" : "opacity-100"}`} />
      <Loader2 className={`absolute h-4 w-4 animate-spin transition-opacity ${loading ? "opacity-100" : "opacity-0"}`} />
    </span>
  );
}

function Metric({ icon: Icon, label, value, accent }: { icon: LucideIcon; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-[1.35rem] border p-3 sm:rounded-[1.5rem] sm:p-6 ${accent ? "border-cyan-300/30 bg-cyan-300/10" : "border-border bg-card"}`}>
      <Icon className="h-4 w-4 text-cyan-100 sm:h-5 sm:w-5" />
      <p className="mt-3 line-clamp-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:mt-5 sm:text-xs sm:tracking-[0.28em]">{label}</p>
      <p className="mt-2 break-words text-xl font-semibold leading-tight sm:mt-3 sm:text-3xl">{value}</p>
    </div>
  );
}
