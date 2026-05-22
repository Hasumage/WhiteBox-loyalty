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
import {
  activateTwaSubscription,
  getCachedTwaMarketplace,
  getTwaMarketplace,
  type TwaSubscriptionPlan,
} from "@/lib/api/twa-client";
import { TwaLoadingScreen } from "@/components/twa/TwaLoadingScreen";
import { useI18n } from "@/lib/i18n/use-i18n";
import { formatPlanPrice as formatLocalizedPlanPrice, formatRenewal as formatLocalizedRenewal, interpolate } from "@/lib/i18n/format";
import type { TranslateFn } from "@/lib/i18n/format";

function formatPlanPrice(plan: TwaSubscriptionPlan, t: TranslateFn) {
  return formatLocalizedPlanPrice(plan.price, plan.renewalUnit, t);
}

function formatRenewal(plan: TwaSubscriptionPlan, t: TranslateFn) {
  return formatLocalizedRenewal(plan.renewalValue, plan.renewalUnit, t);
}

function buildBenefits(plan: TwaSubscriptionPlan, t: TranslateFn) {
  const benefits = [
    plan.company ? interpolate(t("client.subscription.benefitsAt"), { company: plan.company.name }) : t("client.subscription.benefitsAcross"),
    plan.category ? interpolate(t("client.subscription.categoryAccess"), { category: plan.category.name }) : t("client.subscription.marketplaceAccess"),
    interpolate(t("client.subscription.renewsEvery"), { period: formatRenewal(plan, t) }),
  ];
  if (plan.promoBonusDays > 0) {
    benefits.push(interpolate(t("client.subscription.bonusDays"), { count: plan.promoBonusDays }));
  }
  return benefits;
}

export default function SubscriptionDetailPage() {
  const { t } = useI18n("ru");
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
    const res = await activateTwaSubscription(subscription.uuid);
    setActivating(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setNotice(t("client.subscription.activatedNotice"));
    setPlans((current) =>
      current.map((plan) => (plan.uuid === subscription.uuid ? { ...plan, isOwned: true } : plan)),
    );
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
  const benefits = buildBenefits(subscription, t);

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
                  {category.name}
                </Badge>
              )}
              {subscription.company && (
                <Badge variant="outline" className="text-xs font-normal">
                  {subscription.company.name}
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
              {t("client.subscription.benefits")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-auto">
              <ul className="space-y-2">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-2 text-sm">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20">
                      <Check className="h-3 w-3 text-primary" />
                    </span>
                    {benefit}
                  </li>
                ))}
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
