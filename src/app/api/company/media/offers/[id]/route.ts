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

function nullableTextField(form: FormData, key: string) {
  if (!form.has(key)) return undefined;
  return String(form.get(key) ?? "").trim() || null;
}

function dateField(form: FormData, key: string) {
  if (!form.has(key)) return undefined;
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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const member = await getCompanyMember(request);
  if (member instanceof NextResponse) return member;
  const { id } = await params;
  let stored: Awaited<ReturnType<typeof storeCompanyMediaFile>> | null = null;
  try {
    const offer = await prisma.companySpecialOffer.findFirst({
      where: { id, companyId: member.companyId, isActive: true },
      select: { id: true, imageStorageKey: true, startsAt: true, endsAt: true },
    });
    if (!offer) return NextResponse.json({ message: "Акция не найдена." }, { status: 404 });

    const form = await request.formData();
    const title = nullableTextField(form, "title");
    const description = nullableTextField(form, "description");
    const code = nullableTextField(form, "code");
    const startsAt = dateField(form, "startsAt");
    const endsAt = dateField(form, "endsAt");
    const nextStartsAt = startsAt !== undefined ? startsAt : offer.startsAt;
    const nextEndsAt = endsAt !== undefined ? endsAt : offer.endsAt;
    if (title === null) return NextResponse.json({ message: "Укажите название акции." }, { status: 400 });
    if (nextStartsAt && nextEndsAt && nextStartsAt >= nextEndsAt) {
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

    const updated = await prisma.companySpecialOffer.update({
      where: { id: offer.id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(code !== undefined ? { code: code?.toUpperCase() ?? null } : {}),
        ...(startsAt !== undefined ? { startsAt } : {}),
        ...(endsAt !== undefined ? { endsAt } : {}),
        ...(stored
          ? {
              imageStorageKey: stored.storageKey,
              imageFileName: stored.fileName,
              imageMimeType: stored.mimeType,
              imageSize: stored.size,
              imageWidth: numberField(form, "width", 900),
              imageHeight: numberField(form, "height", 506),
            }
          : {}),
      },
    });
    if (stored && offer.imageStorageKey) {
      await deleteCompanyMediaFile(offer.imageStorageKey).catch(() => undefined);
    }
    stored = null;
    return NextResponse.json({ offer: serializeOffer(updated) });
  } catch (error) {
    if (stored) await deleteCompanyMediaFile(stored.storageKey).catch(() => undefined);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Не удалось обновить акцию." }, { status: 400 });
  }
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
