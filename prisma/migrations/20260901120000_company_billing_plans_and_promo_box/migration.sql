CREATE TYPE "CompanyBillingPlan" AS ENUM ('GO', 'PRO', 'MAX');

ALTER TABLE "CompanyBillingAccount"
ADD COLUMN "plan" "CompanyBillingPlan" NOT NULL DEFAULT 'PRO';

ALTER TYPE "HuntBoxType" ADD VALUE 'PROMO';
