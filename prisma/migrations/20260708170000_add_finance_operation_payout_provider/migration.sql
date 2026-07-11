ALTER TABLE "FinanceOperation"
  ADD COLUMN "payoutProvider" "PaymentProvider",
  ADD COLUMN "providerPayoutId" TEXT,
  ADD COLUMN "providerPayoutStatus" TEXT,
  ADD COLUMN "providerIdempotenceKey" TEXT,
  ADD COLUMN "providerPayload" JSONB,
  ADD COLUMN "payoutDestinationType" TEXT,
  ADD COLUMN "payoutDestinationLabel" TEXT,
  ADD COLUMN "payoutProviderRequestedAt" TIMESTAMP(3),
  ADD COLUMN "payoutProviderSyncedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "FinanceOperation_providerPayoutId_key" ON "FinanceOperation"("providerPayoutId");
CREATE UNIQUE INDEX "FinanceOperation_providerIdempotenceKey_key" ON "FinanceOperation"("providerIdempotenceKey");
CREATE INDEX "FinanceOperation_payoutProvider_providerPayoutStatus_idx" ON "FinanceOperation"("payoutProvider", "providerPayoutStatus");
