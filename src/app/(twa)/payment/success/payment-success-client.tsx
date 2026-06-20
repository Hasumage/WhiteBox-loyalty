"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Clock3, Loader2, QrCode, ReceiptText, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getTwaPayment, refreshTwaDashboard, type TwaPaymentCheckout } from "@/lib/api/twa-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/features/subscriptions";

function formatDate(value: string | null, locale: "ru" | "en") {
  if (!value) return locale === "ru" ? "без даты окончания" : "no expiration date";
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusCopy(status: TwaPaymentCheckout["status"], locale: "ru" | "en") {
  if (status === "SUCCEEDED") return locale === "ru" ? "Оплата прошла успешно" : "Payment completed";
  if (status === "CANCELED" || status === "FAILED") return locale === "ru" ? "Оплата не завершена" : "Payment was not completed";
  return locale === "ru" ? "Оплата еще обрабатывается" : "Payment is still processing";
}

export function PaymentSuccessClient() {
  const { locale } = useI18n("ru");
  const params = useSearchParams();
  const routeParams = useParams<{ rest?: string[] }>();
  const paymentFromPath = Array.isArray(routeParams?.rest)
    ? routeParams.rest.find((part) => /^[0-9a-f-]{16,}$/i.test(part))
    : null;
  const paymentUuid = params.get("payment") ?? paymentFromPath ?? "";
  const [payment, setPayment] = useState<TwaPaymentCheckout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadPayment() {
    if (!paymentUuid) {
      setError(locale === "ru" ? "Номер платежа не найден." : "Payment number was not found.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await getTwaPayment(paymentUuid);
    if (!result.ok) {
      setError(result.message);
      setLoading(false);
      return;
    }
    setPayment(result.data);
    if (result.data.status === "SUCCEEDED") {
      await refreshTwaDashboard();
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentUuid]);

  const isSuccess = payment?.status === "SUCCEEDED";
  const isFailed = payment?.status === "FAILED" || payment?.status === "CANCELED";
  const title = payment ? statusCopy(payment.status, locale) : locale === "ru" ? "Проверяем оплату" : "Checking payment";
  const expiresAt = payment?.activatedSubscription?.expiresAt ?? null;
  const orderLabel = useMemo(() => payment?.providerPaymentId ?? payment?.uuid ?? paymentUuid, [payment, paymentUuid]);

  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="min-h-full px-4 pb-8 pt-8"
    >
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(165,243,252,0.18),_rgba(8,12,18,0.96)_45%,_rgba(5,7,10,0.98))] p-6 shadow-[0_0_60px_rgba(103,232,249,0.12)]">
        <div className="absolute right-[-40px] top-[-40px] h-36 w-36 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0.82, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.08, type: "spring", stiffness: 180, damping: 16 }}
            className={`flex h-20 w-20 items-center justify-center rounded-[1.6rem] border ${isFailed ? "border-red-300/30 bg-red-500/10" : "border-cyan-200/30 bg-cyan-300/10"}`}
          >
            {loading ? (
              <Loader2 className="h-10 w-10 animate-spin text-cyan-100" />
            ) : isFailed ? (
              <XCircle className="h-10 w-10 text-red-200" />
            ) : (
              <CheckCircle2 className="h-10 w-10 text-cyan-100" />
            )}
          </motion.div>

          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.35em] text-cyan-100/70">
            {locale === "ru" ? "NearLoy checkout" : "NearLoy checkout"}
          </p>
          <h1 className="mt-3 text-3xl font-bold leading-tight text-white">{title}</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-white/65">
            {isSuccess
              ? locale === "ru"
                ? "Подписка активирована и уже доступна в вашем аккаунте. Можно переходить к QR и пользоваться преимуществами."
                : "Your subscription is active and available on your account. You can open QR and use the benefits."
              : locale === "ru"
                ? "Если платеж уже списан, нажмите обновить: NearLoy повторно сверит статус с YooKassa."
                : "If the payment was charged, refresh the status and NearLoy will sync it with YooKassa again."}
          </p>
        </div>
      </section>

      {error && (
        <p className="mt-4 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <section className="mt-5 grid gap-3">
        <Card className="glass border-white/10">
          <CardContent className="grid gap-4 p-4">
            <div className="flex items-start gap-3">
              <ReceiptText className="mt-0.5 h-5 w-5 text-cyan-100" />
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{locale === "ru" ? "Номер заказа" : "Order number"}</p>
                <p className="mt-1 break-all font-semibold">{orderLabel || "-"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-cyan-100" />
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{locale === "ru" ? "Подписка" : "Subscription"}</p>
                <p className="mt-1 font-semibold">{payment?.plan?.name ?? (locale === "ru" ? "Проверяем тариф" : "Checking plan")}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock3 className="mt-0.5 h-5 w-5 text-cyan-100" />
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{locale === "ru" ? "Действует до" : "Valid until"}</p>
                <p className="mt-1 font-semibold">{formatDate(expiresAt, locale)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="mt-5 grid gap-3">
        {isSuccess ? (
          <Button asChild size="lg" className="h-14 rounded-2xl">
            <Link href="/scan" className="inline-flex items-center justify-center gap-2">
              <QrCode className="h-5 w-5" />
              {locale === "ru" ? "Перейти к QR" : "Open QR"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <Button size="lg" className="h-14 rounded-2xl" disabled={loading} onClick={() => void loadPayment()}>
            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <RefreshCw className="mr-2 h-5 w-5" />}
            {locale === "ru" ? "Обновить статус оплаты" : "Refresh payment status"}
          </Button>
        )}
        <Button asChild variant="secondary" className="h-12 rounded-2xl">
          <Link href={SUBSCRIPTIONS_ENABLED ? "/marketplace" : "/app"}>
            {locale === "ru"
              ? SUBSCRIPTIONS_ENABLED ? "Вернуться к подпискам" : "Вернуться в кошелёк"
              : SUBSCRIPTIONS_ENABLED ? "Back to subscriptions" : "Back to wallet"}
          </Link>
        </Button>
      </div>
    </motion.main>
  );
}
