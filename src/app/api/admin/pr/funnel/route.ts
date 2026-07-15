import { NextResponse, type NextRequest } from "next/server";
import type { CompanyReferralPipelineStatus, Prisma } from "@prisma/client";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const PIPELINE_STATUSES = new Set<CompanyReferralPipelineStatus>([
  "LEAD",
  "NEGOTIATION",
  "TRIAL",
  "CONNECTED",
  "REVENUE_ACTIVE",
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

export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "PR", "canView");
  if (!access.ok) return access.response;

  const items = await prisma.prFunnelCompany.findMany({
    where: canSeeAll(access.actor.role) ? {} : { ownerUserId: session.userId },
    orderBy: [{ status: "asc" }, { position: "asc" }, { updatedAt: "desc" }],
    include: funnelInclude,
  });

  return NextResponse.json({
    scope: canSeeAll(access.actor.role) ? "ALL" : "OWN",
    items: items.map(serialize),
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
  const status = body.status && PIPELINE_STATUSES.has(body.status) ? body.status : "LEAD";
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
  if (body.status && PIPELINE_STATUSES.has(body.status)) data.status = body.status;
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
