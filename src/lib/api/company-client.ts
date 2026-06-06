import { getAccessToken } from "./auth-client";

export type CompanyMemberRole = "OWNER" | "MANAGER" | "CASHIER";
export type EntitlementWindow = "DAY" | "WEEK" | "MONTH" | "TERM" | "UNLIMITED";

export type CompanyProfile = {
  member: { uuid: string; role: CompanyMemberRole; name: string; email: string };
  company: {
    slug: string;
    name: string;
    description: string | null;
    isActive: boolean;
    verificationStatus: string;
    identityVerificationCompleted: boolean;
    verificationApplication: {
      uuid: string;
      status: "DRAFT" | "SUBMITTED" | "REVIEWING" | "APPROVED" | "REJECTED";
      createdAt: string;
      identityVerificationMode: "FULL" | "DEFERRED";
    } | null;
    operatesOnline: boolean;
    subscriptionSpendPolicy: "EXCLUDE" | "INCLUDE_NO_BONUS" | "INCLUDE_WITH_BONUS";
    categories: Array<{ id: number; slug?: string; name: string; icon: string }>;
    levels: Array<{ name: string; minimumSpend: number; cashbackPercent: number }>;
  };
};

export type CompanyLocation = {
  id: number;
  uuid: string;
  companyId: number;
  title: string | null;
  address: string;
  city: string | null;
  latitude: string;
  longitude: string;
  precision: string | null;
  openTime: string;
  closeTime: string;
  workingDays: number[];
  isMain: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CompanyDashboard = {
  memberRole: CompanyMemberRole;
  company: { name: string; verificationStatus: string };
  metrics: {
    customers: number;
    activeSubscribers: number;
    subscriptionGross: number;
    recognizedSubscriptionRevenue: number;
    potentialSubscriptionRevenue: number;
    dailySubscriptionRevenue: number;
    purchaseRevenue: number;
    pointsAwarded: number;
    pendingPayouts: number;
    activeEntitlements: number;
  };
  recentOperations: Array<{
    uuid: string;
    kind: "POINTS" | "SUBSCRIPTION";
    direction: "EARN" | "SPEND" | "PURCHASE";
    customer: string;
    title: string;
    amount: number | null;
    points: number | null;
    createdAt: string;
  }>;
};

export type CompanyClient = {
  uuid: string;
  name: string;
  email: string | null;
  balance: number;
  totalSpend: number;
  level: { name: string; minimumSpend: number; cashbackPercent: number };
};

export type CompanyClientDetail = CompanyClient & {
  recentPurchases: Array<{ uuid: string; amount: number; pointsAwarded: number; createdAt: string }>;
  recentPointOperations: Array<{
    uuid: string;
    type: "EARN" | "SPEND";
    amount: number;
    description: string | null;
    occurredAt: string;
  }>;
  recentSubscriptionRedemptions: Array<{
    uuid: string;
    source: "SUBSCRIPTION" | "BUNDLE";
    quantity: number;
    note: string | null;
    redeemedAt: string;
    benefit: string;
    benefitUuid: string;
    planName: string;
    processedBy: string;
  }>;
  activeSubscriptions: Array<{
    id: number;
    status: string;
    activatedAt: string;
    expiresAt: string | null;
    willAutoRenew: boolean;
    redemptions: Array<{
      uuid: string;
      quantity: number;
      note: string | null;
      redeemedAt: string;
      benefit: string;
      benefitUuid: string;
      processedBy: string;
    }>;
    subscription: CompanySubscription;
  }>;
  activeBundleSubscriptions: Array<{
    id: number;
    uuid: string;
    status: string;
    activatedAt: string;
    expiresAt: string | null;
    willAutoRenew: boolean;
    redemptions: Array<{
      uuid: string;
      quantity: number;
      note: string | null;
      redeemedAt: string;
      benefit: string;
      benefitUuid: string;
      processedBy: string;
    }>;
    bundle: CompanyClubBundle;
  }>;
};

export type CompanySubscription = {
  uuid: string;
  name: string;
  description: string;
  price: string;
  renewalPeriod: string;
  renewalValue?: number;
  renewalUnit?: "week" | "month" | "year" | string;
  promoBonusDays?: number;
  isActive: boolean;
  stats?: {
    activeSubscribers: number;
    dailyRevenue: number;
    futureRevenue: number;
    recognizedRevenue: number;
    totalRedemptions: number;
    usageCapacity: number;
    usagePercent: number;
  };
  entitlements: Array<{
    uuid: string;
    title: string;
    description: string | null;
    allowance: number;
    windowValue: number;
    windowUnit: EntitlementWindow;
    isActive: boolean;
    redemption?: EntitlementRedemptionState;
  }>;
};

export type EntitlementRedemptionState = {
  unlimited: boolean;
  used: number | null;
  allowance: number | null;
  remaining: number | null;
  canRedeem: boolean;
  windowStartedAt: string | null;
  windowEndsAt: string | null;
  lastRedeemedAt: string | null;
};

export type CompanyClubBundleParticipant = {
  uuid: string;
  companyId: number;
  company: { id: number; slug: string; name: string; isActive?: boolean };
  benefitTitle: string;
  benefitDescription: string;
  fulfillmentNote: string | null;
  revenueSharePercent: number;
  allowance: number;
  windowValue: number;
  windowUnit: EntitlementWindow;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  approvedAt: string | null;
  rejectedAt: string | null;
  sortOrder: number;
  redemption?: EntitlementRedemptionState;
};

export type CompanyClubBundle = {
  uuid: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  renewalPeriod: string;
  renewalValue: number;
  renewalUnit: string;
  promoBonusDays: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  isActive: boolean;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category: { id: number; slug: string; name: string; icon: string } | null;
  proposedByCompany: { id: number; slug: string; name: string } | null;
  participants: CompanyClubBundleParticipant[];
};

export type CompanyClubData = {
  memberRole: CompanyMemberRole;
  company: { id: number; slug: string; name: string };
  companies: Array<{
    id: number;
    slug: string;
    name: string;
    description: string | null;
    operatesOnline: boolean;
    category: { id: number; slug: string; name: string; icon: string };
    categories: Array<{ id: number; slug: string; name: string; icon: string }>;
  }>;
  bundles: CompanyClubBundle[];
  incoming: CompanyClubBundle[];
  active: CompanyClubBundle[];
};

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api").replace(/\/$/, "");
}

function headers(json = false) {
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${getAccessToken() ?? ""}`,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    cache: "no-store",
    ...init,
    headers: { ...headers(Boolean(init?.body)), ...init?.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(payload.message) ? payload.message.join(", ") : payload.message;
    throw new Error(message || `HTTP ${response.status}`);
  }
  return payload as T;
}

export function companyProfile() {
  return request<CompanyProfile>("/company/profile");
}

export function companyCategories() {
  return request<Array<{ id: number; slug: string; name: string; icon: string }>>("/company/categories");
}

export function updateCompanyProfile(body: {
  name: string;
  description?: string;
  operatesOnline: boolean;
  categoryIds: number[];
}) {
  return request<CompanyProfile>("/company/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function companyLocations() {
  return request<CompanyLocation[]>("/company/locations");
}

export async function companyCreateCompanyLocation(input: {
  title?: string;
  address: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  openTime?: string;
  closeTime?: string;
  workingDays?: number[];
  isMain?: boolean;
  isActive?: boolean;
}) {
  try {
    const data = await request<CompanyLocation>("/company/locations", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Failed to create company location" };
  }
}

export async function companyUpdateCompanyLocation(locationUuid: string, input: {
  title?: string;
  address: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  openTime?: string;
  closeTime?: string;
  workingDays?: number[];
  isMain?: boolean;
  isActive?: boolean;
}) {
  try {
    const data = await request<CompanyLocation>(`/company/locations/${encodeURIComponent(locationUuid)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Failed to update company location" };
  }
}

export async function companyDeleteCompanyLocation(locationUuid: string) {
  try {
    const data = await request<{ success: true }>(`/company/locations/${encodeURIComponent(locationUuid)}`, {
      method: "DELETE",
    });
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Failed to delete company location" };
  }
}

export async function submitCompanyVerification(formData: FormData) {
  const response = await fetch("/api/company/verification", {
    method: "POST",
    headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
    body: formData,
  });
  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    applicationUuid?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new Error(payload.message || `HTTP ${response.status}`);
  }
  return payload;
}

export function companyDashboard() {
  return request<CompanyDashboard>("/company/dashboard");
}

export function companyClients(query = "") {
  return request<CompanyClient[]>(`/company/clients?query=${encodeURIComponent(query)}`);
}

export function companyClient(uuid: string) {
  return request<CompanyClientDetail>(`/company/clients/${encodeURIComponent(uuid)}`);
}

export function lookupCompanyClientCode(code: string) {
  return request<CompanyClientDetail>("/company/clients/lookup-code", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export function awardCompanyPoints(body: {
  userUuid: string;
  mode: "MANUAL" | "PURCHASE";
  points?: number;
  purchaseAmount?: number;
  description?: string;
}) {
  return request<{ pointsAwarded: number; level: CompanyClient["level"] | null }>("/company/loyalty/award", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function spendCompanyPoints(body: { userUuid: string; points: number; description?: string }) {
  return request<{ pointsSpent: number; balance: number }>("/company/loyalty/spend", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateCompanyLoyaltySettings(body: {
  subscriptionSpendPolicy: "EXCLUDE" | "INCLUDE_NO_BONUS" | "INCLUDE_WITH_BONUS";
  levelRules: Array<{ levelName: string; minTotalSpend: number; cashbackPercent: number }>;
}) {
  return request<{ subscriptionSpendPolicy: CompanyProfile["company"]["subscriptionSpendPolicy"]; levelRules: typeof body.levelRules }>(
    "/company/loyalty/settings",
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export function companySubscriptions() {
  return request<CompanySubscription[]>("/company/subscriptions");
}

export function createCompanySubscription(body: {
  name: string;
  description: string;
  price: number;
  renewalValue: number;
  renewalUnit: "week" | "month" | "year";
  entitlements: Array<{
    title: string;
    description?: string;
    allowance: number;
    windowValue: number;
    windowUnit: EntitlementWindow;
  }>;
}) {
  return request<CompanySubscription>("/company/subscriptions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateCompanySubscription(
  subscriptionUuid: string,
  body: {
    name?: string;
    description?: string;
    price?: number;
    renewalValue?: number;
    renewalUnit?: "week" | "month" | "year";
    acknowledgeSubscriberRefundPolicy?: boolean;
  },
) {
  return request<CompanySubscription>(`/company/subscriptions/${encodeURIComponent(subscriptionUuid)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function createCompanyEntitlement(
  subscriptionUuid: string,
  body: { title: string; description?: string; allowance: number; windowValue: number; windowUnit: EntitlementWindow },
) {
  return request(`/company/subscriptions/${encodeURIComponent(subscriptionUuid)}/entitlements`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateCompanyEntitlement(
  subscriptionUuid: string,
  entitlementUuid: string,
  body: {
    title?: string;
    description?: string;
    allowance?: number;
    windowValue?: number;
    windowUnit?: EntitlementWindow;
    isActive?: boolean;
    acknowledgeSubscriberRefundPolicy?: boolean;
  },
) {
  return request(`/company/subscriptions/${encodeURIComponent(subscriptionUuid)}/entitlements/${encodeURIComponent(entitlementUuid)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export type CompanyRedemptionResult = {
  benefit: string;
  bundle?: string;
  unlimited: boolean;
  used: number | null;
  allowance: number | null;
  remaining: number | null;
  windowUnit: EntitlementWindow;
  windowValue: number;
  windowStartedAt: string | null;
  windowEndsAt: string | null;
};

export function redeemCompanyEntitlement(body: { userUuid: string; entitlementUuid: string; quantity?: number }) {
  return request<CompanyRedemptionResult>("/company/subscriptions/redemptions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function companyClub() {
  return request<CompanyClubData>("/company/club");
}

export function createCompanyClubBundle(body: {
  name: string;
  description: string;
  price: number;
  partnerCompanyId: number;
  renewalValue?: number;
  renewalUnit?: "week" | "month" | "year";
  promoBonusDays?: number;
  categoryId?: number;
  myBenefitTitle: string;
  myBenefitDescription: string;
  myFulfillmentNote?: string;
  myRevenueSharePercent: number;
  myAllowance?: number;
  myWindowValue?: number;
  myWindowUnit?: EntitlementWindow;
  partnerBenefitTitle: string;
  partnerBenefitDescription: string;
  partnerFulfillmentNote?: string;
  partnerRevenueSharePercent: number;
  partnerAllowance?: number;
  partnerWindowValue?: number;
  partnerWindowUnit?: EntitlementWindow;
}) {
  return request<CompanyClubBundle>("/company/club/bundles", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function approveCompanyClubBundle(uuid: string) {
  return request<CompanyClubBundle>(`/company/club/bundles/${encodeURIComponent(uuid)}/approve`, { method: "POST" });
}

export function rejectCompanyClubBundle(uuid: string) {
  return request<CompanyClubBundle>(`/company/club/bundles/${encodeURIComponent(uuid)}/reject`, { method: "POST" });
}

export function redeemCompanyBundleBenefit(body: { userUuid: string; participantUuid: string; quantity?: number }) {
  return request<CompanyRedemptionResult & { bundle: string }>(
    "/company/club/bundles/redemptions",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export function companyTeam() {
  return request<
    Array<{
      uuid: string;
      role: CompanyMemberRole;
      isActive: boolean;
      user: { uuid: string; name: string; email: string; accountStatus: string };
    }>
  >("/company/team");
}

export function createCompanyTeamMember(body: { name: string; email: string; password: string; role: "MANAGER" | "CASHIER" }) {
  return request("/company/team", { method: "POST", body: JSON.stringify(body) });
}

export function setCompanyTeamMemberRole(uuid: string, role: "MANAGER" | "CASHIER") {
  return request(`/company/team/${encodeURIComponent(uuid)}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export function setCompanyTeamMemberStatus(uuid: string, isActive: boolean) {
  return request(`/company/team/${encodeURIComponent(uuid)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  });
}

export function companyFinance() {
  return request<{
    subscriptionGross: number;
    recognizedSubscriptionRevenue: number;
    potentialSubscriptionRevenue: number;
    dailySubscriptionRevenue: number;
    reservedPayouts: number;
    paidPayouts: number;
    paidBillingFees: number;
    availableForPayout: number;
    activeSubscribers: number;
    operations: Array<{ uuid: string; amount: number; status: string; title: string; createdAt: string }>;
  }>("/company/finance");
}

export type CompanyBillingData = {
  account: { status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED"; trialEndsAt: string | null; currentPeriodStartsAt: string; currentPeriodEndsAt: string };
  invoice: null | { uuid: string; status: "OPEN" | "PAID" | "WAIVED" | "CANCELED"; periodStartsAt: string; periodEndsAt: string; baseFee: string | number; promoDiscountAmount: string | number; commissionCreditAmount: string | number; amountDue: string | number };
  availableBalance: number;
  history: Array<{ uuid: string; status: string; periodStartsAt: string; periodEndsAt: string; amountDue: number }>;
};

export function companyBilling() {
  return request<CompanyBillingData>("/company/billing");
}

export function applyCompanyBillingPromo(code: string) {
  return request<CompanyBillingData>("/company/billing/promo", { method: "POST", body: JSON.stringify({ code }) });
}

export function payCompanyBillingInvoice() {
  return request<CompanyBillingData>("/company/billing/pay", { method: "POST" });
}

export async function requestCompanyPayout(body: { amount: number; details?: string }) {
  const response = await fetch("/api/company/finance/payouts", {
    method: "POST",
    cache: "no-store",
    headers: headers(true),
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(payload.message) ? payload.message.join(", ") : payload.message;
    throw new Error(message || `HTTP ${response.status}`);
  }
  return payload;
}
