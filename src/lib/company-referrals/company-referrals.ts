import { randomUUID } from "node:crypto";
import { AccountStatus, Prisma, UserRole, type CompanyReferralStatus, type FinanceOperationStatus } from "@prisma/client";
import { supportManagerSharePercent } from "./support-manager";
import { calculatePlatformRevenueSummary, type PlatformRevenueSubscription } from "@/lib/finance/platform-revenue";
import { prisma } from "@/lib/prisma";
import { hasPrPayoutDestination, serializePrPayoutRequisites } from "@/lib/pr-payout/requisites";

export const COMPANY_REFERRAL_PAYOUT_TITLE = "Company referral payout request";
const MIN_REFERRAL_PAYOUT_RUB = 1_000;
const COMPANY_NEARLOY_REFERRAL_PERCENT = 30;
const CUSTOMER_SUBSCRIPTION_REFERRAL_ENABLED = false;
const REFERRAL_PAYOUT_LOCK_NAMESPACE = 79_1337;
export const PUBLIC_COMPANY_REFERRAL_SOURCE = "PUBLIC_REFERRAL";
export const SYSTEM_COMPANY_REFERRAL_SOURCE = "SYSTEM_SUPER_ADMIN";
export const PROMO_COMPANY_REFERRAL_SOURCE = "PROMO_CODE";

type PrismaLike = typeof prisma | Prisma.TransactionClient;
type CompanyReferralRevenueRow = Prisma.CompanyReferralGetPayload<{
  include: {
    referrer: { select: { role: true } };
    company: {
      select: {
        id: true;
        slug: true;
        name: true;
        isActive: true;
        verificationStatus: true;
        platformCommissionPercent: true;
        commissionFreeMonthlyTurnover: true;
        commissionGraceEndsAt: true;
        supportManagerId: true;
        subscriptions: {
          select: {
            id: true;
            price: true;
            userPlans: {
              select: {
                status: true;
                activatedAt: true;
                expiresAt: true;
              };
            };
          };
        };
        billingInvoices: {
          select: {
            status: true;
            paidAmount: true;
          };
        };
      };
    };
  };
}>;

export function normalizeCompanyReferralCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40) : "";
}

function codePrefix(name?: string | null) {
  const source = (name || "WB").toUpperCase().replace(/[^A-Z0-9]+/g, "");
  return (source || "WB").slice(0, 4).padEnd(2, "W");
}

export async function ensureCompanyReferralCode(userId: number, name?: string | null) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { companyReferralCode: true, name: true },
  });
  if (!existing) throw new Error("User not found.");
  if (existing.companyReferralCode) return existing.companyReferralCode;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = `${codePrefix(name ?? existing.name)}-${randomUUID().slice(0, 8).toUpperCase()}`;
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { companyReferralCode: code },
        select: { companyReferralCode: true },
      });
      return updated.companyReferralCode!;
    } catch {
      // Rare collision: retry with a fresh UUID fragment.
    }
  }

  throw new Error("Failed to create referral code.");
}

export async function findCompanyReferralReferrer(code: string) {
  const normalized = normalizeCompanyReferralCode(code);
  if (!normalized) return null;

  return prisma.user.findFirst({
    where: {
      companyReferralCode: normalized,
      accountStatus: "ACTIVE",
    },
    select: { id: true, uuid: true, name: true, email: true, role: true },
  });
}

export async function findFallbackCompanyReferralReferrer(db: PrismaLike = prisma) {
  return db.user.findFirst({
    where: {
      role: UserRole.SUPER_ADMIN,
      accountStatus: AccountStatus.ACTIVE,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, uuid: true, name: true, email: true, role: true },
  });
}

export function isCompanyReferralCommissionable(referral: {
  status: CompanyReferralStatus | string;
  source?: string | null;
  referrer?: { role?: UserRole | string | null } | null;
}) {
  if (referral.status !== "ACTIVE") return false;
  if (referral.source === SYSTEM_COMPANY_REFERRAL_SOURCE) return false;
  if (referral.referrer?.role === UserRole.SUPER_ADMIN) return false;
  return true;
}

export async function attachCompanyReferral(params: {
  tx: Prisma.TransactionClient;
  companyId: number;
  referrerUserId: number;
  source?: string;
  notes?: string | null;
}) {
  const isSystemReferral = params.source === SYSTEM_COMPANY_REFERRAL_SOURCE;
  return params.tx.companyReferral.create({
    data: {
      companyId: params.companyId,
      referrerUserId: params.referrerUserId,
      source: params.source ?? PUBLIC_COMPANY_REFERRAL_SOURCE,
      pipelineStatus: isSystemReferral ? "CONNECTED" : "LEAD",
      referralPercent: isSystemReferral ? 0 : 1,
      notes: params.notes ?? null,
    },
  });
}

export async function reassignCompanyReferralFromSystemToPromoOwner(params: {
  tx: Prisma.TransactionClient;
  companyId: number;
  promoCode: string;
  promoOwner?: {
    id: number;
    role?: UserRole | string | null;
    accountStatus?: string | null;
  } | null;
}) {
  const owner = params.promoOwner;
  if (!owner || owner.accountStatus !== AccountStatus.ACTIVE || owner.role !== UserRole.MANAGER) {
    return { changed: false, reason: "PROMO_OWNER_IS_NOT_PR_MANAGER" };
  }

  const current = await params.tx.companyReferral.findUnique({
    where: { companyId: params.companyId },
    include: { referrer: { select: { id: true, role: true } } },
  });

  if (current && current.referrerUserId !== owner.id && isCompanyReferralCommissionable(current)) {
    return { changed: false, reason: "COMPANY_ALREADY_HAS_PR_MANAGER" };
  }

  const data = {
    referrerUserId: owner.id,
    status: "ACTIVE" as const,
    pipelineStatus: "CONNECTED" as const,
    source: PROMO_COMPANY_REFERRAL_SOURCE,
    referralPercent: new Prisma.Decimal(COMPANY_NEARLOY_REFERRAL_PERCENT),
    endedAt: null,
    notes: `Promo code ${params.promoCode} applied.`,
  };

  if (current) {
    await params.tx.companyReferral.update({
      where: { companyId: params.companyId },
      data,
    });
    return { changed: true, reason: "SYSTEM_REFERRAL_REASSIGNED" };
  }

  await params.tx.companyReferral.create({
    data: {
      companyId: params.companyId,
      ...data,
    },
  });
  return { changed: true, reason: "PROMO_REFERRAL_CREATED" };
}

function statusLabel(status: CompanyReferralStatus) {
  if (status === "ACTIVE") return "Активна";
  if (status === "PAUSED") return "На паузе";
  return "Завершена";
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function referralMoney(value: number) {
  return Math.round(money(value) / 10) * 10;
}

function toRevenueRows(referrals: CompanyReferralRevenueRow[]) {
  const rows: PlatformRevenueSubscription[] = [];

  for (const referral of referrals) {
    const referralIsCommissionable = isCompanyReferralCommissionable(referral);
    for (const subscription of referral.company.subscriptions) {
      for (const userPlan of subscription.userPlans) {
        rows.push({
          companyId: referral.companyId,
          companyName: referral.company.name,
          price: subscription.price,
          status: userPlan.status,
          activatedAt: userPlan.activatedAt,
          expiresAt: userPlan.expiresAt,
          platformCommissionPercent: referral.company.platformCommissionPercent,
          commissionFreeMonthlyTurnover: referral.company.commissionFreeMonthlyTurnover,
          commissionGraceEndsAt: referral.company.commissionGraceEndsAt,
          supportManagerUserId: referral.company.supportManagerId,
          supportManagerPercent: supportManagerSharePercent(),
          referralPercent: referralIsCommissionable ? referral.referralPercent : new Prisma.Decimal(0),
          referralStatus: referralIsCommissionable ? referral.status : "ENDED",
          referrerUserId: referralIsCommissionable ? referral.referrerUserId : null,
        });
      }
    }
  }

  return rows;
}

function calculateCompanyReferralRevenueSummary(referrals: CompanyReferralRevenueRow[]) {
  const customerSubscriptionSummary = calculatePlatformRevenueSummary(toRevenueRows(referrals));
  const customerSubscriptionByCompany = new Map(
    customerSubscriptionSummary.companies.map((company) => [company.companyId, company]),
  );

  const companies = referrals.map((referral) => {
    const customerSubscriptionRevenue = customerSubscriptionByCompany.get(referral.companyId);
    const referralIsCommissionable = isCompanyReferralCommissionable(referral);
    const paidNearLoyGross =
      referralIsCommissionable
        ? referral.company.billingInvoices
            .filter((invoice) => invoice.status === "PAID")
            .reduce((sum, invoice) => sum + Number(invoice.paidAmount), 0)
        : 0;
    const nearLoyReferralCommission = referralIsCommissionable
      ? referralMoney(paidNearLoyGross * (COMPANY_NEARLOY_REFERRAL_PERCENT / 100))
      : 0;
    const customerSubscriptionReferralCommission = CUSTOMER_SUBSCRIPTION_REFERRAL_ENABLED
      ? (customerSubscriptionRevenue?.referralCommission ?? 0)
      : 0;
    const referralCommission = nearLoyReferralCommission + customerSubscriptionReferralCommission;

    return {
      companyId: referral.companyId,
      companyName: referral.company.name,
      gross: money(paidNearLoyGross),
      recognizedGross: money(paidNearLoyGross),
      futureGross: 0,
      whiteBoxCommission: money(Math.max(0, paidNearLoyGross - referralCommission)),
      referralCommission: money(referralCommission),
      nearLoyReferralCommission: money(nearLoyReferralCommission),
      customerSubscriptionReferralCommission: money(customerSubscriptionReferralCommission),
      activeSubscriptions: customerSubscriptionRevenue?.activeSubscriptions ?? 0,
      referralUserId: referralIsCommissionable ? referral.referrerUserId : null,
    };
  });

  return {
    gross: money(companies.reduce((sum, company) => sum + company.gross, 0)),
    recognizedGross: money(companies.reduce((sum, company) => sum + company.recognizedGross, 0)),
    futureGross: money(companies.reduce((sum, company) => sum + company.futureGross, 0)),
    whiteBoxCommission: money(companies.reduce((sum, company) => sum + company.whiteBoxCommission, 0)),
    referralCommission: money(companies.reduce((sum, company) => sum + company.referralCommission, 0)),
    nearLoyReferralCommission: money(companies.reduce((sum, company) => sum + company.nearLoyReferralCommission, 0)),
    customerSubscriptionReferralCommission: money(
      companies.reduce((sum, company) => sum + company.customerSubscriptionReferralCommission, 0),
    ),
    activeSubscriptions: companies.reduce((sum, company) => sum + company.activeSubscriptions, 0),
    companiesWithReferral: companies.filter((company) => company.referralUserId !== null).length,
    companies,
  };
}

async function loadReferralRows(userId: number, db: PrismaLike = prisma) {
  return db.companyReferral.findMany({
    where: { referrerUserId: userId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      referrer: { select: { role: true } },
      company: {
        select: {
          id: true,
          slug: true,
          name: true,
          isActive: true,
          verificationStatus: true,
          platformCommissionPercent: true,
          commissionFreeMonthlyTurnover: true,
          commissionGraceEndsAt: true,
          supportManagerId: true,
          subscriptions: {
            select: {
              id: true,
              price: true,
              userPlans: {
                where: { status: { in: ["ACTIVE", "EXPIRED"] } },
                select: { status: true, activatedAt: true, expiresAt: true },
              },
            },
          },
          billingInvoices: {
            select: {
              status: true,
              paidAmount: true,
            },
          },
        },
      },
    },
  });
}

async function loadReferralPayouts(userId: number, db: PrismaLike = prisma) {
  return db.financeOperation.findMany({
    where: {
      requestedById: userId,
      companyId: null,
      type: "PAYOUT_REQUEST",
      title: { startsWith: COMPANY_REFERRAL_PAYOUT_TITLE },
    },
    select: { uuid: true, amount: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCompanyReferralDashboard(userId: number) {
  const code = await ensureCompanyReferralCode(userId);
  const [user, referrals, payouts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        prPayoutBankCode: true,
        prPayoutBankName: true,
        prPayoutPhone: true,
        prPayoutCardLast4: true,
        prPayoutRequisitesUpdatedAt: true,
      },
    }),
    loadReferralRows(userId),
    loadReferralPayouts(userId),
  ]);
  const summary = calculateCompanyReferralRevenueSummary(referrals);
  const companyRevenue = new Map(summary.companies.map((company) => [company.companyId, company]));
  const reservedStatuses = new Set<FinanceOperationStatus>(["PENDING_APPROVAL", "APPROVED"]);
  const paidStatuses = new Set<FinanceOperationStatus>(["PAID"]);
  const reserved = money(payouts.filter((row) => reservedStatuses.has(row.status)).reduce((sum, row) => sum + Number(row.amount), 0));
  const paid = money(payouts.filter((row) => paidStatuses.has(row.status)).reduce((sum, row) => sum + Number(row.amount), 0));
  const available = money(Math.max(0, summary.referralCommission - reserved - paid));

  return {
    code,
    minPayoutRub: MIN_REFERRAL_PAYOUT_RUB,
    requisites: serializePrPayoutRequisites(user ?? {}),
    totals: {
      companies: referrals.length,
      activeCompanies: referrals.filter((row) => row.status === "ACTIVE" && row.company.isActive).length,
      recognizedGross: summary.recognizedGross,
      futureGross: summary.futureGross,
      referralCommission: summary.referralCommission,
      reserved,
      paid,
      available,
    },
    companies: referrals.map((referral) => {
      const revenue = companyRevenue.get(referral.companyId);
      return {
        slug: referral.company.slug,
        name: referral.company.name,
        status: referral.status,
        statusLabel: statusLabel(referral.status),
        pipelineStatus: referral.pipelineStatus,
        verificationStatus: referral.company.verificationStatus,
        isActive: referral.company.isActive,
        referralPercent: Number(referral.referralPercent),
        startedAt: referral.startedAt.toISOString(),
        recognizedGross: revenue?.recognizedGross ?? 0,
        futureGross: revenue?.futureGross ?? 0,
        referralCommission: revenue?.referralCommission ?? 0,
        activeSubscriptions: revenue?.activeSubscriptions ?? 0,
      };
    }),
    payouts: payouts.map((row) => ({
      uuid: row.uuid,
      amount: Number(row.amount),
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export async function createCompanyReferralPayoutRequest(userId: number, amount: number) {
  if (!Number.isFinite(amount) || amount < MIN_REFERRAL_PAYOUT_RUB) {
    throw new Error(`Минимальная сумма выплаты - ${MIN_REFERRAL_PAYOUT_RUB} ₽.`);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { prPayoutBankName: true, prPayoutPhone: true, prPayoutCardLast4: true },
  });

  if (!user || !hasPrPayoutDestination(user)) {
    throw new Error("Перед созданием выплаты сохраните банк и телефон или карту.");
  }

  return prisma.$transaction(async (tx) => {
    // Serialize payout reservations per referrer so concurrent requests cannot reserve the same balance twice.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${REFERRAL_PAYOUT_LOCK_NAMESPACE}, ${userId})`;

    const referrals = await loadReferralRows(userId, tx);
    const payouts = await loadReferralPayouts(userId, tx);
    const summary = calculateCompanyReferralRevenueSummary(referrals);
    const reservedOrPaid = payouts
      .filter((row) => ["PENDING_APPROVAL", "APPROVED", "PAID"].includes(row.status))
      .reduce((sum, row) => sum + Number(row.amount), 0);
    const available = money(Math.max(0, summary.referralCommission - reservedOrPaid));

    if (amount > available) {
      throw new Error(`Доступно к выплате ${available} ₽.`);
    }

    const operation = await tx.financeOperation.create({
      data: {
        type: "PAYOUT_REQUEST",
        status: "PENDING_APPROVAL",
        amount,
        currency: "RUB",
        title: `${COMPANY_REFERRAL_PAYOUT_TITLE}: ${amount} RUB`,
        details: "Public company referral payout request. Source: 30% of paid company NearLoy subscriptions. Customer subscription turnover commission is disabled for launch.",
        requestedById: userId,
        requestedAt: new Date(),
      },
    });

    await tx.auditEvent.create({
      data: {
        workspace: "MANAGER",
        level: "WARN",
        category: "BILLING",
        action: "Company referral payout requested",
        actorUserId: userId,
        actorLabel: `user:${userId}`,
        targetUuid: operation.uuid,
        targetLabel: operation.title,
        details: `${amount} RUB`,
        tags: ["#BILLING", "#REFERRAL"],
      },
    });

    return operation;
  });
}

export async function calculateCompanyReferralPayoutCoverage(
  userId: number,
  operation?: { uuid?: string; amount?: Prisma.Decimal | number | string; status?: FinanceOperationStatus } | null,
  db: PrismaLike = prisma,
) {
  const [referrals, payouts] = await Promise.all([loadReferralRows(userId, db), loadReferralPayouts(userId, db)]);
  const summary = calculateCompanyReferralRevenueSummary(referrals);
  const reservedStatuses = new Set<FinanceOperationStatus>(["PENDING_APPROVAL", "APPROVED"]);
  const paidStatuses = new Set<FinanceOperationStatus>(["PAID"]);
  const reserved = money(
    payouts.filter((row) => reservedStatuses.has(row.status)).reduce((sum, row) => sum + Number(row.amount), 0),
  );
  const paid = money(payouts.filter((row) => paidStatuses.has(row.status)).reduce((sum, row) => sum + Number(row.amount), 0));
  const available = money(Math.max(0, summary.referralCommission - reserved - paid));
  const currentAmount = Number(operation?.amount ?? 0);
  const currentReserved =
    operation?.status && (reservedStatuses.has(operation.status) || paidStatuses.has(operation.status)) ? currentAmount : 0;
  const availableBeforeThisRequest = money(available + currentReserved);

  return {
    companies: referrals.length,
    activeCompanies: referrals.filter((row) => row.status === "ACTIVE" && row.company.isActive).length,
    recognizedGross: summary.recognizedGross,
    futureGross: summary.futureGross,
    referralCommission: summary.referralCommission,
    reserved,
    paid,
    available,
    availableBeforeThisRequest,
    requestCovered: currentAmount > 0 ? availableBeforeThisRequest >= currentAmount : null,
  };
}

export async function getCompanyReferralLiabilityReport(db: PrismaLike = prisma) {
  const [referrals, payouts] = await Promise.all([
    db.companyReferral.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        referrer: { select: { id: true, uuid: true, name: true, email: true, role: true } },
        company: {
          select: {
            id: true,
            slug: true,
            name: true,
            isActive: true,
            verificationStatus: true,
            platformCommissionPercent: true,
            commissionFreeMonthlyTurnover: true,
            commissionGraceEndsAt: true,
            supportManagerId: true,
            subscriptions: {
              select: {
                id: true,
                price: true,
                userPlans: {
                  where: { status: { in: ["ACTIVE", "EXPIRED"] } },
                  select: { status: true, activatedAt: true, expiresAt: true },
                },
              },
            },
            billingInvoices: {
              select: {
                status: true,
                paidAmount: true,
              },
            },
          },
        },
      },
    }),
    db.financeOperation.findMany({
      where: {
        companyId: null,
        type: "PAYOUT_REQUEST",
        title: { startsWith: COMPANY_REFERRAL_PAYOUT_TITLE },
        status: { in: ["PENDING_APPROVAL", "APPROVED", "PAID"] },
        requestedById: { not: null },
      },
      select: { requestedById: true, amount: true, status: true },
    }),
  ]);

  const summary = calculateCompanyReferralRevenueSummary(referrals);
  const byAgent = new Map<
    number,
    {
      userId: number;
      uuid: string;
      name: string;
      email: string;
      companies: number;
      activeCompanies: number;
      recognizedGross: number;
      referralCommission: number;
      reserved: number;
      paid: number;
      availableBalance: number;
      unpaidTotal: number;
    }
  >();

  for (const referral of referrals) {
    const existing = byAgent.get(referral.referrerUserId);
    if (existing) {
      existing.companies += 1;
      existing.activeCompanies += referral.status === "ACTIVE" && referral.company.isActive ? 1 : 0;
      continue;
    }
    byAgent.set(referral.referrerUserId, {
      userId: referral.referrerUserId,
      uuid: referral.referrer.uuid,
      name: referral.referrer.name || referral.referrer.email,
      email: referral.referrer.email,
      companies: 1,
      activeCompanies: referral.status === "ACTIVE" && referral.company.isActive ? 1 : 0,
      recognizedGross: 0,
      referralCommission: 0,
      reserved: 0,
      paid: 0,
      availableBalance: 0,
      unpaidTotal: 0,
    });
  }

  for (const company of summary.companies) {
    if (!company.referralUserId) continue;
    const agent = byAgent.get(company.referralUserId);
    if (!agent) continue;
    agent.recognizedGross = money(agent.recognizedGross + company.recognizedGross);
    agent.referralCommission = money(agent.referralCommission + company.referralCommission);
  }

  for (const payout of payouts) {
    if (!payout.requestedById) continue;
    const agent = byAgent.get(payout.requestedById);
    if (!agent) continue;
    if (payout.status === "PAID") {
      agent.paid = money(agent.paid + Number(payout.amount));
    } else {
      agent.reserved = money(agent.reserved + Number(payout.amount));
    }
  }

  const agents = [...byAgent.values()]
    .map((agent) => ({
      ...agent,
      availableBalance: money(Math.max(0, agent.referralCommission - agent.reserved - agent.paid)),
      unpaidTotal: money(Math.max(0, agent.referralCommission - agent.paid)),
    }))
    .filter((agent) => agent.unpaidTotal > 0)
    .sort((left, right) => right.unpaidTotal - left.unpaidTotal);

  return {
    generatedAt: new Date().toISOString(),
    agentsWithDebt: agents.length,
    totalUnpaid: money(agents.reduce((sum, agent) => sum + agent.unpaidTotal, 0)),
    totalAvailableBalance: money(agents.reduce((sum, agent) => sum + agent.availableBalance, 0)),
    totalReserved: money(agents.reduce((sum, agent) => sum + agent.reserved, 0)),
    totalPaid: money(agents.reduce((sum, agent) => sum + agent.paid, 0)),
    topAgents: agents.slice(0, 20).map((agent) => ({
      ...agent,
      userUrl: `/admin/users/${agent.uuid}`,
      financeUrl: "/admin/finance",
    })),
  };
}

