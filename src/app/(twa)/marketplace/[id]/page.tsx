"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Check, CircleDollarSign, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { SubscriptionsComingSoon } from "@/components/subscriptions/SubscriptionsComingSoon";
import {
  createTwaSubscriptionCheckout,
  getCachedTwaMarketplace,
  getTwaMarketplace,
  type TwaSubscriptionPlan,
} from "@/lib/api/twa-client";
import { TwaLoadingScreen } from "@/components/twa/TwaLoadingScreen";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/features/subscriptions";
import { useI18n } from "@/lib/i18n/use-i18n";
import { categoryName } from "@/lib/i18n/categories";
import { formatPlanPrice as formatLocalizedPlanPrice, formatRenewal as formatLocalizedRenewal } from "@/lib/i18n/format";
import type { TranslateFn } from "@/lib/i18n/format";

function formatPlanPrice(plan: TwaSubscriptionPlan, t: TranslateFn) {
  return formatLocalizedPlanPrice(plan.price, plan.renewalUnit, t);
}

function formatRenewal(plan: TwaSubscriptionPlan, t: TranslateFn) {
  return formatLocalizedRenewal(plan.renewalValue, plan.renewalUnit, t);
}

function entitlementLimit(
  entitlement: TwaSubscriptionPlan["entitlements"][number],
  locale: "ru" | "en",
) {
  if (entitlement.windowUnit === "UNLIMITED") {
    return locale === "ru" ? "Без лимита использований" : "Unlimited uses";
  }
  const units = locale === "ru"
    ? { DAY: "день", WEEK: "неделю", MONTH: "месяц", TERM: "срок подписки" }
    : { DAY: "day", WEEK: "week", MONTH: "month", TERM: "subscription term" };
  return locale === "ru"
    ? `${entitlement.allowance} раз за каждые ${entitlement.windowValue} ${units[entitlement.windowUnit]}`
    : `${entitlement.allowance} uses per ${entitlement.windowValue} ${units[entitlement.windowUnit]}`;
}

export default function SubscriptionDetailPage() {
  if (!SUBSCRIPTIONS_ENABLED) {
    return <SubscriptionsComingSoon mode="client" backHref="/marketplace" primaryHref="/map" />;
  }

  return <SubscriptionDetailEnabledPage />;
}

function SubscriptionDetailEnabledPage() {
  const { locale, t } = useI18n("ru");
  const params = useParams();
  const id = String(params.id ?? "");
  const [plans, setPlans] = useState<TwaSubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    const cached = getCachedTwaMarketplace();
    if (cached.subscriptions.length) {
      setPlans(cached.subscriptions);
      setLoading(false);
    }
    void getTwaMarketplace().then((data) => {
      if (ignore) return;
      setPlans(data.subscriptions);
      setLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, []);

  const subscription = useMemo(
    () => plans.find((plan) => plan.uuid === id || plan.slug === id) ?? null,
    [id, plans],
  );

  async function onActivate() {
    if (!subscription || subscription.isOwned) return;
    setActivating(true);
    setError(null);
    setNotice(null);
    const res = await createTwaSubscriptionCheckout(subscription.uuid);
    setActivating(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    if (!res.data.confirmationUrl) {
      setError(locale === "ru" ? "Платеж создан, но YooKassa не вернула ссылку оплаты." : "Payment was created, but YooKassa did not return a payment link.");
      return;
    }
    setNotice(locale === "ru" ? "Открываем безопасную страницу оплаты..." : "Opening secure payment page...");
    window.location.href = res.data.confirmationUrl;
  }

  if (loading && plans.length === 0) {
    return <TwaLoadingScreen title={t("client.subscription.loadingTitle")} subtitle={t("client.subscription.loadingSubtitle")} />;
  }

  if (!subscription) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex min-h-full flex-col items-center justify-center px-6"
      >
        <p className="mb-4 text-muted-foreground">{t("client.subscription.notFound")}</p>
        <Button asChild variant="secondary">
          <Link href="/marketplace">{t("client.common.backMarketplace")}</Link>
        </Button>
      </motion.div>
    );
  }

  const category = subscription.category;
  const entitlements = subscription.entitlements ?? [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="min-h-full px-4 pb-6 pt-6"
    >
      <Link
        href="/marketplace"
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("client.common.back")}
      </Link>

      <motion.section
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="mb-6"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/20">
            {category ? (
              <CategoryIcon iconName={category.icon ?? "Circle"} className="h-7 w-7 text-primary" />
            ) : (
              <CircleDollarSign className="h-7 w-7 text-primary" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold">{subscription.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              {category && (
                <Badge variant="secondary" className="inline-flex items-center gap-1 text-xs font-normal">
                  <CategoryIcon iconName={category.icon ?? "Circle"} className="h-3 w-3" />
                  {categoryName(category, t)}
                </Badge>
              )}
              {subscription.company && (
                <Badge variant="outline" className="text-xs font-normal">
                  {subscription.company.name}
                </Badge>
              )}
              {subscription.type === "bundle" && subscription.partners && (
                <Badge variant="outline" className="text-xs font-normal">
                  {subscription.partners}
                </Badge>
              )}
              {subscription.isOwned && <Badge className="text-xs font-normal">{t("client.common.active")}</Badge>}
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <Card className="glass border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("client.subscription.description")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm">{subscription.description}</p>
          </CardContent>
        </Card>
      </motion.section>

      <motion.section
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.12 }}
        className="mb-6"
      >
        <Card className="glass border-white/10">
          <CardContent className="flex flex-row items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">{t("client.subscription.price")}</p>
              <p className="text-xl font-bold text-primary">{formatPlanPrice(subscription, t)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">{t("client.subscription.renewal")}</p>
              <p className="font-medium">{formatRenewal(subscription, t)}</p>
            </div>
          </CardContent>
        </Card>
      </motion.section>

      <motion.section
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.14 }}
        className="mb-6"
      >
        <Card className="glass border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {locale === "ru" ? "Что входит в подписку" : "Included services"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-auto">
              <ul className="space-y-2">
                {entitlements.map((benefit) => (
                  <li key={benefit.uuid} className="flex items-start gap-2 rounded-xl border border-white/8 bg-white/[0.025] p-3 text-sm">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20">
                      <Check className="h-3 w-3 text-primary" />
                    </span>
                    <span>
                      <span className="block font-medium">{benefit.title}</span>
                      {benefit.company && (
                        <span className="mt-0.5 block text-xs text-primary">
                          {locale === "ru" ? "Выдает: " : "Provided by: "}{benefit.company.name}
                        </span>
                      )}
                      {benefit.description && <span className="mt-0.5 block text-muted-foreground">{benefit.description}</span>}
                      <span className="mt-1 block text-xs text-primary">{entitlementLimit(benefit, locale)}</span>
                    </span>
                  </li>
                ))}
                {entitlements.length === 0 && (
                  <li className="rounded-xl border border-dashed border-white/10 p-3 text-sm text-muted-foreground">
                    {locale === "ru" ? "Компания пока не описала услуги этого тарифа." : "The company has not described services for this plan yet."}
                  </li>
                )}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.section>

      {notice && (
        <p className="mb-3 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {notice}
        </p>
      )}
      {error && (
        <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <motion.section initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.16 }}>
        <Button className="w-full" size="lg" disabled={subscription.isOwned || activating} onClick={() => void onActivate()}>
          {activating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : subscription.isOwned ? (
            <Check className="mr-2 h-4 w-4" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {subscription.isOwned ? t("client.subscription.activated") : activating ? t("client.subscription.activating") : t("client.subscription.activate")}
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {t("client.subscription.paymentFuture")}
        </p>
      </motion.section>
    </motion.div>
  );
}
