import { getAccessToken } from "./auth-client";

export type AdminRole = "CLIENT" | "COMPANY" | "ADMIN" | "SUPER_ADMIN" | "MANAGER" | "SUPPORT";

export type AdminUserRow = {
  uuid: string;
  email: string;
  name: string;
  role: AdminRole;
  accountStatus: "ACTIVE" | "FROZEN_PENDING_DELETION" | "BLOCKED";
  createdAt: string;
};

export type AdminUsersResponse = {
  items: AdminUserRow[];
  total: number;
  summary?: {
    totalUsers: number;
    activeUsers: number;
    adminUsers: number;
    blockedUsers: number;
  };
  page: number;
  limit: number;
  totalPages: number;
  sortBy: "name" | "email" | "role" | "status" | "createdAt";
  sortDir: "asc" | "desc";
};

export type AdminAuditRow = {
  id: string;
  workspace: "MANAGER" | "DEVELOPER";
  level: "INFO" | "WARN" | "CRITICAL";
  category: "SECURITY" | "USER" | "SUBSCRIPTION" | "BILLING" | "SYSTEM";
  action: string;
  details: string | null;
  actorUserId: number | null;
  actorLabel: string;
  targetUserId: number | null;
  targetLabel: string | null;
  targetEmail: string | null;
  targetUuid: string | null;
  result: "SUCCESS" | "BLOCKED";
  tags: string[];
  ipAddress: string | null;
  countryCode: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  createdAt: string;
};

export type AdminAuditResponse = {
  items: AdminAuditRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type AdminLandingLeadStatus = "NEW" | "IN_PROGRESS" | "CLOSED" | "SPAM";

export type AdminNotificationDelivery = {
  id: string;
  leadId: number;
  channel: string;
  recipientRole: string;
  recipientChatId: string;
  recipientLabel: string | null;
  status: "PENDING" | "SENT" | "FAILED";
  attempts: number;
  telegramMessageId: number | null;
  lastError: string | null;
  nextRetryAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminLandingLead = {
  id: number;
  uuid: string;
  name: string;
  company: string | null;
  contact: string;
  business: string | null;
  message: string;
  status: AdminLandingLeadStatus;
  source: string;
  ipAddress: string | null;
  userAgent: string | null;
  fingerprint: string;
  spamScore: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
  deliveries: AdminNotificationDelivery[];
};

export type AdminLandingLeadsResponse = {
  items: AdminLandingLead[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type AdminSystemHealthResponse = {
  generatedAt: string;
  summary: {
    openIssues: number;
    criticalIncidents: number;
    telegramQueueFailed: number;
    telegramQueueDue: number;
    leadTelegramFailed24h: number;
  };
  telegram: {
    botConfigured: boolean;
    proxyConfigured: boolean;
    queue: {
      total: number;
      failed: number;
      due: number;
      sent: number;
      recent: Array<{
        id: string;
        status: "PENDING" | "SENT" | "FAILED";
        recipientRole: string | null;
        recipientLabel: string | null;
        recipientChatId: string;
        textPreview: string | null;
        source: string | null;
        sourceId: string | null;
        priority: number;
        attempts: number;
        telegramMessageId: number | null;
        lastError: string | null;
        nextRetryAt: string | null;
        sentAt: string | null;
        createdAt: string;
        updatedAt: string;
      }>;
    };
    landingLeadDelivery24h: {
      sent: number;
      failed: number;
      pending: number;
      recentFailures: Array<{
        id: string;
        recipientRole: string;
        recipientLabel: string | null;
        recipientChatId: string;
        attempts: number;
        lastError: string | null;
        nextRetryAt: string | null;
        createdAt: string;
        updatedAt: string;
        lead: { uuid: string; name: string; company: string | null };
      }>;
    };
  };
  developerIncidents: Array<{
    id: string;
    level: "INFO" | "WARN" | "CRITICAL";
    category: "SECURITY" | "USER" | "SUBSCRIPTION" | "BILLING" | "SYSTEM";
    action: string;
    details: string | null;
    actorLabel: string;
    targetLabel: string | null;
    result: "SUCCESS" | "BLOCKED";
    tags: string[];
    linkUrl: string | null;
    linkLabel: string | null;
    taskUuid: string | null;
    createdAt: string;
  }>;
};

export type AdminTaskSource = "AUDIT" | "COMPANY_VERIFICATION" | "FINANCE";
export type AdminTaskPriority = "NORMAL" | "HIGH" | "CRITICAL";
export type AdminTaskStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "DISMISSED";

export type AdminTaskRow = {
  uuid: string;
  source: AdminTaskSource;
  sourceKey: string;
  title: string;
  description: string | null;
  priority: AdminTaskPriority;
  status: AdminTaskStatus;
  targetUrl: string | null;
  targetLabel: string | null;
  assignedToId: number | null;
  resolvedById: number | null;
  assignedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignedTo?: { name: string } | null;
  resolvedBy?: { id: number; name: string; email: string } | null;
};

export type AdminDashboardResponse = {
  generatedAt: string;
  metrics: {
    usersTotal: number;
    usersActive: number;
    companiesActive: number;
    subscriptionsActive: number;
    verificationOpen: number;
    pendingFinance: number;
    openTasks: number;
    criticalTasks: number;
  };
  permittedSources: AdminTaskSource[];
  trend: Array<{ date: string; events: number }>;
  tasks: AdminTaskRow[];
};

export type AdminCompanyVerificationStatus = "DRAFT" | "SUBMITTED" | "REVIEWING" | "APPROVED" | "REJECTED";
export type AdminCompanyEmploymentType = "SELF_EMPLOYED" | "INDIVIDUAL_ENTREPRENEUR";
export type AdminIdentityVerificationMode = "FULL" | "DEFERRED";

export type AdminCompanyVerificationApplication = {
  id: number;
  uuid: string;
  companyId: number | null;
  employmentType: AdminCompanyEmploymentType;
  identityVerificationMode: AdminIdentityVerificationMode;
  status: AdminCompanyVerificationStatus;
  contactName: string;
  contactEmail: string;
  contactTelegram: string | null;
  companyName: string;
  businessCategory: string;
  legalFirstName: string | null;
  legalMiddleName: string | null;
  legalLastName: string | null;
  birthDate: string | null;
  legalFullName: string;
  legalInn: string;
  legalOgrnip: string | null;
  legalRegistrationRegion: string | null;
  payoutBankName: string | null;
  payoutBik: string | null;
  payoutAccount: string | null;
  payoutCorrespondentAccount: string | null;
  payoutCardLast4: string | null;
  verificationDeferralReason: string | null;
  passportLast4: string | null;
  passportDataDeletedAt: string | null;
  consentAcceptedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  adminNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  passportFiles?: Array<{
    uuid: string;
    originalName: string | null;
    mimeType: string;
    size: number;
    sha256: string;
    uploadedAt: string;
    status: "ACTIVE" | "DELETED" | "MISSING";
  }>;
  company: {
    id: number;
    slug: string;
    name: string;
    isActive: boolean;
    verificationStatus: AdminCompanyVerificationStatus;
    passportVerificationStatus: AdminCompanyVerificationStatus;
    identityVerificationMode?: AdminIdentityVerificationMode;
    identityVerificationCompleted?: boolean;
    verificationSubmittedAt?: string | null;
    verificationReviewedAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
  } | null;
};

export type AdminCompanyVerificationsResponse = {
  items: AdminCompanyVerificationApplication[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: Partial<Record<AdminCompanyVerificationStatus, number>>;
};

export type AdminPermissionScope =
  | "USERS"
  | "COMPANIES"
  | "COMPANY_VERIFICATIONS"
  | "FINANCE"
  | "SUPPORT"
  | "AUDIT"
  | "DATABASE"
  | "TELEGRAM"
  | "SETTINGS";

export type AdminUserPermissionRow = {
  scope: AdminPermissionScope;
  canView: boolean;
  canEdit: boolean;
  canApprove: boolean;
};

export type AdminUserPermissionsResponse = {
  user: { uuid: string; name: string; email: string; role: AdminRole };
  scopes: AdminPermissionScope[];
  permissions: AdminUserPermissionRow[];
  policy?: {
    canManage: boolean;
    targetLocked: boolean;
    editableScopes: AdminPermissionScope[];
    assignableRoles?: Array<Extract<AdminRole, "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "SUPPORT">>;
  };
};

export type AdminFinanceOperation = {
  id: string;
  uuid: string;
  type: "PAYOUT_REQUEST" | "PAYOUT_APPROVAL" | "MANUAL_ADJUSTMENT" | "REFUND";
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "PAID" | "CANCELED";
  amount: string;
  currency: string;
  title: string;
  details: string | null;
  requestedAt: string | null;
  approvedAt: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
  company: { id: number; slug: string; name: string } | null;
  requestedBy: { id: number; uuid: string; email: string; name: string } | null;
  approvedBy: { id: number; uuid: string; email: string; name: string } | null;
  companySnapshot?: {
    subscriptionGross: number;
    recognizedRevenue: number;
    potentialRevenue: number;
    dailyRevenue: number;
    activeSubscriptions: number;
    reservedPayouts: number;
    paidPayouts: number;
    availableForPayout: number;
    availableBeforeThisRequest: number;
    requestCovered: boolean | null;
    sources: Array<{
      name: string;
      activeSubscriptions: number;
      dailyRevenue: number;
      recognizedRevenue: number;
      potentialRevenue: number;
    }>;
  } | null;
};

export type AdminBackupItem = {
  id: string;
  label: string;
  kind: "CURRENT" | "SEED" | "MANUAL";
  createdAt: string;
  sourceDatabase: string;
  counts: Record<string, number>;
  file: string;
};

export type AdminRestoreStatus = {
  active: boolean;
  stage:
    | "IDLE"
    | "REQUESTED"
    | "READING_SNAPSHOT"
    | "VALIDATING_PAYLOAD"
    | "WAITING_DB_LOCK"
    | "CLEARING_TABLES"
    | "RESTORING_TABLES"
    | "RESETTING_SEQUENCES"
    | "FINALIZING"
    | "DONE"
    | "FAILED";
  progressPercent: number;
  message: string;
  backupId: string | null;
  actorLabel: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
};

export type AdminCategory = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminCompanySubscription = {
  id: number;
  uuid: string;
  slug: string;
  name: string;
  description: string;
  price: string;
  renewalPeriod: string;
  renewalValue: number;
  renewalUnit: "week" | "month" | "year";
  promoBonusDays: number;
  promoEndsAt: string | null;
  isActive: boolean;
  categoryId: number | null;
  companyId: number;
  createdAt: string;
  updatedAt: string;
  entitlements?: Array<{
    uuid: string;
    title: string;
    description: string | null;
    allowance: number;
    windowValue: number;
    windowUnit: "DAY" | "WEEK" | "MONTH" | "TERM" | "UNLIMITED";
    isActive: boolean;
  }>;
};

export type AdminPairedSubscription = {
  id: number;
  uuid: string;
  slug: string;
  name: string;
  description: string;
  price: string;
  renewalPeriod: string;
  renewalValue: number;
  renewalUnit: "week" | "month" | "year";
  promoBonusDays: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  isActive: boolean;
  categoryId: number | null;
  createdAt: string;
  updatedAt: string;
  category: { id: number; slug: string; name: string; icon: string } | null;
  participants: Array<{
    id: number;
    companyId: number;
    benefitTitle: string;
    benefitDescription: string;
    fulfillmentNote: string | null;
    revenueSharePercent: string;
    sortOrder: number;
    company: { id: number; slug: string; name: string; isActive: boolean };
  }>;
};

export type AdminSubscriptionSearchItem = {
  type: "subscription" | "bundle";
  uuid: string;
  slug: string;
  name: string;
  description: string;
  price: string;
  renewalPeriod: string;
  isActive: boolean;
  status: string;
  updatedAt: string;
  company: { id: number; slug: string; name: string } | null;
  category: { id: number; slug: string; name: string; icon: string } | null;
  participants: Array<{
    companyId: number;
    companyName: string;
    benefitTitle: string;
    revenueSharePercent: string;
  }>;
};

export type AdminCompanyLocation = {
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

export type AdminCompanyUser = {
  id: number;
  uuid: string;
  name: string;
  email: string;
  role: "COMPANY";
  accountStatus: "ACTIVE" | "FROZEN_PENDING_DELETION" | "BLOCKED";
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  managedCompany: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    categoryId: number;
    categoryIds?: number[];
    categories?: Array<{
      categoryId: number;
      category: {
        id: number;
        slug: string;
        name: string;
        icon: string;
      };
    }>;
    pointsPerReward: number;
    subscriptionSpendPolicy?: "EXCLUDE" | "INCLUDE_NO_BONUS" | "INCLUDE_WITH_BONUS";
    levelRules?: Array<{
      id: number;
      levelName: string;
      minTotalSpend: string;
      cashbackPercent: string;
      sortOrder: number;
    }>;
    locations?: AdminCompanyLocation[];
    isActive: boolean;
    operatesOnline: boolean;
  } | null;
};

export type AdminCompanyClientRow = {
  userId: number;
  userUuid: string;
  name: string;
  email: string;
  accountStatus: "ACTIVE" | "FROZEN_PENDING_DELETION" | "BLOCKED";
  userCreatedAt: string;
  linkCreatedAt: string;
  linkUpdatedAt: string;
  balance: number;
  totalEarnedPoints: number;
  totalSpentPoints: number;
  currentLevel: {
    levelName: string;
    cashbackPercent: number;
  } | null;
};

export type AdminCompanyClientsResponse = {
  items: AdminCompanyClientRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  sortBy: "name" | "email" | "balance" | "earned" | "spent" | "level" | "updatedAt";
  sortDir: "asc" | "desc";
};

export type AdminSubscriptionStats = {
  generatedAt: string;
  total: number;
  active: number;
  expired: number;
  canceled: number;
  activeRatePercent: number;
  estimatedMonthlyRevenue: number;
  averageMonthlyRevenuePerActive: number;
  autoRenewEnabled: number;
  autoRenewRatePercent: number;
  expiringIn7Days: number;
  churnedIn30Days: number;
  startedIn30Days: number;
  startedInPrevious30Days: number;
  startedGrowthPercent: number;
  churnRatePercent: number;
  kpi: {
    targets: {
      autoRenewRatePercent: number;
      churnRatePercent: number;
    };
    actual: {
      autoRenewRatePercent: number;
      churnRatePercent: number;
    };
    attainment: {
      autoRenewPercent: number;
      churnPercent: number;
    };
    sla: {
      autoRenew: "on_track" | "at_risk" | "off_track";
      churn: "on_track" | "at_risk" | "off_track";
    };
  };
  forecast: {
    assumptions: {
      startedGrowthPercent: number;
      churnRatePercent: number;
    };
    base: {
      days30: number;
      days90: number;
    };
    optimistic: {
      days30: number;
      days90: number;
    };
    risk: {
      days30: number;
      days90: number;
    };
  };
  concentration: {
    score: number;
    top3SubscriberSharePercent: number;
    top1RevenueSharePercent: number;
  };
  catalog: {
    totalPlans: number;
    activePlans: number;
    inactivePlans: number;
    companyLinkedPlans: number;
    categoryLinkedPlans: number;
  };
  topSubscriptions: Array<{
    uuid: string;
    slug: string;
    name: string;
    companyName: string | null;
    activeSubscribers: number;
    estimatedMonthlyRevenue: number;
  }>;
};

export type AdminPromoCode = {
  id: number;
  code: string;
  title: string;
  description: string | null;
  rewardType: "POINTS" | "SUBSCRIPTION";
  points: number;
  subscriptionId: number | null;
  maxRedemptions: number | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  redemptionCount: number;
  company: { id: number; slug: string; name: string } | null;
  subscription: { uuid: string; slug: string; name: string } | null;
};

export type AdminReferralCampaign = {
  id: number;
  title: string;
  inviterBonusPoints: number;
  invitedBonusPoints: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  bonusCompany: { id: number; slug: string; name: string } | null;
  stats: {
    createdInvites: number;
    redeemedInvites: number;
    rewardedInvites: number;
  };
};

export type AdminUserDetail = {
  id: number;
  uuid: string;
  telegramId: string | null;
  name: string;
  email: string;
  role: AdminRole;
  accountStatus: "ACTIVE" | "FROZEN_PENDING_DELETION" | "BLOCKED";
  emailVerifiedAt: string | null;
  deletionScheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  hasPassword: boolean;
  favoriteCategories: Array<{
    id: number;
    createdAt: string;
    category: {
      id: number;
      slug: string;
      name: string;
      icon: string;
    };
  }>;
  companyLinks: Array<{
    id: number;
    balance: number;
    pointsToNextReward: number | null;
    expiringPoints: number | null;
    expiringDate: string | null;
    createdAt: string;
    updatedAt: string;
    company: {
      slug: string;
      name: string;
      category: {
        slug: string;
        name: string;
      };
    };
  }>;
  subscriptions: Array<{
    id: number;
    status: "ACTIVE" | "EXPIRED" | "CANCELED";
    activatedAt: string;
    expiresAt: string | null;
    willAutoRenew: boolean;
    createdAt: string;
    updatedAt: string;
    subscription: {
      uuid: string;
      slug: string;
      name: string;
      price: string;
      renewalPeriod: string;
      company: { name: string } | null;
      category: { name: string } | null;
    };
  }>;
  refreshTokens: Array<{
    id: string;
    expiresAt: string;
    createdAt: string;
    revokedAt: string | null;
  }>;
  oauthAccounts: Array<{
    id: string;
    provider: string;
    providerAccountId: string;
    scope: string | null;
    expiresAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  loginEvents: Array<{
    id: string;
    ipAddress: string | null;
    countryCode: string | null;
    city: string | null;
    userAgent: string | null;
    deviceLabel: string | null;
    createdAt: string;
  }>;
  loginRisk: {
    primaryCountry: string | null;
    latestCountry: string | null;
    unusualCountries: string[];
    shouldReview: boolean;
  };
  loyaltyTransactions: Array<{
    uuid: string;
    type: "EARN" | "SPEND";
    status: "ACTIVE" | "EXPIRED";
    amount: number;
    description: string | null;
    occurredAt: string;
    company: {
      name: string;
      slug: string;
    };
  }>;
  criticalActions: Array<{
    id: string;
    action: string;
    details: string | null;
    category: "SECURITY" | "USER" | "SUBSCRIPTION" | "BILLING" | "SYSTEM";
    level: "INFO" | "WARN" | "CRITICAL";
    result: "SUCCESS" | "BLOCKED";
    tags: string[];
    actorLabel: string;
    ipAddress: string | null;
    countryCode: string | null;
    createdAt: string;
  }>;
};

export type AdminProfileStatusRarity = "RARE" | "EPIC" | "LEGENDARY";

export type AdminProfileStatus = {
  id: string;
  slug: string;
  title: string;
  description: string;
  rarity: AdminProfileStatusRarity;
  icon: string;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  unlockCount: number;
  unlocked?: boolean;
  unlockedAt?: string | null;
  seenAt?: string | null;
  source?: string | null;
  selected?: boolean;
};

export type AdminProfileStatusResponse = {
  statuses: AdminProfileStatus[];
  selectedStatusId: string | null;
  userFound: boolean | null;
};

export type AdminUpdateUserInput = {
  name?: string;
  role?: AdminRole;
  accountStatus?: "ACTIVE" | "FROZEN_PENDING_DELETION" | "BLOCKED";
  emailVerifiedAt?: string | null;
  createdAt?: string | null;
};

function apiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
  return base.replace(/\/$/, "");
}

function authHeaders(): HeadersInit {
  const t = getAccessToken();
  return {
    "Content-Type": "application/json",
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

export async function adminListUsers(options?: {
  role?: string;
  query?: string;
  page?: number;
  limit?: number;
  sortBy?: "name" | "email" | "role" | "status" | "createdAt";
  sortDir?: "asc" | "desc";
}): Promise<AdminUsersResponse | null> {
  const params = new URLSearchParams();
  if (options?.role) params.set("role", options.role);
  if (options?.query) params.set("query", options.query);
  if (options?.page) params.set("page", String(options.page));
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.sortBy) params.set("sortBy", options.sortBy);
  if (options?.sortDir) params.set("sortDir", options.sortDir);
  const suffix = params.toString() ? `?${params}` : "";
  try {
    const res = await fetch(`${apiBase()}/admin/users${suffix}`, { headers: authHeaders() });
    if (!res.ok) return null;
    return (await res.json()) as AdminUsersResponse;
  } catch {
    return null;
  }
}

export async function adminCreateAccount(input: {
  name: string;
  email: string;
  password: string;
  role: AdminRole;
}) {
  const res = await fetch(`${apiBase()}/admin/accounts`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to create account" };
  }
  return { ok: true as const };
}

export async function adminGetUser(uuid: string): Promise<
  | { ok: true; data: AdminUserDetail }
  | { ok: false; status: number; message: string }
> {
  const res = await fetch(`${apiBase()}/admin/users/${uuid}`, { headers: authHeaders() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = Array.isArray(data.message) ? data.message.join(", ") : data.message ?? "Request failed";
    return { ok: false, status: res.status, message };
  }
  return { ok: true, data: (await res.json()) as AdminUserDetail };
}

export async function adminUpdateUser(uuid: string, input: AdminUpdateUserInput) {
  const res = await fetch(`${apiBase()}/admin/users/${uuid}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to update user" };
  }
  return { ok: true as const, data: (await res.json()) as AdminUserDetail };
}

export async function adminUpdateUserRole(uuid: string, role: AdminRole) {
  const res = await fetch(`${apiBase()}/admin/users/${uuid}/role`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to update user role" };
  }
  return { ok: true as const, data: (await res.json()) as { uuid: string; email: string; name: string; role: AdminRole; updatedAt: string } };
}

export async function adminDeleteUser(uuid: string) {
  const res = await fetch(`${apiBase()}/admin/users/${uuid}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to delete user" };
  }
  return { ok: true as const };
}

export async function adminForceLogoutUser(uuid: string) {
  const res = await fetch(`${apiBase()}/admin/users/${uuid}/force-logout`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to force logout user" };
  }
  return { ok: true as const, data: (await res.json()) as { success: true; revokedSessions: number } };
}

export async function adminReactivateUser(uuid: string) {
  const res = await fetch(`${apiBase()}/admin/users/${uuid}/reactivate-account`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to reactivate user" };
  }
  return { ok: true as const, data: (await res.json()) as { uuid: string; accountStatus: string } };
}

export async function adminRequestEmailChange(uuid: string, newEmail: string) {
  const res = await fetch(`${apiBase()}/admin/users/${uuid}/email-change-request`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ newEmail }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to send email change link" };
  }
  return {
    ok: true as const,
    data: (await res.json()) as {
      success: true;
      sentTo: string;
      expiresAt: string;
      previewUrl?: string;
    },
  };
}

export async function adminListProfileStatuses(userUuid?: string) {
  const params = new URLSearchParams();
  if (userUuid) params.set("userUuid", userUuid);
  const suffix = params.toString() ? `?${params}` : "";
  const res = await fetch(`/api/admin/profile-statuses${suffix}`, { headers: authHeaders() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to load profile statuses" };
  }
  return { ok: true as const, data: (await res.json()) as AdminProfileStatusResponse };
}

export async function adminCreateProfileStatus(input: {
  title: string;
  description: string;
  rarity: AdminProfileStatusRarity;
  icon?: string;
  slug?: string;
}) {
  const res = await fetch("/api/admin/profile-statuses", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to create profile status" };
  }
  return { ok: true as const, data: (await res.json()) as AdminProfileStatus };
}

export async function adminGrantProfileStatus(userUuid: string, statusId: string) {
  const res = await fetch(`/api/admin/users/${userUuid}/profile-statuses`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ statusId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to grant profile status" };
  }
  return { ok: true as const, data: await res.json() };
}

export async function adminListCategories() {
  const res = await fetch(`${apiBase()}/admin/categories`, { headers: authHeaders() });
  if (!res.ok) return [];
  return (await res.json()) as AdminCategory[];
}

export async function adminCreateCategory(input: {
  slug: string;
  name: string;
  description?: string;
  icon: string;
}) {
  const res = await fetch(`${apiBase()}/admin/categories`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to create category" };
  }
  return { ok: true as const, data: (await res.json()) as AdminCategory };
}

export async function adminUpdateCategory(id: number, input: Partial<Pick<AdminCategory, "slug" | "name" | "description" | "icon">>) {
  const res = await fetch(`${apiBase()}/admin/categories/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to update category" };
  }
  return { ok: true as const, data: (await res.json()) as AdminCategory };
}

export async function adminDeleteCategory(id: number) {
  const res = await fetch(`${apiBase()}/admin/categories/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to delete category" };
  }
  return { ok: true as const };
}

export async function adminListCompanyUsers(query?: string) {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  const suffix = params.toString() ? `?${params}` : "";
  try {
    const res = await fetch(`${apiBase()}/admin/company-users${suffix}`, { headers: authHeaders() });
    if (!res.ok) return [];
    return (await res.json()) as AdminCompanyUser[];
  } catch {
    return [];
  }
}

export async function adminGetCompanyUser(uuid: string) {
  try {
    const res = await fetch(`${apiBase()}/admin/company-users/${uuid}`, { headers: authHeaders() });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
      return { ok: false as const, status: res.status, message: message ?? "Failed" };
    }
    return { ok: true as const, data: (await res.json()) as AdminCompanyUser & { managedCompany: (AdminCompanyUser["managedCompany"] & { subscriptions: AdminCompanySubscription[] }) | null } };
  } catch (error) {
    return {
      ok: false as const,
      status: 0,
      message: error instanceof Error ? error.message : "Network error",
    };
  }
}

export async function adminUpdateCompanyUser(uuid: string, input: {
  name?: string;
  accountStatus?: "ACTIVE" | "FROZEN_PENDING_DELETION" | "BLOCKED";
  emailVerifiedAt?: string | null;
  createdAt?: string | null;
}) {
  const res = await fetch(`${apiBase()}/admin/company-users/${uuid}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to update company user" };
  }
  return { ok: true as const, data: (await res.json()) as AdminCompanyUser };
}

export async function adminDeleteCompanyUser(uuid: string) {
  const res = await fetch(`${apiBase()}/admin/company-users/${uuid}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to delete company user" };
  }
  return { ok: true as const };
}

export async function adminCreateCompanyLocation(uuid: string, input: {
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
  const res = await fetch(`${apiBase()}/admin/company-users/${uuid}/locations`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
    return { ok: false as const, message: message ?? "Failed to create company location" };
  }
  return { ok: true as const, data: (await res.json()) as AdminCompanyLocation };
}

export async function adminUpdateCompanyLocation(uuid: string, locationUuid: string, input: {
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
  const res = await fetch(`${apiBase()}/admin/company-users/${uuid}/locations/${locationUuid}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
    return { ok: false as const, message: message ?? "Failed to update company location" };
  }
  return { ok: true as const, data: (await res.json()) as AdminCompanyLocation };
}

export async function adminDeleteCompanyLocation(uuid: string, locationUuid: string) {
  const res = await fetch(`${apiBase()}/admin/company-users/${uuid}/locations/${locationUuid}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
    return { ok: false as const, message: message ?? "Failed to delete company location" };
  }
  return { ok: true as const, data: (await res.json()) as { success: true } };
}

export async function adminListCompanyClients(
  uuid: string,
  options?: {
    query?: string;
    page?: number;
    limit?: number;
    sortBy?: "name" | "email" | "balance" | "earned" | "spent" | "level" | "updatedAt";
    sortDir?: "asc" | "desc";
  },
) {
  const params = new URLSearchParams();
  if (options?.query) params.set("query", options.query);
  if (options?.page) params.set("page", String(options.page));
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.sortBy) params.set("sortBy", options.sortBy);
  if (options?.sortDir) params.set("sortDir", options.sortDir);
  const suffix = params.toString() ? `?${params}` : "";
  const res = await fetch(`${apiBase()}/admin/company-users/${uuid}/clients${suffix}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to fetch company clients" };
  }
  return { ok: true as const, data: (await res.json()) as AdminCompanyClientsResponse };
}

export async function adminUpsertCompanyProfile(uuid: string, input: {
  name: string;
  slug?: string;
  description?: string;
  categoryId?: number;
  categoryIds?: number[];
  pointsPerReward?: number;
  subscriptionSpendPolicy?: "EXCLUDE" | "INCLUDE_NO_BONUS" | "INCLUDE_WITH_BONUS";
  levelRules?: Array<{
    levelName: string;
    minTotalSpend: number;
    cashbackPercent: number;
  }>;
  isActive?: boolean;
  operatesOnline?: boolean;
}) {
  const res = await fetch(`${apiBase()}/admin/company-users/${uuid}/company-profile`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to upsert company profile" };
  }
  return { ok: true as const, data: await res.json() };
}

export async function adminCreateCompanySubscription(uuid: string, input: {
  name: string;
  description: string;
  price: number;
  renewalPeriod?: string;
  renewalValue?: number;
  renewalUnit?: "week" | "month" | "year";
  promoBonusDays?: number;
  promoEndsAt?: string | null;
  slug?: string;
  categoryId?: number;
  entitlements: Array<{
    title: string;
    description?: string;
    allowance: number;
    windowValue: number;
    windowUnit: "DAY" | "WEEK" | "MONTH" | "TERM" | "UNLIMITED";
  }>;
}) {
  const res = await fetch(`${apiBase()}/admin/company-users/${uuid}/subscriptions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to create subscription" };
  }
  return { ok: true as const, data: (await res.json()) as AdminCompanySubscription };
}

export async function adminUpdateCompanySubscription(
  uuid: string,
  subscriptionUuid: string,
  input: Partial<{
    name: string;
    description: string;
    price: number;
    renewalPeriod: string;
    renewalValue: number;
    renewalUnit: "week" | "month" | "year";
    promoBonusDays: number;
    promoEndsAt: string | null;
    slug: string;
    isActive: boolean;
    categoryId: number;
  }>,
) {
  const res = await fetch(`${apiBase()}/admin/company-users/${uuid}/subscriptions/${subscriptionUuid}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to update subscription" };
  }
  return { ok: true as const, data: (await res.json()) as AdminCompanySubscription };
}

export async function adminDeleteCompanySubscription(uuid: string, subscriptionUuid: string) {
  const res = await fetch(`${apiBase()}/admin/company-users/${uuid}/subscriptions/${subscriptionUuid}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to delete subscription" };
  }
  return { ok: true as const };
}

export async function adminCreateCompanySubscriptionEntitlement(
  uuid: string,
  subscriptionUuid: string,
  input: {
    title: string;
    description?: string;
    allowance: number;
    windowValue: number;
    windowUnit: "DAY" | "WEEK" | "MONTH" | "TERM" | "UNLIMITED";
  },
) {
  const res = await fetch(`${apiBase()}/admin/company-users/${uuid}/subscriptions/${subscriptionUuid}/entitlements`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to create subscription benefit" };
  }
  return { ok: true as const, data: await res.json() };
}

export async function adminSubscriptionStats() {
  try {
    const res = await fetch(`${apiBase()}/admin/subscriptions/stats`, {
      headers: authHeaders(),
    });
    if (!res.ok) return null;
    return (await res.json()) as AdminSubscriptionStats;
  } catch {
    return null;
  }
}

export async function adminFindSubscriptionByUuid(uuid: string) {
  const res = await fetch(`${apiBase()}/admin/subscriptions/${uuid}`, {
    headers: authHeaders(),
  });
  if (!res.ok) return null;
  return (await res.json()) as {
    uuid: string;
    name: string;
    slug: string;
    description: string;
  };
}

export async function adminSearchSubscriptions(query: string) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("query", query.trim());
  const suffix = params.toString() ? `?${params}` : "";
  const res = await fetch(`${apiBase()}/admin/subscriptions/search${suffix}`, {
    headers: authHeaders(),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { items: AdminSubscriptionSearchItem[] };
  return data.items;
}

export async function adminListPairedSubscriptions() {
  const res = await fetch(`${apiBase()}/admin/subscriptions/bundles`, {
    headers: authHeaders(),
  });
  if (!res.ok) return [];
  return (await res.json()) as AdminPairedSubscription[];
}

export async function adminCreatePairedSubscription(input: {
  name: string;
  description: string;
  price: number;
  renewalValue?: number;
  renewalUnit?: "week" | "month" | "year";
  promoBonusDays?: number;
  slug?: string;
  categoryId?: number;
  isActive?: boolean;
  participants: Array<{
    companyId: number;
    benefitTitle: string;
    benefitDescription: string;
    fulfillmentNote?: string;
    revenueSharePercent: number;
  }>;
}) {
  const res = await fetch(`${apiBase()}/admin/subscriptions/bundles`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
    return { ok: false as const, message: message ?? "Failed to create paired subscription" };
  }
  return { ok: true as const, data: (await res.json()) as AdminPairedSubscription };
}

export async function adminListPromoCodes() {
  try {
    const res = await fetch(`${apiBase()}/admin/promo-codes`, { headers: authHeaders() });
    if (!res.ok) return [];
    return (await res.json()) as AdminPromoCode[];
  } catch {
    return [];
  }
}

export async function adminCreatePromoCode(input: {
  code: string;
  title: string;
  description?: string;
  rewardType: "POINTS" | "SUBSCRIPTION";
  points?: number;
  companyUuid?: string;
  subscriptionUuid?: string;
  maxRedemptions?: number | null;
  expiresAt?: string | null;
  isActive?: boolean;
}) {
  const res = await fetch(`${apiBase()}/admin/promo-codes`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
    return { ok: false as const, message: message ?? "Failed to create promo code" };
  }
  return { ok: true as const, data: (await res.json()) as AdminPromoCode };
}

export async function adminUpdatePromoCode(id: number, input: Partial<{
  code: string;
  title: string;
  description: string;
  rewardType: "POINTS" | "SUBSCRIPTION";
  points: number;
  companyUuid: string;
  subscriptionUuid: string;
  maxRedemptions: number | null;
  expiresAt: string | null;
  isActive: boolean;
}>) {
  const res = await fetch(`${apiBase()}/admin/promo-codes/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
    return { ok: false as const, message: message ?? "Failed to update promo code" };
  }
  return { ok: true as const, data: (await res.json()) as AdminPromoCode };
}

export async function adminGetReferralCampaign() {
  try {
    const res = await fetch(`${apiBase()}/admin/referral-campaign`, { headers: authHeaders() });
    if (!res.ok) return null;
    return (await res.json()) as AdminReferralCampaign;
  } catch {
    return null;
  }
}

export async function adminUpdateReferralCampaign(input: Partial<Pick<
  AdminReferralCampaign,
  "title" | "inviterBonusPoints" | "invitedBonusPoints" | "isActive"
>> & { bonusCompanyUuid?: string | null }) {
  const res = await fetch(`${apiBase()}/admin/referral-campaign`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
    return { ok: false as const, message: message ?? "Failed to update referral campaign" };
  }
  return { ok: true as const, data: (await res.json()) as AdminReferralCampaign };
}

export async function adminListAuditEvents(options?: {
  workspace?: "MANAGER" | "DEVELOPER";
  query?: string;
  tag?: string;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (options?.workspace) params.set("workspace", options.workspace);
  if (options?.query) params.set("query", options.query);
  if (options?.tag) params.set("tag", options.tag);
  if (options?.page) params.set("page", String(options.page));
  if (options?.limit) params.set("limit", String(options.limit));
  const suffix = params.toString() ? `?${params}` : "";
  const res = await fetch(`${apiBase()}/admin/audit${suffix}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to fetch audit events" };
  }
  return { ok: true as const, data: (await res.json()) as AdminAuditResponse };
}

export async function adminCreateAuditEvent(input: {
  workspace?: "MANAGER" | "DEVELOPER";
  category: "SECURITY" | "USER" | "SUBSCRIPTION" | "BILLING" | "SYSTEM";
  level?: "INFO" | "WARN" | "CRITICAL";
  action: string;
  targetLabel?: string;
  targetEmail?: string;
  targetUuid?: string;
  details?: string;
  tags?: string[];
  result?: "SUCCESS" | "BLOCKED";
  linkUrl?: string;
  linkLabel?: string;
}) {
  const res = await fetch(`${apiBase()}/admin/audit`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to create audit event" };
  }
  return { ok: true as const, data: (await res.json()) as AdminAuditRow };
}

export async function adminListBackups() {
  const res = await fetch(`${apiBase()}/admin/backups`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to fetch backups" };
  }
  return { ok: true as const, data: (await res.json()) as AdminBackupItem[] };
}

export async function adminCreateBackup(input?: {
  label?: string;
  kind?: "CURRENT" | "SEED" | "MANUAL";
}) {
  const res = await fetch(`${apiBase()}/admin/backups`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input ?? {}),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to create backup" };
  }
  return { ok: true as const, data: (await res.json()) as AdminBackupItem };
}

export async function adminRestoreBackup(backupId: string) {
  const res = await fetch(`${apiBase()}/admin/backups/${backupId}/restore`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ confirm: true }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
    return { ok: false as const, message: message ?? "Failed to restore backup" };
  }
  return {
    ok: true as const,
    data: (await res.json()) as { success: true; restored: AdminBackupItem },
  };
}

export async function adminRestoreStatus() {
  const res = await fetch(`${apiBase()}/admin/backups/restore-status`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
    return { ok: false as const, message: message ?? "Failed to fetch restore status" };
  }
  return { ok: true as const, data: (await res.json()) as AdminRestoreStatus };
}

export async function adminDeleteBackup(backupId: string) {
  const res = await fetch(`${apiBase()}/admin/backups/${backupId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to delete backup" };
  }
  return { ok: true as const, data: (await res.json()) as { success: true } };
}

export async function adminDownloadBackup(backupId: string) {
  const res = await fetch(`${apiBase()}/admin/backups/${backupId}/file`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to download backup" };
  }

  const blob = await res.blob();
  const contentDisposition = res.headers.get("content-disposition") ?? "";
  const matchedName = /filename="?([^"]+)"?/i.exec(contentDisposition)?.[1];
  const filename = matchedName ?? `${backupId}.json`;

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);

  return { ok: true as const };
}

export async function adminListLandingLeads(options?: {
  query?: string;
  status?: AdminLandingLeadStatus | "ALL";
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (options?.query) params.set("query", options.query);
  if (options?.status && options.status !== "ALL") params.set("status", options.status);
  if (options?.page) params.set("page", String(options.page));
  if (options?.limit) params.set("limit", String(options.limit));
  const suffix = params.toString() ? `?${params}` : "";
  const res = await fetch(`/api/admin/landing-leads${suffix}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to fetch landing leads" };
  }
  return { ok: true as const, data: (await res.json()) as AdminLandingLeadsResponse };
}

export async function adminGetLandingLead(uuid: string) {
  const res = await fetch(`/api/admin/landing-leads/${uuid}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to fetch landing lead" };
  }
  return { ok: true as const, data: (await res.json()) as AdminLandingLead };
}

export async function adminUpdateLandingLead(uuid: string, input: {
  status: AdminLandingLeadStatus;
  notes?: string;
}) {
  const res = await fetch(`/api/admin/landing-leads/${uuid}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to update landing lead" };
  }
  return { ok: true as const, data: (await res.json()) as AdminLandingLead };
}

export async function adminRetryLandingLead(uuid: string) {
  const res = await fetch(`/api/admin/landing-leads/${uuid}/retry`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to retry landing lead notification" };
  }
  return { ok: true as const, data: (await res.json()) as { ok: true; result: { sent: number; failed: number } } };
}

export async function adminRetryDueLandingLeads() {
  const res = await fetch("/api/admin/landing-leads/retry-due", {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to process landing lead retry queue" };
  }
  return {
    ok: true as const,
    data: (await res.json()) as { ok: true; result: { processed: number } },
  };
}

export async function adminGetSystemHealth() {
  const res = await fetch("/api/admin/system-health", {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to fetch system health" };
  }
  return { ok: true as const, data: (await res.json()) as AdminSystemHealthResponse };
}

export async function adminGetDashboard() {
  const res = await fetch("/api/admin/dashboard", {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to fetch dashboard" };
  }
  return { ok: true as const, data: (await res.json()) as AdminDashboardResponse };
}

export async function adminGetTask(uuid: string) {
  const res = await fetch(`/api/admin/tasks/${uuid}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to fetch task" };
  }
  return { ok: true as const, data: (await res.json()) as AdminTaskRow };
}

export async function adminUpdateTask(uuid: string, action: "start" | "resolve" | "reopen") {
  const res = await fetch(`/api/admin/tasks/${uuid}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ action }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to update task" };
  }
  return { ok: true as const, data: (await res.json()) as AdminTaskRow };
}

export async function adminRetryTelegramQueue() {
  const res = await fetch("/api/admin/telegram/retry-queue", {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to retry Telegram queue" };
  }
  return {
    ok: true as const,
    data: (await res.json()) as {
      ok: true;
      result: { processed: number; sent: number; failed: number; results: Array<{ id: string; ok: boolean; message?: string }> };
    },
  };
}

export async function adminResolveSystemHealthIncident(id: string) {
  const res = await fetch("/api/admin/system-health", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ action: "resolveDeveloperIncident", id }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to resolve incident" };
  }
  return { ok: true as const, data: (await res.json()) as { ok: true; incident: { id: string; tags: string[] } } };
}

export async function adminListCompanyVerifications(options?: {
  query?: string;
  status?: AdminCompanyVerificationStatus | "ALL";
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (options?.query) params.set("query", options.query);
  if (options?.status && options.status !== "ALL") params.set("status", options.status);
  if (options?.page) params.set("page", String(options.page));
  if (options?.limit) params.set("limit", String(options.limit));
  const suffix = params.toString() ? `?${params}` : "";
  const res = await fetch(`/api/admin/company-verifications${suffix}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to fetch company verification requests" };
  }
  return { ok: true as const, data: (await res.json()) as AdminCompanyVerificationsResponse };
}

export async function adminGetCompanyVerification(uuid: string) {
  const res = await fetch(`/api/admin/company-verifications/${uuid}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to fetch company verification request" };
  }
  return { ok: true as const, data: (await res.json()) as AdminCompanyVerificationApplication };
}

export async function adminUpdateCompanyVerification(uuid: string, input: {
  status: Exclude<AdminCompanyVerificationStatus, "DRAFT">;
}) {
  const res = await fetch(`/api/admin/company-verifications/${uuid}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to update company verification request" };
  }
  return { ok: true as const, data: (await res.json()) as AdminCompanyVerificationApplication };
}

export async function adminSyncPassportStorage() {
  const res = await fetch("/api/admin/company-verifications/passport-storage/sync", {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to sync passport storage" };
  }
  return {
    ok: true as const,
    data: (await res.json()) as {
      ok: true;
      result: {
        activeDbRecords: number;
        encryptedFilesOnDisk: number;
        missingFiles: number;
        orphanFilesDeleted: number;
      };
    },
  };
}

export async function adminGetUserPermissions(uuid: string) {
  const res = await fetch(`/api/admin/users/${uuid}/permissions`, { headers: authHeaders() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to fetch user permissions" };
  }
  return { ok: true as const, data: (await res.json()) as AdminUserPermissionsResponse };
}

export async function adminUpdateUserPermissions(uuid: string, permissions: AdminUserPermissionRow[]) {
  const res = await fetch(`/api/admin/users/${uuid}/permissions`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ permissions }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to update user permissions" };
  }
  return { ok: true as const, data: (await res.json()) as AdminUserPermissionsResponse };
}

export async function adminListFinanceOperations() {
  const res = await fetch("/api/admin/finance-operations", { headers: authHeaders() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to fetch finance operations" };
  }
  return { ok: true as const, data: (await res.json()) as { items: AdminFinanceOperation[] } };
}

export async function adminCreateFinanceOperation(input: {
  title: string;
  amount: string;
  currency?: string;
  details?: string;
}) {
  const res = await fetch("/api/admin/finance-operations", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to create finance operation" };
  }
  return { ok: true as const, data: (await res.json()) as AdminFinanceOperation };
}

export async function adminUpdateFinanceOperation(uuid: string, status: AdminFinanceOperation["status"]) {
  const res = await fetch(`/api/admin/finance-operations/${uuid}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, message: data.message ?? "Failed to update finance operation" };
  }
  return { ok: true as const, data: (await res.json()) as AdminFinanceOperation };
}


