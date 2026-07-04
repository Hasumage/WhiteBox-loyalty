-- CreateEnum
CREATE TYPE "CompanyMediaKind" AS ENUM ('LOGO', 'HERO', 'GALLERY');

-- CreateTable
CREATE TABLE "CompanyMediaAsset" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "kind" "CompanyMediaKind" NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySpecialOffer" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT,
    "imageStorageKey" TEXT,
    "imageFileName" TEXT,
    "imageMimeType" TEXT,
    "imageSize" INTEGER,
    "imageWidth" INTEGER,
    "imageHeight" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySpecialOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMediaAsset_storageKey_key" ON "CompanyMediaAsset"("storageKey");

-- CreateIndex
CREATE INDEX "CompanyMediaAsset_companyId_kind_sortOrder_idx" ON "CompanyMediaAsset"("companyId", "kind", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySpecialOffer_imageStorageKey_key" ON "CompanySpecialOffer"("imageStorageKey");

-- CreateIndex
CREATE INDEX "CompanySpecialOffer_companyId_isActive_sortOrder_idx" ON "CompanySpecialOffer"("companyId", "isActive", "sortOrder");

-- AddForeignKey
ALTER TABLE "CompanyMediaAsset" ADD CONSTRAINT "CompanyMediaAsset_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySpecialOffer" ADD CONSTRAINT "CompanySpecialOffer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
