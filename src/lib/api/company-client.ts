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
    categories: Array<{ id: number; name: string; icon: string }>;
    levels: Array<{ name: string; minimumSpend: number; cashbackPercent: number }>;
  };
};

export type CompanyDashboard = {
  memberRole: CompanyMemberRole;
  company: { name: string; verificationStatus: string };
  metrics: {
    customers: number;
    activeSubscribers: number;
    subscriptionGross: number;
    monthlyRecurringRevenue: number;
    purchaseRevenue: number;
    pointsAwarded: number;
    pendingPayouts: number;
    activeEntitlements: number;
  };
  recentPurchases: Array<{
    uuid: string;
    customer: string;
    amount: number;
    pointsAwarded: number;
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
  activeSubscriptions: Array<{
    id: number;
    subscription: CompanySubscription;
  }>;
};

export type CompanySubscription = {
  uuid: string;
  name: string;
  description: string;
  price: string;
  renewalPeriod: string;
  isActive: boolean;
  entitlements: Array<{
    uuid: string;
    title: string;
    description: string | null;
    allowance: number;
    windowValue: number;
    windowUnit: EntitlementWindow;
    isActive: boolean;
  }>;
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

export function companySubscriptions() {
  return request<CompanySubscription[]>("/company/subscriptions");
}

export function createCompanySubscription(body: {
  name: string;
  description: string;
  price: number;
  renewalValue: number;
  renewalUnit: "week" | "month" | "year";
}) {
  return request<CompanySubscription>("/company/subscriptions", {
    method: "POST",
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

export function redeemCompanyEntitlement(body: { userUuid: string; entitlementUuid: string; quantity?: number }) {
  return request<{ benefit: string; unlimited: boolean; used: number | null; allowance: number | null }>("/company/subscriptions/redemptions", {
    method: "POST",
    body: JSON.stringify(body),
  });
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
    monthlyRecurringRevenue: number;
    activeSubscribers: number;
    operations: Array<{ uuid: string; amount: number; status: string; title: string; createdAt: string }>;
  }>("/company/finance");
}

export function requestCompanyPayout(body: { amount: number; details?: string }) {
  return request("/company/finance/payouts", { method: "POST", body: JSON.stringify(body) });
}
