import { randomUUID } from "node:crypto";
import type { CompanyReferralStatus, FinanceOperationStatus, Prisma } from "@prisma/client";
import { supportManagerSharePercent } from "./support-manager";
import { calculatePlatformRevenueSummary, type PlatformRevenueSubscription } from "@/lib/finance/platform-revenue";
import { prisma } from "@/lib/prisma";

const COMPANY_REFERRAL_PAYOUT_TITLE = "Company referral payout request";
const MIN_REFERRAL_PAYOUT_RUB = 5_000;

type PrismaLike = typeof prisma | Prisma.TransactionClient;
type CompanyReferralRevenueRow = Prisma.CompanyReferralGetPayload<{
  include: {
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
    select: { id: true, uuid: true, name: true, email: true },
  });
}

export async function attachCompanyReferral(params: {
  tx: Prisma.TransactionClient;
  companyId: number;
  referrerUserId: number;
  source?: string;
  notes?: string | null;
}) {
  return params.tx.companyReferral.create({
    data: {
      companyId: params.companyId,
      referrerUserId: params.referrerUserId,
      source: params.source ?? "PUBLIC_REFERRAL",
      pipelineStatus: "LEAD",
      referralPercent: 1,
      notes: params.notes ?? null,
    },
  });
}

function statusLabel(status: CompanyReferralStatus) {
  if (status === "ACTIVE") return "Активна";
  if (status === "PAUSED") return "На паузе";
  return "Завершена";
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function toRevenueRows(referrals: CompanyReferralRevenueRow[]) {
  const rows: PlatformRevenueSubscription[] = [];

  for (const referral of referrals) {
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
          referralPercent: referral.referralPercent,
          referralStatus: referral.status,
          referrerUserId: referral.referrerUserId,
        });
      }
    }
  }

  return rows;
}

async function loadReferralRows(userId: number, db: PrismaLike = prisma) {
  return db.companyReferral.findMany({
    where: { referrerUserId: userId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
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
  const [referrals, payouts] = await Promise.all([loadReferralRows(userId), loadReferralPayouts(userId)]);
  const summary = calculatePlatformRevenueSummary(toRevenueRows(referrals));
  const companyRevenue = new Map(summary.companies.map((company) => [company.companyId, company]));
  const reservedStatuses = new Set<FinanceOperationStatus>(["PENDING_APPROVAL", "APPROVED"]);
  const paidStatuses = new Set<FinanceOperationStatus>(["PAID"]);
  const reserved = money(payouts.filter((row) => reservedStatuses.has(row.status)).reduce((sum, row) => sum + Number(row.amount), 0));
  const paid = money(payouts.filter((row) => paidStatuses.has(row.status)).reduce((sum, row) => sum + Number(row.amount), 0));
  const available = money(Math.max(0, summary.referralCommission - reserved - paid));

  return {
    code,
    minPayoutRub: MIN_REFERRAL_PAYOUT_RUB,
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

  return prisma.$transaction(async (tx) => {
    const referrals = await loadReferralRows(userId, tx);
    const payouts = await loadReferralPayouts(userId, tx);
    const summary = calculatePlatformRevenueSummary(toRevenueRows(referrals));
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
        details: "Public company referral payout request. Source: invited companies and recognized subscription turnover, paid from the WhiteBox share.",
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

