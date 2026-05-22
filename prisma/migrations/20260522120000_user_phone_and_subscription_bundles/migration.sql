-- Add Telegram-verified user phone fields.
ALTER TABLE "User" ADD COLUMN "phoneNumber" TEXT;
ALTER TABLE "User" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");

-- Admin-managed paired subscription bundles.
CREATE TYPE "SubscriptionBundleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

CREATE TABLE "SubscriptionBundle" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "renewalPeriod" TEXT NOT NULL,
    "renewalValue" INTEGER NOT NULL DEFAULT 1,
    "renewalUnit" TEXT NOT NULL DEFAULT 'month',
    "promoBonusDays" INTEGER NOT NULL DEFAULT 0,
    "status" "SubscriptionBundleStatus" NOT NULL DEFAULT 'DRAFT',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "categoryId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionBundle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionBundleParticipant" (
    "id" SERIAL NOT NULL,
    "bundleId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "benefitTitle" TEXT NOT NULL,
    "benefitDescription" TEXT NOT NULL,
    "fulfillmentNote" TEXT,
    "revenueSharePercent" DECIMAL(5,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionBundleParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionBundle_uuid_key" ON "SubscriptionBundle"("uuid");
CREATE UNIQUE INDEX "SubscriptionBundle_slug_key" ON "SubscriptionBundle"("slug");
CREATE INDEX "SubscriptionBundle_status_isActive_idx" ON "SubscriptionBundle"("status", "isActive");
CREATE INDEX "SubscriptionBundle_categoryId_idx" ON "SubscriptionBundle"("categoryId");
CREATE UNIQUE INDEX "SubscriptionBundleParticipant_bundleId_companyId_key" ON "SubscriptionBundleParticipant"("bundleId", "companyId");
CREATE INDEX "SubscriptionBundleParticipant_companyId_idx" ON "SubscriptionBundleParticipant"("companyId");

ALTER TABLE "SubscriptionBundle" ADD CONSTRAINT "SubscriptionBundle_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubscriptionBundleParticipant" ADD CONSTRAINT "SubscriptionBundleParticipant_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "SubscriptionBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionBundleParticipant" ADD CONSTRAINT "SubscriptionBundleParticipant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
