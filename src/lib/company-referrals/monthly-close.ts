import { AccountStatus, Prisma, UserRole, type FinanceOperationStatus } from "@prisma/client";
import {
  COMPANY_REFERRAL_PAYOUT_TITLE,
  isCompanyReferralCommissionable,
} from "@/lib/company-referrals/company-referrals";
import { prisma } from "@/lib/prisma";

type PrismaLike = typeof prisma | Prisma.TransactionClient;

const MOSCOW_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;
const ACTIVE_PAYOUT_STATUSES: FinanceOperationStatus[] = ["PENDING_APPROVAL", "APPROVED", "PAID"];

export const COMPANY_REFERRAL_MONTHLY_PAYOUT_TITLE = `${COMPANY_REFERRAL_PAYOUT_TITLE} monthly close`;

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function referralMoney(value: number) {
  return Math.round(money(value) / 10) * 10;
}

function fallbackAgent(referrerUserId: number) {
  return {
    uuid: `missing-user-${referrerUserId}`,
    name: `Deleted PR user #${referrerUserId}`,
    email: "deleted-pr-user@deleted.nearloy.local",
  };
}

function fallbackCompany(companyId: number) {
  return {
    id: companyId,
    slug: `missing-company-${companyId}`,
    name: `Deleted company #${companyId}`,
    isActive: false,
    billingInvoices: [],
  };
}

function moscowParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function moscowMonthStart(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1) - MOSCOW_UTC_OFFSET_MS);
}

export function getMoscowMonthPeriod(year: number, month: number) {
  const start = moscowMonthStart(year, month);
  const end = month === 12 ? moscowMonthStart(year + 1, 1) : moscowMonthStart(year, month + 1);
  return {
    key: `${year}-${String(month).padStart(2, "0")}`,
    start,
    end,
  };
}

export function getCurrentMoscowMonthPeriod(now = new Date()) {
  const parts = moscowParts(now);
  return getMoscowMonthPeriod(parts.year, parts.month);
}

export function getPreviousMoscowMonthPeriod(now = new Date()) {
  const parts = moscowParts(now);
  return parts.month === 1 ? getMoscowMonthPeriod(parts.year - 1, 12) : getMoscowMonthPeriod(parts.year, parts.month - 1);
}

export function canClosePreviousPrMonth(now = new Date()) {
  return moscowParts(now).day === 1;
}

export function monthlyPayoutTitle(periodKey: string) {
  return `${COMPANY_REFERRAL_MONTHLY_PAYOUT_TITLE}: ${periodKey}`;
}

async function loadPrAgents(db: PrismaLike, userId?: number | null) {
  return db.user.findMany({
    where: userId
      ? { id: userId }
      : {
          accountStatus: AccountStatus.ACTIVE,
          role: UserRole.MANAGER,
          permissions: { some: { scope: "PR", canView: true } },
        },
    select: {
      id: true,
      uuid: true,
      name: true,
      email: true,
      companyReferralCode: true,
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
}

async function loadMonthlyReferrals(db: PrismaLike, period: { start: Date; end: Date }, userId?: number | null) {
  return db.companyReferral.findMany({
    where: userId ? { referrerUserId: userId } : {},
    include: {
      referrer: { select: { id: true, uuid: true, name: true, email: true, role: true } },
      company: {
        select: {
          id: true,
          slug: true,
          name: true,
          isActive: true,
          billingInvoices: {
            where: {
              status: "PAID",
              OR: [
                { paidAt: { gte: period.start, lt: period.end } },
                { paidAt: null, createdAt: { gte: period.start, lt: period.end } },
              ],
            },
            select: { paidAmount: true, paidAt: true, createdAt: true },
          },
        },
      },
    },
  });
}

async function loadMonthlyPayouts(db: PrismaLike, periodKey: string, userId?: number | null) {
  return db.financeOperation.findMany({
    where: {
      type: "PAYOUT_REQUEST",
      companyId: null,
      requestedById: userId ? userId : { not: null },
      title: { startsWith: monthlyPayoutTitle(periodKey) },
      status: { in: ACTIVE_PAYOUT_STATUSES },
    },
    select: { requestedById: true, amount: true, status: true },
  });
}

export async function getCompanyReferralMonthlyReport(params: {
  scope: "ALL" | "OWN";
  userId?: number;
  period?: { key: string; start: Date; end: Date };
  now?: Date;
  db?: PrismaLike;
}) {
  const db = params.db ?? prisma;
  const period = params.period ?? getCurrentMoscowMonthPeriod(params.now);
  const userId = params.scope === "OWN" ? params.userId : undefined;
  const [agents, referrals, payouts] = await Promise.all([
    loadPrAgents(db, userId),
    loadMonthlyReferrals(db, period, userId),
    loadMonthlyPayouts(db, period.key, userId),
  ]);

  const byAgent = new Map(
    agents.map((agent) => [
      agent.id,
      {
        userId: agent.id,
        uuid: agent.uuid,
        name: agent.name || agent.email,
        email: agent.email,
        referralCode: agent.companyReferralCode,
        companies: 0,
        activeCompanies: 0,
        monthlyGross: 0,
        monthlyReferralCommission: 0,
        closedAmount: 0,
        paidAmount: 0,
        pendingAmount: 0,
        availableToClose: 0,
      },
    ]),
  );

  for (const referral of referrals) {
    const company = referral.company ?? fallbackCompany(referral.companyId);
    if (!byAgent.has(referral.referrerUserId) && params.scope === "ALL") {
      const referrer = referral.referrer ?? fallbackAgent(referral.referrerUserId);
      byAgent.set(referral.referrerUserId, {
        userId: referral.referrerUserId,
        uuid: referrer.uuid,
        name: referrer.name || referrer.email,
        email: referrer.email,
        referralCode: null,
        companies: 0,
        activeCompanies: 0,
        monthlyGross: 0,
        monthlyReferralCommission: 0,
        closedAmount: 0,
        paidAmount: 0,
        pendingAmount: 0,
        availableToClose: 0,
      });
    }
    const agent = byAgent.get(referral.referrerUserId);
    if (!agent) continue;
    agent.companies += 1;
    if (referral.status === "ACTIVE" && company.isActive) agent.activeCompanies += 1;
    if (!isCompanyReferralCommissionable(referral)) continue;

    const gross = company.billingInvoices.reduce((sum, invoice) => sum + Number(invoice.paidAmount), 0);
    const commission = referralMoney(gross * 0.3);
    agent.monthlyGross = money(agent.monthlyGross + gross);
    agent.monthlyReferralCommission = money(agent.monthlyReferralCommission + commission);
  }

  for (const payout of payouts) {
    if (!payout.requestedById) continue;
    const agent = byAgent.get(payout.requestedById);
    if (!agent) continue;
    const amount = Number(payout.amount);
    agent.closedAmount = money(agent.closedAmount + amount);
    if (payout.status === "PAID") agent.paidAmount = money(agent.paidAmount + amount);
    else agent.pendingAmount = money(agent.pendingAmount + amount);
  }

  const agentsList = [...byAgent.values()]
    .map((agent) => ({
      ...agent,
      availableToClose: money(Math.max(0, agent.monthlyReferralCommission - agent.closedAmount)),
    }))
    .sort((left, right) => right.monthlyReferralCommission - left.monthlyReferralCommission || left.name.localeCompare(right.name));

  return {
    period: {
      key: period.key,
      startsAt: period.start.toISOString(),
      endsAt: period.end.toISOString(),
    },
    totals: {
      agents: agentsList.length,
      companies: agentsList.reduce((sum, agent) => sum + agent.companies, 0),
      activeCompanies: agentsList.reduce((sum, agent) => sum + agent.activeCompanies, 0),
      monthlyGross: money(agentsList.reduce((sum, agent) => sum + agent.monthlyGross, 0)),
      monthlyReferralCommission: money(agentsList.reduce((sum, agent) => sum + agent.monthlyReferralCommission, 0)),
      closedAmount: money(agentsList.reduce((sum, agent) => sum + agent.closedAmount, 0)),
      paidAmount: money(agentsList.reduce((sum, agent) => sum + agent.paidAmount, 0)),
      pendingAmount: money(agentsList.reduce((sum, agent) => sum + agent.pendingAmount, 0)),
      availableToClose: money(agentsList.reduce((sum, agent) => sum + agent.availableToClose, 0)),
    },
    agents: agentsList,
  };
}

export async function closePreviousCompanyReferralMonth(params: {
  actorUserId: number;
  now?: Date;
  db?: PrismaLike;
}) {
  const db = params.db ?? prisma;
  const now = params.now ?? new Date();
  const period = getPreviousMoscowMonthPeriod(now);
  const report = await getCompanyReferralMonthlyReport({ scope: "ALL", period, now, db });
  const payableAgents = report.agents.filter((agent) => agent.availableToClose > 0);

  const operations = [];
  for (const agent of payableAgents) {
    const existing = await db.financeOperation.findFirst({
      where: {
        type: "PAYOUT_REQUEST",
        companyId: null,
        requestedById: agent.userId,
        title: { startsWith: monthlyPayoutTitle(period.key) },
        status: { in: ACTIVE_PAYOUT_STATUSES },
      },
      select: { uuid: true, amount: true, status: true, createdAt: true },
    });
    if (existing) {
      operations.push({ ...existing, amount: Number(existing.amount), created: false });
      continue;
    }

    const snapshot = {
      kind: "PR_MONTHLY_CLOSE",
      period: report.period,
      agent: {
        userId: agent.userId,
        uuid: agent.uuid,
        name: agent.name,
        email: agent.email,
        referralCode: agent.referralCode,
      },
      companies: agent.companies,
      activeCompanies: agent.activeCompanies,
      monthlyGross: agent.monthlyGross,
      monthlyReferralCommission: agent.monthlyReferralCommission,
      closedBefore: agent.closedAmount,
      amount: agent.availableToClose,
    };

    const operation = await db.financeOperation.create({
      data: {
        type: "PAYOUT_REQUEST",
        status: "PENDING_APPROVAL",
        amount: agent.availableToClose,
        currency: "RUB",
        title: `${monthlyPayoutTitle(period.key)}: ${agent.name} · ${agent.availableToClose} RUB`,
        details: JSON.stringify(snapshot, null, 2),
        requestedById: agent.userId,
        requestedAt: now,
      },
      select: { uuid: true, amount: true, status: true, createdAt: true },
    });
    operations.push({ ...operation, amount: Number(operation.amount), created: true });
  }

  await db.auditEvent.create({
    data: {
      workspace: "MANAGER",
      level: "WARN",
      category: "BILLING",
      action: "PR month closed",
      actorUserId: params.actorUserId,
      actorLabel: `user:${params.actorUserId}`,
      targetLabel: period.key,
      details: `${operations.filter((operation) => operation.created).length} PR payout operations generated for ${period.key}.`,
      tags: ["#BILLING", "#PR", "#MONTHLY_CLOSE"],
    },
  });

  return {
    period: report.period,
    generated: operations.filter((operation) => operation.created).length,
    skippedExisting: operations.filter((operation) => !operation.created).length,
    totalAmount: money(operations.reduce((sum, operation) => sum + Number(operation.amount), 0)),
    operations,
  };
}
