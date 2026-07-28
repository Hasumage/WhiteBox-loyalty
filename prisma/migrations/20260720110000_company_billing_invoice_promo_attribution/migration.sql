ALTER TABLE "CompanyBillingInvoice"
ADD COLUMN IF NOT EXISTS "appliedPromoCodeId" TEXT;

UPDATE "CompanyBillingInvoice" AS invoice
SET "appliedPromoCodeId" = account."appliedPromoCodeId"
FROM "CompanyBillingAccount" AS account
WHERE invoice."companyId" = account."companyId"
  AND invoice."appliedPromoCodeId" IS NULL
  AND account."appliedPromoCodeId" IS NOT NULL
  AND invoice."promoDiscountPercent" > 0;

DO $$
BEGIN
  ALTER TABLE "CompanyBillingInvoice"
  ADD CONSTRAINT "CompanyBillingInvoice_appliedPromoCodeId_fkey"
  FOREIGN KEY ("appliedPromoCodeId") REFERENCES "CompanyBillingPromoCode"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "CompanyBillingInvoice_appliedPromoCodeId_idx"
ON "CompanyBillingInvoice"("appliedPromoCodeId");
