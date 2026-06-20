-- CreateEnum
CREATE TYPE "CompanyKycAccessAction" AS ENUM ('UPSERT_FROM_VERIFICATION', 'REVEAL_DATA', 'VIEW_PHOTO', 'DELETE_PHOTO');

-- DropIndex
DROP INDEX "PromoCode_companyId_idx";

-- DropIndex
DROP INDEX "ReferralCampaign_bonusCompanyId_idx";

-- AlterTable
ALTER TABLE "Category" ALTER COLUMN "icon" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CompanyLevelRule" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CompanyLocation" ALTER COLUMN "uuid" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CompanyReferral" ALTER COLUMN "uuid" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Subscription" ALTER COLUMN "uuid" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SubscriptionBundleParticipant" ALTER COLUMN "uuid" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SubscriptionBundleRedemption" ALTER COLUMN "uuid" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "uuid" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserSubscriptionBundle" ALTER COLUMN "uuid" DROP DEFAULT;

-- CreateTable
CREATE TABLE "CompanyKycRecord" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "applicationId" INTEGER,
    "status" "CompanyVerificationStatus" NOT NULL DEFAULT 'APPROVED',
    "employmentType" "CompanyEmploymentType",
    "identityVerificationMode" "IdentityVerificationMode" NOT NULL DEFAULT 'FULL',
    "legalFirstName" TEXT,
    "legalMiddleName" TEXT,
    "legalLastName" TEXT,
    "birthDate" TIMESTAMP(3),
    "legalFullName" TEXT,
    "legalInn" TEXT,
    "legalOgrnip" TEXT,
    "legalRegistrationRegion" TEXT,
    "passportEncryptedPayload" TEXT,
    "passportEncryptionIv" TEXT,
    "passportEncryptionTag" TEXT,
    "passportLast4" TEXT,
    "passportPhotoEncrypted" BYTEA,
    "passportPhotoEncryptionIv" TEXT,
    "passportPhotoEncryptionTag" TEXT,
    "passportPhotoMimeType" TEXT,
    "passportPhotoOriginalName" TEXT,
    "passportPhotoSize" INTEGER,
    "passportPhotoSha256" TEXT,
    "passportPhotoDeletedAt" TIMESTAMP(3),
    "passportPhotoDeletedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyKycRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyKycAccessLog" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "kycRecordId" INTEGER NOT NULL,
    "actorUserId" INTEGER,
    "action" "CompanyKycAccessAction" NOT NULL,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyKycAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyKycRecord_uuid_key" ON "CompanyKycRecord"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyKycRecord_companyId_key" ON "CompanyKycRecord"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyKycRecord_applicationId_key" ON "CompanyKycRecord"("applicationId");

-- CreateIndex
CREATE INDEX "CompanyKycRecord_status_updatedAt_idx" ON "CompanyKycRecord"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyKycAccessLog_uuid_key" ON "CompanyKycAccessLog"("uuid");

-- CreateIndex
CREATE INDEX "CompanyKycAccessLog_kycRecordId_createdAt_idx" ON "CompanyKycAccessLog"("kycRecordId", "createdAt");

-- CreateIndex
CREATE INDEX "CompanyKycAccessLog_actorUserId_createdAt_idx" ON "CompanyKycAccessLog"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "CompanyKycRecord" ADD CONSTRAINT "CompanyKycRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyKycRecord" ADD CONSTRAINT "CompanyKycRecord_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "CompanyVerificationApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyKycRecord" ADD CONSTRAINT "CompanyKycRecord_passportPhotoDeletedById_fkey" FOREIGN KEY ("passportPhotoDeletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyKycAccessLog" ADD CONSTRAINT "CompanyKycAccessLog_kycRecordId_fkey" FOREIGN KEY ("kycRecordId") REFERENCES "CompanyKycRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyKycAccessLog" ADD CONSTRAINT "CompanyKycAccessLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "SubscriptionBundleRedemption_userSubscriptionBundleId_participa" RENAME TO "SubscriptionBundleRedemption_userSubscriptionBundleId_parti_idx";

-- RenameIndex
ALTER INDEX "SubscriptionRedemption_userSubscriptionId_entitlementId_redeeme" RENAME TO "SubscriptionRedemption_userSubscriptionId_entitlementId_red_idx";
