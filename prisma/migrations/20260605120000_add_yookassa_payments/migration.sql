-- Add YooKassa-backed user payment records.
CREATE TYPE "PaymentProvider" AS ENUM ('YOOKASSA');
CREATE TYPE "PaymentPurpose" AS ENUM ('USER_SUBSCRIPTION', 'USER_SUBSCRIPTION_BUNDLE');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'WAITING_FOR_CAPTURE', 'SUCCEEDED', 'CANCELED', 'FAILED', 'REFUNDED');

CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'YOOKASSA',
    "purpose" "PaymentPurpose" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "description" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyId" INTEGER,
    "subscriptionId" INTEGER,
    "subscriptionBundleId" INTEGER,
    "userSubscriptionId" INTEGER,
    "userSubscriptionBundleId" INTEGER,
    "providerPaymentId" TEXT,
    "providerStatus" TEXT,
    "idempotenceKey" TEXT NOT NULL,
    "confirmationUrl" TEXT,
    "returnUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "metadata" JSONB,
    "providerPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payment_uuid_key" ON "Payment"("uuid");
CREATE UNIQUE INDEX "Payment_userSubscriptionId_key" ON "Payment"("userSubscriptionId");
CREATE UNIQUE INDEX "Payment_userSubscriptionBundleId_key" ON "Payment"("userSubscriptionBundleId");
CREATE UNIQUE INDEX "Payment_providerPaymentId_key" ON "Payment"("providerPaymentId");
CREATE UNIQUE INDEX "Payment_idempotenceKey_key" ON "Payment"("idempotenceKey");
CREATE INDEX "Payment_userId_status_createdAt_idx" ON "Payment"("userId", "status", "createdAt");
CREATE INDEX "Payment_companyId_status_createdAt_idx" ON "Payment"("companyId", "status", "createdAt");
CREATE INDEX "Payment_purpose_status_idx" ON "Payment"("purpose", "status");
CREATE INDEX "Payment_provider_status_idx" ON "Payment"("provider", "status");
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionBundleId_fkey" FOREIGN KEY ("subscriptionBundleId") REFERENCES "SubscriptionBundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userSubscriptionId_fkey" FOREIGN KEY ("userSubscriptionId") REFERENCES "UserSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userSubscriptionBundleId_fkey" FOREIGN KEY ("userSubscriptionBundleId") REFERENCES "UserSubscriptionBundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
