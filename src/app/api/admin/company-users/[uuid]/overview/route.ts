import { NextResponse, type NextRequest } from "next/server";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { calculateCompanyFinancialSnapshot } from "@/lib/finance/company-finance";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function money(value: unknown) {
  return Number(value ?? 0).toFixed(2);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ uuid: string }> }) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;

  const access = await requireAdminScope(session, "COMPANIES", "canView");
  if (!access.ok) return access.response;

  const { uuid } = await params;
  const owner = await prisma.user.findUnique({
    where: { uuid },
    select: {
      id: true,
      uuid: true,
      name: true,
      email: true,
      managedCompany: {
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
        },
      },
    },
  });

  if (!owner?.managedCompany) {
    return NextResponse.json({ message: "Company account was not found" }, { status: 404 });
  }

  const company = owner.managedCompany;
  const now = new Date();
  const [
    subscriptionStatusRows,
    revenueSubscriptions,
    financeOperations,
    billingAccount,
    billingInvoices,
    customerCount,
    customerBalance,
    loyaltyTotals,
    recentPayments,
    verificationApplication,
  ] = await Promise.all([
    prisma.userSubscription.groupBy({
      by: ["status"],
      where: { subscription: { companyId: company.id } },
      _count: true,
    }).catch(() => []),
    prisma.userSubscription.findMany({
      where: {
        status: { in: ["ACTIVE", "EXPIRED"] },
        subscription: { companyId: company.id },
      },
      select: {
        status: true,
        activatedAt: true,
        expiresAt: true,
        subscription: {
          select: {
            companyId: true,
            name: true,
            price: true,
            company: {
              select: {
                platformCommissionPercent: true,
                commissionFreeMonthlyTurnover: true,
                commissionGraceEndsAt: true,
                currentReferral: {
                  select: {
                    status: true,
                    referralPercent: true,
                    referrerUserId: true,
                  },
                },
                supportManagerId: true,
              },
            },
          },
        },
      },
    }).catch(() => []),
    prisma.financeOperation.findMany({
      where: {
        companyId: company.id,
        type: "PAYOUT_REQUEST",
        status: { in: ["PENDING_APPROVAL", "APPROVED", "PAID"] },
      },
      select: { companyId: true, type: true, status: true, amount: true },
    }).catch(() => []),
    prisma.companyBillingAccount.findUnique({ where: { companyId: company.id } }).catch(() => null),
    prisma.companyBillingInvoice.findMany({
      where: { companyId: company.id },
      orderBy: { periodStartsAt: "desc" },
      take: 1,
    }).catch(() => []),
    prisma.userCompany.count({ where: { companyId: company.id } }).catch(() => 0),
    prisma.userCompany.aggregate({
      where: { companyId: company.id },
      _sum: { balance: true },
    }).catch(() => ({ _sum: { balance: 0 } })),
    prisma.loyaltyTransaction.groupBy({
      by: ["type"],
      where: { companyId: company.id },
      _sum: { amount: true },
    }).catch(() => []),
    prisma.payment.findMany({
      where: {
        OR: [
          { companyId: company.id },
          { userId: owner.id, purpose: "COMPANY_NEARLOY_SUBSCRIPTION" },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        uuid: true,
        status: true,
        amount: true,
        currency: true,
        purpose: true,
        description: true,
        paidAt: true,
        createdAt: true,
      },
    }).catch(() => []),
    prisma.companyVerificationApplication.findFirst({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
      select: {
        uuid: true,
        companyName: true,
        contactName: true,
        identityVerificationMode: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }).catch(() => null),
  ]);

  const revenueRows = revenueSubscriptions.map((item) => ({
    companyId: item.subscription.companyId!,
    name: item.subscription.name,
    price: item.subscription.price,
    status: item.status,
    activatedAt: item.activatedAt,
    expiresAt: item.expiresAt,
    platformCommissionPercent: item.subscription.company?.platformCommissionPercent,
    commissionFreeMonthlyTurnover: item.subscription.company?.commissionFreeMonthlyTurnover,
    commissionGraceEndsAt: item.subscription.company?.commissionGraceEndsAt,
    referralPercent: item.subscription.company?.currentReferral?.referralPercent,
    referralStatus: item.subscription.company?.currentReferral?.status,
    referrerUserId: item.subscription.company?.currentReferral?.referrerUserId,
    supportManagerUserId: item.subscription.company?.supportManagerId,
  }));
  const financial = calculateCompanyFinancialSnapshot(company.id, revenueRows, financeOperations, now);
  const statusCounts = subscriptionStatusRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row._count;
    return acc;
  }, {});
  const activeSubscriptions = revenueSubscriptions.filter(
    (item) => item.status === "ACTIVE" && (!item.expiresAt || item.expiresAt > now),
  ).length;
  const expiringIn7Days = revenueSubscriptions.filter(
    (item) =>
      item.status === "ACTIVE" &&
      item.expiresAt &&
      item.expiresAt > now &&
      item.expiresAt <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
  ).length;
  const invoice = billingInvoices[0] ?? null;
  const account =
    billingAccount
      ? {
          status: billingAccount.status,
          trialStartedAt: billingAccount.trialStartedAt,
          trialEndsAt: billingAccount.trialEndsAt,
          currentPeriodStartsAt: billingAccount.currentPeriodStartsAt,
          currentPeriodEndsAt: billingAccount.currentPeriodEndsAt,
        }
      : invoice && (invoice.status === "PAID" || invoice.status === "WAIVED") && invoice.periodEndsAt > now
        ? {
            status: "ACTIVE" as const,
            trialStartedAt: null,
            trialEndsAt: null,
            currentPeriodStartsAt: invoice.periodStartsAt,
            currentPeriodEndsAt: invoice.periodEndsAt,
          }
        : null;
  const pointsEarned = loyaltyTotals.find((row) => row.type === "EARN")?._sum.amount ?? 0;
  const pointsSpent = loyaltyTotals.find((row) => row.type === "SPEND")?._sum.amount ?? 0;

  return NextResponse.json({
    company: {
      owner: { uuid: owner.uuid, name: owner.name, email: owner.email },
      profile: { id: company.id, name: company.name, slug: company.slug, isActive: company.isActive },
      verification: verificationApplication
        ? {
            uuid: verificationApplication.uuid,
            companyName: verificationApplication.companyName,
            contactName: verificationApplication.contactName,
            identityVerificationMode: verificationApplication.identityVerificationMode,
            status: verificationApplication.status,
            createdAt: verificationApplication.createdAt,
            updatedAt: verificationApplication.updatedAt,
          }
        : null,
    },
    billing: {
      account,
      invoice: invoice
        ? {
            uuid: invoice.uuid,
            status: invoice.status,
            periodStartsAt: invoice.periodStartsAt,
            periodEndsAt: invoice.periodEndsAt,
            baseFee: money(invoice.baseFee),
            promoDiscountAmount: money(invoice.promoDiscountAmount),
            commissionCreditAmount: money(invoice.commissionCreditAmount),
            amountDue: money(invoice.amountDue),
            paidAmount: money(invoice.paidAmount),
            paidAt: invoice.paidAt,
          }
        : null,
    },
    userSubscriptions: {
      total: Object.values(statusCounts).reduce((total, count) => total + count, 0),
      active: activeSubscriptions,
      expired: statusCounts.EXPIRED ?? 0,
      canceled: statusCounts.CANCELED ?? 0,
      expiringIn7Days,
    },
    customers: {
      total: customerCount,
      pointsBalance: customerBalance._sum.balance ?? 0,
      pointsEarned,
      pointsSpent,
    },
    financial: {
      subscriptionGross: money(financial.subscriptionGross),
      recognizedRevenue: money(financial.recognizedRevenue),
      companyRecognizedRevenue: money(financial.companyRecognizedRevenue),
      whiteBoxCommission: money(financial.whiteBoxCommission),
      referralCommission: money(financial.referralCommission),
      supportManagerCommission: money(financial.supportManagerCommission),
      reservedPayouts: money(financial.reservedPayouts),
      paidPayouts: money(financial.paidPayouts),
      availableForPayout: money(financial.availableForPayout),
      activeSubscriptions: financial.activeSubscriptions,
      sources: financial.sources,
    },
    recentPayments: recentPayments.map((payment) => ({
      uuid: payment.uuid,
      status: payment.status,
      amount: money(payment.amount),
      currency: payment.currency,
      purpose: payment.purpose,
      description: payment.description,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
    })),
  });
}
