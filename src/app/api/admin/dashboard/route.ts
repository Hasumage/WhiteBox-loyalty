import { NextResponse, type NextRequest } from "next/server";
import type { AdminTaskSource, CompanyReferralPipelineStatus } from "@prisma/client";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { resolveEffectivePermissions } from "@/lib/admin/access-control";
import { ACTIVE_ADMIN_TASK_STATUSES, syncAdminTasksFromSignals } from "@/lib/admin/admin-tasks";
import { calculatePlatformRevenueSummary } from "@/lib/finance/platform-revenue";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function allowedSourcesFor(role: string, permissions: Array<{ scope: string; canView: boolean; canEdit: boolean; canApprove: boolean }>) {
  const effective = resolveEffectivePermissions(role, permissions);
  const can = new Map(effective.map((permission) => [permission.scope, permission.canView]));
  return [
    ...(can.get("AUDIT") ? ["AUDIT" as const] : []),
    ...(can.get("COMPANY_VERIFICATIONS") ? ["COMPANY_VERIFICATION" as const] : []),
    ...(can.get("FINANCE") ? ["FINANCE" as const] : []),
  ];
}

export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;

  await syncAdminTasksFromSignals();

  const actor = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      role: true,
      permissions: { select: { scope: true, canView: true, canEdit: true, canApprove: true } },
    },
  });
  const effectivePermissions = resolveEffectivePermissions(actor?.role ?? session.role, actor?.permissions ?? []);
  const seesPr = effectivePermissions.some((permission) => permission.scope === "PR" && permission.canView);
  const sources = allowedSourcesFor(actor?.role ?? session.role, actor?.permissions ?? []);
  const visibleTaskWhere = { source: { in: sources as AdminTaskSource[] } };
  const openWhere = { ...visibleTaskWhere, status: { in: [...ACTIVE_ADMIN_TASK_STATUSES] } };
  const seesVerification = sources.includes("COMPANY_VERIFICATION");
  const seesFinance = sources.includes("FINANCE");
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 6);

  const [
    usersTotal,
    usersActive,
    companiesActive,
    subscriptionsActive,
    verificationOpen,
    pendingFinance,
    openTasks,
    criticalTasks,
    recentTasks,
    recentTaskEvents,
    revenueSubscriptions,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { accountStatus: "ACTIVE" } }),
    prisma.company.count({ where: { isActive: true } }),
    prisma.userSubscription.count({ where: { status: "ACTIVE" } }),
    seesVerification
      ? prisma.companyVerificationApplication.count({ where: { status: { in: ["SUBMITTED", "REVIEWING"] } } })
      : Promise.resolve(0),
    seesFinance ? prisma.financeOperation.count({ where: { status: "PENDING_APPROVAL" } }) : Promise.resolve(0),
    prisma.adminTask.count({ where: openWhere }),
    prisma.adminTask.count({ where: { ...openWhere, priority: "CRITICAL" } }),
    prisma.adminTask.findMany({
      where: openWhere,
      orderBy: { createdAt: "asc" },
      take: 32,
      include: { assignedTo: { select: { name: true } } },
    }),
    prisma.adminTask.findMany({
      where: { ...visibleTaskWhere, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    seesFinance
      ? prisma.userSubscription.findMany({
          where: { status: { in: ["ACTIVE", "EXPIRED"] }, subscription: { companyId: { not: null } } },
          select: {
            status: true,
            activatedAt: true,
            expiresAt: true,
            subscription: {
              select: {
                name: true,
                price: true,
                company: {
                  select: {
                    id: true,
                    name: true,
                    platformCommissionPercent: true,
                    commissionFreeMonthlyTurnover: true,
                    commissionGraceEndsAt: true,
                    supportManagerId: true,
                    currentReferral: {
                      select: {
                        referrerUserId: true,
                        referralPercent: true,
                        status: true,
                      },
                    },
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const platformRevenue = calculatePlatformRevenueSummary(
    revenueSubscriptions
      .filter((row) => row.subscription.company)
      .map((row) => ({
        companyId: row.subscription.company!.id,
        companyName: row.subscription.company!.name,
        price: row.subscription.price,
        status: row.status,
        activatedAt: row.activatedAt,
        expiresAt: row.expiresAt,
        platformCommissionPercent: row.subscription.company!.platformCommissionPercent,
        commissionFreeMonthlyTurnover: row.subscription.company!.commissionFreeMonthlyTurnover,
        commissionGraceEndsAt: row.subscription.company!.commissionGraceEndsAt,
        supportManagerUserId: row.subscription.company!.supportManagerId,
        supportManagerPercent: 1,
        referrerUserId: row.subscription.company!.currentReferral?.referrerUserId ?? null,
        referralPercent: row.subscription.company!.currentReferral?.referralPercent ?? null,
        referralStatus: row.subscription.company!.currentReferral?.status ?? null,
      })),
    new Date(),
  );

  let prDashboard = null;
  if (seesPr) {
    const seesAllReferrals = actor?.role === "SUPER_ADMIN" || actor?.role === "ADMIN";
    const referralRows = await prisma.companyReferral.findMany({
      where: seesAllReferrals ? {} : { referrerUserId: session.userId },
      orderBy: [{ status: "asc" }, { startedAt: "desc" }],
      include: {
        referrer: { select: { id: true, uuid: true, name: true, email: true, role: true } },
        company: { select: { id: true, name: true, slug: true, isActive: true } },
      },
    });
    const referralCompanyIds = referralRows.map((row) => row.companyId);
    const prRevenueSubscriptions = referralCompanyIds.length
      ? await prisma.userSubscription.findMany({
          where: { status: { in: ["ACTIVE", "EXPIRED"] }, subscription: { companyId: { in: referralCompanyIds } } },
          select: {
            status: true,
            activatedAt: true,
            expiresAt: true,
            subscription: {
              select: {
                price: true,
                company: {
                  select: {
                    id: true,
                    name: true,
                    platformCommissionPercent: true,
                    commissionFreeMonthlyTurnover: true,
                    commissionGraceEndsAt: true,
                    supportManagerId: true,
                    currentReferral: {
                      select: {
                        referrerUserId: true,
                        referralPercent: true,
                        status: true,
                      },
                    },
                  },
                },
              },
            },
          },
        })
      : [];
    const prRevenue = calculatePlatformRevenueSummary(
      prRevenueSubscriptions
        .filter((row) => row.subscription.company)
        .map((row) => ({
          companyId: row.subscription.company!.id,
          companyName: row.subscription.company!.name,
          price: row.subscription.price,
          status: row.status,
          activatedAt: row.activatedAt,
          expiresAt: row.expiresAt,
          platformCommissionPercent: row.subscription.company!.platformCommissionPercent,
          commissionFreeMonthlyTurnover: row.subscription.company!.commissionFreeMonthlyTurnover,
          commissionGraceEndsAt: row.subscription.company!.commissionGraceEndsAt,
          supportManagerUserId: row.subscription.company!.supportManagerId,
          supportManagerPercent: 1,
          referrerUserId: row.subscription.company!.currentReferral?.referrerUserId ?? null,
          referralPercent: row.subscription.company!.currentReferral?.referralPercent ?? null,
          referralStatus: row.subscription.company!.currentReferral?.status ?? null,
        })),
      new Date(),
    );
    const revenueByCompany = new Map(prRevenue.companies.map((company) => [company.companyId, company]));
    const pipeline = referralRows.reduce<Record<CompanyReferralPipelineStatus, number>>(
      (acc, row) => {
        acc[row.pipelineStatus] += 1;
        return acc;
      },
      { LEAD: 0, NEGOTIATION: 0, TRIAL: 0, CONNECTED: 0, REVENUE_ACTIVE: 0, LOST: 0 },
    );

    prDashboard = {
      scope: seesAllReferrals ? "ALL" : "OWN",
      totals: {
        companies: referralRows.length,
        activeCompanies: referralRows.filter((row) => row.status === "ACTIVE" && row.company.isActive).length,
        recognizedGross: prRevenue.recognizedGross,
        futureGross: prRevenue.futureGross,
        whiteBoxNetCommission: prRevenue.whiteBoxCommission,
        referralCommission: prRevenue.referralCommission,
        supportManagerCommission: prRevenue.supportManagerCommission,
      },
      pipeline,
      companies: referralRows.slice(0, 12).map((row) => {
        const revenue = revenueByCompany.get(row.companyId);
        return {
          uuid: row.uuid,
          companyId: row.companyId,
          companyName: row.company.name,
          companySlug: row.company.slug,
          companyActive: row.company.isActive,
          status: row.status,
          pipelineStatus: row.pipelineStatus,
          referralPercent: Number(row.referralPercent),
          source: row.source,
          referrer: row.referrer,
          recognizedGross: revenue?.recognizedGross ?? 0,
          futureGross: revenue?.futureGross ?? 0,
          whiteBoxNetCommission: revenue?.whiteBoxCommission ?? 0,
          referralCommission: revenue?.referralCommission ?? 0,
          activeSubscriptions: revenue?.activeSubscriptions ?? 0,
        };
      }),
    };
  }

  const priorityOrder = { CRITICAL: 0, HIGH: 1, NORMAL: 2 } as const;
  const priorityTasks = recentTasks
    .sort((left, right) => priorityOrder[left.priority] - priorityOrder[right.priority] || left.createdAt.getTime() - right.createdAt.getTime())
    .slice(0, 8);
  const trend = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(since);
    date.setDate(date.getDate() + offset);
    const key = dateKey(date);
    return {
      date: key,
      events: recentTaskEvents.filter((event) => dateKey(event.createdAt) === key).length,
    };
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    metrics: {
      usersTotal,
      usersActive,
      companiesActive,
      subscriptionsActive,
      verificationOpen,
      pendingFinance,
      openTasks,
      criticalTasks,
      subscriptionGross: platformRevenue.gross,
      subscriptionRecognizedGross: platformRevenue.recognizedGross,
      subscriptionFutureGross: platformRevenue.futureGross,
      whiteBoxCommission: platformRevenue.whiteBoxCommission,
      referralCommission: platformRevenue.referralCommission,
      supportManagerCommission: platformRevenue.supportManagerCommission,
      companyRecognizedRevenue: platformRevenue.companyRecognizedRevenue,
      companiesWithReferral: platformRevenue.companiesWithReferral,
      companiesWithSupportManager: platformRevenue.companiesWithSupportManager,
    },
    permittedSources: sources,
    pr: prDashboard,
    trend,
    tasks: priorityTasks.map((task) => ({
      ...task,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      assignedAt: task.assignedAt?.toISOString() ?? null,
      resolvedAt: task.resolvedAt?.toISOString() ?? null,
    })),
  });
}
