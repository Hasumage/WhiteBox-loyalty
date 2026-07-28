import { NextResponse, type NextRequest } from "next/server";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import {
  normalizeRecommendationBoostPercent,
  recommendationBoostMultiplier,
} from "@/lib/recommendations/company-recommendation-boost";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function readUuid(params: { uuid?: string } | Promise<{ uuid?: string }>) {
  return (await Promise.resolve(params)).uuid ?? "";
}

function serializeCompany(owner: {
  uuid: string;
  name: string;
  email: string;
  managedCompany: {
    id: number;
    name: string;
    slug: string;
    recommendationBoostPercent: number;
    recommendForEveryone: boolean;
  } | null;
}) {
  const company = owner.managedCompany;
  if (!company) return null;
  return {
    company: {
      owner: { uuid: owner.uuid, name: owner.name, email: owner.email },
      profile: { id: company.id, name: company.name, slug: company.slug },
      recommendation: {
        boostPercent: company.recommendationBoostPercent,
        recommendForEveryone: company.recommendForEveryone,
        effectiveMultiplier: recommendationBoostMultiplier(company.recommendationBoostPercent),
      },
    },
  };
}

export async function GET(
  request: NextRequest,
  context: { params: { uuid?: string } | Promise<{ uuid?: string }> },
) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;

  const access = await requireAdminScope(session, "PROMOTION", "canView");
  if (!access.ok) return access.response;

  const owner = await prisma.user.findUnique({
    where: { uuid: await readUuid(context.params) },
    select: {
      uuid: true,
      name: true,
      email: true,
      managedCompany: {
        select: {
          id: true,
          name: true,
          slug: true,
          recommendationBoostPercent: true,
          recommendForEveryone: true,
        },
      },
    },
  });

  if (!owner?.managedCompany) {
    return NextResponse.json({ message: "Company account was not found" }, { status: 404 });
  }

  return NextResponse.json(serializeCompany(owner));
}

export async function PATCH(
  request: NextRequest,
  context: { params: { uuid?: string } | Promise<{ uuid?: string }> },
) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;

  const access = await requireAdminScope(session, "PROMOTION", "canEdit");
  if (!access.ok) return access.response;

  const body = (await request.json().catch(() => ({}))) as {
    recommendationBoostPercent?: unknown;
    recommendForEveryone?: unknown;
  };

  const owner = await prisma.user.findUnique({
    where: { uuid: await readUuid(context.params) },
    select: {
      id: true,
      uuid: true,
      name: true,
      email: true,
      managedCompany: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!owner?.managedCompany) {
    return NextResponse.json({ message: "Company account was not found" }, { status: 404 });
  }

  const company = await prisma.company.update({
    where: { id: owner.managedCompany.id },
    data: {
      recommendationBoostPercent: normalizeRecommendationBoostPercent(body.recommendationBoostPercent),
      recommendForEveryone: body.recommendForEveryone === true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      recommendationBoostPercent: true,
      recommendForEveryone: true,
    },
  });

  return NextResponse.json(
    serializeCompany({
      uuid: owner.uuid,
      name: owner.name,
      email: owner.email,
      managedCompany: company,
    }),
  );
}
