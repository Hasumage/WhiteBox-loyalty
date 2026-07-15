import { NextResponse, type NextRequest } from "next/server";
import type { CompanyReferralPipelineStatus, Prisma } from "@prisma/client";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const MANUAL_PIPELINE_STATUSES = new Set<CompanyReferralPipelineStatus>([
  "LEAD",
  "NEGOTIATION",
  "TRIAL",
  "CONNECTED",
  "LOST",
]);

function canSeeAll(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function nullableText(value: unknown, max: number) {
  const next = text(value, max);
  return next || null;
}

const funnelInclude = {
  owner: { select: { uuid: true, name: true, email: true } },
} satisfies Prisma.PrFunnelCompanyInclude;

const referralInclude = {
  company: {
    select: {
      id: true,
      slug: true,
      name: true,
      isActive: true,
      owner: { select: { uuid: true, name: true, email: true } },
      billingAccount: {
        select: {
          status: true,
          currentPeriodEndsAt: true,
        },
      },
      billingInvoices: {
        where: { status: { in: ["PAID", "WAIVED"] } },
        orderBy: { periodEndsAt: "desc" },
        take: 1,
        select: {
          uuid: true,
          status: true,
          periodEndsAt: true,
          paidAt: true,
        },
      },
    },
  },
  referrer: { select: { uuid: true, name: true, email: true } },
} satisfies Prisma.CompanyReferralInclude;

type ReferralCompany = Prisma.CompanyReferralGetPayload<{ include: typeof referralInclude }>;

function serialize(item: Prisma.PrFunnelCompanyGetPayload<{ include: typeof funnelInclude }>) {
  return {
    uuid: item.uuid,
    name: item.name,
    description: item.description,
    status: item.status,
    source: item.source,
    contact: item.contact,
    position: item.position,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    owner: item.owner,
  };
}

function hasActiveNearloySubscription(referral: ReferralCompany, now: Date) {
  const account = referral.company.billingAccount;
  return Boolean(
    referral.company.isActive &&
      account &&
      account.status === "ACTIVE" &&
      account.currentPeriodEndsAt.getTime() > now.getTime(),
  );
}

function hadNearloySubscriptionButExpired(referral: ReferralCompany, now: Date) {
  const account = referral.company.billingAccount;
  if (!referral.company.isActive || !account) return false;
  const hadPaidPeriod = referral.company.billingInvoices.length > 0;
  if (!hadPaidPeriod) return false;
  return account.status === "PAST_DUE" || account.status === "SUSPENDED" || account.currentPeriodEndsAt.getTime() <= now.getTime();
}

function serializeReferralCompany(referral: ReferralCompany) {
  const account = referral.company.billingAccount;
  const lastInvoice = referral.company.billingInvoices[0] ?? null;
  return {
    uuid: referral.uuid,
    referralPercent: Number(referral.referralPercent),
    updatedAt: referral.updatedAt.toISOString(),
    company: {
      id: referral.company.id,
      slug: referral.company.slug,
      name: referral.company.name,
      ownerUuid: referral.company.owner?.uuid ?? null,
      ownerName: referral.company.owner?.name ?? null,
      ownerEmail: referral.company.owner?.email ?? null,
      billingStatus: account?.status ?? null,
      billingEndsAt: account?.currentPeriodEndsAt.toISOString() ?? null,
      lastPaidInvoiceAt: lastInvoice?.paidAt?.toISOString() ?? null,
      lastPaidPeriodEndsAt: lastInvoice?.periodEndsAt.toISOString() ?? null,
    },
    referrer: referral.referrer,
  };
}

export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "PR", "canView");
  if (!access.ok) return access.response;

  const canViewAll = canSeeAll(access.actor.role);
  const now = new Date();
  const items = await prisma.prFunnelCompany.findMany({
    where: canViewAll
      ? { status: { not: "REVENUE_ACTIVE" } }
      : { ownerUserId: session.userId, status: { not: "REVENUE_ACTIVE" } },
    orderBy: [{ status: "asc" }, { position: "asc" }, { updatedAt: "desc" }],
    include: funnelInclude,
  });
  const referrals = await prisma.companyReferral.findMany({
    where: canViewAll
      ? { status: "ACTIVE" }
      : { referrerUserId: session.userId, status: "ACTIVE" },
    orderBy: [{ updatedAt: "desc" }],
    include: referralInclude,
  });

  return NextResponse.json({
    scope: canViewAll ? "ALL" : "OWN",
    items: items.map(serialize),
    activeCompanies: referrals.filter((referral) => hasActiveNearloySubscription(referral, now)).map(serializeReferralCompany),
    expiredCompanies: referrals.filter((referral) => hadNearloySubscriptionButExpired(referral, now)).map(serializeReferralCompany),
  });
}

export async function POST(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "PR", "canEdit");
  if (!access.ok) return access.response;

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    description?: string;
    status?: CompanyReferralPipelineStatus;
    source?: string;
    contact?: string;
  };
  const name = text(body.name, 160);
  if (!name) return NextResponse.json({ message: "Company name is required" }, { status: 400 });
  if (body.status === "REVENUE_ACTIVE") {
    return NextResponse.json({ message: "Revenue stage is automatic" }, { status: 400 });
  }
  const status = body.status && MANUAL_PIPELINE_STATUSES.has(body.status) ? body.status : "LEAD";
  const last = await prisma.prFunnelCompany.aggregate({
    where: { ownerUserId: session.userId, status },
    _max: { position: true },
  });

  const item = await prisma.prFunnelCompany.create({
    data: {
      ownerUserId: session.userId,
      name,
      description: nullableText(body.description, 4000),
      status,
      source: nullableText(body.source, 120),
      contact: nullableText(body.contact, 160),
      position: (last._max.position ?? 0) + 1,
    },
    include: funnelInclude,
  });

  return NextResponse.json(serialize(item), { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "PR", "canEdit");
  if (!access.ok) return access.response;

  const body = (await request.json().catch(() => ({}))) as {
    uuid?: string;
    name?: string;
    description?: string | null;
    status?: CompanyReferralPipelineStatus;
    source?: string | null;
    contact?: string | null;
    position?: number;
  };
  const uuid = text(body.uuid, 80);
  if (!uuid) return NextResponse.json({ message: "Funnel item uuid is required" }, { status: 400 });

  const current = await prisma.prFunnelCompany.findUnique({
    where: { uuid },
    select: { ownerUserId: true },
  });
  if (!current) return NextResponse.json({ message: "Funnel item not found" }, { status: 404 });
  if (!canSeeAll(access.actor.role) && current.ownerUserId !== session.userId) {
    return NextResponse.json({ message: "This funnel item belongs to another PR manager" }, { status: 403 });
  }

  const data: Prisma.PrFunnelCompanyUpdateInput = {};
  if (typeof body.name === "string") {
    const name = text(body.name, 160);
    if (!name) return NextResponse.json({ message: "Company name is required" }, { status: 400 });
    data.name = name;
  }
  if (body.description !== undefined) data.description = nullableText(body.description, 4000);
  if (body.source !== undefined) data.source = nullableText(body.source, 120);
  if (body.contact !== undefined) data.contact = nullableText(body.contact, 160);
  if (body.status === "REVENUE_ACTIVE") {
    return NextResponse.json({ message: "Revenue stage is automatic" }, { status: 400 });
  }
  if (body.status && MANUAL_PIPELINE_STATUSES.has(body.status)) data.status = body.status;
  if (Number.isFinite(body.position)) data.position = Math.max(0, Math.trunc(Number(body.position)));

  const item = await prisma.prFunnelCompany.update({
    where: { uuid },
    data,
    include: funnelInclude,
  });

  return NextResponse.json(serialize(item));
}

export async function DELETE(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "PR", "canEdit");
  if (!access.ok) return access.response;

  const { searchParams } = new URL(request.url);
  const uuid = text(searchParams.get("uuid"), 80);
  if (!uuid) return NextResponse.json({ message: "Funnel item uuid is required" }, { status: 400 });

  const current = await prisma.prFunnelCompany.findUnique({
    where: { uuid },
    select: { ownerUserId: true },
  });
  if (!current) return NextResponse.json({ message: "Funnel item not found" }, { status: 404 });
  if (!canSeeAll(access.actor.role) && current.ownerUserId !== session.userId) {
    return NextResponse.json({ message: "This funnel item belongs to another PR manager" }, { status: 403 });
  }

  await prisma.prFunnelCompany.delete({ where: { uuid } });
  return NextResponse.json({ ok: true });
}
