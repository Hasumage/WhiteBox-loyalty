"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Gift,
  Globe2,
  Hash,
  FileText,
  MapPin,
  Plus,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  Tag,
  ShieldAlert,
  ShieldCheck,
  TicketCheck,
  Trash2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryMultiSelect } from "@/components/ui/category-multi-select";
import { CategorySelect } from "@/components/ui/category-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  adminCreateCompanySubscriptionEntitlement,
  adminCreateCompanySubscription,
  adminCreateCompanyLocation,
  adminDeleteCompanySubscription,
  adminDeleteCompanyLocation,
  adminDeleteCompanyUser,
  adminGetCompanyUser,
  adminListCategories,
  adminUpdateCompanyLocation,
  adminUpdateCompanySubscription,
  adminUpdateCompanyUser,
  adminUpsertCompanyProfile,
  type AdminCategory,
  type AdminCompanyLocation,
  type AdminCompanySubscription,
} from "@/lib/api/admin-client";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { useI18n } from "@/lib/i18n/use-i18n";

type CompanyForm = {
  name: string;
  accountStatus: "ACTIVE" | "FROZEN_PENDING_DELETION" | "BLOCKED";
  emailVerifiedAt: string;
  createdAt: string;
};

type CompanyProfileForm = {
  name: string;
  slug: string;
  description: string;
  categoryIds: number[];
  pointsPerReward: number;
  subscriptionSpendPolicy: "EXCLUDE" | "INCLUDE_NO_BONUS" | "INCLUDE_WITH_BONUS";
  levelRules: Array<{
    levelName: string;
    minTotalSpend: number;
    cashbackPercent: number;
  }>; 
  isActive: boolean;
  operatesOnline: boolean;
};

type SubscriptionDraft = {
  name: string;
  description: string;
  price: string;
  renewalValue: number;
  renewalUnit: "week" | "month" | "year";
  promoBonusDays: number;
  slug: string;
  categoryId: number | "";
};

type LocationDraft = {
  title: string;
  address: string;
  city: string;
  openTime: string;
  closeTime: string;
  workingDays: number[];
  isMain: boolean;
};

type EntitlementDraft = {
  title: string;
  description: string;
  allowance: number;
  windowValue: number;
  windowUnit: "DAY" | "WEEK" | "MONTH" | "TERM" | "UNLIMITED";
};

type SaveOptions = {
  skipReload?: boolean;
  silent?: boolean;
};

const SUBSCRIPTION_POLICY_OPTIONS = [
  {
    key: "EXCLUDE" as const,
    titleKey: "admin.companyDetail.policyExcludeTitle",
    descriptionKey: "admin.companyDetail.policyExcludeDescription",
    badgeKey: "admin.companyDetail.policyExcludeBadge",
  },
  {
    key: "INCLUDE_NO_BONUS" as const,
    titleKey: "admin.companyDetail.policySpendOnlyTitle",
    descriptionKey: "admin.companyDetail.policySpendOnlyDescription",
    badgeKey: "admin.companyDetail.policySpendOnlyBadge",
  },
  {
    key: "INCLUDE_WITH_BONUS" as const,
    titleKey: "admin.companyDetail.policySpendCashbackTitle",
    descriptionKey: "admin.companyDetail.policySpendCashbackDescription",
    badgeKey: "admin.companyDetail.policySpendCashbackBadge",
  },
] satisfies Array<{
  key: "EXCLUDE" | "INCLUDE_NO_BONUS" | "INCLUDE_WITH_BONUS";
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  badgeKey: TranslationKey;
}>;

const SECTION_META = [
  {
    key: "account",
    titleKey: "admin.companyDetail.sectionAccount",
    descriptionKey: "admin.companyDetail.sectionAccountDescription",
    icon: ShieldAlert,
  },
  {
    key: "profile",
    titleKey: "admin.companyDetail.sectionProfile",
    descriptionKey: "admin.companyDetail.sectionProfileDescription",
    icon: Building2,
  },
  {
    key: "locations",
    titleKey: "admin.companyDetail.sectionLocations",
    descriptionKey: "admin.companyDetail.sectionLocationsDescription",
    icon: MapPin,
  },
  {
    key: "subscriptions",
    titleKey: "admin.companyDetail.sectionSubscriptions",
    descriptionKey: "admin.companyDetail.sectionSubscriptionsDescription",
    icon: CircleDollarSign,
  },
] as const;

type SectionKey = (typeof SECTION_META)[number]["key"];

const WEEKDAY_OPTIONS = [
  { value: 1, labelKey: "admin.companyDetail.weekdayMon" },
  { value: 2, labelKey: "admin.companyDetail.weekdayTue" },
  { value: 3, labelKey: "admin.companyDetail.weekdayWed" },
  { value: 4, labelKey: "admin.companyDetail.weekdayThu" },
  { value: 5, labelKey: "admin.companyDetail.weekdayFri" },
  { value: 6, labelKey: "admin.companyDetail.weekdaySat" },
  { value: 0, labelKey: "admin.companyDetail.weekdaySun" },
];
const DEFAULT_WORKING_DAYS = [0, 1, 2, 3, 4, 5, 6];

function toggleWeekday(days: number[], day: number) {
  const next = days.includes(day) ? days.filter((item) => item !== day) : [...days, day];
  return next.length > 0 ? next.sort((a, b) => a - b) : days;
}

function normalizeLocation(location: AdminCompanyLocation): AdminCompanyLocation {
  return {
    ...location,
    openTime: location.openTime ?? "09:00",
    closeTime: location.closeTime ?? "21:00",
    workingDays: Array.isArray(location.workingDays) && location.workingDays.length > 0
      ? location.workingDays
      : DEFAULT_WORKING_DAYS,
  };
}

function toDateTimeLocal(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoOrNull(local: string) {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function formatPrice(value: string | number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "-";
  return new Intl.NumberFormat("ru-RU").format(n);
}

function normalizeLevelRules(
  rules?: Array<{ levelName: string; minTotalSpend: string | number; cashbackPercent: string | number }>,
) {
  const mapped =
    rules?.map((rule) => ({
      levelName: rule.levelName,
      minTotalSpend: Number(rule.minTotalSpend),
      cashbackPercent: Number(rule.cashbackPercent),
    })) ?? [];

  return mapped.length > 0 ? mapped : [{ levelName: "Bronze", minTotalSpend: 0, cashbackPercent: 0 }];
}

function statusLabel(value: string, t: (key: TranslationKey) => string) {
  if (value === "ACTIVE") return t("admin.companyDetail.statusActive");
  if (value === "INACTIVE") return t("admin.companyDetail.statusInactive");
  if (value === "FROZEN_PENDING_DELETION") return t("admin.companyDetail.statusFrozen");
  if (value === "BLOCKED") return t("admin.companyDetail.statusBlocked");
  if (value === "MAIN") return t("admin.companyDetail.statusMain");
  if (value === "BRANCH") return t("admin.companyDetail.statusBranch");
  return value;
}

export default function AdminCompanyProfilePage() {
  const { t } = useI18n("ru");
  const params = useParams<{ uuid: string }>();
  const companyUserUuid = params.uuid;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [accountForm, setAccountForm] = useState<CompanyForm | null>(null);
  const [companyForm, setCompanyForm] = useState<CompanyProfileForm | null>(null);
  const [subscriptions, setSubscriptions] = useState<AdminCompanySubscription[]>([]);
  const [subscriptionQuery, setSubscriptionQuery] = useState("");
  const [sections, setSections] = useState({
    account: false,
    profile: false,
    locations: false,
    subscriptions: false,
  });
  const [initialAccountHash, setInitialAccountHash] = useState("");
  const [initialCompanyHash, setInitialCompanyHash] = useState("");
  const [initialSubscriptionsHash, setInitialSubscriptionsHash] = useState("");
  const [initialAccountState, setInitialAccountState] = useState<CompanyForm | null>(null);
  const [initialCompanyState, setInitialCompanyState] = useState<CompanyProfileForm | null>(null);
  const [initialSubscriptionsState, setInitialSubscriptionsState] = useState<
    AdminCompanySubscription[]
  >([]);
  const [locations, setLocations] = useState<AdminCompanyLocation[]>([]);
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationDraft, setLocationDraft] = useState<LocationDraft>({
    title: "",
    address: "",
    city: "Moscow",
    openTime: "09:00",
    closeTime: "21:00",
    workingDays: DEFAULT_WORKING_DAYS,
    isMain: false,
  });
  const [draft, setDraft] = useState<SubscriptionDraft>({
    name: "",
    description: "",
    price: "",
    renewalValue: 1,
    renewalUnit: "month",
    promoBonusDays: 0,
    slug: "",
    categoryId: "",
  });
  const [entitlementEditorUuid, setEntitlementEditorUuid] = useState<string | null>(null);
  const [entitlementDraft, setEntitlementDraft] = useState<EntitlementDraft>({
    title: "",
    description: "",
    allowance: 1,
    windowValue: 1,
    windowUnit: "DAY",
  });

  const filteredSubscriptions = useMemo(() => {
    const q = subscriptionQuery.trim().toLowerCase();
    if (!q) return subscriptions;
    return subscriptions.filter((sub) => {
      return (
        sub.name.toLowerCase().includes(q) ||
        sub.description.toLowerCase().includes(q) ||
        sub.slug.toLowerCase().includes(q) ||
        sub.renewalPeriod.toLowerCase().includes(q) ||
        `${sub.renewalValue} ${sub.renewalUnit}`.includes(q)
      );
    });
  }, [subscriptionQuery, subscriptions]);

  const accountHash = useMemo(() => {
    if (!accountForm) return "";
    return JSON.stringify(accountForm);
  }, [accountForm]);

  const companyHash = useMemo(() => {
    if (!companyForm) return "";
    return JSON.stringify(companyForm);
  }, [companyForm]);

  const subscriptionsHash = useMemo(() => {
    return JSON.stringify(
      [...subscriptions]
        .sort((a, b) => a.uuid.localeCompare(b.uuid))
        .map((sub) => ({
          uuid: sub.uuid,
          name: sub.name,
          description: sub.description,
          price: String(sub.price),
          renewalPeriod: sub.renewalPeriod,
          renewalValue: sub.renewalValue,
          renewalUnit: sub.renewalUnit,
          promoBonusDays: sub.promoBonusDays,
          promoEndsAt: sub.promoEndsAt,
          slug: sub.slug,
          categoryId: sub.categoryId,
          isActive: sub.isActive,
        })),
    );
  }, [subscriptions]);

  const accountDirty = Boolean(initialAccountHash && accountHash !== initialAccountHash);
  const companyDirty = Boolean(initialCompanyHash && companyHash !== initialCompanyHash);
  const subscriptionsDirty = Boolean(
    initialSubscriptionsHash && subscriptionsHash !== initialSubscriptionsHash,
  );
  const hasDirty = accountDirty || companyDirty || subscriptionsDirty;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [userRes, cats] = await Promise.all([adminGetCompanyUser(companyUserUuid), adminListCategories()]);
      setCategories(cats);
      if (!userRes.ok) {
        setError(`${t("admin.companyDetail.loadUserFailed")} (${userRes.status}): ${userRes.message}`);
        setLoading(false);
        return;
      }

      const user = userRes.data;
      setAccountForm({
        name: user.name,
        accountStatus: user.accountStatus,
        emailVerifiedAt: toDateTimeLocal(user.emailVerifiedAt),
        createdAt: toDateTimeLocal(user.createdAt),
      });
      setCompanyForm({
        name: user.managedCompany?.name ?? "",
        slug: user.managedCompany?.slug ?? "",
        description: user.managedCompany?.description ?? "",
        categoryIds:
          user.managedCompany?.categories?.map((row) => row.categoryId) ??
          (user.managedCompany?.categoryId ? [user.managedCompany.categoryId] : []),
        pointsPerReward: user.managedCompany?.pointsPerReward ?? 100,
        subscriptionSpendPolicy: user.managedCompany?.subscriptionSpendPolicy ?? "EXCLUDE",
        levelRules: normalizeLevelRules(user.managedCompany?.levelRules),
        isActive: user.managedCompany?.isActive ?? true,
        operatesOnline: user.managedCompany?.operatesOnline ?? false,
      });
      setSubscriptions(user.managedCompany?.subscriptions ?? []);
      setLocations((user.managedCompany?.locations ?? []).map(normalizeLocation));
      const nextAccount: CompanyForm = {
        name: user.name,
        accountStatus: user.accountStatus,
        emailVerifiedAt: toDateTimeLocal(user.emailVerifiedAt),
        createdAt: toDateTimeLocal(user.createdAt),
      };
      const nextCompany: CompanyProfileForm = {
        name: user.managedCompany?.name ?? "",
        slug: user.managedCompany?.slug ?? "",
        description: user.managedCompany?.description ?? "",
        categoryIds:
          user.managedCompany?.categories?.map((row) => row.categoryId) ??
          (user.managedCompany?.categoryId ? [user.managedCompany.categoryId] : []),
        pointsPerReward: user.managedCompany?.pointsPerReward ?? 100,
        subscriptionSpendPolicy: user.managedCompany?.subscriptionSpendPolicy ?? "EXCLUDE",
        levelRules: normalizeLevelRules(user.managedCompany?.levelRules),
        isActive: user.managedCompany?.isActive ?? true,
        operatesOnline: user.managedCompany?.operatesOnline ?? false,
      };
      const nextSubscriptions = user.managedCompany?.subscriptions ?? [];
      setInitialAccountState(nextAccount);
      setInitialCompanyState(nextCompany);
      setInitialSubscriptionsState(nextSubscriptions);
      setInitialAccountHash(JSON.stringify(nextAccount));
      setInitialCompanyHash(JSON.stringify(nextCompany));
      setInitialSubscriptionsHash(
        JSON.stringify(
          [...nextSubscriptions]
            .sort((a, b) => a.uuid.localeCompare(b.uuid))
            .map((sub) => ({
              uuid: sub.uuid,
              name: sub.name,
              description: sub.description,
              price: String(sub.price),
              renewalPeriod: sub.renewalPeriod,
              renewalValue: sub.renewalValue,
              renewalUnit: sub.renewalUnit,
              promoBonusDays: sub.promoBonusDays,
              promoEndsAt: sub.promoEndsAt,
              slug: sub.slug,
              categoryId: sub.categoryId,
              isActive: sub.isActive,
            })),
        ),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("admin.companyDetail.loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    void (async () => {
      try {
        const [userRes, cats] = await Promise.all([adminGetCompanyUser(companyUserUuid), adminListCategories()]);
        if (ignore) return;
        setCategories(cats);
        if (!userRes.ok) {
          setError(`${t("admin.companyDetail.loadUserFailed")} (${userRes.status}): ${userRes.message}`);
          setLoading(false);
          return;
        }

        const user = userRes.data;
        setAccountForm({
          name: user.name,
          accountStatus: user.accountStatus,
          emailVerifiedAt: toDateTimeLocal(user.emailVerifiedAt),
          createdAt: toDateTimeLocal(user.createdAt),
        });
        setCompanyForm({
          name: user.managedCompany?.name ?? "",
          slug: user.managedCompany?.slug ?? "",
          description: user.managedCompany?.description ?? "",
          categoryIds:
            user.managedCompany?.categories?.map((row) => row.categoryId) ??
            (user.managedCompany?.categoryId ? [user.managedCompany.categoryId] : []),
          pointsPerReward: user.managedCompany?.pointsPerReward ?? 100,
          subscriptionSpendPolicy: user.managedCompany?.subscriptionSpendPolicy ?? "EXCLUDE",
          levelRules: normalizeLevelRules(user.managedCompany?.levelRules),
          isActive: user.managedCompany?.isActive ?? true,
          operatesOnline: user.managedCompany?.operatesOnline ?? false,
        });
        setSubscriptions(user.managedCompany?.subscriptions ?? []);
        setLocations((user.managedCompany?.locations ?? []).map(normalizeLocation));
        const nextAccount: CompanyForm = {
          name: user.name,
          accountStatus: user.accountStatus,
          emailVerifiedAt: toDateTimeLocal(user.emailVerifiedAt),
          createdAt: toDateTimeLocal(user.createdAt),
        };
        const nextCompany: CompanyProfileForm = {
          name: user.managedCompany?.name ?? "",
          slug: user.managedCompany?.slug ?? "",
          description: user.managedCompany?.description ?? "",
          categoryIds:
            user.managedCompany?.categories?.map((row) => row.categoryId) ??
            (user.managedCompany?.categoryId ? [user.managedCompany.categoryId] : []),
          pointsPerReward: user.managedCompany?.pointsPerReward ?? 100,
          subscriptionSpendPolicy: user.managedCompany?.subscriptionSpendPolicy ?? "EXCLUDE",
          levelRules: normalizeLevelRules(user.managedCompany?.levelRules),
          isActive: user.managedCompany?.isActive ?? true,
          operatesOnline: user.managedCompany?.operatesOnline ?? false,
        };
        const nextSubscriptions = user.managedCompany?.subscriptions ?? [];
        setInitialAccountState(nextAccount);
        setInitialCompanyState(nextCompany);
        setInitialSubscriptionsState(nextSubscriptions);
        setInitialAccountHash(JSON.stringify(nextAccount));
        setInitialCompanyHash(JSON.stringify(nextCompany));
        setInitialSubscriptionsHash(
          JSON.stringify(
            [...nextSubscriptions]
              .sort((a, b) => a.uuid.localeCompare(b.uuid))
              .map((sub) => ({
                uuid: sub.uuid,
                name: sub.name,
                description: sub.description,
                price: String(sub.price),
                renewalPeriod: sub.renewalPeriod,
                renewalValue: sub.renewalValue,
                renewalUnit: sub.renewalUnit,
                promoBonusDays: sub.promoBonusDays,
                promoEndsAt: sub.promoEndsAt,
                slug: sub.slug,
                categoryId: sub.categoryId,
                isActive: sub.isActive,
              })),
          ),
        );
        setError(null);
        setLoading(false);
      } catch (loadError) {
        if (ignore) return;
        setError(loadError instanceof Error ? loadError.message : t("admin.companyDetail.loadFailed"));
        setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [companyUserUuid]);

  async function saveAccount(options?: SaveOptions) {
    if (!accountForm) return;
    const res = await adminUpdateCompanyUser(companyUserUuid, {
      name: accountForm.name,
      accountStatus: accountForm.accountStatus,
      emailVerifiedAt: toIsoOrNull(accountForm.emailVerifiedAt),
      createdAt: toIsoOrNull(accountForm.createdAt),
    });
    if (!res.ok) {
      setError(String(res.message));
      return false;
    }
    if (!options?.silent) setNotice(t("admin.companyDetail.accountUpdated"));
    setError(null);
    if (!options?.skipReload) await load();
    return true;
  }

  async function saveCompanyProfile(options?: SaveOptions) {
    if (!companyForm) return;
    const categoryIds = companyForm.categoryIds.filter((id) => Number.isInteger(id) && id > 0);
    if (categoryIds.length === 0) {
      setError(t("admin.companyDetail.selectCategoryError"));
      return false;
    }
    const sortedLevelRules = [...companyForm.levelRules].sort(
      (a, b) => Number(a.minTotalSpend) - Number(b.minTotalSpend),
    );
    for (let i = 1; i < sortedLevelRules.length; i += 1) {
      if (Number(sortedLevelRules[i].cashbackPercent) < Number(sortedLevelRules[i - 1].cashbackPercent)) {
        setError(
          t("admin.companyDetail.cashbackOrderError"),
        );
        return false;
      }
    }
    const res = await adminUpsertCompanyProfile(companyUserUuid, {
      name: companyForm.name,
      slug: companyForm.slug,
      description: companyForm.description || undefined,
      categoryId: categoryIds[0],
      categoryIds,
      pointsPerReward: Math.max(1, Number(companyForm.pointsPerReward || 1)),
      subscriptionSpendPolicy: companyForm.subscriptionSpendPolicy,
      levelRules: companyForm.levelRules.map((rule) => ({
        levelName: rule.levelName.trim() || t("admin.companyDetail.levelFallback"),
        minTotalSpend: Number(rule.minTotalSpend || 0),
        cashbackPercent: Number(rule.cashbackPercent || 0),
      })),
      isActive: companyForm.isActive,
      operatesOnline: companyForm.operatesOnline,
    });
    if (!res.ok) {
      setError(String(res.message));
      return false;
    }
    if (!options?.silent) setNotice(t("admin.companyDetail.profileSaved"));
    setError(null);
    if (!options?.skipReload) await load();
    return true;
  }

  async function createSubscription() {
    const res = await adminCreateCompanySubscription(companyUserUuid, {
      name: draft.name,
      description: draft.description,
      price: Number(draft.price),
      renewalValue: Number(draft.renewalValue),
      renewalUnit: draft.renewalUnit,
      promoBonusDays: Number(draft.promoBonusDays || 0),
      promoEndsAt: null,
      slug: draft.slug || undefined,
      categoryId: draft.categoryId === "" ? undefined : Number(draft.categoryId),
    });
    if (!res.ok) {
      setError(String(res.message));
      return;
    }
    setDraft({
      name: "",
      description: "",
      price: "",
      renewalValue: 1,
      renewalUnit: "month",
      promoBonusDays: 0,
      slug: "",
      categoryId: "",
    });
    setError(null);
    setNotice(t("admin.companyDetail.subscriptionCreated"));
    await load();
  }

  async function saveSubscription(sub: AdminCompanySubscription, options?: SaveOptions) {
    const res = await adminUpdateCompanySubscription(companyUserUuid, sub.uuid, {
      name: sub.name,
      description: sub.description,
      price: Number(sub.price),
      renewalValue: sub.renewalValue,
      renewalUnit: sub.renewalUnit,
      promoBonusDays: sub.promoBonusDays,
      promoEndsAt: sub.promoEndsAt,
      slug: sub.slug,
      isActive: sub.isActive,
      categoryId: sub.categoryId ?? undefined,
    });
    if (!res.ok) {
      setError(String(res.message));
      return false;
    }
    setError(null);
    if (!options?.silent) setNotice(t("admin.companyDetail.subscriptionUpdated"));
    if (!options?.skipReload) await load();
    return true;
  }

  async function removeSubscription(uuid: string) {
    const res = await adminDeleteCompanySubscription(companyUserUuid, uuid);
    if (!res.ok) {
      setError(String(res.message));
      return;
    }
    setError(null);
    setNotice(t("admin.companyDetail.subscriptionDeleted"));
    await load();
  }

  async function createEntitlement(subscriptionUuid: string) {
    if (!entitlementDraft.title.trim()) return;
    const res = await adminCreateCompanySubscriptionEntitlement(companyUserUuid, subscriptionUuid, entitlementDraft);
    if (!res.ok) {
      setError(String(res.message));
      return;
    }
    setError(null);
    setNotice(t("admin.companyDetail.entitlementCreated"));
    setEntitlementEditorUuid(null);
    setEntitlementDraft({ title: "", description: "", allowance: 1, windowValue: 1, windowUnit: "DAY" });
    await load();
  }

  async function removeCompanyUser() {
    const check = window.prompt('Type "DELETE" to remove company account');
    if (check !== "DELETE") return;
    const res = await adminDeleteCompanyUser(companyUserUuid);
    if (!res.ok) {
      setError(String(res.message));
      return;
    }
    window.location.href = "/admin/companies";
  }

  async function createLocation() {
    if (!locationDraft.address.trim()) {
      setError(t("admin.companyDetail.locationAddressRequired"));
      return;
    }
    setLocationSaving(true);
    const res = await adminCreateCompanyLocation(companyUserUuid, {
      title: locationDraft.title || undefined,
      address: locationDraft.address,
      city: locationDraft.city || undefined,
      openTime: locationDraft.openTime,
      closeTime: locationDraft.closeTime,
      workingDays: locationDraft.workingDays,
      isMain: locationDraft.isMain,
      isActive: true,
    });
    setLocationSaving(false);
    if (!res.ok) {
      setError(String(res.message));
      return;
    }
    setError(null);
    setNotice(t("admin.companyDetail.locationSaved"));
    setLocationDraft({ title: "", address: "", city: "Moscow", openTime: "09:00", closeTime: "21:00", workingDays: DEFAULT_WORKING_DAYS, isMain: false });
    await load();
  }

  async function saveLocation(location: AdminCompanyLocation) {
    setLocationSaving(true);
    const res = await adminUpdateCompanyLocation(companyUserUuid, location.uuid, {
      title: location.title ?? undefined,
      address: location.address,
      city: location.city ?? undefined,
      openTime: location.openTime ?? "09:00",
      closeTime: location.closeTime ?? "21:00",
      workingDays: location.workingDays ?? DEFAULT_WORKING_DAYS,
      isMain: location.isMain,
      isActive: location.isActive,
    });
    setLocationSaving(false);
    if (!res.ok) {
      setError(String(res.message));
      return;
    }
    setError(null);
    setNotice(t("admin.companyDetail.locationUpdated"));
    await load();
  }

  async function removeLocation(locationUuid: string) {
    const ok = window.confirm("Delete this company address?");
    if (!ok) return;
    const res = await adminDeleteCompanyLocation(companyUserUuid, locationUuid);
    if (!res.ok) {
      setError(String(res.message));
      return;
    }
    setError(null);
    setNotice(t("admin.companyDetail.locationDeleted"));
    await load();
  }

  function openSection(key: SectionKey) {
    setSections((prev) => ({ ...prev, [key]: true }));
    window.requestAnimationFrame(() => {
      document.getElementById(`company-section-${key}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function toggleSection(key: SectionKey) {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function discardAllChanges() {
    if (initialAccountState) {
      setAccountForm({ ...initialAccountState });
      setInitialAccountHash(JSON.stringify(initialAccountState));
    }
    if (initialCompanyState) {
      setCompanyForm({
        ...initialCompanyState,
        categoryIds: [...initialCompanyState.categoryIds],
        levelRules: initialCompanyState.levelRules.map((rule) => ({ ...rule })),
      });
      setInitialCompanyHash(JSON.stringify(initialCompanyState));
    }
    setSubscriptions(initialSubscriptionsState.map((sub) => ({ ...sub })));
    setInitialSubscriptionsHash(
      JSON.stringify(
        [...initialSubscriptionsState]
          .sort((a, b) => a.uuid.localeCompare(b.uuid))
          .map((sub) => ({
            uuid: sub.uuid,
            name: sub.name,
            description: sub.description,
            price: String(sub.price),
            renewalPeriod: sub.renewalPeriod,
            renewalValue: sub.renewalValue,
            renewalUnit: sub.renewalUnit,
            promoBonusDays: sub.promoBonusDays,
            promoEndsAt: sub.promoEndsAt,
            slug: sub.slug,
            categoryId: sub.categoryId,
            isActive: sub.isActive,
          })),
      ),
    );
    setNotice(t("admin.companyDetail.discarded"));
    setError(null);
  }

  async function saveAllChanges() {
    const changedSubscriptions = [...subscriptions]
      .sort((a, b) => a.uuid.localeCompare(b.uuid))
      .filter((sub, index) => {
        const baselineParsed = initialSubscriptionsHash ? (JSON.parse(initialSubscriptionsHash) as Array<{
          uuid: string;
          name: string;
          description: string;
          price: string;
          renewalPeriod: string;
          renewalValue: number;
          renewalUnit: "week" | "month" | "year";
          promoBonusDays: number;
          promoEndsAt: string | null;
          slug: string;
          categoryId: number | null;
          isActive: boolean;
        }>) : [];
        const baseline = baselineParsed[index];
        if (!baseline || baseline.uuid !== sub.uuid) return true;
        return JSON.stringify({
          uuid: sub.uuid,
          name: sub.name,
          description: sub.description,
          price: String(sub.price),
          renewalPeriod: sub.renewalPeriod,
          renewalValue: sub.renewalValue,
          renewalUnit: sub.renewalUnit,
          promoBonusDays: sub.promoBonusDays,
          promoEndsAt: sub.promoEndsAt,
          slug: sub.slug,
          categoryId: sub.categoryId,
          isActive: sub.isActive,
        }) !== JSON.stringify(baseline);
      });

    setError(null);
    setNotice(null);

    if (accountDirty) {
      const ok = await saveAccount({ skipReload: true, silent: true });
      if (!ok) return;
    }
    if (companyDirty) {
      const ok = await saveCompanyProfile({ skipReload: true, silent: true });
      if (!ok) return;
    }
    if (subscriptionsDirty) {
      for (const sub of changedSubscriptions) {
        const ok = await saveSubscription(sub, { skipReload: true, silent: true });
        if (!ok) return;
      }
    }

    await load();
    setNotice(t("admin.companyDetail.allSaved"));
  }

  if (error && !accountForm && !companyForm) {
    return (
      <Card className="glass border-destructive/30">
        <CardContent className="space-y-4 py-6">
          <div className="space-y-1">
            <p className="text-base font-semibold text-destructive">{t("admin.companyDetail.loadFailedTitle")}</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void load()}>
              {t("admin.common.retry")}
            </Button>
            <Button asChild variant="ghost">
              <Link href="/admin/companies">
                <ArrowLeft className="h-4 w-4" />
                {t("admin.companyDetail.back")}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading || !accountForm || !companyForm) {
    return <p className="text-sm text-muted-foreground">{t("admin.companyDetail.loading")}</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
            <Link href="/admin/companies">
              <ArrowLeft className="h-4 w-4" />
              {t("admin.companyDetail.back")}
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{t("admin.companyDetail.title")}</h1>
            <Badge variant={companyForm.isActive ? "default" : "secondary"}>
              {companyForm.isActive ? statusLabel("ACTIVE", t) : statusLabel("INACTIVE", t)}
            </Badge>
            {companyForm.operatesOnline && <Badge variant="outline">{t("admin.companyDetail.onlineBadge")}</Badge>}
            <Badge variant="outline">UUID: {companyUserUuid.slice(0, 8)}...</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary">
            <Link href={`/admin/companies/${companyUserUuid}/clients`}>
              <Users className="h-4 w-4" />
              {t("admin.companyDetail.companyClients")}
            </Link>
          </Button>
          <Button variant="destructive" onClick={() => void removeCompanyUser()}>
            <Trash2 className="h-4 w-4" />
            {t("admin.companyDetail.deleteCompanyUser")}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="glass border-white/10 gap-3 py-3">
          <CardContent className="flex items-center gap-3 px-4">
            <div className="rounded-lg bg-primary/15 p-2 text-primary">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("admin.companyDetail.companyProfile")}</p>
              <p className="text-sm font-semibold">{companyForm.name || t("admin.companyDetail.notSet")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-white/10 gap-3 py-3">
          <CardContent className="flex items-center gap-3 px-4">
            <div className="rounded-lg bg-primary/15 p-2 text-primary">
              <CircleDollarSign className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("admin.companyDetail.minRedeem")}</p>
              <p className="text-sm font-semibold">{formatPrice(companyForm.pointsPerReward)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-white/10 gap-3 py-3">
          <CardContent className="flex items-center gap-3 px-4">
            <div className="rounded-lg bg-primary/15 p-2 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("admin.companyDetail.subscriptions")}</p>
              <p className="text-sm font-semibold">{subscriptions.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        {t("admin.companyDetail.proTipStart")} <span className="font-medium text-foreground">{t("admin.companyDetail.saveAll")}</span> {t("admin.companyDetail.proTipEnd")}
      </div>

      <Card className="glass border-white/10">
        <CardContent className="flex flex-wrap gap-2 p-3">
          {SECTION_META.map((section) => {
            const Icon = section.icon;
            const isOpen = sections[section.key];
            return (
              <Button
                key={section.key}
                type="button"
                variant={isOpen ? "default" : "secondary"}
                className="h-auto min-w-[150px] justify-start gap-2 px-3 py-2"
                onClick={() => openSection(section.key)}
              >
                <Icon className="h-4 w-4" />
                  <span className="text-left">
                  <span className="block text-sm font-semibold">{t(section.titleKey)}</span>
                  <span className="block text-[11px] opacity-75">{t(section.descriptionKey)}</span>
                </span>
              </Button>
            );
          })}
        </CardContent>
      </Card>

      <Card id="company-section-account" className="scroll-mt-4 glass border-white/10 gap-3 py-4">
        <CardHeader
          className={cn("pb-2 pt-4", !sections.account && "cursor-pointer")}
          onClick={() => {
            if (!sections.account) openSection("account");
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <CardTitle className="inline-flex items-center gap-2 text-base">
                <ShieldAlert className="h-4 w-4 text-primary" />
                {t("admin.companyDetail.accountTitle")}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t("admin.companyDetail.accountDescription")}</p>
            </div>
            <div className="flex items-center gap-2">
              {accountDirty && <Badge variant="outline">{t("admin.companyDetail.unsaved")}</Badge>}
              <Button
                variant="ghost"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleSection("account");
                }}
              >
                {sections.account ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        {sections.account && <CardContent className="space-y-3 pb-4 pt-0">
          <div className="rounded-xl border border-white/10 bg-muted/10 p-3.5 md:p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="acc-name">{t("admin.companyDetail.displayName")}</Label>
              <Input
                id="acc-name"
                value={accountForm.name}
                onChange={(e) => setAccountForm((p) => (p ? { ...p, name: e.target.value } : p))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acc-status" className="inline-flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-primary" />
                {t("admin.companyDetail.accountStatus")}
              </Label>
              <SelectField
                id="acc-status"
                value={accountForm.accountStatus}
                onChange={(e) =>
                  setAccountForm((p) => (p ? { ...p, accountStatus: e.target.value as CompanyForm["accountStatus"] } : p))
                }
              >
                <option value="ACTIVE">{statusLabel("ACTIVE", t)}</option>
                <option value="FROZEN_PENDING_DELETION">{statusLabel("FROZEN_PENDING_DELETION", t)}</option>
                <option value="BLOCKED">{statusLabel("BLOCKED", t)}</option>
              </SelectField>
            </div>
            <div className="space-y-2">
              <Label htmlFor="acc-email-verified">{t("admin.companyDetail.emailVerifiedAt")}</Label>
              <Input
                id="acc-email-verified"
                type="datetime-local"
                value={accountForm.emailVerifiedAt}
                onChange={(e) => setAccountForm((p) => (p ? { ...p, emailVerifiedAt: e.target.value } : p))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acc-created-at">{t("admin.companyDetail.createdAt")}</Label>
              <Input
                id="acc-created-at"
                type="datetime-local"
                value={accountForm.createdAt}
                onChange={(e) => setAccountForm((p) => (p ? { ...p, createdAt: e.target.value } : p))}
              />
            </div>
            </div>
          </div>
          <Button onClick={() => void saveAccount()}>
            <Save className="h-4 w-4" />
            {t("admin.companyDetail.saveAccount")}
          </Button>
        </CardContent>}
      </Card>

      <Card id="company-section-locations" className="scroll-mt-4 glass border-white/10 gap-3 py-4">
        <CardHeader
          className={cn("pb-2 pt-4", !sections.locations && "cursor-pointer")}
          onClick={() => {
            if (!sections.locations) openSection("locations");
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <CardTitle className="inline-flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-primary" />
                {t("admin.companyDetail.locations")}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {companyForm.operatesOnline
                  ? t("admin.companyDetail.locationsOnlineDescription")
                  : t("admin.companyDetail.locationsDescription")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="secondary" size="sm" onClick={(event) => event.stopPropagation()}>
                <Link href={`/admin/companies/${companyUserUuid}/map`}>
                  <MapPin className="h-4 w-4" />
                  {t("admin.companyDetail.openMapPicker")}
                </Link>
              </Button>
              <Badge variant="outline">{locations.length} {t("admin.companyDetail.savedCount")}</Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleSection("locations");
                }}
              >
                {sections.locations ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        {sections.locations && (
          <CardContent className="space-y-4 pb-4 pt-0">
            {companyForm.operatesOnline && (
              <div className="rounded-2xl border border-cyan-200/20 bg-cyan-200/[0.06] p-4 text-sm text-cyan-50">
                <div className="flex items-start gap-3">
                  <Globe2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-100" />
                  <div>
                    <p className="font-semibold">{t("admin.companyDetail.onlineLocationsTitle")}</p>
                    <p className="mt-1 text-cyan-50/75">{t("admin.companyDetail.onlineLocationsHint")}</p>
                  </div>
                </div>
              </div>
            )}
            <div className="rounded-2xl border border-cyan-200/15 bg-gradient-to-br from-cyan-200/[0.07] via-muted/10 to-muted/5 p-4 shadow-[0_18px_70px_rgba(0,0,0,0.16)]">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="inline-flex items-center gap-2 text-sm font-semibold">
                    <Plus className="h-4 w-4 text-cyan-100" />
                    {t("admin.companyDetail.addLocationTitle")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{t("admin.companyDetail.addLocationHint")}</p>
                </div>
                {locationDraft.isMain && (
                  <Badge variant="outline" className="border-cyan-200/40 bg-cyan-200/10 text-cyan-50">
                    {t("admin.companyDetail.mainLocationSelected")}
                  </Badge>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
                <div className="space-y-2 xl:col-span-2">
                  <Label htmlFor="location-title">{t("admin.companyDetail.locationLabel")}</Label>
                  <Input
                    id="location-title"
                    placeholder={t("admin.companyDetail.locationLabelPlaceholder")}
                    value={locationDraft.title}
                    onChange={(e) => setLocationDraft((p) => ({ ...p, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 xl:col-span-2">
                  <Label htmlFor="location-city">{t("admin.companyDetail.city")}</Label>
                  <Input
                    id="location-city"
                    placeholder={t("admin.companyDetail.cityPlaceholder")}
                    value={locationDraft.city}
                    onChange={(e) => setLocationDraft((p) => ({ ...p, city: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 xl:col-span-4">
                  <Label htmlFor="location-address">{t("admin.companyDetail.address")}</Label>
                  <Input
                    id="location-address"
                    placeholder={t("admin.companyDetail.addressPlaceholder")}
                    value={locationDraft.address}
                    onChange={(e) => setLocationDraft((p) => ({ ...p, address: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 xl:col-span-2">
                  <Label htmlFor="location-open">{t("admin.companyDetail.openTime")}</Label>
                  <Input
                    id="location-open"
                    type="time"
                    value={locationDraft.openTime}
                    onChange={(e) => setLocationDraft((p) => ({ ...p, openTime: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 xl:col-span-2">
                  <Label htmlFor="location-close">{t("admin.companyDetail.closeTime")}</Label>
                  <Input
                    id="location-close"
                    type="time"
                    value={locationDraft.closeTime}
                    onChange={(e) => setLocationDraft((p) => ({ ...p, closeTime: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2 xl:col-span-7">
                  <Label>{t("admin.companyDetail.workingDays")}</Label>
                  <div className="flex flex-wrap gap-1.5 rounded-xl border border-white/10 bg-background/35 p-2">
                    {WEEKDAY_OPTIONS.map((day) => (
                      <Button
                        key={day.value}
                        type="button"
                        size="sm"
                        variant={(locationDraft.workingDays ?? DEFAULT_WORKING_DAYS).includes(day.value) ? "default" : "secondary"}
                        className="h-8 min-w-9 px-2 text-xs"
                        onClick={() =>
                          setLocationDraft((prev) => ({ ...prev, workingDays: toggleWeekday(prev.workingDays ?? DEFAULT_WORKING_DAYS, day.value) }))
                        }
                      >
                        {t(day.labelKey as TranslationKey)}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2 xl:col-span-5">
                  <Label>{t("admin.companyDetail.locationActions")}</Label>
                  <div className="grid gap-2 rounded-xl border border-white/10 bg-background/35 p-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      variant={locationDraft.isMain ? "default" : "secondary"}
                      onClick={() => setLocationDraft((p) => ({ ...p, isMain: !p.isMain }))}
                      className="h-10 min-w-0"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {t("admin.companyDetail.markMainLocation")}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void createLocation()}
                      disabled={locationSaving || !locationDraft.address.trim()}
                      className="h-10 min-w-0"
                    >
                      <Plus className="h-4 w-4" />
                      {t("admin.companyDetail.addLocationButton")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              {locations.map((location) => (
                <div key={location.uuid} className="rounded-2xl border border-white/10 bg-muted/10 p-4">
                  <div className="mb-4 grid gap-3 border-b border-white/10 pb-3 xl:grid-cols-[1fr_auto] xl:items-start">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={location.isMain ? "default" : "secondary"}>
                        {location.isMain ? statusLabel("MAIN", t) : statusLabel("BRANCH", t)}
                      </Badge>
                      <Badge variant={location.isActive ? "outline" : "secondary"}>
                        {location.isActive ? statusLabel("ACTIVE", t) : statusLabel("INACTIVE", t)}
                      </Badge>
                      {location.precision && <Badge variant="outline">{t("admin.companyDetail.precision")}: {location.precision}</Badge>}
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">
                      {Number(location.latitude).toFixed(6)}, {Number(location.longitude).toFixed(6)}
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
                    <div className="space-y-1 xl:col-span-2">
                      <Label className="text-xs">{t("admin.companyDetail.locationLabel")}</Label>
                      <Input
                        value={location.title ?? ""}
                        onChange={(e) =>
                          setLocations((prev) =>
                            prev.map((item) => (item.uuid === location.uuid ? { ...item, title: e.target.value } : item)),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1 xl:col-span-2">
                      <Label className="text-xs">{t("admin.companyDetail.city")}</Label>
                      <Input
                        value={location.city ?? ""}
                        onChange={(e) =>
                          setLocations((prev) =>
                            prev.map((item) => (item.uuid === location.uuid ? { ...item, city: e.target.value } : item)),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1 xl:col-span-4">
                      <Label className="text-xs">{t("admin.companyDetail.address")}</Label>
                      <Input
                        value={location.address}
                        onChange={(e) =>
                          setLocations((prev) =>
                            prev.map((item) => (item.uuid === location.uuid ? { ...item, address: e.target.value } : item)),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1 xl:col-span-2">
                      <Label className="text-xs">{t("admin.companyDetail.openTime")}</Label>
                      <Input
                        type="time"
                        value={location.openTime}
                        onChange={(e) =>
                          setLocations((prev) =>
                            prev.map((item) => (item.uuid === location.uuid ? { ...item, openTime: e.target.value } : item)),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1 xl:col-span-2">
                      <Label className="text-xs">{t("admin.companyDetail.closeTime")}</Label>
                      <Input
                        type="time"
                        value={location.closeTime}
                        onChange={(e) =>
                          setLocations((prev) =>
                            prev.map((item) => (item.uuid === location.uuid ? { ...item, closeTime: e.target.value } : item)),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2 xl:col-span-7">
                      <Label className="text-xs">{t("admin.companyDetail.workingDays")}</Label>
                      <div className="flex flex-wrap gap-1.5 rounded-xl border border-white/10 bg-background/35 p-2">
                        {WEEKDAY_OPTIONS.map((day) => (
                          <Button
                            key={day.value}
                            type="button"
                            size="sm"
                            variant={(location.workingDays ?? DEFAULT_WORKING_DAYS).includes(day.value) ? "default" : "secondary"}
                            className="h-8 min-w-9 px-2 text-xs"
                            onClick={() =>
                              setLocations((prev) =>
                                prev.map((item) =>
                                  item.uuid === location.uuid
                                    ? { ...item, workingDays: toggleWeekday(item.workingDays ?? DEFAULT_WORKING_DAYS, day.value) }
                                    : item,
                                ),
                              )
                            }
                          >
                            {t(day.labelKey as TranslationKey)}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2 md:col-span-2 xl:col-span-5">
                      <Label className="text-xs">{t("admin.companyDetail.locationActions")}</Label>
                      <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-background/35 p-2">
                      <Button
                        variant={location.isMain ? "default" : "secondary"}
                        onClick={() =>
                          setLocations((prev) =>
                            prev.map((item) => ({
                              ...item,
                              isMain: item.uuid === location.uuid,
                            })),
                          )
                        }
                        className="min-w-0"
                      >
                        {location.isMain ? t("admin.companyDetail.mainLocationSelected") : t("admin.companyDetail.markMainLocation")}
                      </Button>
                      <Button
                        variant={location.isActive ? "secondary" : "outline"}
                        onClick={() =>
                          setLocations((prev) =>
                            prev.map((item) =>
                              item.uuid === location.uuid ? { ...item, isActive: !item.isActive } : item,
                            ),
                          )
                        }
                        className="min-w-0"
                      >
                        {location.isActive ? statusLabel("ACTIVE", t) : statusLabel("INACTIVE", t)}
                      </Button>
                      <Button onClick={() => void saveLocation(location)} disabled={locationSaving} className="min-w-0">
                        {t("admin.companyDetail.save")}
                      </Button>
                      <Button variant="destructive" onClick={() => void removeLocation(location.uuid)} className="min-w-0">
                        {t("admin.companyDetail.delete")}
                      </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {locations.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/15 bg-muted/10 p-5 text-sm text-muted-foreground">
                  {companyForm.operatesOnline
                    ? t("admin.companyDetail.noAddressesOnline")
                    : t("admin.companyDetail.noAddresses")}
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      <Card id="company-section-profile" className="scroll-mt-4 glass border-white/10 gap-3 py-4">
        <CardHeader
          className={cn("pb-2 pt-4", !sections.profile && "cursor-pointer")}
          onClick={() => {
            if (!sections.profile) openSection("profile");
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <CardTitle className="inline-flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-primary" />
                {t("admin.companyDetail.companyProfile")}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t("admin.companyDetail.profileDescription")}</p>
            </div>
            <div className="flex items-center gap-2">
              {companyDirty && <Badge variant="outline">{t("admin.companyDetail.unsaved")}</Badge>}
              <Button
                variant="ghost"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleSection("profile");
                }}
              >
                {sections.profile ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        {sections.profile && <CardContent className="space-y-3 pb-4 pt-0">
          <div className="rounded-xl border border-white/10 bg-muted/10 p-3.5 md:p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">{t("admin.companyDetail.companyName")}</Label>
              <Input
                id="company-name"
                placeholder={t("admin.companyDetail.companyName")}
                value={companyForm.name}
                onChange={(e) => setCompanyForm((p) => (p ? { ...p, name: e.target.value } : p))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-slug">{t("admin.companyDetail.slug")}</Label>
              <Input
                id="company-slug"
                placeholder="company-slug"
                value={companyForm.slug}
                onChange={(e) => setCompanyForm((p) => (p ? { ...p, slug: e.target.value } : p))}
              />
            </div>
            <div className="space-y-2 xl:col-span-2">
              <Label htmlFor="company-description">{t("admin.companyDetail.description")}</Label>
              <Textarea
                id="company-description"
                placeholder={t("admin.companyDetail.descriptionPlaceholder")}
                rows={2}
                className="max-h-48"
                value={companyForm.description}
                onChange={(e) => setCompanyForm((p) => (p ? { ...p, description: e.target.value } : p))}
              />
            </div>
            <div className="space-y-2 xl:col-span-2">
              <Label htmlFor="company-category">{t("admin.companyDetail.categories")}</Label>
              <CategoryMultiSelect
                id="company-category"
                value={companyForm.categoryIds}
                options={categories}
                onChange={(nextValues) =>
                  setCompanyForm((p) => (p ? { ...p, categoryIds: nextValues } : p))
                }
                placeholder={t("admin.companyDetail.categoriesPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-points">{t("admin.companyDetail.minRedeem")}</Label>
              <Input
                id="company-points"
                type="number"
                min={1}
                value={companyForm.pointsPerReward}
                onChange={(e) =>
                  setCompanyForm((p) =>
                    p ? { ...p, pointsPerReward: Math.max(1, Number(e.target.value || 1)) } : p,
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-active">{t("admin.companyDetail.companyStatus")}</Label>
              <SelectField
                id="company-active"
                value={companyForm.isActive ? "active" : "inactive"}
                onChange={(e) =>
                  setCompanyForm((p) => (p ? { ...p, isActive: e.target.value === "active" } : p))
                }
              >
                <option value="active">{statusLabel("ACTIVE", t)}</option>
                <option value="inactive">{statusLabel("INACTIVE", t)}</option>
              </SelectField>
            </div>
            <div className="space-y-2 xl:col-span-2">
              <Label className="inline-flex items-center gap-1.5">
                <Globe2 className="h-3.5 w-3.5 text-primary" />
                {t("admin.companyDetail.workMode")}
              </Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant={!companyForm.operatesOnline ? "default" : "secondary"}
                  className="h-auto justify-start gap-3 rounded-xl px-3 py-3 text-left"
                  onClick={() =>
                    setCompanyForm((p) => (p ? { ...p, operatesOnline: false } : p))
                  }
                >
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span>
                    <span className="block text-sm font-semibold">
                      {t("admin.companyDetail.workModeOffline")}
                    </span>
                    <span className="block text-xs font-normal opacity-70">
                      {t("admin.companyDetail.workModeOfflineDescription")}
                    </span>
                  </span>
                </Button>
                <Button
                  type="button"
                  variant={companyForm.operatesOnline ? "default" : "secondary"}
                  className="h-auto justify-start gap-3 rounded-xl px-3 py-3 text-left"
                  onClick={() =>
                    setCompanyForm((p) => (p ? { ...p, operatesOnline: true } : p))
                  }
                >
                  <Globe2 className="h-4 w-4 shrink-0" />
                  <span>
                    <span className="block text-sm font-semibold">
                      {t("admin.companyDetail.workModeOnline")}
                    </span>
                    <span className="block text-xs font-normal opacity-70">
                      {t("admin.companyDetail.workModeOnlineDescription")}
                    </span>
                  </span>
                </Button>
              </div>
            </div>
            <div className="space-y-2 xl:col-span-2">
              <Label className="inline-flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                {t("admin.companyDetail.subscriptionImpactMode")}
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {SUBSCRIPTION_POLICY_OPTIONS.map((opt) => {
                  const isActive = companyForm.subscriptionSpendPolicy === opt.key;
                  return (
                    <Button
                      key={opt.key}
                      type="button"
                      variant={isActive ? "default" : "secondary"}
                      className="h-9 w-full justify-center truncate px-2 text-xs md:text-sm"
                      onClick={() =>
                        setCompanyForm((p) =>
                          p ? { ...p, subscriptionSpendPolicy: opt.key } : p,
                        )
                      }
                    >
                      {t(opt.titleKey)}
                    </Button>
                  );
                })}
              </div>
              <div className="rounded-md border border-white/10 bg-muted/30 px-2.5 py-2 text-xs">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="font-medium">
                    {t(SUBSCRIPTION_POLICY_OPTIONS.find((opt) => opt.key === companyForm.subscriptionSpendPolicy)?.titleKey ?? "admin.companyDetail.policyExcludeTitle")}
                  </p>
                  <Badge variant="outline">
                    {t(SUBSCRIPTION_POLICY_OPTIONS.find((opt) => opt.key === companyForm.subscriptionSpendPolicy)?.badgeKey ?? "admin.companyDetail.policyExcludeBadge")}
                  </Badge>
                </div>
                <p className="text-muted-foreground">
                  {t(SUBSCRIPTION_POLICY_OPTIONS.find((opt) => opt.key === companyForm.subscriptionSpendPolicy)?.descriptionKey ?? "admin.companyDetail.policyExcludeDescription")}
                </p>
              </div>
            </div>
            <div className="space-y-2 xl:col-span-4">
              <Label>{t("admin.companyDetail.loyaltyLevels")}</Label>
              <div className="space-y-2 rounded-xl border border-white/10 bg-muted/20 p-3">
                <div className="hidden grid-cols-12 gap-2 px-1 text-xs font-medium text-muted-foreground md:grid">
                  <div className="col-span-5">{t("admin.companyDetail.levelName")}</div>
                  <div className="col-span-3">{t("admin.companyDetail.minTotalSpend")}</div>
                  <div className="col-span-2">{t("admin.companyDetail.cashbackPercent")}</div>
                  <div className="col-span-2 text-center">{t("admin.companyDetail.actions")}</div>
                </div>
                {companyForm.levelRules.map((rule, index) => (
                  <div
                    key={`${index}-${rule.levelName}`}
                    className="grid gap-2 rounded-lg border border-white/10 bg-background/50 p-2.5 md:grid-cols-12"
                  >
                    <div className="space-y-1 md:col-span-5">
                      <Label className="text-xs md:hidden">{t("admin.companyDetail.levelName")}</Label>
                      <Input
                        placeholder={t("admin.companyDetail.levelName")}
                        value={rule.levelName}
                        onChange={(e) =>
                          setCompanyForm((p) =>
                            p
                              ? {
                                  ...p,
                                  levelRules: p.levelRules.map((r, i) =>
                                    i === index ? { ...r, levelName: e.target.value } : r,
                                  ),
                                }
                              : p,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1 md:col-span-3">
                      <Label className="text-xs md:hidden">{t("admin.companyDetail.minTotalSpend")}</Label>
                      <Input
                        type="number"
                        min={0}
                        step="1"
                        placeholder="0"
                        value={rule.minTotalSpend}
                        onFocus={(e) => {
                          if (rule.minTotalSpend === 0) e.currentTarget.select();
                        }}
                        onChange={(e) =>
                          setCompanyForm((p) =>
                            p
                              ? {
                                  ...p,
                                  levelRules: p.levelRules.map((r, i) =>
                                    i === index
                                      ? {
                                          ...r,
                                          minTotalSpend: Math.max(0, Number(e.target.value || 0)),
                                        }
                                      : r,
                                  ),
                                }
                              : p,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs md:hidden">{t("admin.companyDetail.cashbackPercent")}</Label>
                      <Input
                        type="number"
                        min={0}
                        max={30}
                        step="0.1"
                        placeholder="0%"
                        value={rule.cashbackPercent}
                        onFocus={(e) => {
                          if (rule.cashbackPercent === 0) e.currentTarget.select();
                        }}
                        onChange={(e) =>
                          setCompanyForm((p) =>
                            p
                              ? {
                                  ...p,
                                  levelRules: p.levelRules.map((r, i) =>
                                    i === index
                                      ? {
                                          ...r,
                                          cashbackPercent: Math.min(
                                            30,
                                            Math.max(0, Number(e.target.value || 0)),
                                          ),
                                        }
                                      : r,
                                  ),
                                }
                              : p,
                          )
                        }
                      />
                      <div className="grid grid-cols-3 gap-1">
                        {[1, 5, 10].map((preset) => (
                          <Button
                            key={preset}
                            type="button"
                            size="sm"
                            variant={
                              Number(rule.cashbackPercent) === preset ? "default" : "secondary"
                            }
                            className="h-7 px-0 text-xs"
                            onClick={() =>
                              setCompanyForm((p) =>
                                p
                                  ? {
                                      ...p,
                                      levelRules: p.levelRules.map((r, i) =>
                                        i === index ? { ...r, cashbackPercent: preset } : r,
                                      ),
                                    }
                                  : p,
                              )
                            }
                          >
                            {preset}%
                          </Button>
                        ))}
                      </div>
                    </div>
                    <Button
                      className="md:col-span-2"
                      variant="destructive"
                      onClick={() =>
                        setCompanyForm((p) =>
                          p
                            ? {
                                ...p,
                                levelRules:
                                  p.levelRules.length > 1
                                    ? p.levelRules.filter((_, i) => i !== index)
                                    : p.levelRules,
                              }
                            : p,
                        )
                      }
                      disabled={companyForm.levelRules.length <= 1}
                    >
                      {t("admin.companyDetail.remove")}
                    </Button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  onClick={() =>
                    setCompanyForm((p) =>
                      p
                        ? {
                            ...p,
                            levelRules: [
                              ...p.levelRules,
                              {
                                levelName: `${t("admin.companyDetail.levelFallback")} ${p.levelRules.length + 1}`,
                                minTotalSpend: 0,
                                cashbackPercent: 0,
                              },
                            ],
                          }
                        : p,
                    )
                  }
                >
                  <Plus className="h-4 w-4" />
                  {t("admin.companyDetail.addLevel")}
                </Button>
              </div>
            </div>
            <div className="flex items-end xl:col-span-4">
              <Button onClick={() => void saveCompanyProfile()} className="w-full">
                <Save className="h-4 w-4" />
                {t("admin.companyDetail.saveCompanyProfile")}
              </Button>
            </div>
            </div>
          </div>
        </CardContent>}
      </Card>

      <Card id="company-section-subscriptions" className="scroll-mt-4 glass border-white/10 gap-3 py-4">
        <CardHeader
          className={cn("pb-2 pt-4", !sections.subscriptions && "cursor-pointer")}
          onClick={() => {
            if (!sections.subscriptions) openSection("subscriptions");
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <CardTitle className="inline-flex items-center gap-2 text-base">
                <CircleDollarSign className="h-4 w-4 text-primary" />
                {t("admin.companyDetail.subscriptions")}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t("admin.companyDetail.subscriptionsDescription")}</p>
            </div>
            <div className="flex items-center gap-2">
              {subscriptionsDirty && <Badge variant="outline">{t("admin.companyDetail.unsaved")}</Badge>}
              <Button
                variant="ghost"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleSection("subscriptions");
                }}
              >
                {sections.subscriptions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        {sections.subscriptions && <CardContent className="space-y-4 pb-4 pt-0">
          <div className="rounded-xl border border-white/10 bg-muted/10 p-4 md:p-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
              <div className="space-y-2 xl:col-span-3">
                <Label htmlFor="sub-draft-name" className="inline-flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  {t("admin.companyDetail.name")}
                </Label>
                <Input
                  id="sub-draft-name"
                  placeholder="Premium Coffee Club"
                  value={draft.name}
                  onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2 xl:col-span-2">
                <Label htmlFor="sub-draft-price" className="inline-flex items-center gap-1.5">
                  <CircleDollarSign className="h-3.5 w-3.5 text-primary" />
                  {t("admin.companyDetail.price")}
                </Label>
                <Input
                  id="sub-draft-price"
                  placeholder="100"
                  type="number"
                  value={draft.price}
                  onChange={(e) => setDraft((p) => ({ ...p, price: e.target.value }))}
                />
              </div>
              <div className="space-y-2 xl:col-span-2">
                <Label htmlFor="sub-draft-renewal-value" className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <Hash className="h-3.5 w-3.5 text-primary" />
                  {t("admin.companyDetail.periodValue")}
                </Label>
                <Input
                  id="sub-draft-renewal-value"
                  type="number"
                  min={1}
                  value={draft.renewalValue}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, renewalValue: Math.max(1, Number(e.target.value || 1)) }))
                  }
                />
              </div>
              <div className="space-y-2 xl:col-span-2">
                <Label htmlFor="sub-draft-renewal-unit" className="inline-flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5 text-primary" />
                  {t("admin.companyDetail.renewalPeriod")}
                </Label>
                <SelectField
                  id="sub-draft-renewal-unit"
                  value={draft.renewalUnit}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, renewalUnit: e.target.value as "week" | "month" | "year" }))
                  }
                >
                  <option value="week">{t("admin.companyDetail.week")}</option>
                  <option value="month">{t("admin.companyDetail.month")}</option>
                  <option value="year">{t("admin.companyDetail.year")}</option>
                </SelectField>
              </div>
              <div className="space-y-2 xl:col-span-2">
                <Label htmlFor="sub-draft-promo-bonus" className="inline-flex items-center gap-1.5">
                  <Gift className="h-3.5 w-3.5 text-primary" />
                  {t("admin.companyDetail.bonusDays")}
                </Label>
                <Input
                  id="sub-draft-promo-bonus"
                  type="number"
                  min={0}
                  value={draft.promoBonusDays}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, promoBonusDays: Math.max(0, Number(e.target.value || 0)) }))
                  }
                />
              </div>
              <div className="space-y-2 xl:col-span-3">
                <Label htmlFor="sub-draft-slug" className="inline-flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-primary" />
                  {t("admin.companyDetail.slug")}
                </Label>
                <Input
                  id="sub-draft-slug"
                  placeholder="premium-coffee-club"
                  value={draft.slug}
                  onChange={(e) => setDraft((p) => ({ ...p, slug: e.target.value }))}
                />
              </div>
              <div className="space-y-2 xl:col-span-4">
              <Label htmlFor="sub-draft-category" className="inline-flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-primary" />
                {t("admin.companyDetail.category")}
              </Label>
                <CategorySelect
                  id="sub-draft-category"
                  value={draft.categoryId}
                  options={categories}
                  onChange={(nextValue) => setDraft((p) => ({ ...p, categoryId: nextValue }))}
                  emptyLabel={t("admin.companyDetail.noCategory")}
                />
              </div>
              <div className="space-y-2 xl:col-span-12 xl:mt-1">
                <Label htmlFor="sub-draft-description" className="inline-flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  {t("admin.companyDetail.description")}
                </Label>
                <Textarea
                  id="sub-draft-description"
                  placeholder={t("admin.companyDetail.subscriptionDescriptionPlaceholder")}
                  rows={5}
                  className="min-h-[140px] max-h-80"
                  value={draft.description}
                  onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div className="flex items-end justify-end xl:col-span-12">
                <Button
                  onClick={() => void createSubscription()}
                  disabled={!draft.name || !draft.description || !draft.price}
                  className="h-11 w-full xl:w-[220px]"
                >
                  <Plus className="h-4 w-4" />
                  {t("admin.companyDetail.add")}
                </Button>
              </div>
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={subscriptionQuery}
              onChange={(e) => setSubscriptionQuery(e.target.value)}
              placeholder={t("admin.companyDetail.subscriptionSearchPlaceholder")}
              className="pl-9"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {t("admin.companyDetail.showing")} {filteredSubscriptions.length} {t("admin.companyDetail.of")} {subscriptions.length} {t("admin.companyDetail.subscriptionsPlural")}
          </p>

          <div className="space-y-2.5">
            {filteredSubscriptions.map((sub) => (
              <div key={sub.uuid} className="rounded-xl border border-white/10 bg-muted/10 p-3.5">
                <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                  <p className="text-xs font-medium text-muted-foreground">{t("admin.companyDetail.subscription")} #{sub.uuid.slice(0, 8)}</p>
                  <Badge variant={sub.isActive ? "default" : "secondary"}>
                    {sub.isActive ? statusLabel("ACTIVE", t) : statusLabel("INACTIVE", t)}
                  </Badge>
                </div>
                <div className="mb-2 hidden grid-cols-12 gap-3 px-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground xl:grid">
                  <div className="col-span-2">{t("admin.companyDetail.name")}</div>
                  <div className="col-span-1">{t("admin.companyDetail.price")}</div>
                  <div className="col-span-1">{t("admin.companyDetail.period")}</div>
                  <div className="col-span-2">{t("admin.companyDetail.renewal")}</div>
                  <div className="col-span-1">{t("admin.companyDetail.bonusDaysShort")}</div>
                  <div className="col-span-2">{t("admin.companyDetail.slug")}</div>
                  <div className="col-span-3">{t("admin.companyDetail.category")}</div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
                  <div className="space-y-1 xl:col-span-2">
                    <Label className="text-xs xl:hidden">{t("admin.companyDetail.name")}</Label>
                    <Input value={sub.name} onChange={(e) => setSubscriptions((prev) => prev.map((p) => p.uuid === sub.uuid ? { ...p, name: e.target.value } : p))} />
                  </div>
                  <div className="space-y-1 xl:col-span-1">
                    <Label className="text-xs xl:hidden">{t("admin.companyDetail.price")}</Label>
                    <Input type="number" value={sub.price} onChange={(e) => setSubscriptions((prev) => prev.map((p) => p.uuid === sub.uuid ? { ...p, price: e.target.value } : p))} />
                  </div>
                  <div className="space-y-1 xl:col-span-1">
                    <Label className="text-xs xl:hidden">{t("admin.companyDetail.periodValue")}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={sub.renewalValue}
                      onChange={(e) =>
                        setSubscriptions((prev) =>
                          prev.map((p) =>
                            p.uuid === sub.uuid ? { ...p, renewalValue: Math.max(1, Number(e.target.value || 1)) } : p,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1 xl:col-span-2">
                    <Label className="text-xs xl:hidden">{t("admin.companyDetail.renewalPeriod")}</Label>
                    <SelectField
                      value={sub.renewalUnit}
                      onChange={(e) =>
                        setSubscriptions((prev) =>
                          prev.map((p) =>
                            p.uuid === sub.uuid
                              ? { ...p, renewalUnit: e.target.value as "week" | "month" | "year" }
                              : p,
                          ),
                        )
                      }
                    >
                      <option value="week">{t("admin.companyDetail.week")}</option>
                      <option value="month">{t("admin.companyDetail.month")}</option>
                      <option value="year">{t("admin.companyDetail.year")}</option>
                    </SelectField>
                  </div>
                  <div className="space-y-1 xl:col-span-1">
                    <Label className="text-xs xl:hidden">{t("admin.companyDetail.bonusDaysShort")}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={sub.promoBonusDays}
                      onChange={(e) =>
                        setSubscriptions((prev) =>
                          prev.map((p) =>
                            p.uuid === sub.uuid
                              ? { ...p, promoBonusDays: Math.max(0, Number(e.target.value || 0)) }
                              : p,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1 xl:col-span-2">
                    <Label className="text-xs xl:hidden">{t("admin.companyDetail.slug")}</Label>
                    <Input value={sub.slug} onChange={(e) => setSubscriptions((prev) => prev.map((p) => p.uuid === sub.uuid ? { ...p, slug: e.target.value } : p))} />
                  </div>
                  <div className="space-y-1 xl:col-span-3">
                    <Label className="text-xs xl:hidden">{t("admin.companyDetail.category")}</Label>
                    <CategorySelect
                      value={sub.categoryId === null ? "" : sub.categoryId}
                      options={categories}
                      onChange={(nextValue) =>
                        setSubscriptions((prev) =>
                          prev.map((p) =>
                            p.uuid === sub.uuid
                              ? { ...p, categoryId: typeof nextValue === "number" ? nextValue : null }
                              : p,
                          ),
                        )
                      }
                      emptyLabel={t("admin.companyDetail.noCategory")}
                    />
                  </div>
                  <div className="space-y-1 xl:col-span-9">
                    <Label className="text-xs">{t("admin.companyDetail.description")}</Label>
                    <Textarea
                      rows={4}
                      className="min-h-[120px] max-h-72"
                      value={sub.description}
                      onChange={(e) =>
                        setSubscriptions((prev) =>
                          prev.map((p) => (p.uuid === sub.uuid ? { ...p, description: e.target.value } : p)),
                        )
                      }
                    />
                  </div>
                  <div className="flex items-end gap-2 xl:col-span-3 xl:justify-end">
                    <Button variant="secondary" onClick={() => void saveSubscription(sub)} className="flex-1 xl:max-w-[150px]">{t("admin.companyDetail.save")}</Button>
                    <Button variant="destructive" onClick={() => void removeSubscription(sub.uuid)} className="flex-1 xl:max-w-[150px]">{t("admin.companyDetail.delete")}</Button>
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.035] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="inline-flex items-center gap-2 text-sm font-semibold">
                        <TicketCheck className="h-4 w-4 text-cyan-100" />
                        {t("admin.companyDetail.entitlements")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{t("admin.companyDetail.entitlementsHint")}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEntitlementEditorUuid((current) => (current === sub.uuid ? null : sub.uuid))}
                    >
                      <Plus className="h-4 w-4" />
                      {t("admin.companyDetail.addEntitlement")}
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(sub.entitlements ?? []).map((benefit) => (
                      <Badge key={benefit.uuid} variant="outline" className="gap-2 px-3 py-1">
                        {benefit.title}
                        <span className="text-muted-foreground">
                          {benefit.windowUnit === "UNLIMITED"
                            ? t("admin.companyDetail.entitlementUnlimited")
                            : `${benefit.allowance}/${benefit.windowValue} ${benefit.windowUnit.toLowerCase()}`}
                        </span>
                      </Badge>
                    ))}
                    {(sub.entitlements ?? []).length === 0 && (
                      <p className="text-xs text-muted-foreground">{t("admin.companyDetail.noEntitlements")}</p>
                    )}
                  </div>
                  {entitlementEditorUuid === sub.uuid && (
                    <div className="mt-4 grid gap-3 rounded-xl border border-white/10 p-3 md:grid-cols-2 xl:grid-cols-5">
                      <Input
                        placeholder={t("admin.companyDetail.entitlementTitlePlaceholder")}
                        value={entitlementDraft.title}
                        onChange={(event) => setEntitlementDraft((current) => ({ ...current, title: event.target.value }))}
                      />
                      <Input
                        placeholder={t("admin.companyDetail.entitlementDescriptionPlaceholder")}
                        value={entitlementDraft.description}
                        onChange={(event) => setEntitlementDraft((current) => ({ ...current, description: event.target.value }))}
                      />
                      <Input
                          type="number"
                          min={1}
                          disabled={entitlementDraft.windowUnit === "UNLIMITED"}
                          value={entitlementDraft.allowance}
                        onChange={(event) => setEntitlementDraft((current) => ({ ...current, allowance: Math.max(1, Number(event.target.value || 1)) }))}
                      />
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min={1}
                          disabled={entitlementDraft.windowUnit === "UNLIMITED"}
                          value={entitlementDraft.windowValue}
                          onChange={(event) => setEntitlementDraft((current) => ({ ...current, windowValue: Math.max(1, Number(event.target.value || 1)) }))}
                        />
                        <SelectField
                          value={entitlementDraft.windowUnit}
                          onChange={(event) => setEntitlementDraft((current) => ({ ...current, windowUnit: event.target.value as EntitlementDraft["windowUnit"] }))}
                        >
                          <option value="DAY">{t("admin.companyDetail.entitlementDay")}</option>
                          <option value="WEEK">{t("admin.companyDetail.entitlementWeek")}</option>
                          <option value="MONTH">{t("admin.companyDetail.entitlementMonth")}</option>
                          <option value="TERM">{t("admin.companyDetail.entitlementTerm")}</option>
                          <option value="UNLIMITED">{t("admin.companyDetail.entitlementUnlimited")}</option>
                        </SelectField>
                      </div>
                      <Button onClick={() => void createEntitlement(sub.uuid)} disabled={!entitlementDraft.title.trim()}>
                        {t("admin.companyDetail.saveEntitlement")}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {filteredSubscriptions.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-muted/10 p-5 text-center text-sm text-muted-foreground">
                {t("admin.companyDetail.noSubscriptionsMatch")}
              </div>
            )}
          </div>
        </CardContent>}
      </Card>

      {(hasDirty || error || notice) && (
        <div className="sticky bottom-3 z-30">
          <Card className="border-primary/30 bg-card/95 shadow-2xl backdrop-blur">
            <CardContent className="space-y-3 py-4">
              <div className="text-sm">
                <p className="font-medium">
                  {hasDirty ? t("admin.companyDetail.unsavedChangesDetected") : t("admin.companyDetail.status")}
                </p>
                {hasDirty && (
                  <p className="text-xs text-muted-foreground">
                    {accountDirty && `${t("admin.companyDetail.sectionAccount")} `}
                    {companyDirty && `${t("admin.companyDetail.sectionProfile")} `}
                    {subscriptionsDirty && `${t("admin.companyDetail.sectionSubscriptions")} `}
                  </p>
                )}
              </div>
              {(error || notice) && (
                <div className="space-y-1">
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  {notice && <p className="text-sm text-emerald-300">{notice}</p>}
                </div>
              )}
              {hasDirty && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button variant="secondary" onClick={() => void discardAllChanges()}>
                    <RotateCcw className="h-4 w-4" />
                    {t("admin.companyDetail.discard")}
                  </Button>
                  <Button onClick={() => void saveAllChanges()}>
                    <Save className="h-4 w-4" />
                    {t("admin.companyDetail.saveAll")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

