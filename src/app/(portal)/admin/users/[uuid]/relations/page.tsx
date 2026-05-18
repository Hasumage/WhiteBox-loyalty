"use client";

import { Building2, ChevronDown, Heart, Link2, WalletCards, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { useI18n } from "@/lib/i18n/use-i18n";
import { cn } from "@/lib/utils";
import { formatDateTime, UserPageHeader, UserPageState, useAdminUserProfile } from "../_components/user-detail";

function StatStripItem({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
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

function RelationSection({
  icon: Icon,
  title,
  count,
  empty,
  children,
  defaultOpen = false,
}: {
  icon: LucideIcon;
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group border-b border-white/10 last:border-b-0"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition hover:bg-white/[0.035] [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-cyan-100">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{title}</p>
            <p className="text-sm text-muted-foreground">{count > 0 ? `${count} records` : empty}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={count > 0 ? "default" : "secondary"}>{count}</Badge>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
        </div>
      </summary>
      <div className={cn("px-5 pb-5", count === 0 && "hidden")}>{children}</div>
    </details>
  );
}

export default function AdminUserRelationsPage() {
  const { locale, t } = useI18n("ru");
  const { user, loading, error } = useAdminUserProfile();
  const state = <UserPageState loading={loading} error={error} />;
  if (loading || error || !user) return state;

  return (
    <div className="space-y-5 pb-8">
      <UserPageHeader user={user} active="relations" />

      <div className="grid gap-3 md:grid-cols-3">
        <StatStripItem icon={Heart} label={t("admin.userDetail.favoriteCategories")} value={user.favoriteCategories.length} />
        <StatStripItem icon={Building2} label={t("admin.userDetail.companyLinks")} value={user.companyLinks.length} />
        <StatStripItem icon={WalletCards} label={t("admin.userDetail.subscriptions")} value={user.subscriptions.length} />
      </div>

      <Card className="glass overflow-hidden border-white/10">
        <CardContent className="p-0">
          <RelationSection
            icon={Heart}
            title={t("admin.userDetail.favoriteCategories")}
            count={user.favoriteCategories.length}
            empty={t("admin.userDetail.noFavoriteCategories")}
            defaultOpen={user.favoriteCategories.length > 0}
          >
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {user.favoriteCategories.map((fav) => (
                <div key={fav.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="rounded-xl border border-white/10 bg-background/60 p-2 text-cyan-100">
                      <CategoryIcon iconName={fav.category.icon} className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{fav.category.name}</p>
                      <p className="truncate text-xs text-muted-foreground">/{fav.category.slug}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(fav.createdAt, locale)}</span>
                </div>
              ))}
            </div>
          </RelationSection>

          <RelationSection
            icon={Building2}
            title={t("admin.userDetail.companyLinks")}
            count={user.companyLinks.length}
            empty={t("admin.userDetail.noCompanyLinks")}
            defaultOpen={user.companyLinks.length > 0}
          >
            <div className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              {user.companyLinks.map((link) => (
                <div key={link.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{link.company.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{link.company.category.name}</p>
                  </div>
                  <Badge variant="secondary">{link.balance} pts</Badge>
                  <p className="text-sm text-muted-foreground">{t("admin.userDetail.nextReward")}: {link.pointsToNextReward ?? "-"}</p>
                  <p className="text-sm text-muted-foreground">{formatDateTime(link.updatedAt, locale)}</p>
                </div>
              ))}
            </div>
          </RelationSection>

          <RelationSection
            icon={WalletCards}
            title={t("admin.userDetail.subscriptions")}
            count={user.subscriptions.length}
            empty={t("admin.userDetail.noSubscriptions")}
            defaultOpen={user.subscriptions.length > 0}
          >
            <div className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              {user.subscriptions.map((sub) => (
                <div key={sub.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto_auto_auto] lg:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{sub.subscription.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{sub.subscription.company?.name ?? sub.subscription.category?.name ?? sub.subscription.slug}</p>
                  </div>
                  <Badge variant={sub.status === "ACTIVE" ? "default" : "secondary"}>{sub.status}</Badge>
                  <p className="text-sm text-muted-foreground">{t("admin.userDetail.expires")}: {formatDateTime(sub.expiresAt, locale)}</p>
                  <p className="text-sm text-muted-foreground">{t("admin.userDetail.autoRenew")}: {sub.willAutoRenew ? t("admin.common.active") : t("admin.common.inactive")}</p>
                </div>
              ))}
            </div>
          </RelationSection>
        </CardContent>
      </Card>
    </div>
  );
}
