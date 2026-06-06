ALTER TYPE "PermissionScope" ADD VALUE IF NOT EXISTS 'PR';

CREATE TYPE "CompanyReferralStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

ALTER TABLE "Company"
  ADD COLUMN "platformCommissionPercent" DECIMAL(5,2) NOT NULL DEFAULT 12.00,
  ADD COLUMN "platformMonthlyFee" DECIMAL(10,2) NOT NULL DEFAULT 4990.00,
  ADD COLUMN "commissionFreeMonthlyTurnover" DECIMAL(12,2) NOT NULL DEFAULT 50000.00,
  ADD COLUMN "monthlyFeeOverride" DECIMAL(10,2),
  ADD COLUMN "monthlyFeeOverrideEndsAt" TIMESTAMP(3),
  ADD COLUMN "commissionGraceEndsAt" TIMESTAMP(3);

CREATE TABLE "CompanyReferral" (
  "id" SERIAL NOT NULL,
  "uuid" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "companyId" INTEGER NOT NULL,
  "referrerUserId" INTEGER NOT NULL,
  "status" "CompanyReferralStatus" NOT NULL DEFAULT 'ACTIVE',
  "referralPercent" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  "source" TEXT NOT NULL DEFAULT 'PR',
  "notes" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CompanyReferral_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyReferral_uuid_key" ON "CompanyReferral"("uuid");
CREATE UNIQUE INDEX "CompanyReferral_companyId_key" ON "CompanyReferral"("companyId");
CREATE INDEX "CompanyReferral_referrerUserId_status_idx" ON "CompanyReferral"("referrerUserId", "status");
CREATE INDEX "CompanyReferral_status_startedAt_idx" ON "CompanyReferral"("status", "startedAt");

ALTER TABLE "CompanyReferral"
  ADD CONSTRAINT "CompanyReferral_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompanyReferral"
  ADD CONSTRAINT "CompanyReferral_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
