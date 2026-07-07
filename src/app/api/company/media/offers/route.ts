import { CompanyMemberRole } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { isUserAuthResponse, requireUserSession } from "@/lib/auth/require-user-session";
import {
  companyMediaUrl,
  deleteCompanyMediaFile,
  storeCompanyMediaFile,
} from "@/lib/company-media-storage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function isUploadLike(value: unknown): value is File {
  return typeof value === "object" && value !== null && "size" in value && "type" in value;
}

function numberField(form: FormData, key: string, fallback: number) {
  const value = Number(form.get(key));
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function dateField(form: FormData, key: string) {
  const raw = String(form.get(key) ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Некорректная дата: ${key}.`);
  }
  return date;
}

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

function serializeOffer(offer: {
  id: string;
  title: string;
  description: string | null;
  code: string | null;
  imageStorageKey: string | null;
  imageFileName: string | null;
  imageMimeType: string | null;
  imageSize: number | null;
  imageWidth: number | null;
  imageHeight: number | null;
  sortOrder: number;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...offer,
    imageUrl: companyMediaUrl(offer.imageStorageKey),
    startsAt: offer.startsAt?.toISOString() ?? null,
    endsAt: offer.endsAt?.toISOString() ?? null,
    createdAt: offer.createdAt.toISOString(),
    updatedAt: offer.updatedAt.toISOString(),
  };
}

export async function POST(request: NextRequest) {
  const member = await getCompanyMember(request);
  if (member instanceof NextResponse) return member;
  let stored: Awaited<ReturnType<typeof storeCompanyMediaFile>> | null = null;
  try {
    const form = await request.formData();
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim() || null;
    const code = String(form.get("code") ?? "").trim().toUpperCase() || null;
    const startsAt = dateField(form, "startsAt");
    const endsAt = dateField(form, "endsAt");
    if (!title) return NextResponse.json({ message: "Укажите название акции." }, { status: 400 });
    if (startsAt && endsAt && startsAt >= endsAt) {
      return NextResponse.json({ message: "Дата окончания акции должна быть позже даты начала." }, { status: 400 });
    }

    const upload = form.get("file");
    if (isUploadLike(upload) && upload.size > 0) {
      stored = await storeCompanyMediaFile({
        buffer: Buffer.from(await upload.arrayBuffer()),
        mimeType: upload.type,
        originalName: upload.name || null,
      });
    }
    const maxSort = await prisma.companySpecialOffer.aggregate({
      where: { companyId: member.companyId },
      _max: { sortOrder: true },
    });
    const offer = await prisma.companySpecialOffer.create({
      data: {
        companyId: member.companyId,
        title,
        description,
        code,
        startsAt,
        endsAt,
        imageStorageKey: stored?.storageKey ?? null,
        imageFileName: stored?.fileName ?? null,
        imageMimeType: stored?.mimeType ?? null,
        imageSize: stored?.size ?? null,
        imageWidth: stored ? numberField(form, "width", 900) : null,
        imageHeight: stored ? numberField(form, "height", 506) : null,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });
    stored = null;
    return NextResponse.json({ offer: serializeOffer(offer) });
  } catch (error) {
    if (stored) await deleteCompanyMediaFile(stored.storageKey).catch(() => undefined);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Не удалось создать акцию." }, { status: 400 });
  }
}
