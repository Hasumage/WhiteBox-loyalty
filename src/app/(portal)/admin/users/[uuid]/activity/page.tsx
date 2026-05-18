"use client";

import { ChevronDown, CircleDollarSign, History, Sparkles, WalletCards, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/use-i18n";
import { formatDateTime, UserPageHeader, UserPageState, useAdminUserProfile } from "../_components/user-detail";

function ActivityStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-100">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold">{value}</p>
      </div>
    </div>
  );
}

function TimelineSection({
  icon: Icon,
  title,
  description,
  count,
  empty,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <details open={count > 0} className="group border-b border-white/10 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition hover:bg-white/[0.035] [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-cyan-100">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{title}</p>
            <p className="truncate text-sm text-muted-foreground">{count > 0 ? description : empty}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={count > 0 ? "default" : "secondary"}>{count}</Badge>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
        </div>
      </summary>
      {count > 0 && <div className="px-5 pb-5">{children}</div>}
    </details>
  );
}

export default function AdminUserActivityPage() {
  const { locale, t } = useI18n("ru");
  const { user, loading, error } = useAdminUserProfile();
  const state = <UserPageState loading={loading} error={error} />;
  if (loading || error || !user) return state;

  const earned = user.loyaltyTransactions
    .filter((tx) => tx.type === "EARN")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const spent = user.loyaltyTransactions
    .filter((tx) => tx.type === "SPEND")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const operations = user.loyaltyTransactions.length + user.subscriptions.length;

  return (
    <div className="space-y-5 pb-8">
      <UserPageHeader user={user} active="activity" />

      <div className="grid gap-3 md:grid-cols-3">
        <ActivityStat icon={History} label={t("admin.userDetail.operations")} value={operations} />
        <ActivityStat icon={Sparkles} label={t("admin.userDetail.pointsEarned")} value={earned} />
        <ActivityStat icon={CircleDollarSign} label={t("admin.userDetail.pointsSpent")} value={spent} />
      </div>

      <Card className="glass overflow-hidden border-white/10">
        <CardContent className="p-0">
          <TimelineSection
            icon={Sparkles}
            title={t("admin.userDetail.loyaltyHistory")}
            description={t("admin.userDetail.loyaltyHistoryDescription")}
            count={user.loyaltyTransactions.length}
            empty={t("admin.userDetail.noLoyaltyHistory")}
          >
            <div className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              {user.loyaltyTransactions.map((tx) => (
                <div key={tx.uuid} className="grid gap-3 p-4 md:grid-cols-[1fr_auto_auto] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{tx.company.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{tx.description ?? t("admin.common.noDetails")}</p>
                  </div>
                  <Badge variant={tx.type === "EARN" ? "default" : "secondary"}>
                    {tx.type} {tx.amount}
                  </Badge>
                  <p className="text-sm text-muted-foreground">{formatDateTime(tx.occurredAt, locale)} • {tx.status}</p>
                </div>
              ))}
            </div>
          </TimelineSection>

          <TimelineSection
            icon={WalletCards}
            title={t("admin.userDetail.subscriptionHistory")}
            count={user.subscriptions.length}
            empty={t("admin.userDetail.noSubscriptions")}
          >
            <div className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              {user.subscriptions.map((sub) => (
                <div key={sub.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto_auto] lg:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{sub.subscription.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{sub.subscription.price} • {sub.subscription.renewalPeriod}</p>
                  </div>
                  <Badge variant={sub.status === "ACTIVE" ? "default" : "secondary"}>{sub.status}</Badge>
                  <p className="text-sm text-muted-foreground">
                    {t("admin.userDetail.activated")}: {formatDateTime(sub.activatedAt, locale)} • {t("admin.userDetail.expires")}: {formatDateTime(sub.expiresAt, locale)}
                  </p>
                </div>
              ))}
            </div>
          </TimelineSection>
        </CardContent>
      </Card>
    </div>
  );
}
