import { getAccessToken } from "./auth-client";
import { fetchWithAuthRecovery } from "./authenticated-fetch";
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
  logoUrl?: string | null;
  isActive: boolean;
  operatesOnline: boolean;
  isFavorite: boolean;
  favoritedAt: string | null;
  recommendation?: {
    boostPercent: number;
    recommendForEveryone: boolean;
    effectiveMultiplier: number;
  };
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

export type TwaPaymentStatus = "PENDING" | "WAITING_FOR_CAPTURE" | "SUCCEEDED" | "CANCELED" | "FAILED" | "REFUNDED" | "EXPIRED";

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

export type TwaCompanyRecommendation = {
  company: TwaCompany;
  score: number;
  reason: "manual_priority" | "manual_boost" | "profile_match";
  effectiveMultiplier: number;
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

export type HuntRarity = "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY";
export type HuntElement = "FLAME" | "WATER" | "NATURE" | "WIND" | "MUSIC" | "LIGHT" | "SHADOW";
export type HuntBoxType = "DAILY" | "POST" | "TRENDING" | "CATEGORY" | "DISTRICT" | "FOUNDER" | "PARTNER";
export type HuntCardStatKey = "health" | "attack" | "luck" | "evasion";
export type HuntReportReason = "SPAM" | "OFFENSIVE" | "FALSE_PLACE" | "DUPLICATE" | "PRIVATE_DATA" | "COPYRIGHT" | "OTHER";

export type HuntProfile = {
  influenceBalance: number;
  lifetimeInfluence: number;
  xp: number;
  level: number;
  postsCount: number;
  likesReceivedCount: number;
  boxesOpenedCount: number;
  cardsOwnedCount: number;
  tutorialCompletedAt: string | null;
};

export type HuntMission = {
  slug: string;
  title: string;
  description: string;
  kind: "DAILY" | "WEEKLY" | "SEASONAL" | "ONBOARDING";
  targetAction: string;
  targetCount: number;
  rewardInfluence: number;
  rewardXp: number;
  rewardBoxType: string | null;
  progress: number;
  completedAt: string | null;
  claimedAt: string | null;
};

export type HuntBox = {
  uuid: string;
  type: HuntBoxType;
  rarity: HuntRarity;
  status: "GRANTED" | "OPENED" | "EXPIRED";
  influenceCost: number;
  createdAt: string;
};

export type HuntCard = {
  uuid: string;
  rarity: HuntRarity;
  element: HuntElement;
  level: number;
  xp: number;
  stats: Record<string, number>;
  trait: string;
  visualSeed: string;
  createdAt: string;
  species: {
    slug: string;
    name: string;
    description: string;
    element: HuntElement;
    baseRarity?: HuntRarity;
    baseStats?: Record<string, number>;
    visualPrompt: string;
    imageUrl?: string | null;
  };
};

export type HuntCardUpgrade = {
  uuid: string;
  baseDeltas: Record<string, number>;
  statsBefore: Record<string, number>;
  statsAfterBase: Record<string, number>;
  bonusStat?: HuntCardStatKey | null;
  bonusDelta?: number | null;
  statsAfterBonus?: Record<string, number> | null;
  status: "PENDING_BONUS" | "COMPLETED";
};

export type HuntCatalogSpecies = {
  uuid: string;
  slug: string;
  name: string;
  description: string;
  element: HuntElement;
  baseRarity: HuntRarity;
  category: ApiCategory | null;
  baseStats: Record<string, number>;
  visualPrompt: string;
  imageUrl: string | null;
  ownedCount: number;
};

export type HuntPost = {
  uuid: string;
  caption: string;
  photoUrl: string | null;
  mediaUrls: string[];
  tags: string[];
  rating: number | null;
  visitPriceBand: string | null;
  moodTags: string[];
  gpsConfidence: number;
  latitude: number | null;
  longitude: number | null;
  moderationStatus: "CLEAR" | "FLAGGED" | "REVIEWING" | "ACTIONED";
  likeCount: number;
  score: number;
  likedByMe: boolean;
  createdAt: string;
  author: { uuid: string; name: string };
  place: {
    uuid: string;
    slug: string;
    name: string;
    address: string | null;
    city: string | null;
    district: string | null;
    tags: string[];
    source: "USER_SUGGESTED" | "COMPANY" | "SYSTEM_SEEDED";
    category: ApiCategory | null;
    company: { slug: string; name: string } | null;
  };
};

export type HuntPlace = HuntPost["place"] & {
  postCount: number;
  likeCount: number;
  wantedCount: number;
  isClaimable: boolean;
};

export type HuntOverview = {
  profile: HuntProfile;
  missions: HuntMission[];
  boxes: HuntBox[];
  cards: HuntCard[];
  recentPosts: Array<{
    uuid: string;
    caption: string;
    likeCount: number;
    score: number;
    createdAt: string;
    place: { name: string; city: string | null; district: string | null };
  }>;
  economy: {
    postCreateReward: number;
    likeAuthorReward: number;
    postBoxCost: number;
    dailyPostLimit: number;
    dailyPostRewardCap: number;
    dailyLikeRewardCap: number;
  };
};

export type HuntSharePost = {
  kind: "post";
  post: HuntPost;
  cta: { title: string; subtitle: string };
};

export type HuntShareCard = {
  kind: "card";
  card: HuntCard;
  owner: { uuid: string; name: string };
  cta: { title: string; subtitle: string };
};

export type HuntBattleRandom = {
  success: true;
  mode: "RANDOM";
  battleSeed: string;
  expiresAt: string;
  playerCard: HuntCard;
  opponent: HuntCatalogSpecies;
};

export type HuntBattleCode = {
  success: true;
  mode: "PRIVATE_CODE";
  code: string;
  expiresAt: string;
  playerCard: HuntCard;
};

export type HuntGrowthPlace = HuntPlace & {
  storedPostCount: number;
  storedLikeCount: number;
  uniqueAuthors: number;
  uniqueReactors: number;
  demandScore: number;
  lastPostAt: string | null;
  acquisitionHint: "already_claimed" | "priority_outreach" | "warm_lead" | "watch";
};

export type TwaProfile = {
  user: {
    uuid: string;
    name: string;
    email: string;
    birthDate: string | null;
    birthDateChangedAt: string | null;
    birthDateNextChangeAt: string | null;
    createdAt: string;
  };
  preferences: {
    onboardingCompletedAt: string | null;
    onboardingSkippedAt: string | null;
    geolocationPromptedAt: string | null;
    profileVisibility: "PRIVATE" | "FRIENDS" | "PUBLIC";
    marketingOptIn: boolean;
    showActivityStats: boolean;
    browserNotificationsEnabled: boolean;
    geoNotificationsEnabled: boolean;
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
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined") return "/backend-api";
  return "http://localhost:3001/api";
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
    const res = await fetchWithAuthRecovery(`${apiBase()}${path}`, {
      method: "GET",
      headers: authHeaders(),
      cache: "no-store",
    }, {
      redirectOnFailure: false,
      emitRecoveryEvents: false,
      timeoutMs: 10000,
    });
    if (!res.ok) return cached.hit ? cached.data : fallback;
    const data = (await res.json()) as T;
    writeTwaCache(cacheKey(path), data, ttlMs);
    return data;
  } catch {
    return cached.hit ? cached.data : fallback;
  }
}

async function getPublicJson<T>(path: string, fallback: T, ttlMs = TWA_CACHE_TTL_MS, force = false): Promise<T> {
  const cached = readTwaCache<T>(cacheKey(path), fallback, TWA_CACHE_STALE_MS);
  if (!force && cached.hit && !cached.expired) return cached.data;

  try {
    const res = await fetch(`${apiBase()}${path}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
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
    const res = await fetchWithAuthRecovery(`${apiBase()}${path}`, {
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
    const res = await fetchWithAuthRecovery(`${apiBase()}${path}`, {
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
    const res = await fetchWithAuthRecovery(path, {
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

export function getTwaCompanies(force = false) {
  return getJson<TwaCompany[]>("/registered/companies", [], TWA_CACHE_TTL_MS, force);
}

export function getTwaRecommendations(limit = 8, force = false) {
  return getJson<TwaCompanyRecommendation[]>(
    `/registered/recommendations?limit=${encodeURIComponent(String(limit))}`,
    [],
    TWA_CACHE_TTL_MS,
    force,
  );
}

export function getCachedTwaMapCompanies() {
  return readCachedJson<TwaCompany[]>("/registered/companies?surface=map", []);
}

export function getTwaMapCompanies(force = false) {
  return getJson<TwaCompany[]>("/registered/companies?surface=map", [], TWA_CACHE_TTL_MS, force);
}

export function getPublicTwaCompany(slug: string) {
  return getJson<TwaCompany | null>(`/public/companies/${encodeURIComponent(slug)}`, null, TWA_CACHE_TTL_MS, true);
}

export function getPublicTwaCompanySuggestions(excludeSlug?: string, limit = 4) {
  const search = new URLSearchParams();
  if (excludeSlug) search.set("exclude", excludeSlug);
  search.set("limit", String(limit));
  return getJson<TwaCompany[]>(`/public/companies?${search.toString()}`, [], TWA_CACHE_TTL_MS, true);
}

export async function setTwaCompanyFavorite(companyId: number | string, isFavorite: boolean) {
  const result = await putJson<{
    companyId: number;
    slug: string;
    name: string;
    isFavorite: boolean;
    favoritedAt: string | null;
  }>(
    `/registered/companies/${encodeURIComponent(String(companyId))}/favorite`,
    { isFavorite },
    "Failed to update favorite company.",
  );
  if (result.ok) clearTwaCache();
  return result;
}

const walletFallback: TwaWallet = {
  totalBalance: 0,
  companies: [],
};

export function getCachedTwaWallet() {
  return readCachedJson<TwaWallet>("/registered/wallet", walletFallback);
}

export function getTwaWallet(force = false) {
  return getJson<TwaWallet>("/registered/wallet", walletFallback, TWA_CACHE_TTL_MS, force);
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

const huntOverviewFallback: HuntOverview = {
  profile: {
    influenceBalance: 0,
    lifetimeInfluence: 0,
    xp: 0,
    level: 1,
    postsCount: 0,
    likesReceivedCount: 0,
    boxesOpenedCount: 0,
    cardsOwnedCount: 0,
    tutorialCompletedAt: null,
  },
  missions: [],
  boxes: [],
  cards: [],
  recentPosts: [],
  economy: {
    postCreateReward: 35,
    likeAuthorReward: 8,
    postBoxCost: 120,
    dailyPostLimit: 8,
    dailyPostRewardCap: 175,
    dailyLikeRewardCap: 800,
  },
};

export function getCachedHuntOverview() {
  return readCachedJson<HuntOverview>("/hunt/overview", huntOverviewFallback);
}

export function getHuntOverview(force = false) {
  return getJson<HuntOverview>("/hunt/overview", huntOverviewFallback, TWA_CACHE_TTL_MS, force);
}

export function getHuntFeed(force = false) {
  return getJson<HuntPost[]>("/hunt/feed", [], TWA_CACHE_TTL_MS, force);
}

export function getPublicHuntFeed(force = false) {
  return getPublicJson<HuntPost[]>("/hunt/public/feed", [], TWA_CACHE_TTL_MS, force);
}

export function getPublicHuntSharePost(uuid: string) {
  return getJson<HuntSharePost | null>(`/hunt/share/posts/${encodeURIComponent(uuid)}`, null, TWA_CACHE_TTL_MS, true);
}

export function getPublicHuntShareCard(uuid: string) {
  return getJson<HuntShareCard | null>(`/hunt/share/cards/${encodeURIComponent(uuid)}`, null, TWA_CACHE_TTL_MS, true);
}

export function getHuntCardCatalog(force = false) {
  return getJson<HuntCatalogSpecies[]>("/hunt/cards/catalog", [], TWA_CACHE_TTL_MS, force);
}

export async function getHuntCardCatalogResult(force = false) {
  const path = "/hunt/cards/catalog";
  const cached = readTwaCache<HuntCatalogSpecies[]>(cacheKey(path), [], TWA_CACHE_STALE_MS);
  if (!force && cached.hit && !cached.expired) return { ok: true as const, data: cached.data };

  try {
    const res = await fetchWithAuthRecovery(`${apiBase()}${path}`, {
      method: "GET",
      headers: authHeaders(),
      cache: "no-store",
    }, {
      redirectOnFailure: false,
      emitRecoveryEvents: false,
      timeoutMs: 10000,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
      return cached.hit
        ? { ok: true as const, data: cached.data }
        : { ok: false as const, message: message ?? "Failed to load Hunt card catalog." };
    }
    const data = (await res.json()) as HuntCatalogSpecies[];
    writeTwaCache(cacheKey(path), data, TWA_CACHE_TTL_MS);
    return { ok: true as const, data };
  } catch (error) {
    return cached.hit
      ? { ok: true as const, data: cached.data }
      : { ok: false as const, message: error instanceof Error ? error.message : "Failed to load Hunt card catalog." };
  }
}

export function getHuntPlaces(query?: string, force = false) {
  const suffix = query ? `?q=${encodeURIComponent(query)}` : "";
  return getJson<HuntPlace[]>(`/hunt/places${suffix}`, [], TWA_CACHE_TTL_MS, force);
}

export async function completeHuntTutorial() {
  const result = await postJson<{ success: true; profile: HuntProfile }>("/hunt/tutorial/complete", {}, "Failed to complete Hunt tutorial");
  if (result.ok) clearTwaCache();
  return result;
}

export async function createHuntPost(input: {
  placeName?: string;
  address?: string;
  city?: string;
  district?: string;
  categorySlug?: string;
  caption: string;
  photoUrl?: string;
  tags?: string[];
  mediaUrls?: string[];
  rating?: number;
  visitPriceBand?: string;
  moodTags?: string[];
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
}) {
  const result = await postJson<HuntPost>("/hunt/posts", input, "Failed to create Hunt post");
  if (result.ok) clearTwaCache();
  return result;
}

export async function geocodeHuntAddress(input: { address: string }) {
  return postJson<{ address: string; latitude: number; longitude: number; precision: string | null; name: string | null; description: string | null }>(
    "/hunt/geocode",
    input,
    "Failed to geocode Hunt address",
  );
}

export async function createHuntPlace(input: {
  name: string;
  address?: string;
  city?: string;
  district?: string;
  categorySlug?: string;
  latitude?: number;
  longitude?: number;
  tags?: string[];
}) {
  const result = await postJson<HuntPlace>("/hunt/places", input, "Failed to create Hunt place");
  if (result.ok) clearTwaCache();
  return result;
}

export async function uploadHuntMedia(input: { fileName: string; contentType: string; dataBase64: string }) {
  return postJson<{ url: string; fileName: string; contentType: string; size: number }>("/hunt/media", input, "Failed to upload Hunt media");
}

export async function likeHuntPost(uuid: string) {
  const result = await postJson<{ success: true }>(`/hunt/posts/${uuid}/like`, {}, "Failed to like Hunt post");
  if (result.ok) clearTwaCache();
  return result;
}

export async function reportHuntPost(uuid: string, input: { reason: HuntReportReason; details?: string }) {
  return postJson<{ success: true }>(`/hunt/posts/${uuid}/report`, input, "Failed to report Hunt post");
}

export async function openHuntBox(boxUuid?: string, boxType?: HuntBoxType) {
  const result = await postJson<{ box: HuntBox; card: HuntCard }>("/hunt/boxes/open", { boxUuid, boxType }, "Failed to open Hunt box");
  if (result.ok) clearTwaCache();
  return result;
}

export async function upgradeHuntCard(cardUuid?: string, focusStat?: HuntCardStatKey) {
  const result = await postJson<{ success: true; cost: number; card: HuntCard; upgrade?: HuntCardUpgrade }>("/hunt/cards/upgrade", { cardUuid, focusStat }, "Failed to upgrade Hunt card");
  if (result.ok) clearTwaCache();
  return result;
}

export async function applyHuntCardUpgradeBonus(upgradeUuid: string, focusStat: HuntCardStatKey) {
  const result = await postJson<{ success: true; card: HuntCard; upgrade: HuntCardUpgrade }>("/hunt/cards/upgrade/bonus", { upgradeUuid, focusStat }, "Failed to apply Hunt card upgrade bonus");
  if (result.ok) clearTwaCache();
  return result;
}

export async function findRandomHuntBattle(cardUuid?: string) {
  return postJson<HuntBattleRandom>("/hunt/battle/random", { cardUuid }, "Failed to find Hunt battle opponent");
}

export async function createHuntBattleCode(cardUuid?: string) {
  return postJson<HuntBattleCode>("/hunt/battle/code", { cardUuid }, "Failed to create Hunt battle code");
}

const profileFallback: TwaProfile = {
  user: { uuid: "", name: "", email: "", birthDate: null, birthDateChangedAt: null, birthDateNextChangeAt: null, createdAt: "" },
  preferences: {
    onboardingCompletedAt: null,
    onboardingSkippedAt: null,
    geolocationPromptedAt: null,
    profileVisibility: "PRIVATE",
    marketingOptIn: false,
    showActivityStats: true,
    browserNotificationsEnabled: false,
    geoNotificationsEnabled: false,
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

export async function updateTwaProfile(input: { birthDate?: string | null }) {
  const result = await putJson<TwaProfile>("/registered/profile", input, "Failed to update profile");
  if (result.ok) clearTwaCache();
  return result;
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

export function getTwaHistory(force = false) {
  return getJson<TwaHistory>("/registered/history", historyFallback, TWA_CACHE_TTL_MS, force);
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
  const res = await fetchWithAuthRecovery(`${apiBase()}/registered/subscriptions/${uuid}/activate`, {
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
  const res = await fetchWithAuthRecovery(`${apiBase()}/registered/payments/subscriptions/${uuid}/checkout`, {
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
  const res = await fetchWithAuthRecovery(`${apiBase()}/registered/payments/${uuid}`, {
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
  browserNotificationsEnabled?: boolean;
  geoNotificationsEnabled?: boolean;
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
