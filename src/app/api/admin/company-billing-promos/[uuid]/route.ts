import { NextResponse, type NextRequest } from "next/server";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  context: { params: { uuid: string } | Promise<{ uuid: string }> },
) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "PR", "canEdit");
  if (!access.ok) return access.response;
  const { uuid } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { isActive?: boolean };
  const promo = await prisma.companyBillingPromoCode.update({
    where: { uuid },
    data: { isActive: body.isActive === true },
  });
  return NextResponse.json({ ...promo, discountPercent: Number(promo.discountPercent) });
}
