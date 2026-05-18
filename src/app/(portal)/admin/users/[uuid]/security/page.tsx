"use client";

import { AlertTriangle, ChevronDown, KeyRound, LockKeyhole, ShieldCheck, Smartphone, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/use-i18n";
import { formatDateTime, UserPageHeader, UserPageState, useAdminUserProfile } from "../_components/user-detail";

function SecurityStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
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

function CompactSection({
  icon: Icon,
  title,
  subtitle,
  count,
  empty,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
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
            <p className="truncate text-sm text-muted-foreground">{count > 0 ? subtitle : empty}</p>
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

export default function AdminUserSecurityPage() {
  const { locale, t } = useI18n("ru");
  const { user, loading, error } = useAdminUserProfile();
  const state = <UserPageState loading={loading} error={error} />;
  if (loading || error || !user) return state;

  const activeRefreshTokens = user.refreshTokens.filter((token) => !token.revokedAt).length;

  return (
    <div className="space-y-5 pb-8">
      <UserPageHeader user={user} active="security" />

      <div className="grid gap-3 md:grid-cols-3">
        <SecurityStat icon={Smartphone} label={t("admin.userDetail.activeDevices")} value={user.loginEvents.length} />
        <SecurityStat icon={KeyRound} label={t("admin.userDetail.activeTokens")} value={activeRefreshTokens} />
        <SecurityStat icon={AlertTriangle} label={t("admin.userDetail.criticalActions")} value={user.criticalActions.length} />
      </div>

      <Card className={user.loginRisk.shouldReview ? "glass border-amber-300/30 bg-amber-400/10" : "glass border-emerald-300/20 bg-emerald-400/10"}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> {t("admin.userDetail.loginRisk")}</CardTitle>
          <CardDescription>{t("admin.userDetail.loginRiskDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <p>{t("admin.userDetail.primaryCountry")}: <strong>{user.loginRisk.primaryCountry ?? "-"}</strong></p>
          <p>{t("admin.userDetail.latestCountry")}: <strong>{user.loginRisk.latestCountry ?? "-"}</strong></p>
          <p>{t("admin.userDetail.reviewNeeded")}: <strong>{user.loginRisk.shouldReview ? t("admin.common.active") : t("admin.common.inactive")}</strong></p>
        </CardContent>
      </Card>

      <Card className="glass overflow-hidden border-white/10">
        <CardContent className="p-0">
          <CompactSection
            icon={Smartphone}
            title={t("admin.userDetail.loginMetadata")}
            subtitle={t("admin.userDetail.loginMetadataDescription")}
            count={user.loginEvents.length}
            empty={t("admin.userDetail.noLoginEvents")}
          >
            <div className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              {user.loginEvents.map((evt) => (
                <div key={evt.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto] lg:items-start">
                  <div className="min-w-0">
                    <p className="font-semibold">{evt.deviceLabel ?? t("admin.userDetail.unknownDevice")}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{evt.countryCode ?? "??"} • {evt.city ?? t("admin.userDetail.unknownCity")} • {evt.ipAddress ?? t("admin.userDetail.unknownIp")}</p>
                    <p className="mt-2 truncate text-xs text-muted-foreground">{evt.userAgent ?? t("admin.userDetail.noUserAgent")}</p>
                  </div>
                  <Badge variant="secondary">{formatDateTime(evt.createdAt, locale)}</Badge>
                </div>
              ))}
            </div>
          </CompactSection>

          <CompactSection
            icon={KeyRound}
            title={t("admin.userDetail.refreshTokens")}
            subtitle={t("admin.userDetail.refreshTokensDescription")}
            count={user.refreshTokens.length}
            empty={t("admin.userDetail.noTokens")}
          >
            <div className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              {user.refreshTokens.map((token) => (
                <div key={token.id} className="grid gap-2 p-3 font-mono text-xs md:grid-cols-[1fr_auto] md:items-center">
                  <p className="truncate">{token.id}</p>
                  <p className="text-muted-foreground">{formatDateTime(token.expiresAt, locale)} • {token.revokedAt ? t("admin.userDetail.revoked") : t("admin.common.active")}</p>
                </div>
              ))}
            </div>
          </CompactSection>

          <CompactSection
            icon={AlertTriangle}
            title={t("admin.userDetail.criticalActions")}
            subtitle={t("admin.userDetail.criticalActionsDescription")}
            count={user.criticalActions.length}
            empty={t("admin.userDetail.noCriticalActions")}
          >
            <div className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              {user.criticalActions.map((entry) => (
                <div key={entry.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto] lg:items-start">
                  <div className="min-w-0">
                    <p className="font-semibold">{entry.action}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{entry.details ?? t("admin.common.noDetails")}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(entry.createdAt, locale)} • {entry.actorLabel} • {entry.category}/{entry.level}</p>
                  </div>
                  <Badge variant={entry.result === "BLOCKED" ? "destructive" : "secondary"}>{entry.result}</Badge>
                </div>
              ))}
            </div>
          </CompactSection>

          <CompactSection
            icon={LockKeyhole}
            title={t("admin.userDetail.oauthAccounts")}
            subtitle={t("admin.userDetail.oauthAccountsDescription")}
            count={user.oauthAccounts.length}
            empty={t("admin.userDetail.noOauth")}
          >
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {user.oauthAccounts.map((account) => (
                <div key={account.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="font-semibold">{account.provider}</p>
                  <p className="truncate text-xs text-muted-foreground">{account.providerAccountId}</p>
                </div>
              ))}
            </div>
          </CompactSection>
        </CardContent>
      </Card>
    </div>
  );
}
