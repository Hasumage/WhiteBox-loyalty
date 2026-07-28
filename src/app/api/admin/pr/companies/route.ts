import { NextResponse, type NextRequest } from "next/server";
import type { CompanyReferralPipelineStatus, CompanyReferralStatus, Prisma } from "@prisma/client";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const REFERRAL_STATUSES = new Set<CompanyReferralStatus>(["ACTIVE", "PAUSED", "ENDED"]);
const PIPELINE_STATUSES = new Set<CompanyReferralPipelineStatus>([
  "LEAD",
  "NEGOTIATION",
  "TRIAL",
  "CONNECTED",
  "REVENUE_ACTIVE",
  "LOST",
]);

type PipelineLockReason = "ACTIVE_SUBSCRIPTION" | "EXPIRED_SUBSCRIPTION";

function canSeeAllPrCompanies(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function hasActiveNearloySubscription(company: {
  isActive: boolean;
  billingAccount: { status: string; currentPeriodEndsAt: Date } | null;
}) {
  return Boolean(
    company.isActive &&
      company.billingAccount &&
      company.billingAccount.status === "ACTIVE" &&
      company.billingAccount.currentPeriodEndsAt.getTime() > Date.now(),
  );
}

function hadPaidNearloySubscription(company: { billingInvoices: Array<{ status: string }> }) {
  return company.billingInvoices.some((invoice) => invoice.status === "PAID" || invoice.status === "WAIVED");
}

function getPipelineLockReason(company: {
  isActive: boolean;
  billingAccount: { status: string; currentPeriodEndsAt: Date } | null;
  billingInvoices: Array<{ status: string }>;
}): PipelineLockReason | null {
  if (hasActiveNearloySubscription(company)) return "ACTIVE_SUBSCRIPTION";
  if (hadPaidNearloySubscription(company)) return "EXPIRED_SUBSCRIPTION";
  return null;
}

function serializeReferral(referral: Prisma.CompanyReferralGetPayload<{
  include: {
    company: {
      select: {
        id: true;
        slug: true;
        name: true;
        isActive: true;
        operatesOnline: true;
        verificationStatus: true;
        billingAccount: {
          select: {
            status: true;
            currentPeriodEndsAt: true;
          };
        };
        billingInvoices: {
          select: {
            status: true;
          };
        };
      };
    };
    referrer: {
      select: {
        uuid: true;
        name: true;
        email: true;
      };
    };
  };
}>) {
  const pipelineLockReason = getPipelineLockReason(referral.company);
  return {
    uuid: referral.uuid,
    status: referral.status,
    pipelineStatus: pipelineLockReason === "ACTIVE_SUBSCRIPTION" ? "REVENUE_ACTIVE" : referral.pipelineStatus,
    pipelineLockReason,
    source: referral.source,
    notes: referral.notes,
    referralPercent: Number(referral.referralPercent),
    startedAt: referral.startedAt.toISOString(),
    endedAt: referral.endedAt?.toISOString() ?? null,
    updatedAt: referral.updatedAt.toISOString(),
    company: {
      id: referral.company.id,
      slug: referral.company.slug,
      name: referral.company.name,
      isActive: referral.company.isActive,
      operatesOnline: referral.company.operatesOnline,
      verificationStatus: referral.company.verificationStatus,
      billingStatus: referral.company.billingAccount?.status ?? null,
      billingEndsAt: referral.company.billingAccount?.currentPeriodEndsAt.toISOString() ?? null,
      hasPaidNearloySubscription: hadPaidNearloySubscription(referral.company),
    },
    referrer: referral.referrer,
  };
}

const referralInclude = {
  company: {
    select: {
      id: true,
      slug: true,
      name: true,
      isActive: true,
      operatesOnline: true,
      verificationStatus: true,
      billingAccount: {
        select: {
          status: true,
          currentPeriodEndsAt: true,
        },
      },
      billingInvoices: {
        where: { status: { in: ["PAID", "WAIVED"] } },
        take: 1,
        select: {
          status: true,
        },
      },
    },
  },
  referrer: {
    select: {
      uuid: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.CompanyReferralInclude;

export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "PR", "canView");
  if (!access.ok) return access.response;

  const referrals = await prisma.companyReferral.findMany({
    where: canSeeAllPrCompanies(access.actor.role) ? {} : { referrerUserId: session.userId },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: referralInclude,
  });

  return NextResponse.json({
    scope: canSeeAllPrCompanies(access.actor.role) ? "ALL" : "OWN",
    items: referrals.map(serializeReferral),
  });
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "PR", "canEdit");
  if (!access.ok) return access.response;

  const body = (await request.json().catch(() => ({}))) as {
    referralUuid?: string;
    companyName?: string;
    status?: CompanyReferralStatus;
    pipelineStatus?: CompanyReferralPipelineStatus;
    source?: string;
    notes?: string | null;
  };
  const referralUuid = text(body.referralUuid, 80);
  if (!referralUuid) return NextResponse.json({ message: "Referral uuid is required" }, { status: 400 });

  const current = await prisma.companyReferral.findUnique({
    where: { uuid: referralUuid },
    select: {
      companyId: true,
      referrerUserId: true,
      company: {
        select: {
          isActive: true,
          billingAccount: {
            select: {
              status: true,
              currentPeriodEndsAt: true,
            },
          },
          billingInvoices: {
            where: { status: { in: ["PAID", "WAIVED"] } },
            take: 1,
            select: {
              status: true,
            },
          },
        },
      },
    },
  });
  if (!current) return NextResponse.json({ message: "Referral not found" }, { status: 404 });
  if (!canSeeAllPrCompanies(access.actor.role) && current.referrerUserId !== session.userId) {
    return NextResponse.json({ message: "This company is assigned to another PR manager" }, { status: 403 });
  }

  const referralData: Prisma.CompanyReferralUpdateInput = {};
  if (body.status && REFERRAL_STATUSES.has(body.status)) referralData.status = body.status;
  const pipelineLockReason = getPipelineLockReason(current.company);
  if (pipelineLockReason === "ACTIVE_SUBSCRIPTION") {
    referralData.pipelineStatus = "REVENUE_ACTIVE";
  } else if (!pipelineLockReason && body.pipelineStatus && PIPELINE_STATUSES.has(body.pipelineStatus)) {
    referralData.pipelineStatus = body.pipelineStatus;
  }
  if (typeof body.source === "string") referralData.source = text(body.source, 80) || "PR";
  if (body.notes !== undefined) referralData.notes = text(body.notes, 4000) || null;

  const companyName = text(body.companyName, 120);
  const referral = await prisma.$transaction(async (tx) => {
    if (companyName) {
      await tx.company.update({
        where: { id: current.companyId },
        data: { name: companyName },
      });
    }

    return tx.companyReferral.update({
      where: { uuid: referralUuid },
      data: referralData,
      include: referralInclude,
    });
  });

  return NextResponse.json(serializeReferral(referral));
}
