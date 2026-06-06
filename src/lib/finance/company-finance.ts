import { calculatePlatformRevenueSummary } from "./platform-revenue";

const DAY_MS = 24 * 60 * 60 * 1000;

type NumericValue = number | string | { toString(): string };

export type CompanySubscriptionRevenueRow = {
  companyId: number;
  name: string;
  price: NumericValue;
  status: "ACTIVE" | "EXPIRED" | "CANCELED";
  activatedAt: Date | string;
  expiresAt: Date | string | null;
  platformCommissionPercent?: NumericValue | null;
  commissionFreeMonthlyTurnover?: NumericValue | null;
  commissionGraceEndsAt?: Date | string | null;
  referralPercent?: NumericValue | null;
  referralStatus?: string | null;
  referrerUserId?: number | null;
  supportManagerUserId?: number | null;
  supportManagerPercent?: NumericValue | null;
};

export type CompanyPayoutRow = {
  companyId: number | null;
  type: string;
  status: string;
  amount: NumericValue;
};

export type CompanyRevenueSource = {
  name: string;
  activeSubscriptions: number;
  dailyRevenue: number;
  recognizedRevenue: number;
  potentialRevenue: number;
};

export type CompanyFinancialSnapshot = {
  subscriptionGross: number;
  recognizedRevenue: number;
  potentialRevenue: number;
  dailyRevenue: number;
  whiteBoxCommission: number;
  referralCommission: number;
  supportManagerCommission: number;
  companyRecognizedRevenue: number;
  activeSubscriptions: number;
  reservedPayouts: number;
  paidPayouts: number;
  availableForPayout: number;
  sources: CompanyRevenueSource[];
};

function amount(value: NumericValue) {
  return Number(typeof value === "object" ? value.toString() : value);
}

function currency(value: number) {
  return Math.round(value * 100) / 100;
}

function revenueForSubscription(row: CompanySubscriptionRevenueRow, now: Date) {
  const value = amount(row.price);
  const startedAt = new Date(row.activatedAt).getTime();
  const expiresAt = row.expiresAt ? new Date(row.expiresAt).getTime() : startedAt + DAY_MS;
  const durationDays = Math.max(1, Math.ceil((expiresAt - startedAt) / DAY_MS));
  const elapsedDays = Math.min(durationDays, Math.max(0, Math.floor((now.getTime() - startedAt) / DAY_MS)));
  const dailyRevenue = value / durationDays;
  return {
    value,
    dailyRevenue,
    recognizedRevenue: dailyRevenue * elapsedDays,
    potentialRevenue: value - dailyRevenue * elapsedDays,
    active: row.status === "ACTIVE" && (!row.expiresAt || new Date(row.expiresAt) > now),
  };
}

/**
 * Until a payment ledger is introduced, an activated, non-cancelled subscription
 * is the auditable source of company earnings.
 */
export function calculateCompanyFinancialSnapshot(
  companyId: number,
  subscriptions: CompanySubscriptionRevenueRow[],
  payouts: CompanyPayoutRow[],
  now = new Date(),
): CompanyFinancialSnapshot {
  const sources = new Map<string, CompanyRevenueSource>();
  const totals = subscriptions
    .filter((row) => row.companyId === companyId && row.status !== "CANCELED")
    .reduce(
      (result, row) => {
        const revenue = revenueForSubscription(row, now);
        result.subscriptionGross += revenue.value;
        result.recognizedRevenue += revenue.recognizedRevenue;
        result.potentialRevenue += revenue.potentialRevenue;
        result.dailyRevenue += revenue.dailyRevenue;
        result.activeSubscriptions += revenue.active ? 1 : 0;
        const source = sources.get(row.name) ?? {
          name: row.name,
          activeSubscriptions: 0,
          dailyRevenue: 0,
          recognizedRevenue: 0,
          potentialRevenue: 0,
        };
        source.activeSubscriptions += revenue.active ? 1 : 0;
        source.dailyRevenue += revenue.dailyRevenue;
        source.recognizedRevenue += revenue.recognizedRevenue;
        source.potentialRevenue += revenue.potentialRevenue;
        sources.set(row.name, source);
        return result;
      },
      { subscriptionGross: 0, recognizedRevenue: 0, potentialRevenue: 0, dailyRevenue: 0, activeSubscriptions: 0 },
    );

  const companyPayouts = payouts.filter((row) => row.companyId === companyId && row.type === "PAYOUT_REQUEST");
  const reservedPayouts = companyPayouts
    .filter((row) => row.status === "PENDING_APPROVAL" || row.status === "APPROVED")
    .reduce((total, row) => total + amount(row.amount), 0);
  const paidPayouts = companyPayouts
    .filter((row) => row.status === "PAID")
    .reduce((total, row) => total + amount(row.amount), 0);

  const platform = calculatePlatformRevenueSummary(
    subscriptions
      .filter((row) => row.companyId === companyId)
      .map((row) => ({
        companyId: row.companyId,
        companyName: row.name,
        price: row.price,
        status: row.status,
        activatedAt: row.activatedAt,
        expiresAt: row.expiresAt,
        platformCommissionPercent: row.platformCommissionPercent,
        commissionFreeMonthlyTurnover: row.commissionFreeMonthlyTurnover,
        commissionGraceEndsAt: row.commissionGraceEndsAt,
        referralPercent: row.referralPercent,
        referralStatus: row.referralStatus,
        referrerUserId: row.referrerUserId,
        supportManagerUserId: row.supportManagerUserId,
        supportManagerPercent: row.supportManagerPercent,
      })),
    now,
  );

  return {
    subscriptionGross: currency(totals.subscriptionGross),
    recognizedRevenue: currency(totals.recognizedRevenue),
    potentialRevenue: currency(totals.potentialRevenue),
    dailyRevenue: currency(totals.dailyRevenue),
    whiteBoxCommission: platform.whiteBoxCommission,
    referralCommission: platform.referralCommission,
    supportManagerCommission: platform.supportManagerCommission,
    companyRecognizedRevenue: platform.companyRecognizedRevenue,
    activeSubscriptions: totals.activeSubscriptions,
    reservedPayouts: currency(reservedPayouts),
    paidPayouts: currency(paidPayouts),
    availableForPayout: Math.max(0, currency(platform.companyRecognizedRevenue - reservedPayouts - paidPayouts)),
    sources: [...sources.values()].map((source) => ({
      ...source,
      dailyRevenue: currency(source.dailyRevenue),
      recognizedRevenue: currency(source.recognizedRevenue),
      potentialRevenue: currency(source.potentialRevenue),
    })),
  };
}

export function evaluatePayoutCoverage(snapshot: CompanyFinancialSnapshot, operation: CompanyPayoutRow) {
  const isReserved =
    operation.type === "PAYOUT_REQUEST" &&
    (operation.status === "PENDING_APPROVAL" || operation.status === "APPROVED");
  const operationAmount = amount(operation.amount);
  const availableBeforeThisRequest = Math.max(
    0,
    currency(
      snapshot.companyRecognizedRevenue -
        snapshot.paidPayouts -
        snapshot.reservedPayouts +
        (isReserved ? operationAmount : 0),
    ),
  );
  return {
    ...snapshot,
    availableBeforeThisRequest,
    requestCovered: operation.type === "PAYOUT_REQUEST" ? operationAmount <= availableBeforeThisRequest : null,
  };
}
