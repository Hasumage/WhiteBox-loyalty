ALTER TABLE "CompanyBillingAccount"
  ADD COLUMN "paymentMethodProvider" "PaymentProvider",
  ADD COLUMN "paymentMethodEncrypted" BYTEA,
  ADD COLUMN "paymentMethodIv" TEXT,
  ADD COLUMN "paymentMethodTag" TEXT,
  ADD COLUMN "paymentMethodTitle" TEXT,
  ADD COLUMN "paymentMethodCardLast4" TEXT,
  ADD COLUMN "paymentMethodCardType" TEXT,
  ADD COLUMN "paymentMethodSavedAt" TIMESTAMP(3),
  ADD COLUMN "paymentMethodDeletedAt" TIMESTAMP(3);
