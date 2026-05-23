"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Archive, ArrowDownLeft, ArrowUpRight, History as HistoryIcon } from "lucide-react";
import { getCachedTwaHistory, getTwaHistory, type TwaHistory, type TwaUserSubscription } from "@/lib/api/twa-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { cn } from "@/lib/utils";
import { TwaLoadingScreen } from "@/components/twa/TwaLoadingScreen";
import { useI18n } from "@/lib/i18n/use-i18n";
import { formatPlanPrice as formatLocalizedPlanPrice, relativeDate } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/shared";
import type { TranslateFn } from "@/lib/i18n/format";

function formatDate(iso: string, locale: Locale, t: TranslateFn) {
  return relativeDate(iso, locale, t);
}

function formatPlanPrice(subscription: TwaUserSubscription, t: TranslateFn) {
  const plan = subscription.subscription;
  return formatLocalizedPlanPrice(plan.price, plan.renewalUnit, t);
}

function subscriptionStatusLabel(status: TwaUserSubscription["status"], t: TranslateFn) {
  if (status === "CANCELED") return t("client.common.canceled");
  if (status === "EXPIRED") return t("client.common.expired");
  return t("client.common.active");
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const item = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0 },
};

export default function HistoryPage() {
  const { locale, t } = useI18n("ru");
  const [history, setHistory] = useState<TwaHistory>({ transactions: [], archivedSubscriptions: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    const cached = getCachedTwaHistory();
    if (cached.transactions.length || cached.archivedSubscriptions.length) {
      setHistory(cached);
      setLoading(false);
    }
    void getTwaHistory().then((data) => {
      if (ignore) return;
      setHistory(data);
      setLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, []);

  if (loading && history.transactions.length === 0 && history.archivedSubscriptions.length === 0) {
    return <TwaLoadingScreen title={t("client.history.loadingTitle")} subtitle={t("client.history.loadingSubtitle")} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="min-h-full px-4 pb-4 pt-6"
    >
      <motion.section variants={container} initial="hidden" animate="show" className="mb-4">
        <motion.div variants={item} className="mb-1 flex items-center gap-2">
          <HistoryIcon className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{t("client.history.title")}</h1>
        </motion.div>
        <motion.p variants={item} className="text-sm text-muted-foreground">
          {t("client.history.subtitle")}
        </motion.p>
      </motion.section>

      <Tabs defaultValue="activity" className="w-full">
        <TabsList className="glass mb-4 w-full border-white/10">
          <TabsTrigger value="activity" className="flex-1">
            <ArrowDownLeft className="mr-1.5 h-4 w-4" />
            {t("client.history.activity")}
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="flex-1">
            <Archive className="mr-1.5 h-4 w-4" />
            {t("client.history.subscriptions")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="mt-0">
          <ScrollArea className="h-[calc(100dvh-14rem)] pr-2">
            <ul className="space-y-1.5">
              {history.transactions.map((tx, index) => (
                <motion.li
                  key={tx.uuid}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(index * 0.035, 0.24) }}
                >
                  <Card className="glass border-white/10">
                    <CardContent className="flex min-h-[48px] items-center gap-3 px-3 py-1">
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                          tx.type === "EARN"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-amber-500/20 text-amber-400",
                        )}
                      >
                        {tx.type === "EARN" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-semibold">{tx.company.name}</p>
                        <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{tx.description ?? formatDate(tx.occurredAt, locale, t)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={cn("text-sm tabular-nums font-semibold", tx.type === "EARN" ? "text-emerald-400" : "text-amber-400")}>
                          {tx.type === "EARN" ? "+" : "-"}
                          {Math.abs(tx.amount)}
                        </span>
                        <Badge variant={tx.status === "ACTIVE" ? "default" : "secondary"} className="px-2.5 py-1 text-xs">
                          {tx.status === "ACTIVE" ? t("client.common.active") : t("client.common.expired")}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </motion.li>
              ))}
            </ul>
            {!loading && history.transactions.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("client.history.noActivity")}</p>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="subscriptions" className="mt-0">
          <ScrollArea className="h-[calc(100dvh-14rem)] pr-2">
            <div className="space-y-1.5">
              {history.archivedSubscriptions.map((subscription, index) => {
                const plan = subscription.subscription;
                const category = plan.category;
                return (
                  <motion.div
                    key={subscription.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(index * 0.035, 0.24) }}
                  >
                    <Link href={`/marketplace/${plan.uuid}`} className="block">
                      <Card className="glass border-white/10 transition-all hover:border-white/20">
                        <CardContent className="px-3 py-1">
                          <div className="flex min-h-[48px] items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                {category && (
                                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/20 text-muted-foreground">
                                    <CategoryIcon iconName={category.icon ?? "Circle"} className="h-4 w-4" />
                                  </span>
                                )}
                                <div className="min-w-0">
                                  <p className="truncate text-base font-semibold">{plan.name}</p>
                                  <p className="mt-0.5 truncate text-xs leading-snug text-muted-foreground">
                                    {formatPlanPrice(subscription, t)}
                                    {category ? ` В· ${category.name}` : ""}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold",
                                subscription.status === "CANCELED"
                                  ? "border-red-400/30 bg-red-500/15 text-red-300"
                                  : "bg-muted/40 text-muted-foreground",
                              )}
                            >
                              {subscriptionStatusLabel(subscription.status, t)}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
            {!loading && history.archivedSubscriptions.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("client.history.noArchivedSubscriptions")}</p>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
