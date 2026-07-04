import { NextResponse, type NextRequest } from "next/server";
import { CompanyMediaKind } from "@prisma/client";
import { companyMediaUrl } from "@/lib/company-media-storage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function serializeAsset(asset: {
  id: string;
  kind: CompanyMediaKind;
  title: string | null;
  description: string | null;
  storageKey: string;
  width: number;
  height: number;
  sortOrder: number;
}) {
  return { ...asset, url: companyMediaUrl(asset.storageKey) };
}

function serializeOffer(offer: {
  id: string;
  title: string;
  description: string | null;
  code: string | null;
  imageStorageKey: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  sortOrder: number;
}) {
  return { ...offer, imageUrl: companyMediaUrl(offer.imageStorageKey) };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const company = await prisma.company.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true,
      mediaAssets: {
        where: { isActive: true },
        orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      },
      specialOffers: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      },
    },
  });
  if (!company) return NextResponse.json({ message: "Company not found" }, { status: 404 });
  const logo = company.mediaAssets.find((asset) => asset.kind === CompanyMediaKind.LOGO);
  const hero = company.mediaAssets.find((asset) => asset.kind === CompanyMediaKind.HERO);
  return NextResponse.json({
    media: {
      logo: logo ? serializeAsset(logo) : null,
      hero: hero ? serializeAsset(hero) : null,
      gallery: company.mediaAssets.filter((asset) => asset.kind === CompanyMediaKind.GALLERY).slice(0, 10).map(serializeAsset),
    },
    offers: company.specialOffers.map(serializeOffer),
  });
}
