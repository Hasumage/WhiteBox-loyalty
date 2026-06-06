CREATE TYPE "CompanyBillingStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED');
CREATE TYPE "CompanyBillingInvoiceStatus" AS ENUM ('OPEN', 'PAID', 'WAIVED', 'CANCELED');

CREATE TABLE "CompanyBillingAccount" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "status" "CompanyBillingStatus" NOT NULL DEFAULT 'TRIAL',
    "trialStartedAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodStartsAt" TIMESTAMP(3) NOT NULL,
    "currentPeriodEndsAt" TIMESTAMP(3) NOT NULL,
    "appliedPromoCodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanyBillingAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyBillingInvoice" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "status" "CompanyBillingInvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "periodStartsAt" TIMESTAMP(3) NOT NULL,
    "periodEndsAt" TIMESTAMP(3) NOT NULL,
    "baseFee" DECIMAL(12,2) NOT NULL,
    "promoDiscountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "promoDiscountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "commissionCreditAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amountDue" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanyBillingInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyBillingPromoCode" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "discountPercent" DECIMAL(5,2) NOT NULL,
    "maxRedemptions" INTEGER,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanyBillingPromoCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyBillingPromoRedemption" (
    "id" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompanyBillingPromoRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyBillingAccount_companyId_key" ON "CompanyBillingAccount"("companyId");
CREATE INDEX "CompanyBillingAccount_status_currentPeriodEndsAt_idx" ON "CompanyBillingAccount"("status", "currentPeriodEndsAt");
CREATE INDEX "CompanyBillingAccount_appliedPromoCodeId_idx" ON "CompanyBillingAccount"("appliedPromoCodeId");
CREATE UNIQUE INDEX "CompanyBillingInvoice_uuid_key" ON "CompanyBillingInvoice"("uuid");
CREATE INDEX "CompanyBillingInvoice_companyId_status_createdAt_idx" ON "CompanyBillingInvoice"("companyId", "status", "createdAt");
CREATE INDEX "CompanyBillingInvoice_status_periodEndsAt_idx" ON "CompanyBillingInvoice"("status", "periodEndsAt");
CREATE UNIQUE INDEX "CompanyBillingInvoice_companyId_periodStartsAt_key" ON "CompanyBillingInvoice"("companyId", "periodStartsAt");
CREATE UNIQUE INDEX "CompanyBillingPromoCode_uuid_key" ON "CompanyBillingPromoCode"("uuid");
CREATE UNIQUE INDEX "CompanyBillingPromoCode_code_key" ON "CompanyBillingPromoCode"("code");
CREATE INDEX "CompanyBillingPromoCode_isActive_expiresAt_idx" ON "CompanyBillingPromoCode"("isActive", "expiresAt");
CREATE INDEX "CompanyBillingPromoCode_createdByUserId_createdAt_idx" ON "CompanyBillingPromoCode"("createdByUserId", "createdAt");
CREATE INDEX "CompanyBillingPromoRedemption_companyId_redeemedAt_idx" ON "CompanyBillingPromoRedemption"("companyId", "redeemedAt");
CREATE UNIQUE INDEX "CompanyBillingPromoRedemption_promoCodeId_companyId_key" ON "CompanyBillingPromoRedemption"("promoCodeId", "companyId");

ALTER TABLE "CompanyBillingAccount" ADD CONSTRAINT "CompanyBillingAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyBillingAccount" ADD CONSTRAINT "CompanyBillingAccount_appliedPromoCodeId_fkey" FOREIGN KEY ("appliedPromoCodeId") REFERENCES "CompanyBillingPromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanyBillingInvoice" ADD CONSTRAINT "CompanyBillingInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyBillingPromoCode" ADD CONSTRAINT "CompanyBillingPromoCode_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyBillingPromoRedemption" ADD CONSTRAINT "CompanyBillingPromoRedemption_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "CompanyBillingPromoCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyBillingPromoRedemption" ADD CONSTRAINT "CompanyBillingPromoRedemption_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
