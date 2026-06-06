import { getAccessToken } from "./auth-client";
import { clearTwaCache, readTwaCache, writeTwaCache } from "./twa-cache";
import type { ApiCategory } from "./categories-client";

export type TwaCompanyLevel = {
  current: {
    id: number;
    levelName: string;
    minTotalSpend: number;
    cashbackPercent: number;
    sortOrder: number;
  } | null;
  next: {
    id: number;
    levelName: string;
    minTotalSpend: number;
    cashbackPercent: number;
    sortOrder: number;
    pointsToNext: number;
  } | null;
  totalSpentPoints: number;
  progressPercent: number;
  ladder: Array<{
    id: number;
    levelName: string;
    minTotalSpend: number;
    cashbackPercent: number;
    sortOrder: number;
  }>;
};

export type TwaCompany = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  operatesOnline: boolean;
  category: ApiCategory;
  categories: ApiCategory[];
  locations: Array<{
    uuid: string;
    title: string | null;
    address: string;
    city: string | null;
    latitude: number;
    longitude: number;
    precision: string | null;
    openTime: string;
    closeTime: string;
    workingDays: number[];
    isMain: boolean;
  }>;
  points: {
    balance: number;
    totalEarnedPoints: number;
    totalSpentPoints: number;
    pointsToNextReward: number | null;
    expiringPoints: number | null;
    expiringDate: string | null;
    updatedAt: string | null;
  };
  level: TwaCompanyLevel;
};

export type TwaSubscriptionPlan = {
  type?: "subscription" | "bundle";
  uuid: string;
  slug: string;
  name: string;
  description: string;
  price: string;
  renewalPeriod: string;
  renewalValue: number;
  renewalUnit: string;
  promoBonusDays: number;
  promoEndsAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  company: { id: number; slug: string; name: string; isActive: boolean } | null;
  partners?: string;
  category: ApiCategory | null;
  participants?: Array<{
    uuid: string;
    company: { id: number; slug: string; name: string; isActive: boolean };
    benefitTitle: string;
    benefitDescription: string | null;
    fulfillmentNote: string | null;
    revenueSharePercent: number;
    allowance: number;
    windowValue: number;
    windowUnit: "DAY" | "WEEK" | "MONTH" | "TERM" | "UNLIMITED";
  }>;
  entitlements: Array<{
    uuid: string;
    title: string;
    description: string | null;
    allowance: number;
    windowValue: number;
    windowUnit: "DAY" | "WEEK" | "MONTH" | "TERM" | "UNLIMITED";
    isActive: boolean;
    company?: { id: number; slug: string; name: string; isActive: boolean };
    fulfillmentNote?: string | null;
    revenueSharePercent?: number;
  }>;
  isOwned?: boolean;
};

export type TwaUserSubscription = {
  id: number;
  status: "ACTIVE" | "EXPIRED" | "CANCELED";
  activatedAt: string;
  expiresAt: string | null;
  willAutoRenew: boolean;
  createdAt: string;
  updatedAt: string;
  subscription: TwaSubscriptionPlan;
};

export type TwaPaymentStatus = "PENDING" | "WAITING_FOR_CAPTURE" | "SUCCEEDED" | "CANCELED" | "FAILED" | "REFUNDED";

export type TwaPaymentCheckout = {
  uuid: string;
  status: TwaPaymentStatus;
  amount: string;
  currency: string;
  confirmationUrl: string | null;
  providerPaymentId: string | null;
  providerStatus: string | null;
  paidAt: string | null;
  plan?: {
    type: "subscription" | "bundle";
    uuid: string;
    name: string;
    renewalValue: number;
    renewalUnit: string;
  } | null;
  activatedSubscription?: {
    id: number;
    status: "ACTIVE" | "EXPIRED" | "CANCELED";
    activatedAt: string;
    expiresAt: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type TwaHistory = {
  transactions: Array<{
    uuid: string;
    type: "EARN" | "SPEND";
    status: "ACTIVE" | "EXPIRED";
    amount: number;
    description: string | null;
    occurredAt: string;
    company: {
      id: number;
      slug: string;
      name: string;
      category: ApiCategory;
    };
  }>;
  redemptions: Array<{
    uuid: string;
    source: "SUBSCRIPTION" | "BUNDLE";
    quantity: number;
    redeemedAt: string;
    benefit: string;
    benefitUuid: string;
    planName: string;
    planUuid: string;
    company: {
      id: number;
      slug: string;
      name: string;
      category: ApiCategory;
    };
  }>;
  subscriptions: TwaUserSubscription[];
  archivedSubscriptions: TwaUserSubscription[];
};

export type TwaMarketplace = {
  categories: ApiCategory[];
  subscriptions: TwaSubscriptionPlan[];
};

export type TwaWallet = {
  totalBalance: number;
  companies: TwaCompany[];
};

export type TwaDashboard = {
  wallet: TwaWallet;
  activeSubscriptions: TwaUserSubscription[];
  recommendedSubscriptions: TwaSubscriptionPlan[];
  favoriteCategories: ApiCategory[];
};

export type TwaQr = {
  payload: string;
  generatedAt: string;
};

export type TwaLookupCode = {
  code: string;
  expiresAt: string;
};

export type TwaProfile = {
  user: {
    uuid: string;
    name: string;
    email: string;
    createdAt: string;
  };
  preferences: {
    onboardingCompletedAt: string | null;
    onboardingSkippedAt: string | null;
    geolocationPromptedAt: string | null;
    profileVisibility: "PRIVATE" | "FRIENDS" | "PUBLIC";
    marketingOptIn: boolean;
    showActivityStats: boolean;
  };
  stats: {
    totalBalance: number;
    partnerCount: number;
    activeSubscriptions: number;
    favoriteCategories: number;
    activityScore: number;
  };
  favoriteCategories: ApiCategory[];
  referral: {
    code: string;
    title: string;
    inviterBonusPoints: number;
    invitedBonusPoints: number;
    isActive: boolean;
  };
};

export type ProfileStatusRarity = "RARE" | "EPIC" | "LEGENDARY";

export type ProfileStatus = {
  id: string;
  slug: string;
  title: string;
  description: string;
  rarity: ProfileStatusRarity;
  icon: string;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UserProfileStatus = ProfileStatus & {
  unlocked: boolean;
  unlockedAt: string | null;
  seenAt: string | null;
  source: string | null;
};

export type UserProfileStatusState = {
  selectedStatusId: string | null;
  selectedStatus: ProfileStatus | null;
  statuses: UserProfileStatus[];
  newlyUnlocked: Array<ProfileStatus & { unlockedAt: string; source: string }>;
  summary: {
    total: number;
    unlocked: number;
    new: number;
  };
};

export type UserTelegramConnectionStatus = {
  connected: boolean;
  telegramId: string | null;
  phoneNumber: string | null;
  phoneVerifiedAt: string | null;
  email: string;
  name: string;
  role: string;
  accountStatus: string;
  canConnect: boolean;
  updatedAt: string;
};

export type UserTelegramLink = {
  token: string;
  expiresAt: string;
  deepLink: string;
};

export type UserCompanyReferralDashboard = {
  code: string;
  link: string;
  minPayoutRub: number;
  totals: {
    companies: number;
    activeCompanies: number;
    recognizedGross: number;
    futureGross: number;
    referralCommission: number;
    reserved: number;
    paid: number;
    available: number;
  };
  companies: Array<{
    slug: string;
    name: string;
    status: string;
    statusLabel: string;
    pipelineStatus: string;
    verificationStatus: string;
    isActive: boolean;
    referralPercent: number;
    startedAt: string;
    recognizedGross: number;
    futureGross: number;
    referralCommission: number;
    activeSubscriptions: number;
  }>;
  payouts: Array<{
    uuid: string;
    amount: number;
    status: string;
    createdAt: string;
  }>;
};

function apiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
  return base.replace(/\/$/, "");
}

function authHeaders(): HeadersInit {
  const token = getAccessToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const TWA_CACHE_TTL_MS = 2 * 60 * 1000;
const TWA_CACHE_STALE_MS = 15 * 60 * 1000;

function cacheKey(path: string) {
  return `GET:${path}`;
}

function readCachedJson<T>(path: string, fallback: T, staleMs = TWA_CACHE_STALE_MS) {
  return readTwaCache<T>(cacheKey(path), fallback, staleMs).data;
}

async function getJson<T>(path: string, fallback: T, ttlMs = TWA_CACHE_TTL_MS, force = false): Promise<T> {
  const cached = readTwaCache<T>(cacheKey(path), fallback, TWA_CACHE_STALE_MS);
  if (!force && cached.hit && !cached.expired) return cached.data;

  try {
    const res = await fetch(`${apiBase()}${path}`, {
      method: "GET",
      headers: authHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return cached.hit ? cached.data : fallback;
    const data = (await res.json()) as T;
    writeTwaCache(cacheKey(path), data, ttlMs);
    return data;
  } catch {
    return cached.hit ? cached.data : fallback;
  }
}

async function postJson<T>(path: string, body: unknown, fallbackMessage: string) {
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
      return { ok: false as const, message: message ?? fallbackMessage };
    }
    return { ok: true as const, data: (await res.json()) as T };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : fallbackMessage };
  }
}

async function putJson<T>(path: string, body: unknown, fallbackMessage: string) {
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
      return { ok: false as const, message: message ?? fallbackMessage };
    }
    return { ok: true as const, data: (await res.json()) as T };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : fallbackMessage };
  }
}

async function nextApiJson<T>(path: string, options: RequestInit, fallbackMessage: string) {
  try {
    const res = await fetch(path, {
      ...options,
      headers: {
        ...authHeaders(),
        ...(options.headers ?? {}),
      },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
      return { ok: false as const, message: message ?? fallbackMessage };
    }
    return { ok: true as const, data: data as T };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : fallbackMessage };
  }
}

export async function getUserTelegramStatus() {
  return nextApiJson<UserTelegramConnectionStatus>(
    "/api/telegram/status",
    { method: "GET" },
    "Failed to check Telegram connection.",
  );
}

export async function createUserTelegramLink() {
  return nextApiJson<UserTelegramLink>(
    "/api/telegram/link-token",
    { method: "POST" },
    "Failed to create Telegram link.",
  );
}

export async function requestTelegramPhone() {
  return nextApiJson<{ sent: boolean; queued?: boolean }>(
    "/api/telegram/request-phone",
    { method: "POST" },
    "Failed to request Telegram phone.",
  );
}

export async function getUserCompanyReferrals() {
  return nextApiJson<UserCompanyReferralDashboard>(
    "/api/user/company-referrals",
    { method: "GET" },
    "Failed to load company referrals.",
  );
}

export async function requestUserCompanyReferralPayout(amount: number) {
  return nextApiJson<{ operationUuid: string; dashboard: UserCompanyReferralDashboard }>(
    "/api/user/company-referrals",
    {
      method: "POST",
      body: JSON.stringify({ amount }),
    },
    "Failed to request referral payout.",
  );
}

export async function getUserProfileStatuses() {
  return nextApiJson<UserProfileStatusState>(
    "/api/user/profile-statuses",
    { method: "GET" },
    "Failed to load profile statuses.",
  );
}

export async function selectUserProfileStatus(statusId: string | null) {
  const result = await nextApiJson<UserProfileStatusState>(
    "/api/user/profile-statuses",
    { method: "PATCH", body: JSON.stringify({ statusId }) },
    "Failed to select profile status.",
  );
  if (result.ok) clearTwaCache();
  return result;
}

export async function markUserProfileStatusesSeen() {
  return nextApiJson<{ ok: true; updated: number }>(
    "/api/user/profile-statuses/seen",
    { method: "POST" },
    "Failed to mark statuses as seen.",
  );
}

const dashboardFallback: TwaDashboard = {
  wallet: { totalBalance: 0, companies: [] },
  activeSubscriptions: [],
  recommendedSubscriptions: [],
  favoriteCategories: [],
};

export function getCachedTwaDashboard() {
  return readCachedJson<TwaDashboard>("/registered/dashboard", dashboardFallback);
}

export function getTwaDashboard() {
  return getJson<TwaDashboard>("/registered/dashboard", dashboardFallback);
}

export function refreshTwaDashboard() {
  return getJson<TwaDashboard>("/registered/dashboard", dashboardFallback, TWA_CACHE_TTL_MS, true);
}

const marketplaceFallback: TwaMarketplace = {
  categories: [],
  subscriptions: [],
};

export function getCachedTwaMarketplace(categorySlug?: string) {
  const suffix = categorySlug ? `?category=${encodeURIComponent(categorySlug)}` : "";
  return readCachedJson<TwaMarketplace>(`/registered/marketplace${suffix}`, marketplaceFallback);
}

export function getTwaMarketplace(categorySlug?: string) {
  const suffix = categorySlug ? `?category=${encodeURIComponent(categorySlug)}` : "";
  return getJson<TwaMarketplace>(`/registered/marketplace${suffix}`, marketplaceFallback);
}

export function getCachedTwaCompanies() {
  return readCachedJson<TwaCompany[]>("/registered/companies", []);
}

export function getTwaCompanies() {
  return getJson<TwaCompany[]>("/registered/companies", []);
}

const walletFallback: TwaWallet = {
  totalBalance: 0,
  companies: [],
};

export function getCachedTwaWallet() {
  return readCachedJson<TwaWallet>("/registered/wallet", walletFallback);
}

export function getTwaWallet() {
  return getJson<TwaWallet>("/registered/wallet", walletFallback);
}

export function getTwaQr() {
  return getJson<TwaQr>("/registered/qr", {
    payload: "",
    generatedAt: "",
  });
}

export function createTwaLookupCode() {
  return postJson<TwaLookupCode>("/registered/lookup-code", {}, "Failed to generate cashier code");
}

const profileFallback: TwaProfile = {
  user: { uuid: "", name: "", email: "", createdAt: "" },
  preferences: {
    onboardingCompletedAt: null,
    onboardingSkippedAt: null,
    geolocationPromptedAt: null,
    profileVisibility: "PRIVATE",
    marketingOptIn: false,
    showActivityStats: true,
  },
  stats: {
    totalBalance: 0,
    partnerCount: 0,
    activeSubscriptions: 0,
    favoriteCategories: 0,
    activityScore: 0,
  },
  favoriteCategories: [],
  referral: {
    code: "",
    title: "Invite a friend",
    inviterBonusPoints: 0,
    invitedBonusPoints: 0,
    isActive: false,
  },
};

export function getCachedTwaProfile() {
  return readCachedJson<TwaProfile>("/registered/profile", profileFallback);
}

export function getTwaProfile() {
  return getJson<TwaProfile>("/registered/profile", profileFallback);
}

const historyFallback: TwaHistory = {
  transactions: [],
  redemptions: [],
  subscriptions: [],
  archivedSubscriptions: [],
};

export function getCachedTwaHistory() {
  return readCachedJson<TwaHistory>("/registered/history", historyFallback);
}

export function getTwaHistory() {
  return getJson<TwaHistory>("/registered/history", historyFallback);
}

export function getCachedActiveTwaSubscriptions() {
  return readCachedJson<TwaUserSubscription[]>("/registered/subscriptions/active", []);
}

export function getActiveTwaSubscriptions() {
  return getJson<TwaUserSubscription[]>("/registered/subscriptions/active", []);
}

export function getCachedArchivedTwaSubscriptions() {
  return readCachedJson<TwaUserSubscription[]>("/registered/subscriptions/archive", []);
}

export function getArchivedTwaSubscriptions() {
  return getJson<TwaUserSubscription[]>("/registered/subscriptions/archive", []);
}

export async function activateTwaSubscription(uuid: string) {
  const res = await fetch(`${apiBase()}/registered/subscriptions/${uuid}/activate`, {
    method: "POST",
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = Array.isArray(data.message) ? data.message.join(", ") : data.message ?? "Failed";
    return { ok: false as const, message };
  }
  const data = (await res.json()) as TwaUserSubscription;
  clearTwaCache();
  return { ok: true as const, data };
}

export async function createTwaSubscriptionCheckout(uuid: string) {
  const res = await fetch(`${apiBase()}/registered/payments/subscriptions/${uuid}/checkout`, {
    method: "POST",
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = Array.isArray(data.message) ? data.message.join(", ") : data.message ?? "Failed";
    return { ok: false as const, message };
  }
  const data = (await res.json()) as TwaPaymentCheckout;
  return { ok: true as const, data };
}

export async function getTwaPayment(uuid: string) {
  const res = await fetch(`${apiBase()}/registered/payments/${uuid}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = Array.isArray(data.message) ? data.message.join(", ") : data.message ?? "Failed";
    return { ok: false as const, message };
  }
  const data = (await res.json()) as TwaPaymentCheckout;
  if (data.status === "SUCCEEDED") clearTwaCache();
  return { ok: true as const, data };
}

export async function completeTwaOnboarding() {
  const result = await postJson<{ success: true }>("/registered/onboarding/complete", {}, "Failed to complete onboarding");
  if (result.ok) clearTwaCache();
  return result;
}

export async function skipTwaOnboarding() {
  const result = await postJson<{ success: true }>("/registered/onboarding/skip", {}, "Failed to skip onboarding");
  if (result.ok) clearTwaCache();
  return result;
}

export async function updateTwaProfilePreferences(input: {
  profileVisibility?: "PRIVATE" | "FRIENDS" | "PUBLIC";
  marketingOptIn?: boolean;
  showActivityStats?: boolean;
}) {
  const result = await putJson<TwaProfile["preferences"]>("/registered/profile/preferences", input, "Failed to update preferences");
  if (result.ok) clearTwaCache();
  return result;
}

export async function redeemTwaPromoCode(code: string) {
  const result = await postJson<{ type: "POINTS" | "SUBSCRIPTION"; message: string }>("/registered/promo/redeem", { code }, "Failed to redeem promo code");
  if (result.ok) clearTwaCache();
  return result;
}

export function getTwaReferral() {
  return getJson<TwaProfile["referral"]>("/registered/referral", {
    code: "",
    title: "Invite a friend",
    inviterBonusPoints: 0,
    invitedBonusPoints: 0,
    isActive: false,
  });
}

export async function redeemTwaReferralCode(code: string) {
  const result = await postJson<{ success: true; message: string }>("/registered/referral/redeem", { code }, "Failed to redeem referral code");
  if (result.ok) clearTwaCache();
  return result;
}

export { clearTwaCache };
