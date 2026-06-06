const DAY_MS = 24 * 60 * 60 * 1000;

export type NumericValue = number | string | { toString(): string };

export type PlatformRevenueSubscription = {
  companyId: number;
  companyName?: string | null;
  price: NumericValue;
  status: "ACTIVE" | "EXPIRED" | "CANCELED";
  activatedAt: Date | string;
  expiresAt: Date | string | null;
  platformCommissionPercent?: NumericValue | null;
  commissionFreeMonthlyTurnover?: NumericValue | null;
  commissionGraceEndsAt?: Date | string | null;
  referralPercent?: NumericValue | null;
  referralStatus?: "ACTIVE" | "PAUSED" | "ENDED" | string | null;
  referrerUserId?: number | null;
  supportManagerUserId?: number | null;
  supportManagerPercent?: NumericValue | null;
};

export type PlatformCompanyRevenue = {
  companyId: number;
  companyName: string | null;
  gross: number;
  recognizedGross: number;
  futureGross: number;
  dailyGross: number;
  commissionableRecognized: number;
  whiteBoxCommission: number;
  referralCommission: number;
  supportManagerCommission: number;
  companyRecognizedRevenue: number;
  activeSubscriptions: number;
  referralUserId: number | null;
  supportManagerUserId: number | null;
};

export type PlatformRevenueSummary = {
  gross: number;
  recognizedGross: number;
  futureGross: number;
  dailyGross: number;
  whiteBoxCommission: number;
  referralCommission: number;
  supportManagerCommission: number;
  companyRecognizedRevenue: number;
  activeSubscriptions: number;
  companiesWithReferral: number;
  companiesWithSupportManager: number;
  companies: PlatformCompanyRevenue[];
};

function amount(value: NumericValue | null | undefined, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  return Number(typeof value === "object" ? value.toString() : value);
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function subscriptionProgress(row: PlatformRevenueSubscription, now: Date) {
  const value = amount(row.price);
  const startedAt = new Date(row.activatedAt).getTime();
  const expiresAt = row.expiresAt ? new Date(row.expiresAt).getTime() : startedAt + DAY_MS;
  const durationDays = Math.max(1, Math.ceil((expiresAt - startedAt) / DAY_MS));
  const elapsedDays =
    row.status === "EXPIRED"
      ? durationDays
      : Math.min(durationDays, Math.max(0, Math.floor((now.getTime() - startedAt) / DAY_MS)));
  const dailyGross = value / durationDays;

  return {
    value,
    recognizedGross: dailyGross * elapsedDays,
    futureGross: value - dailyGross * elapsedDays,
    dailyGross,
    active: row.status === "ACTIVE" && (!row.expiresAt || new Date(row.expiresAt) > now),
  };
}

function isCommissionGraceActive(row: PlatformRevenueSubscription, now: Date) {
  return row.commissionGraceEndsAt ? new Date(row.commissionGraceEndsAt) > now : false;
}

export function calculatePlatformRevenueSummary(
  subscriptions: PlatformRevenueSubscription[],
  now = new Date(),
): PlatformRevenueSummary {
  const companyMap = new Map<number, PlatformCompanyRevenue & { commissionPercent: number }>();

  for (const row of subscriptions.filter((item) => item.status !== "CANCELED")) {
    const progress = subscriptionProgress(row, now);
    const existing = companyMap.get(row.companyId);
    const company =
      existing ??
      {
        companyId: row.companyId,
        companyName: row.companyName ?? null,
        gross: 0,
        recognizedGross: 0,
        futureGross: 0,
        dailyGross: 0,
        commissionableRecognized: 0,
        whiteBoxCommission: 0,
        referralCommission: 0,
        supportManagerCommission: 0,
        companyRecognizedRevenue: 0,
        activeSubscriptions: 0,
        referralUserId: row.referrerUserId ?? null,
        supportManagerUserId: row.supportManagerUserId ?? null,
        commissionPercent: amount(row.platformCommissionPercent, 12),
      };

    company.gross += progress.value;
    company.recognizedGross += progress.recognizedGross;
    company.futureGross += progress.futureGross;
    company.dailyGross += progress.dailyGross;
    company.activeSubscriptions += progress.active ? 1 : 0;

    if (!existing) companyMap.set(row.companyId, company);
  }

  const companies = [...companyMap.values()].map((company) => {
    const representative = subscriptions.find((row) => row.companyId === company.companyId);
    const commissionEnabled = representative ? !isCommissionGraceActive(representative, now) : true;
    const commissionableRecognized = commissionEnabled ? company.recognizedGross : 0;
    const whiteBoxGrossCommission = commissionableRecognized * (company.commissionPercent / 100);
    const hasActiveReferral =
      commissionEnabled && representative?.referrerUserId && representative.referralStatus === "ACTIVE";
    const hasSupportManager = commissionEnabled && Boolean(representative?.supportManagerUserId);
    const referralCommission = hasActiveReferral
      ? company.recognizedGross * (amount(representative.referralPercent, 1) / 100)
      : 0;
    const supportManagerCommission = hasSupportManager
      ? company.recognizedGross * (amount(representative?.supportManagerPercent, 1) / 100)
      : 0;
    const whiteBoxCommission = Math.max(0, whiteBoxGrossCommission - referralCommission - supportManagerCommission);
    const companyRecognizedRevenue = company.recognizedGross - whiteBoxGrossCommission;

    return {
      companyId: company.companyId,
      companyName: company.companyName,
      gross: money(company.gross),
      recognizedGross: money(company.recognizedGross),
      futureGross: money(company.futureGross),
      dailyGross: money(company.dailyGross),
      commissionableRecognized: money(commissionableRecognized),
      whiteBoxCommission: money(whiteBoxCommission),
      referralCommission: money(referralCommission),
      supportManagerCommission: money(supportManagerCommission),
      companyRecognizedRevenue: money(companyRecognizedRevenue),
      activeSubscriptions: company.activeSubscriptions,
      referralUserId: hasActiveReferral ? company.referralUserId : null,
      supportManagerUserId: hasSupportManager ? company.supportManagerUserId : null,
    };
  });

  return {
    gross: money(companies.reduce((sum, company) => sum + company.gross, 0)),
    recognizedGross: money(companies.reduce((sum, company) => sum + company.recognizedGross, 0)),
    futureGross: money(companies.reduce((sum, company) => sum + company.futureGross, 0)),
    dailyGross: money(companies.reduce((sum, company) => sum + company.dailyGross, 0)),
    whiteBoxCommission: money(companies.reduce((sum, company) => sum + company.whiteBoxCommission, 0)),
    referralCommission: money(companies.reduce((sum, company) => sum + company.referralCommission, 0)),
    supportManagerCommission: money(companies.reduce((sum, company) => sum + company.supportManagerCommission, 0)),
    companyRecognizedRevenue: money(companies.reduce((sum, company) => sum + company.companyRecognizedRevenue, 0)),
    activeSubscriptions: companies.reduce((sum, company) => sum + company.activeSubscriptions, 0),
    companiesWithReferral: companies.filter((company) => company.referralUserId !== null).length,
    companiesWithSupportManager: companies.filter((company) => company.supportManagerUserId !== null).length,
    companies,
  };
}
