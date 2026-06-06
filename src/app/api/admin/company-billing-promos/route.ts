import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "PR", "canView");
  if (!access.ok) return access.response;

  const promos = await prisma.companyBillingPromoCode.findMany({
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true, email: true } }, _count: { select: { redemptions: true } } },
  });
  return NextResponse.json(
    promos.map((promo) => ({ ...promo, discountPercent: Number(promo.discountPercent) })),
  );
}

export async function POST(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "PR", "canEdit");
  if (!access.ok) return access.response;
  const body = (await request.json().catch(() => ({}))) as {
    code?: string;
    title?: string;
    description?: string;
    discountPercent?: number;
    maxRedemptions?: number | null;
    startsAt?: string | null;
    expiresAt?: string | null;
  };
  const code = body.code?.trim().toUpperCase();
  const title = body.title?.trim();
  const discountPercent = Number(body.discountPercent);
  if (!code || code.length > 64 || !title || title.length > 160 || !Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
    return NextResponse.json({ message: "Укажите код, название и скидку от 0 до 100%." }, { status: 400 });
  }
  try {
    const promo = await prisma.companyBillingPromoCode.create({
      data: {
        code,
        title,
        description: body.description?.trim() || null,
        discountPercent: new Prisma.Decimal(discountPercent),
        maxRedemptions: body.maxRedemptions && body.maxRedemptions > 0 ? Math.floor(body.maxRedemptions) : null,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        createdByUserId: session.userId,
      },
    });
    return NextResponse.json({ ...promo, discountPercent: Number(promo.discountPercent) }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ message: "Такой промокод уже существует." }, { status: 409 });
    }
    throw error;
  }
}
