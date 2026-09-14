-- AlterEnum
ALTER TYPE "HuntCurrencyReason" ADD VALUE IF NOT EXISTS 'BATTLE_REWARD';

-- AlterTable
ALTER TABLE "HuntPlayerProfile"
  ADD COLUMN "huntTrophies" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "huntLifetimeTrophies" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "huntTrophySeasonStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "HuntBattleMatch"
  ADD COLUMN "botDisplayName" TEXT,
  ADD COLUMN "ownerPower" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "opponentPower" INTEGER,
  ADD COLUMN "matchedAt" TIMESTAMP(3),
  ADD COLUMN "ownerRewardedAt" TIMESTAMP(3),
  ADD COLUMN "opponentRewardedAt" TIMESTAMP(3),
  ADD COLUMN "ownerTrophyDelta" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "opponentTrophyDelta" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "HuntPlayerProfile_huntTrophies_idx" ON "HuntPlayerProfile"("huntTrophies");
