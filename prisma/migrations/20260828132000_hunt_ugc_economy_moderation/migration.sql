-- CreateEnum
CREATE TYPE "HuntReportReason" AS ENUM ('SPAM', 'OFFENSIVE', 'FALSE_PLACE', 'DUPLICATE', 'PRIVATE_DATA', 'COPYRIGHT', 'OTHER');

-- CreateEnum
CREATE TYPE "HuntReportStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED');

-- AlterTable
ALTER TABLE "HuntPost"
  ADD COLUMN "mediaUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "rating" INTEGER,
  ADD COLUMN "visitPriceBand" TEXT,
  ADD COLUMN "moodTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "gpsConfidence" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "HuntPostReport" (
  "id" TEXT NOT NULL,
  "uuid" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "reporterId" INTEGER NOT NULL,
  "reason" "HuntReportReason" NOT NULL,
  "details" TEXT,
  "status" "HuntReportStatus" NOT NULL DEFAULT 'OPEN',
  "moderatorId" INTEGER,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HuntPostReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HuntPostReport_uuid_key" ON "HuntPostReport"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "HuntPostReport_postId_reporterId_key" ON "HuntPostReport"("postId", "reporterId");

-- CreateIndex
CREATE INDEX "HuntPostReport_postId_status_idx" ON "HuntPostReport"("postId", "status");

-- CreateIndex
CREATE INDEX "HuntPostReport_reporterId_createdAt_idx" ON "HuntPostReport"("reporterId", "createdAt");

-- CreateIndex
CREATE INDEX "HuntPostReport_status_createdAt_idx" ON "HuntPostReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "HuntPostReport_moderatorId_idx" ON "HuntPostReport"("moderatorId");

-- CreateIndex
CREATE INDEX "HuntPost_moderationStatus_updatedAt_idx" ON "HuntPost"("moderationStatus", "updatedAt");

-- AddForeignKey
ALTER TABLE "HuntPostReport" ADD CONSTRAINT "HuntPostReport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "HuntPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuntPostReport" ADD CONSTRAINT "HuntPostReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuntPostReport" ADD CONSTRAINT "HuntPostReport_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

