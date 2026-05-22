"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  FileBadge2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  ShieldX,
  UserRound,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  adminGetCompanyVerification,
  adminListAuditEvents,
  adminUpdateCompanyVerification,
  type AdminAuditRow,
  type AdminCompanyVerificationApplication,
  type AdminCompanyVerificationStatus,
} from "@/lib/api/admin-client";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/shared";
import { useI18n } from "@/lib/i18n/use-i18n";
import { cn } from "@/lib/utils";

function statusClass(status: AdminCompanyVerificationStatus) {
  if (status === "SUBMITTED") return "border-cyan-300/30 bg-cyan-300/10 text-cyan-100";
  if (status === "REVIEWING") return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  if (status === "APPROVED") return "border-emerald-300/30 bg-emerald-300/10 text-emerald-100";
  if (status === "REJECTED") return "border-red-300/30 bg-red-300/10 text-red-100";
  return "border-white/10 bg-white/[0.05] text-muted-foreground";
}

function employmentLabelKey(value: AdminCompanyVerificationApplication["employmentType"]): TranslationKey {
  return value === "SELF_EMPLOYED"
    ? "admin.verifications.selfEmployed"
    : "admin.verifications.individualEntrepreneur";
}

function statusLabelKey(status: AdminCompanyVerificationStatus): TranslationKey {
  if (status === "SUBMITTED") return "admin.common.submitted";
  if (status === "REVIEWING") return "admin.common.reviewing";
  if (status === "APPROVED") return "admin.common.approved";
  if (status === "REJECTED") return "admin.common.rejected";
  return "admin.verifications.detail.draft";
}

function formatDate(value: string | null | undefined, locale: Locale) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function Field({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: string | number | null | undefined;
  icon?: typeof UserRound;
  href?: string;
}) {
  const content = value === null || value === undefined || value === "" ? "-" : String(value);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="h-4 w-4" />} {label}
      </p>
      {href && content !== "-" ? (
        <a href={href} className="mt-2 block break-words text-base font-semibold text-cyan-100 hover:underline">
          {content}
        </a>
      ) : (
        <p className="mt-2 break-words text-base font-semibold">{content}</p>
      )}
    </div>
  );
}

export default function CompanyVerificationDetailPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = use(params);
  const { locale, t } = useI18n("ru");
  const [application, setApplication] = useState<AdminCompanyVerificationApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [auditRows, setAuditRows] = useState<AdminAuditRow[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const passportFile = application?.passportFiles?.[0];

  const telegramHref = useMemo(() => {
    if (!application?.contactTelegram) return undefined;
    const username = application.contactTelegram.replace(/^@/, "");
    return `https://t.me/${username}`;
  }, [application?.contactTelegram]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      const result = await adminGetCompanyVerification(uuid);
      if (!active) return;
      if (result.ok) setApplication(result.data);
      else setError(result.message);
      const audit = await adminListAuditEvents({ workspace: "MANAGER", query: uuid, tag: "USER", limit: 20 });
      if (active && audit.ok) setAuditRows(audit.data.items);
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [uuid]);

  async function updateStatus(status: Exclude<AdminCompanyVerificationStatus, "DRAFT">) {
    setSaving(true);
    setError("");
    setNotice("");
    const result = await adminUpdateCompanyVerification(uuid, { status });
    if (result.ok) {
      setApplication(result.data);
      setNotice(`${t("admin.verifications.detail.statusUpdated")}: ${t(statusLabelKey(status))}.`);
      const audit = await adminListAuditEvents({ workspace: "MANAGER", query: uuid, tag: "USER", limit: 20 });
      if (audit.ok) setAuditRows(audit.data.items);
    } else {
      setError(result.message);
    }
    setSaving(false);
  }

  if (loading) {
    return <Card className="border-white/10 bg-white/[0.04] p-6 text-muted-foreground">{t("admin.verifications.loading")}</Card>;
  }

  if (!application) {
    return (
      <div className="space-y-4">
        <Button asChild variant="secondary">
          <Link href="/admin/company-verifications"><ArrowLeft className="h-4 w-4" /> {t("admin.verifications.detail.back")}</Link>
        </Button>
        <div className="rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">
          {error || t("admin.verifications.detail.notFound")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div>
          <Button asChild variant="secondary">
            <Link href="/admin/company-verifications"><ArrowLeft className="h-4 w-4" /> {t("admin.verifications.detail.back")}</Link>
          </Button>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">{application.companyName}</h1>
            <Badge variant="outline" className={statusClass(application.status)}>{t(statusLabelKey(application.status))}</Badge>
          </div>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {application.uuid} · {t("admin.common.submitted").toLowerCase()} {formatDate(application.createdAt, locale)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={saving} onClick={() => updateStatus("REVIEWING")}>
            <Clock3 className="h-4 w-4" /> {t("admin.verifications.detail.markReviewing")}
          </Button>
          <Button disabled={saving} onClick={() => updateStatus("APPROVED")}>
            <CheckCircle2 className="h-4 w-4" /> {t("admin.verifications.detail.approve")}
          </Button>
          <Button variant="destructive" disabled={saving} onClick={() => updateStatus("REJECTED")}>
            <XCircle className="h-4 w-4" /> {t("admin.verifications.detail.reject")}
          </Button>
        </div>
      </div>

      {(error || notice) && (
        <div
          className={cn(
            "rounded-xl border p-4 text-sm",
            error ? "border-red-400/25 bg-red-500/10 text-red-100" : "border-emerald-400/25 bg-emerald-500/10 text-emerald-100",
          )}
        >
          {error || notice}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden border-white/10 bg-card/70 p-0">
          <CardHeader className="border-b border-white/10 bg-white/[0.035] px-8 pb-5 pt-8">
            <CardTitle className="flex items-center gap-2">
              <BriefcaseBusiness className="h-5 w-5" /> {t("admin.verifications.detail.companyRequest")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 px-8 pb-8 pt-6 sm:grid-cols-2">
            <Field label={t("admin.common.company")} value={application.companyName} icon={BriefcaseBusiness} />
            <Field label={t("admin.verifications.detail.employmentType")} value={t(employmentLabelKey(application.employmentType))} icon={BadgeCheck} />
            <Field
              label={t("admin.verifications.detail.identityMode")}
              value={application.identityVerificationMode === "FULL" ? t("admin.verifications.fullVerification") : t("admin.verifications.detail.deferredTestAccess")}
              icon={ShieldCheck}
            />
            <Field label={t("admin.verifications.detail.businessCategory")} value={application.businessCategory} icon={FileBadge2} />
            <Field label={t("admin.verifications.detail.linkedCompany")} value={application.company ? `${application.company.name} (${application.company.slug})` : "-"} icon={ShieldCheck} />
            <Field label={t("admin.verifications.detail.companyActive")} value={application.company?.isActive ? t("admin.verifications.detail.yes") : t("admin.verifications.detail.no")} icon={application.company?.isActive ? ShieldCheck : ShieldX} />
            <Field label={t("admin.verifications.detail.adminNotified")} value={formatDate(application.adminNotifiedAt, locale)} icon={Mail} />
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-white/10 bg-card/70 p-0">
          <CardHeader className="border-b border-white/10 bg-white/[0.035] px-8 pb-5 pt-8">
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5" /> {t("admin.verifications.detail.contact")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 px-8 pb-8 pt-6">
            <Field label={t("admin.verifications.detail.contactName")} value={application.contactName} icon={UserRound} />
            <Field label={t("admin.users.email")} value={application.contactEmail} icon={Mail} href={`mailto:${application.contactEmail}`} />
            <Field label="Telegram" value={application.contactTelegram} icon={Phone} href={telegramHref} />
            <Field label={t("admin.verifications.detail.ipUserAgent")} value={`${application.ipAddress ?? "-"} / ${application.userAgent ?? "-"}`} icon={MapPin} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="overflow-hidden border-white/10 bg-card/70 p-0">
          <CardHeader className="border-b border-white/10 bg-white/[0.035] px-8 pb-5 pt-8">
            <CardTitle className="flex items-center gap-2">
              <FileBadge2 className="h-5 w-5" /> {t("admin.verifications.detail.legalData")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 px-8 pb-8 pt-6 sm:grid-cols-2">
            <Field label={t("admin.verifications.detail.legalFullName")} value={application.legalFullName} />
            <Field label={t("admin.verifications.detail.birthDate")} value={formatDate(application.birthDate, locale)} />
            <Field label={t("admin.verifications.inn")} value={application.legalInn} />
            <Field label={t("admin.verifications.detail.passportLast4")} value={application.passportLast4} />
            <Field label={t("admin.verifications.detail.consentAccepted")} value={formatDate(application.consentAcceptedAt, locale)} />
            <Field
              label={t("admin.verifications.detail.passportPhotoSafety")}
              value={
                passportFile
                  ? `${t("admin.verifications.detail.encryptedFileAttached")} · ${Math.round(passportFile.size / 1024)} KB · ${passportFile.mimeType}`
                  : `${t("admin.verifications.detail.noActivePassportFile")} · ${t("admin.verifications.detail.cleanup")}: ${formatDate(application.passportDataDeletedAt, locale)}`
              }
            />
            {application.identityVerificationMode === "DEFERRED" && (
              <Field label={t("admin.verifications.detail.deferralReason")} value={application.verificationDeferralReason} />
            )}
            {passportFile && (
              <Button asChild variant="secondary" className="sm:col-span-2">
                <a href={`/api/admin/company-verifications/${application.uuid}/passport-photo`} target="_blank" rel="noreferrer">
                  <ShieldCheck className="h-4 w-4" /> {t("admin.verifications.detail.openPassportPhoto")}
                </a>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-white/10 bg-card/70 p-0">
          <CardHeader className="border-b border-white/10 bg-white/[0.035] px-8 pb-5 pt-8">
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" /> {t("admin.verifications.detail.payoutDetails")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 px-8 pb-8 pt-6 sm:grid-cols-2">
            <Field
              label={t("admin.common.status")}
              value={t("admin.verifications.detail.payoutDeferred")}
            />
            <Field label={t("admin.verifications.detail.reviewedAt")} value={formatDate(application.company?.verificationReviewedAt, locale)} />
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-white/10 bg-card/70 p-0">
        <CardHeader className="cursor-pointer border-b border-white/10 bg-white/[0.035] px-8 pb-5 pt-8" onClick={() => setShowAudit((value) => !value)}>
          <CardTitle className="flex items-center justify-between text-lg">
            <span className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> {t("admin.verifications.detail.auditTrail")}</span>
            <span className="text-sm text-muted-foreground">{showAudit ? t("admin.verifications.detail.hide") : t("admin.verifications.detail.show")}</span>
          </CardTitle>
        </CardHeader>
        {showAudit && (
          <CardContent className="space-y-3 px-8 pb-8 pt-6">
            {auditRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("admin.verifications.detail.noAudit")}</p>
            ) : (
              auditRows.map((row) => (
                <div key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{row.action}</p>
                    <Badge variant="outline">{row.level}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDate(row.createdAt, locale)} · {row.actorLabel}
                  </p>
                  {row.details && <p className="mt-2 text-sm text-muted-foreground">{row.details}</p>}
                </div>
              ))
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
