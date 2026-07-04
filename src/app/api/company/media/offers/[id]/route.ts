import { NextResponse, type NextRequest } from "next/server";
import { CompanyMemberRole } from "@prisma/client";
import { isUserAuthResponse, requireUserSession } from "@/lib/auth/require-user-session";
import { deleteCompanyMediaFile } from "@/lib/company-media-storage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function getCompanyMember(request: NextRequest) {
  const session = await requireUserSession(request);
  if (isUserAuthResponse(session)) return session;
  if (session.role !== "COMPANY") {
    return NextResponse.json({ message: "Доступно только аккаунту компании." }, { status: 403 });
  }
  const member = await prisma.companyMember.findFirst({
    where: { userId: session.userId, isActive: true },
    select: { companyId: true, role: true },
  });
  if (!member) return NextResponse.json({ message: "Компания не найдена." }, { status: 404 });
  if (member.role === CompanyMemberRole.CASHIER) {
    return NextResponse.json({ message: "Недостаточно прав для управления акциями." }, { status: 403 });
  }
  return member;
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const member = await getCompanyMember(request);
  if (member instanceof NextResponse) return member;
  const { id } = await params;
  const offer = await prisma.companySpecialOffer.findFirst({
    where: { id, companyId: member.companyId, isActive: true },
    select: { id: true, imageStorageKey: true },
  });
  if (!offer) return NextResponse.json({ message: "Акция не найдена." }, { status: 404 });
  await prisma.companySpecialOffer.update({ where: { id: offer.id }, data: { isActive: false } });
  await deleteCompanyMediaFile(offer.imageStorageKey).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
