import { CompanyMediaKind, CompanyMemberRole } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { isUserAuthResponse, requireUserSession } from "@/lib/auth/require-user-session";
import {
  companyMediaUrl,
  deleteCompanyMediaFile,
  storeCompanyMediaFile,
} from "@/lib/company-media-storage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const IMAGE_STANDARDS = {
  logo: { width: 512, height: 512, ratio: "1:1", maxSizeMb: 4 },
  hero: { width: 960, height: 420, ratio: "16:7", maxSizeMb: 4 },
  gallery: { width: 900, height: 675, ratio: "4:3", maxCount: 10, maxSizeMb: 4 },
  offer: { width: 900, height: 506, ratio: "16:9", maxSizeMb: 4 },
};

function isUploadLike(value: unknown): value is File {
  return typeof value === "object" && value !== null && "size" in value && "type" in value;
}

function numberField(form: FormData, key: string, fallback: number) {
  const value = Number(form.get(key));
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function serializeAsset(asset: {
  id: string;
  kind: CompanyMediaKind;
  title: string | null;
  description: string | null;
  storageKey: string;
  fileName: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...asset,
    url: companyMediaUrl(asset.storageKey),
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
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
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...offer,
    imageUrl: companyMediaUrl(offer.imageStorageKey),
    createdAt: offer.createdAt.toISOString(),
    updatedAt: offer.updatedAt.toISOString(),
  };
}

async function getCompanyMember(request: NextRequest, requireManager = false) {
  const session = await requireUserSession(request);
  if (isUserAuthResponse(session)) return session;
  if (session.role !== "COMPANY") {
    return NextResponse.json({ message: "Доступно только аккаунту компании." }, { status: 403 });
  }
  const member = await prisma.companyMember.findFirst({
    where: { userId: session.userId, isActive: true },
    orderBy: { id: "asc" },
    select: { companyId: true, role: true },
  });
  if (!member) return NextResponse.json({ message: "Компания не найдена." }, { status: 404 });
  if (requireManager && member.role === CompanyMemberRole.CASHIER) {
    return NextResponse.json({ message: "Недостаточно прав для управления медиа." }, { status: 403 });
  }
  return member;
}

export async function GET(request: NextRequest) {
  try {
    const member = await getCompanyMember(request);
    if (member instanceof NextResponse) return member;

    const [assets, offers] = await Promise.all([
      prisma.companyMediaAsset.findMany({
        where: { companyId: member.companyId, isActive: true },
        orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      }),
      prisma.companySpecialOffer.findMany({
        where: { companyId: member.companyId, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      }),
    ]);
    const logo = assets.find((asset) => asset.kind === CompanyMediaKind.LOGO);
    const hero = assets.find((asset) => asset.kind === CompanyMediaKind.HERO);

    return NextResponse.json({
      standards: IMAGE_STANDARDS,
      media: {
        logo: logo ? serializeAsset(logo) : null,
        hero: hero ? serializeAsset(hero) : null,
        gallery: assets.filter((asset) => asset.kind === CompanyMediaKind.GALLERY).map(serializeAsset),
      },
      offers: offers.map(serializeOffer),
    });
  } catch (error) {
    console.error("[company-media] GET failed", error);
    return NextResponse.json({ message: "Не удалось загрузить медиа компании." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const member = await getCompanyMember(request, true);
  if (member instanceof NextResponse) return member;

  let stored: Awaited<ReturnType<typeof storeCompanyMediaFile>> | null = null;
  try {
    const form = await request.formData();
    const kindRaw = String(form.get("kind") ?? "").toUpperCase();
    const kind =
      kindRaw === "LOGO"
        ? CompanyMediaKind.LOGO
        : kindRaw === "HERO"
          ? CompanyMediaKind.HERO
          : kindRaw === "GALLERY"
            ? CompanyMediaKind.GALLERY
            : null;
    if (!kind) return NextResponse.json({ message: "Неверный тип изображения." }, { status: 400 });
    const upload = form.get("file");
    if (!isUploadLike(upload) || upload.size <= 0) {
      return NextResponse.json({ message: "Выберите изображение." }, { status: 400 });
    }
    if (kind === "GALLERY") {
      const galleryCount = await prisma.companyMediaAsset.count({
        where: { companyId: member.companyId, kind: CompanyMediaKind.GALLERY, isActive: true },
      });
      if (galleryCount >= IMAGE_STANDARDS.gallery.maxCount) {
        return NextResponse.json({ message: "В галерее максимум 10 фото." }, { status: 400 });
      }
    }

    stored = await storeCompanyMediaFile({
      buffer: Buffer.from(await upload.arrayBuffer()),
      mimeType: upload.type,
      originalName: upload.name || null,
    });
    const width = numberField(
      form,
      "width",
      kind === "LOGO"
        ? IMAGE_STANDARDS.logo.width
        : kind === "HERO"
          ? IMAGE_STANDARDS.hero.width
          : IMAGE_STANDARDS.gallery.width,
    );
    const height = numberField(
      form,
      "height",
      kind === "LOGO"
        ? IMAGE_STANDARDS.logo.height
        : kind === "HERO"
          ? IMAGE_STANDARDS.hero.height
          : IMAGE_STANDARDS.gallery.height,
    );
    const title = String(form.get("title") ?? "").trim() || null;
    const description = String(form.get("description") ?? "").trim() || null;

    const result = await prisma.$transaction(async (tx) => {
      if (kind !== "GALLERY") {
        const previous = await tx.companyMediaAsset.findMany({
          where: { companyId: member.companyId, kind, isActive: true },
          select: { id: true, storageKey: true },
        });
        await tx.companyMediaAsset.updateMany({
          where: { companyId: member.companyId, kind, isActive: true },
          data: { isActive: false },
        });
        for (const item of previous) void deleteCompanyMediaFile(item.storageKey).catch(() => undefined);
      }
      const maxSort = await tx.companyMediaAsset.aggregate({
        where: { companyId: member.companyId, kind },
        _max: { sortOrder: true },
      });
      return tx.companyMediaAsset.create({
        data: {
          companyId: member.companyId,
          kind,
          title,
          description,
          storageKey: stored!.storageKey,
          fileName: stored!.fileName,
          mimeType: stored!.mimeType,
          size: stored!.size,
          width,
          height,
          sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        },
      });
    });
    stored = null;
    return NextResponse.json({ asset: serializeAsset(result) });
  } catch (error) {
    if (stored) await deleteCompanyMediaFile(stored.storageKey).catch(() => undefined);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Не удалось загрузить изображение." }, { status: 400 });
  }
}
