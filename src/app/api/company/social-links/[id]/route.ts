import { CompanyMemberRole, CompanySocialLinkKind } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { isUserAuthResponse, requireUserSession } from "@/lib/auth/require-user-session";
import { prisma } from "@/lib/prisma";

function normalizeUrl(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) throw new Error("Укажите ссылку.");
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(withProtocol);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error("Поддерживаются только публичные http/https ссылки.");
  }
  return url.toString();
}

function detectKind(url: string): CompanySocialLinkKind {
  const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  if (hostname === "vk.com" || hostname.endsWith(".vk.com")) return CompanySocialLinkKind.VK;
  if (hostname === "max.ru" || hostname.endsWith(".max.ru") || hostname === "max.com" || hostname.endsWith(".max.com")) return CompanySocialLinkKind.MAX;
  return CompanySocialLinkKind.OTHER;
}

function normalizeKind(value: unknown, url: string) {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "WEBSITE") return CompanySocialLinkKind.WEBSITE;
  if (raw === "VK") return CompanySocialLinkKind.VK;
  if (raw === "MAX") return CompanySocialLinkKind.MAX;
  return detectKind(url);
}

function defaultTitle(kind: CompanySocialLinkKind, url: string) {
  if (kind === CompanySocialLinkKind.WEBSITE) return "Сайт";
  if (kind === CompanySocialLinkKind.VK) return "VK";
  if (kind === CompanySocialLinkKind.MAX) return "MAX";
  return new URL(url).hostname.replace(/^www\./, "");
}

function serialize(link: {
  id: string;
  kind: CompanySocialLinkKind;
  title: string;
  url: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return { ...link, createdAt: link.createdAt.toISOString(), updatedAt: link.updatedAt.toISOString() };
}

async function getCompanyMember(request: NextRequest) {
  const session = await requireUserSession(request);
  if (isUserAuthResponse(session)) return session;
  if (session.role !== "COMPANY") return NextResponse.json({ message: "Доступно только аккаунту компании." }, { status: 403 });

  const member = await prisma.companyMember.findFirst({
    where: { userId: session.userId, isActive: true },
    orderBy: { id: "asc" },
    select: { companyId: true, role: true },
  });
  if (!member) return NextResponse.json({ message: "Компания не найдена." }, { status: 404 });
  if (member.role === CompanyMemberRole.CASHIER) {
    return NextResponse.json({ message: "Недостаточно прав для управления ссылками." }, { status: 403 });
  }
  return member;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const member = await getCompanyMember(request);
  if (member instanceof NextResponse) return member;
  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const url = normalizeUrl(body.url);
    const kind = normalizeKind(body.kind, url);
    const title = String(body.title ?? "").trim().slice(0, 80) || defaultTitle(kind, url);
    await prisma.companySocialLink.updateMany({
      where: { id, companyId: member.companyId, isActive: true },
      data: { title, url, kind },
    });
    const link = await prisma.companySocialLink.findFirstOrThrow({ where: { id, companyId: member.companyId } });
    return NextResponse.json({ link: serialize(link) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Не удалось обновить ссылку." }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const member = await getCompanyMember(request);
  if (member instanceof NextResponse) return member;
  const { id } = await params;

  await prisma.companySocialLink.updateMany({
    where: { id, companyId: member.companyId },
    data: { isActive: false },
  });
  return NextResponse.json({ ok: true });
}
