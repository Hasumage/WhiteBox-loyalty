"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownAZ,
  ArrowDownUp,
  BadgePercent,
  Building2,
  CalendarClock,
  ChevronDown,
  Filter,
  Gift,
  Megaphone,
  RefreshCw,
  Search,
  Sparkles,
  Ticket,
  UsersRound,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  adminCreatePromoCode,
  adminGetCompanyUser,
  adminGetReferralCampaign,
  adminListCompanyUsers,
  adminListPromoCodes,
  adminUpdatePromoCode,
  adminUpdateReferralCampaign,
  type AdminCompanySubscription,
  type AdminCompanyUser,
  type AdminPromoCode,
  type AdminReferralCampaign,
} from "@/lib/api/admin-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { Locale } from "@/lib/i18n/shared";

const inputClass = "glass border-white/10";
const selectClass = "glass h-11 w-full appearance-none rounded-xl border border-white/10 bg-background px-3 pr-12 text-sm text-foreground";

type PromoForm = {
  code: string;
  title: string;
  description: string;
  rewardType: "POINTS" | "SUBSCRIPTION";
  points: string;
  companyUuid: string;
  subscriptionUuid: string;
  maxRedemptions: string;
  expiresAt: string;
};

type PromoStatusFilter = "ALL" | "ACTIVE" | "PAUSED" | "EXPIRED" | "AVAILABLE";
type PromoTypeFilter = "ALL" | "POINTS" | "SUBSCRIPTION";
type PromoExpiryFilter = "ALL" | "NO_EXPIRY" | "EXPIRING_7" | "EXPIRED";
type PromoSortBy = "createdAt" | "code" | "title" | "status" | "type" | "company" | "redemptions" | "maxRedemptions" | "expiresAt" | "points";
type SortDir = "asc" | "desc";

const emptyPromoForm: PromoForm = {
  code: "WELCOME500",
  title: "",
  description: "",
  rewardType: "POINTS",
  points: "500",
  companyUuid: "",
  subscriptionUuid: "",
  maxRedemptions: "",
  expiresAt: "",
};

function normalizeNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function companyName(company?: AdminCompanyUser | null) {
  return company?.managedCompany?.name ?? company?.name ?? "";
}

function promoRewardLabel(code: AdminPromoCode, t: ReturnType<typeof useI18n>["t"]) {
  return code.rewardType === "POINTS"
    ? `${code.points} ${t("admin.growth.pointsShort")} · ${code.company?.name ?? t("admin.growth.noCompany")}`
    : code.subscription?.name ?? t("admin.growth.subscription");
}

function promoCompanyLabel(code: AdminPromoCode, t: ReturnType<typeof useI18n>["t"]) {
  return code.rewardType === "POINTS" ? code.company?.name ?? t("admin.growth.noCompany") : code.subscription?.name ?? t("admin.growth.subscription");
}

function isExpired(date: string | null) {
  return Boolean(date && new Date(date).getTime() < Date.now());
}

function isExpiringSoon(date: string | null) {
  if (!date) return false;
  const expiresAt = new Date(date).getTime();
  const now = Date.now();
  return expiresAt >= now && expiresAt <= now + 7 * 24 * 60 * 60 * 1000;
}

function formatPromoDate(date: string | null, locale: Locale, t: ReturnType<typeof useI18n>["t"]) {
  if (!date) return t("admin.growth.noExpiry");
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(date));
}

function renewalUnitLabel(unit: string, t: ReturnType<typeof useI18n>["t"]) {
  const normalized = unit.toLowerCase();
  if (normalized === "week") return t("admin.growth.periodWeek");
  if (normalized === "month") return t("admin.growth.periodMonth");
  if (normalized === "year") return t("admin.growth.periodYear");
  return unit;
}

function CompanySearchSelect({
  label,
  query,
  onQueryChange,
  options,
  value,
  onValueChange,
  loading,
  placeholder,
  loadingLabel,
  chooseLabel,
}: {
  label: string;
  query: string;
  onQueryChange: (value: string) => void;
  options: AdminCompanyUser[];
  value: string;
  onValueChange: (value: string) => void;
  loading: boolean;
  placeholder: string;
  loadingLabel: string;
  chooseLabel: string;
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-white/10 bg-black/15 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Building2 className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className={`${inputClass} pl-9`} value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder={placeholder} />
      </div>
      <div className="relative">
        <select className={selectClass} value={value} onChange={(e) => onValueChange(e.target.value)}>
          <option value="">{loading ? loadingLabel : chooseLabel}</option>
          {options.map((company) => (
            <option key={company.uuid} value={company.uuid}>
              {companyName(company)}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  );
}

function useCompanyLookup(query: string, enabled = true) {
  const [options, setOptions] = useState<AdminCompanyUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      const rows = await adminListCompanyUsers(query || undefined);
      setOptions(rows.filter((row) => Boolean(row.managedCompany)));
      setLoading(false);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [enabled, query]);

  return { options, loading };
}

export default function AdminGrowthPage() {
  const { locale, t } = useI18n("ru");
  const [promoCodes, setPromoCodes] = useState<AdminPromoCode[]>([]);
  const [campaign, setCampaign] = useState<AdminReferralCampaign | null>(null);
  const [form, setForm] = useState<PromoForm>(emptyPromoForm);
  const [promoCompanyQuery, setPromoCompanyQuery] = useState("");
  const [subscriptionCompanyQuery, setSubscriptionCompanyQuery] = useState("");
  const [referralCompanyQuery, setReferralCompanyQuery] = useState("");
  const [editingPromo, setEditingPromo] = useState<AdminPromoCode | null>(null);
  const [selectedSubscriptionCompanyUuid, setSelectedSubscriptionCompanyUuid] = useState("");
  const [companySubscriptions, setCompanySubscriptions] = useState<AdminCompanySubscription[]>([]);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [campaignDraft, setCampaignDraft] = useState({ title: "", inviterBonusPoints: "", invitedBonusPoints: "", isActive: true, bonusCompanyUuid: "" });
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [inventoryStatus, setInventoryStatus] = useState<PromoStatusFilter>("ALL");
  const [inventoryType, setInventoryType] = useState<PromoTypeFilter>("ALL");
  const [inventoryCompany, setInventoryCompany] = useState("ALL");
  const [inventoryExpiry, setInventoryExpiry] = useState<PromoExpiryFilter>("ALL");
  const [inventorySortBy, setInventorySortBy] = useState<PromoSortBy>("createdAt");
  const [inventorySortDir, setInventorySortDir] = useState<SortDir>("desc");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const promoCompanyLookup = useCompanyLookup(promoCompanyQuery, form.rewardType === "POINTS");
  const subscriptionCompanyLookup = useCompanyLookup(subscriptionCompanyQuery, form.rewardType === "SUBSCRIPTION");
  const referralCompanyLookup = useCompanyLookup(referralCompanyQuery, true);

  async function load() {
    setLoading(true);
    const [codes, referral] = await Promise.all([adminListPromoCodes(), adminGetReferralCampaign()]);
    setPromoCodes(codes);
    setCampaign(referral);
    if (referral) {
      setCampaignDraft({
        title: referral.title,
        inviterBonusPoints: String(referral.inviterBonusPoints),
        invitedBonusPoints: String(referral.invitedBonusPoints),
        isActive: referral.isActive,
        bonusCompanyUuid: "",
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function selectSubscriptionCompany(uuid: string) {
    setSelectedSubscriptionCompanyUuid(uuid);
    setCompanySubscriptions([]);
    setForm((prev) => ({ ...prev, subscriptionUuid: "" }));
    if (!uuid) return;
    setSubscriptionLoading(true);
    const result = await adminGetCompanyUser(uuid);
    setSubscriptionLoading(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setCompanySubscriptions(result.data.managedCompany?.subscriptions ?? []);
  }

  const promoStats = useMemo(() => {
    const active = promoCodes.filter((code) => code.isActive).length;
    const redemptions = promoCodes.reduce((sum, code) => sum + code.redemptionCount, 0);
    return { active, redemptions };
  }, [promoCodes]);

  const inventoryCompanies = useMemo(() => {
    return Array.from(new Set(promoCodes.map((code) => promoCompanyLabel(code, t)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [promoCodes, t]);

  const filteredPromoCodes = useMemo(() => {
    const query = inventoryQuery.trim().toLowerCase();
    const rows = promoCodes.filter((code) => {
      const searchable = [code.code, code.title, code.description ?? "", promoRewardLabel(code, t), promoCompanyLabel(code, t), code.rewardType]
        .join(" ")
        .toLowerCase();
      if (query && !searchable.includes(query)) return false;
      if (inventoryStatus === "ACTIVE" && !code.isActive) return false;
      if (inventoryStatus === "PAUSED" && code.isActive) return false;
      if (inventoryStatus === "EXPIRED" && !isExpired(code.expiresAt)) return false;
      if (inventoryStatus === "AVAILABLE" && (!code.isActive || isExpired(code.expiresAt))) return false;
      if (inventoryType !== "ALL" && code.rewardType !== inventoryType) return false;
      if (inventoryCompany !== "ALL" && promoCompanyLabel(code, t) !== inventoryCompany) return false;
      if (inventoryExpiry === "NO_EXPIRY" && code.expiresAt) return false;
      if (inventoryExpiry === "EXPIRING_7" && !isExpiringSoon(code.expiresAt)) return false;
      if (inventoryExpiry === "EXPIRED" && !isExpired(code.expiresAt)) return false;
      return true;
    });

    const direction = inventorySortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const valueA =
        inventorySortBy === "code"
          ? a.code
          : inventorySortBy === "title"
            ? a.title
            : inventorySortBy === "status"
              ? a.isActive
              : inventorySortBy === "type"
                ? a.rewardType
                : inventorySortBy === "company"
                  ? promoCompanyLabel(a, t)
                  : inventorySortBy === "redemptions"
                    ? a.redemptionCount
                    : inventorySortBy === "maxRedemptions"
                      ? a.maxRedemptions ?? Number.MAX_SAFE_INTEGER
                      : inventorySortBy === "expiresAt"
                        ? a.expiresAt ? new Date(a.expiresAt).getTime() : Number.MAX_SAFE_INTEGER
                        : inventorySortBy === "points"
                          ? a.points
                          : new Date(a.createdAt).getTime();
      const valueB =
        inventorySortBy === "code"
          ? b.code
          : inventorySortBy === "title"
            ? b.title
            : inventorySortBy === "status"
              ? b.isActive
              : inventorySortBy === "type"
                ? b.rewardType
                : inventorySortBy === "company"
                  ? promoCompanyLabel(b, t)
                  : inventorySortBy === "redemptions"
                    ? b.redemptionCount
                    : inventorySortBy === "maxRedemptions"
                      ? b.maxRedemptions ?? Number.MAX_SAFE_INTEGER
                      : inventorySortBy === "expiresAt"
                        ? b.expiresAt ? new Date(b.expiresAt).getTime() : Number.MAX_SAFE_INTEGER
                        : inventorySortBy === "points"
                          ? b.points
                          : new Date(b.createdAt).getTime();

      if (typeof valueA === "string" && typeof valueB === "string") return valueA.localeCompare(valueB) * direction;
      if (typeof valueA === "boolean" && typeof valueB === "boolean") return (Number(valueA) - Number(valueB)) * direction;
      return ((valueA as number) - (valueB as number)) * direction;
    });
  }, [inventoryCompany, inventoryExpiry, inventoryQuery, inventorySortBy, inventorySortDir, inventoryStatus, inventoryType, promoCodes, t]);

  const inventoryFilterCount = [
    inventoryQuery.trim(),
    inventoryStatus !== "ALL",
    inventoryType !== "ALL",
    inventoryCompany !== "ALL",
    inventoryExpiry !== "ALL",
  ].filter(Boolean).length;

  function resetInventoryFilters() {
    setInventoryQuery("");
    setInventoryStatus("ALL");
    setInventoryType("ALL");
    setInventoryCompany("ALL");
    setInventoryExpiry("ALL");
    setInventorySortBy("createdAt");
    setInventorySortDir("desc");
  }

  async function createPromo() {
    setSaving(true);
    setMessage(null);
    const input = {
      code: form.code,
      title: form.title,
      description: form.description || undefined,
      rewardType: form.rewardType,
      points: form.rewardType === "POINTS" ? normalizeNumber(form.points) : undefined,
      companyUuid: form.rewardType === "POINTS" && form.companyUuid ? form.companyUuid : undefined,
      subscriptionUuid: form.rewardType === "SUBSCRIPTION" && form.subscriptionUuid ? form.subscriptionUuid : undefined,
      maxRedemptions: form.maxRedemptions ? normalizeNumber(form.maxRedemptions) : null,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      isActive: true,
    };
    const result = editingPromo ? await adminUpdatePromoCode(editingPromo.id, input) : await adminCreatePromoCode(input);
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setForm(emptyPromoForm);
    setEditingPromo(null);
    setPromoCompanyQuery("");
    setSubscriptionCompanyQuery("");
    setSelectedSubscriptionCompanyUuid("");
    setCompanySubscriptions([]);
    setMessage(editingPromo ? t("admin.growth.promoUpdated") : t("admin.growth.promoCreated"));
    await load();
  }

  function startEditPromo(code: AdminPromoCode) {
    setEditingPromo(code);
    setForm({
      code: code.code,
      title: code.title,
      description: code.description ?? "",
      rewardType: code.rewardType,
      points: String(code.points || 0),
      companyUuid: "",
      subscriptionUuid: "",
      maxRedemptions: code.maxRedemptions == null ? "" : String(code.maxRedemptions),
      expiresAt: code.expiresAt ? code.expiresAt.slice(0, 16) : "",
    });
    setPromoCompanyQuery(code.company?.name ?? "");
    setSubscriptionCompanyQuery("");
    setSelectedSubscriptionCompanyUuid("");
    setCompanySubscriptions([]);
    setMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditPromo() {
    setEditingPromo(null);
    setForm(emptyPromoForm);
    setPromoCompanyQuery("");
    setSubscriptionCompanyQuery("");
    setSelectedSubscriptionCompanyUuid("");
    setCompanySubscriptions([]);
  }

  async function togglePromo(code: AdminPromoCode) {
    const result = await adminUpdatePromoCode(code.id, { isActive: !code.isActive });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setPromoCodes((prev) => prev.map((item) => (item.id === code.id ? result.data : item)));
  }

  async function saveCampaign() {
    setSaving(true);
    setMessage(null);
    const result = await adminUpdateReferralCampaign({
      title: campaignDraft.title,
      inviterBonusPoints: normalizeNumber(campaignDraft.inviterBonusPoints),
      invitedBonusPoints: normalizeNumber(campaignDraft.invitedBonusPoints),
      bonusCompanyUuid: campaignDraft.bonusCompanyUuid || undefined,
      isActive: campaignDraft.isActive,
    });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setCampaign(result.data);
    setMessage(t("admin.growth.referralUpdated"));
  }

  const canCreatePromo = Boolean(
    form.code &&
      form.title &&
      (form.rewardType === "POINTS"
        ? normalizeNumber(form.points) && (form.companyUuid || editingPromo?.rewardType === "POINTS")
        : form.subscriptionUuid || editingPromo?.rewardType === "SUBSCRIPTION"),
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" /> {t("admin.growth.badge")}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{t("admin.growth.title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t("admin.growth.description")}
          </p>
        </div>
        <Button type="button" variant="secondary" className="glass border-white/10" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" /> {t("admin.growth.refresh")}
        </Button>
      </header>

      {message && <div className="rounded-2xl border border-white/10 bg-muted/10 px-4 py-3 text-sm">{message}</div>}

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="glass border-white/10"><CardContent className="flex items-center gap-3 p-4"><div className="rounded-2xl bg-primary/15 p-3 text-primary"><Ticket className="h-5 w-5" /></div><div><p className="text-xs text-muted-foreground">{t("admin.growth.activePromoCodes")}</p><p className="text-2xl font-bold">{promoStats.active}</p></div></CardContent></Card>
        <Card className="glass border-white/10"><CardContent className="flex items-center gap-3 p-4"><div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-300"><BadgePercent className="h-5 w-5" /></div><div><p className="text-xs text-muted-foreground">{t("admin.growth.totalRedemptions")}</p><p className="text-2xl font-bold">{promoStats.redemptions}</p></div></CardContent></Card>
        <Card className="glass border-white/10"><CardContent className="flex items-center gap-3 p-4"><div className="rounded-2xl bg-sky-500/15 p-3 text-sky-300"><UsersRound className="h-5 w-5" /></div><div><p className="text-xs text-muted-foreground">{t("admin.growth.referralRewarded")}</p><p className="text-2xl font-bold">{campaign?.stats.rewardedInvites ?? 0}</p></div></CardContent></Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="glass border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gift className="h-4 w-4 text-primary" /> {editingPromo ? `${t("admin.growth.edit")} ${editingPromo.code}` : t("admin.growth.createPromoCode")}
            </CardTitle>
            <CardDescription>
              {editingPromo
                ? t("admin.growth.editPromoDescription")
                : t("admin.growth.createPromoDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input className={inputClass} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder={t("admin.growth.promoCodePlaceholder")} />
              <Input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("admin.growth.promoTitlePlaceholder")} />
              <select
                className={selectClass}
                value={form.rewardType}
                onChange={(e) => {
                  const rewardType = e.target.value as PromoForm["rewardType"];
                  setForm({ ...form, rewardType, companyUuid: rewardType === "SUBSCRIPTION" ? "" : form.companyUuid, subscriptionUuid: "" });
                  setSelectedSubscriptionCompanyUuid("");
                  setCompanySubscriptions([]);
                }}
              >
                <option value="POINTS">{t("admin.growth.bonusPoints")}</option>
                <option value="SUBSCRIPTION">{t("admin.growth.subscriptionActivation")}</option>
              </select>
              <Input className={inputClass} value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })} placeholder={t("admin.growth.maxRedemptionsPlaceholder")} inputMode="numeric" />
            </div>

            {form.rewardType === "POINTS" ? (
              <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-3 md:grid-cols-[160px_1fr]">
                <Input className={inputClass} value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} placeholder={t("admin.growth.pointsPlaceholder")} inputMode="numeric" />
                <CompanySearchSelect
                  label={t("admin.growth.pointsCompany")}
                  query={promoCompanyQuery}
                  onQueryChange={setPromoCompanyQuery}
                  options={promoCompanyLookup.options}
                  value={form.companyUuid}
                  onValueChange={(value) => setForm({ ...form, companyUuid: value })}
                  loading={promoCompanyLookup.loading}
                  placeholder={editingPromo?.company ? `${t("admin.growth.current")}: ${editingPromo.company.name}` : t("admin.growth.searchCompanyForPoints")}
                  loadingLabel={t("admin.growth.loadingCompanies")}
                  chooseLabel={t("admin.growth.chooseCompany")}
                />
                {editingPromo?.rewardType === "POINTS" && !form.companyUuid && (
                  <p className="md:col-start-2 text-xs text-muted-foreground">{t("admin.growth.keepingCurrentCompany")}: {editingPromo.company?.name ?? t("admin.growth.savedCompany")}</p>
                )}
              </div>
            ) : (
              <div className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-3">
                <CompanySearchSelect
                  label={t("admin.growth.subscriptionCompany")}
                  query={subscriptionCompanyQuery}
                  onQueryChange={setSubscriptionCompanyQuery}
                  options={subscriptionCompanyLookup.options}
                  value={selectedSubscriptionCompanyUuid}
                  onValueChange={(value) => void selectSubscriptionCompany(value)}
                  loading={subscriptionCompanyLookup.loading || subscriptionLoading}
                  placeholder={t("admin.growth.searchCompanyWithPlans")}
                  loadingLabel={t("admin.growth.loadingCompanies")}
                  chooseLabel={t("admin.growth.chooseCompany")}
                />
                {editingPromo?.rewardType === "SUBSCRIPTION" && !form.subscriptionUuid && (
                  <p className="text-xs text-muted-foreground">{t("admin.growth.keepingCurrentSubscription")}: {editingPromo.subscription?.name ?? t("admin.growth.savedSubscription")}</p>
                )}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Building2 className="h-3.5 w-3.5" /> {t("admin.growth.companySubscriptions")}</div>
                  <select className={selectClass} value={form.subscriptionUuid} onChange={(e) => setForm({ ...form, subscriptionUuid: e.target.value })} disabled={!selectedSubscriptionCompanyUuid || companySubscriptions.length === 0}>
                    <option value="">{!selectedSubscriptionCompanyUuid ? t("admin.growth.chooseCompanyFirst") : companySubscriptions.length === 0 ? t("admin.growth.noSubscriptionsForCompany") : t("admin.growth.chooseSubscription")}</option>
                    {companySubscriptions.map((subscription) => (
                      <option key={subscription.uuid} value={subscription.uuid}>{subscription.name} · {subscription.price}/{renewalUnitLabel(subscription.renewalUnit, t)}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("admin.growth.expiresAt")}</span>
                <Input className={inputClass} value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} type="datetime-local" />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("admin.growth.promoDescription")}</span>
                <Input className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t("admin.growth.promoDescriptionPlaceholder")} />
              </label>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1" disabled={saving || !canCreatePromo} onClick={createPromo}>
                <Ticket className="mr-2 h-4 w-4" /> {editingPromo ? t("admin.growth.savePromoChanges") : t("admin.growth.createPromoCode")}
              </Button>
              {editingPromo && (
                <Button type="button" variant="secondary" className="glass border-white/10 sm:w-36" onClick={cancelEditPromo}>
                  {t("admin.growth.cancel")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Megaphone className="h-4 w-4 text-primary" /> {t("admin.growth.referralCampaign")}</CardTitle>
            <CardDescription>{t("admin.growth.referralDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input className={inputClass} value={campaignDraft.title} onChange={(e) => setCampaignDraft({ ...campaignDraft, title: e.target.value })} placeholder={t("admin.growth.campaignTitle")} />
            <div className="grid grid-cols-2 gap-3">
              <Input className={inputClass} value={campaignDraft.inviterBonusPoints} onChange={(e) => setCampaignDraft({ ...campaignDraft, inviterBonusPoints: e.target.value })} placeholder={t("admin.growth.inviterPoints")} />
              <Input className={inputClass} value={campaignDraft.invitedBonusPoints} onChange={(e) => setCampaignDraft({ ...campaignDraft, invitedBonusPoints: e.target.value })} placeholder={t("admin.growth.invitedPoints")} />
            </div>
            <CompanySearchSelect
              label={t("admin.growth.referralBonusCompany")}
              query={referralCompanyQuery}
              onQueryChange={setReferralCompanyQuery}
              options={referralCompanyLookup.options}
              value={campaignDraft.bonusCompanyUuid}
              onValueChange={(value) => setCampaignDraft({ ...campaignDraft, bonusCompanyUuid: value })}
              loading={referralCompanyLookup.loading}
              placeholder={t("admin.growth.searchCompanyForReferral")}
              loadingLabel={t("admin.growth.loadingCompanies")}
              chooseLabel={t("admin.growth.chooseCompany")}
            />
            <p className="text-xs text-muted-foreground">{t("admin.growth.referralPointsHint")}</p>
            <button type="button" onClick={() => setCampaignDraft((prev) => ({ ...prev, isActive: !prev.isActive }))} className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-muted/10 px-3 py-3 text-left text-sm"><span>{t("admin.growth.campaignStatus")}</span><Badge variant={campaignDraft.isActive ? "default" : "secondary"}>{campaignDraft.isActive ? t("admin.growth.active") : t("admin.growth.paused")}</Badge></button>
            <Button className="w-full" disabled={saving} onClick={saveCampaign}>{t("admin.growth.saveReferralRules")}</Button>
          </CardContent>
        </Card>
      </div>

      <Card className="glass border-white/10">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Ticket className="h-4 w-4 text-primary" /> {t("admin.growth.inventoryTitle")}
              </CardTitle>
              <CardDescription>
                {loading ? t("admin.common.loading") : `${filteredPromoCodes.length} ${t("admin.growth.of")} ${promoCodes.length} ${t("admin.growth.codesShown")}`}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{promoCodes.filter((code) => code.isActive && !isExpired(code.expiresAt)).length} {t("admin.growth.available").toLowerCase()}</Badge>
              <Badge variant="secondary">{promoCodes.filter((code) => !code.isActive).length} {t("admin.growth.paused").toLowerCase()}</Badge>
              <Badge variant="secondary">{promoCodes.filter((code) => isExpiringSoon(code.expiresAt)).length} {t("admin.growth.expiringSoon").toLowerCase()}</Badge>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/15 p-3">
            <div className="grid gap-3 xl:grid-cols-[1.3fr_0.8fr_0.8fr_0.9fr_0.8fr]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className={`${inputClass} pl-9`}
                  value={inventoryQuery}
                  onChange={(event) => setInventoryQuery(event.target.value)}
                  placeholder={t("admin.growth.inventorySearchPlaceholder")}
                />
              </div>
              <select className={selectClass} value={inventoryStatus} onChange={(event) => setInventoryStatus(event.target.value as PromoStatusFilter)}>
                <option value="ALL">{t("admin.growth.allStatuses")}</option>
                <option value="AVAILABLE">{t("admin.growth.available")}</option>
                <option value="ACTIVE">{t("admin.growth.activeToggle")}</option>
                <option value="PAUSED">{t("admin.growth.paused")}</option>
                <option value="EXPIRED">{t("admin.growth.expired")}</option>
              </select>
              <select className={selectClass} value={inventoryType} onChange={(event) => setInventoryType(event.target.value as PromoTypeFilter)}>
                <option value="ALL">{t("admin.growth.allRewards")}</option>
                <option value="POINTS">{t("admin.growth.bonusPoints")}</option>
                <option value="SUBSCRIPTION">{t("admin.growth.subscriptions")}</option>
              </select>
              <select className={selectClass} value={inventoryCompany} onChange={(event) => setInventoryCompany(event.target.value)}>
                <option value="ALL">{t("admin.growth.allCompaniesPlans")}</option>
                {inventoryCompanies.map((company) => (
                  <option key={company} value={company}>{company}</option>
                ))}
              </select>
              <select className={selectClass} value={inventoryExpiry} onChange={(event) => setInventoryExpiry(event.target.value as PromoExpiryFilter)}>
                <option value="ALL">{t("admin.growth.anyExpiry")}</option>
                <option value="NO_EXPIRY">{t("admin.growth.noExpiry")}</option>
                <option value="EXPIRING_7">{t("admin.growth.expiring7Days")}</option>
                <option value="EXPIRED">{t("admin.growth.expired")}</option>
              </select>
            </div>

            <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid gap-2 sm:grid-cols-[1fr_150px] lg:w-[440px]">
                <select className={selectClass} value={inventorySortBy} onChange={(event) => setInventorySortBy(event.target.value as PromoSortBy)}>
                  <option value="createdAt">{t("admin.growth.sortNewest")}</option>
                  <option value="code">{t("admin.growth.sortCode")}</option>
                  <option value="title">{t("admin.growth.sortTitle")}</option>
                  <option value="status">{t("admin.growth.sortStatus")}</option>
                  <option value="type">{t("admin.growth.sortRewardType")}</option>
                  <option value="company">{t("admin.growth.sortCompanyPlan")}</option>
                  <option value="redemptions">{t("admin.growth.sortRedemptions")}</option>
                  <option value="maxRedemptions">{t("admin.growth.sortMaxRedemptions")}</option>
                  <option value="expiresAt">{t("admin.growth.sortExpiryDate")}</option>
                  <option value="points">{t("admin.growth.sortPoints")}</option>
                </select>
                <Button type="button" variant="secondary" className="glass border-white/10" onClick={() => setInventorySortDir((prev) => (prev === "asc" ? "desc" : "asc"))}>
                  <ArrowDownUp className="mr-2 h-4 w-4" /> {inventorySortDir === "asc" ? t("admin.growth.asc") : t("admin.growth.desc")}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" className="glass border-white/10" onClick={() => { setInventoryStatus("AVAILABLE"); setInventoryExpiry("ALL"); }}>
                  <Filter className="mr-2 h-4 w-4" /> {t("admin.growth.availableOnly")}
                </Button>
                <Button type="button" variant="secondary" className="glass border-white/10" onClick={() => { setInventorySortBy("redemptions"); setInventorySortDir("desc"); }}>
                  <ArrowDownAZ className="mr-2 h-4 w-4" /> {t("admin.growth.topRedeemed")}
                </Button>
                <Button type="button" variant="secondary" className="glass border-white/10" onClick={() => { setInventoryExpiry("EXPIRING_7"); setInventorySortBy("expiresAt"); setInventorySortDir("asc"); }}>
                  <CalendarClock className="mr-2 h-4 w-4" /> {t("admin.growth.expiringSoon")}
                </Button>
                <Button type="button" variant="secondary" className="glass border-white/10" disabled={inventoryFilterCount === 0 && inventorySortBy === "createdAt" && inventorySortDir === "desc"} onClick={resetInventoryFilters}>
                  <X className="mr-2 h-4 w-4" /> {t("admin.common.reset")}
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredPromoCodes.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/15 bg-muted/10 p-6 text-center text-sm text-muted-foreground">
              {t("admin.growth.noPromoMatches")}
            </div>
          )}
          {filteredPromoCodes.map((code) => (
            <div key={code.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-muted/10 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold tracking-wide">{code.code}</p>
                  <Badge variant={code.isActive ? "default" : "secondary"}>{code.isActive ? t("admin.growth.active") : t("admin.growth.paused")}</Badge>
                  {isExpired(code.expiresAt) && <Badge variant="destructive">{t("admin.growth.expired")}</Badge>}
                  {isExpiringSoon(code.expiresAt) && <Badge variant="secondary">{t("admin.growth.expiringSoon")}</Badge>}
                  <Badge variant="secondary">{promoRewardLabel(code, t)}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {code.title} · {code.redemptionCount} {t("admin.growth.redemptions").toLowerCase()} · {t("admin.growth.limit").toLowerCase()} {code.maxRedemptions ?? t("admin.growth.unlimited").toLowerCase()} · {formatPromoDate(code.expiresAt, locale, t)}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="secondary" className="glass border-white/10" onClick={() => startEditPromo(code)}>{t("admin.growth.edit")}</Button>
                <Button type="button" variant="secondary" className="glass border-white/10" onClick={() => void togglePromo(code)}>{code.isActive ? t("admin.growth.pause") : t("admin.growth.activate")}</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
