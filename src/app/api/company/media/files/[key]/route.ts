import { NextResponse, type NextRequest } from "next/server";
import { readCompanyMediaFile } from "@/lib/company-media-storage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const storageKey = decodeURIComponent(key);
  const [asset, offer] = await Promise.all([
    prisma.companyMediaAsset.findUnique({
      where: { storageKey },
      select: { mimeType: true, isActive: true, company: { select: { isActive: true } } },
    }),
    prisma.companySpecialOffer.findUnique({
      where: { imageStorageKey: storageKey },
      select: { imageMimeType: true, isActive: true, company: { select: { isActive: true } } },
    }),
  ]);
  const mimeType = asset?.isActive && asset.company.isActive ? asset.mimeType : offer?.isActive && offer.company.isActive ? offer.imageMimeType : null;
  if (!mimeType) return NextResponse.json({ message: "File not found" }, { status: 404 });
  try {
    const file = await readCompanyMediaFile(storageKey);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ message: "File not found" }, { status: 404 });
  }
}
