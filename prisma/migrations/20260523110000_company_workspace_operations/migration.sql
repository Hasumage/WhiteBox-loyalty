-- Company workspace roles are independent from platform/admin roles.
CREATE TYPE "CompanyMemberRole" AS ENUM ('OWNER', 'MANAGER', 'CASHIER');
CREATE TYPE "SubscriptionEntitlementWindow" AS ENUM ('DAY', 'WEEK', 'MONTH', 'TERM');

CREATE TABLE "CompanyMember" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "CompanyMemberRole" NOT NULL DEFAULT 'CASHIER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyPurchase" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "processedById" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "cashbackPercent" DECIMAL(5,2) NOT NULL,
    "pointsAwarded" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyPurchase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionEntitlement" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "subscriptionId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "allowance" INTEGER NOT NULL DEFAULT 1,
    "windowValue" INTEGER NOT NULL DEFAULT 1,
    "windowUnit" "SubscriptionEntitlementWindow" NOT NULL DEFAULT 'MONTH',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionRedemption" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "userSubscriptionId" INTEGER NOT NULL,
    "entitlementId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "processedById" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyMember_uuid_key" ON "CompanyMember"("uuid");
CREATE UNIQUE INDEX "CompanyMember_companyId_userId_key" ON "CompanyMember"("companyId", "userId");
CREATE INDEX "CompanyMember_userId_isActive_idx" ON "CompanyMember"("userId", "isActive");
CREATE INDEX "CompanyMember_companyId_role_isActive_idx" ON "CompanyMember"("companyId", "role", "isActive");

CREATE UNIQUE INDEX "CompanyPurchase_uuid_key" ON "CompanyPurchase"("uuid");
CREATE INDEX "CompanyPurchase_companyId_userId_createdAt_idx" ON "CompanyPurchase"("companyId", "userId", "createdAt");
CREATE INDEX "CompanyPurchase_processedById_createdAt_idx" ON "CompanyPurchase"("processedById", "createdAt");

CREATE UNIQUE INDEX "SubscriptionEntitlement_uuid_key" ON "SubscriptionEntitlement"("uuid");
CREATE INDEX "SubscriptionEntitlement_subscriptionId_isActive_idx" ON "SubscriptionEntitlement"("subscriptionId", "isActive");

CREATE UNIQUE INDEX "SubscriptionRedemption_uuid_key" ON "SubscriptionRedemption"("uuid");
CREATE INDEX "SubscriptionRedemption_userSubscriptionId_entitlementId_redeemedAt_idx" ON "SubscriptionRedemption"("userSubscriptionId", "entitlementId", "redeemedAt");
CREATE INDEX "SubscriptionRedemption_companyId_redeemedAt_idx" ON "SubscriptionRedemption"("companyId", "redeemedAt");
CREATE INDEX "SubscriptionRedemption_processedById_redeemedAt_idx" ON "SubscriptionRedemption"("processedById", "redeemedAt");

ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyPurchase" ADD CONSTRAINT "CompanyPurchase_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyPurchase" ADD CONSTRAINT "CompanyPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyPurchase" ADD CONSTRAINT "CompanyPurchase_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionEntitlement" ADD CONSTRAINT "SubscriptionEntitlement_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionRedemption" ADD CONSTRAINT "SubscriptionRedemption_userSubscriptionId_fkey" FOREIGN KEY ("userSubscriptionId") REFERENCES "UserSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionRedemption" ADD CONSTRAINT "SubscriptionRedemption_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "SubscriptionEntitlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionRedemption" ADD CONSTRAINT "SubscriptionRedemption_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionRedemption" ADD CONSTRAINT "SubscriptionRedemption_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Every existing company owner starts as the owner in the new company workspace.
INSERT INTO "CompanyMember" ("uuid", "companyId", "userId", "role", "isActive", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || c."id"::text), c."id", c."ownerUserId", 'OWNER', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Company" c
WHERE c."ownerUserId" IS NOT NULL
ON CONFLICT ("companyId", "userId") DO NOTHING;
