CREATE TYPE "SubscriptionBundleParticipantStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "SubscriptionBundle"
  ADD COLUMN "proposedByCompanyId" INTEGER,
  ADD COLUMN "proposedByUserId" INTEGER,
  ADD COLUMN "activatedAt" TIMESTAMP(3);

ALTER TABLE "SubscriptionBundleParticipant"
  ADD COLUMN "uuid" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  ADD COLUMN "allowance" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "windowValue" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "windowUnit" "SubscriptionEntitlementWindow" NOT NULL DEFAULT 'MONTH',
  ADD COLUMN "approvalStatus" "SubscriptionBundleParticipantStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "approvedById" INTEGER;

UPDATE "SubscriptionBundleParticipant" SET "approvedAt" = CURRENT_TIMESTAMP WHERE "approvalStatus" = 'APPROVED';
UPDATE "SubscriptionBundle" SET "activatedAt" = CURRENT_TIMESTAMP WHERE "status" = 'ACTIVE';

CREATE TABLE "UserSubscriptionBundle" (
  "id" SERIAL NOT NULL,
  "uuid" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId" INTEGER NOT NULL,
  "bundleId" INTEGER NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "willAutoRenew" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserSubscriptionBundle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionBundleRedemption" (
  "id" SERIAL NOT NULL,
  "uuid" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userSubscriptionBundleId" INTEGER NOT NULL,
  "participantId" INTEGER NOT NULL,
  "companyId" INTEGER NOT NULL,
  "processedById" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "note" TEXT,
  "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionBundleRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionBundleParticipant_uuid_key" ON "SubscriptionBundleParticipant"("uuid");
CREATE INDEX "SubscriptionBundleParticipant_approvalStatus_idx" ON "SubscriptionBundleParticipant"("approvalStatus");
CREATE INDEX "SubscriptionBundle_proposedByCompanyId_idx" ON "SubscriptionBundle"("proposedByCompanyId");
CREATE UNIQUE INDEX "UserSubscriptionBundle_uuid_key" ON "UserSubscriptionBundle"("uuid");
CREATE INDEX "UserSubscriptionBundle_userId_status_idx" ON "UserSubscriptionBundle"("userId", "status");
CREATE INDEX "UserSubscriptionBundle_bundleId_idx" ON "UserSubscriptionBundle"("bundleId");
CREATE UNIQUE INDEX "SubscriptionBundleRedemption_uuid_key" ON "SubscriptionBundleRedemption"("uuid");
CREATE INDEX "SubscriptionBundleRedemption_userSubscriptionBundleId_participantId_redeemedAt_idx" ON "SubscriptionBundleRedemption"("userSubscriptionBundleId", "participantId", "redeemedAt");
CREATE INDEX "SubscriptionBundleRedemption_companyId_redeemedAt_idx" ON "SubscriptionBundleRedemption"("companyId", "redeemedAt");
CREATE INDEX "SubscriptionBundleRedemption_processedById_redeemedAt_idx" ON "SubscriptionBundleRedemption"("processedById", "redeemedAt");

ALTER TABLE "SubscriptionBundle" ADD CONSTRAINT "SubscriptionBundle_proposedByCompanyId_fkey" FOREIGN KEY ("proposedByCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubscriptionBundle" ADD CONSTRAINT "SubscriptionBundle_proposedByUserId_fkey" FOREIGN KEY ("proposedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubscriptionBundleParticipant" ADD CONSTRAINT "SubscriptionBundleParticipant_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserSubscriptionBundle" ADD CONSTRAINT "UserSubscriptionBundle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSubscriptionBundle" ADD CONSTRAINT "UserSubscriptionBundle_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "SubscriptionBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionBundleRedemption" ADD CONSTRAINT "SubscriptionBundleRedemption_userSubscriptionBundleId_fkey" FOREIGN KEY ("userSubscriptionBundleId") REFERENCES "UserSubscriptionBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionBundleRedemption" ADD CONSTRAINT "SubscriptionBundleRedemption_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "SubscriptionBundleParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionBundleRedemption" ADD CONSTRAINT "SubscriptionBundleRedemption_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionBundleRedemption" ADD CONSTRAINT "SubscriptionBundleRedemption_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
