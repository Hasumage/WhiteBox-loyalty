CREATE TYPE "HuntCardUpgradeStatus" AS ENUM ('PENDING_BONUS', 'COMPLETED');

CREATE TABLE "HuntCardUpgrade" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "cardId" TEXT NOT NULL,
    "levelFrom" INTEGER NOT NULL,
    "levelTo" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL,
    "statsBefore" JSONB NOT NULL,
    "baseDeltas" JSONB NOT NULL,
    "statsAfterBase" JSONB NOT NULL,
    "bonusStat" TEXT,
    "bonusDelta" INTEGER,
    "statsAfterBonus" JSONB,
    "status" "HuntCardUpgradeStatus" NOT NULL DEFAULT 'PENDING_BONUS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bonusAppliedAt" TIMESTAMP(3),

    CONSTRAINT "HuntCardUpgrade_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HuntCardUpgrade_uuid_key" ON "HuntCardUpgrade"("uuid");
CREATE INDEX "HuntCardUpgrade_userId_status_createdAt_idx" ON "HuntCardUpgrade"("userId", "status", "createdAt");
CREATE INDEX "HuntCardUpgrade_cardId_createdAt_idx" ON "HuntCardUpgrade"("cardId", "createdAt");

ALTER TABLE "HuntCardUpgrade" ADD CONSTRAINT "HuntCardUpgrade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HuntCardUpgrade" ADD CONSTRAINT "HuntCardUpgrade_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "HuntCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
