-- CreateEnum
CREATE TYPE "HuntBattleMode" AS ENUM ('TRAINING', 'PVP_RANDOM', 'PVP_PRIVATE');

-- CreateEnum
CREATE TYPE "HuntBattleStatus" AS ENUM ('WAITING', 'ACTIVE', 'FINISHED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "HuntBattleMatch" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "mode" "HuntBattleMode" NOT NULL DEFAULT 'TRAINING',
    "status" "HuntBattleStatus" NOT NULL DEFAULT 'ACTIVE',
    "ownerId" INTEGER,
    "opponentUserId" INTEGER,
    "code" TEXT,
    "ownerTeamUuids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "opponentTeamUuids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "botSpeciesIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "battleState" JSONB NOT NULL,
    "pendingOrders" JSONB,
    "lastFrames" JSONB,
    "seed" TEXT NOT NULL,
    "turnNumber" INTEGER NOT NULL DEFAULT 1,
    "turnDeadlineAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HuntBattleMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HuntBattleMatch_uuid_key" ON "HuntBattleMatch"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "HuntBattleMatch_code_key" ON "HuntBattleMatch"("code");

-- CreateIndex
CREATE INDEX "HuntBattleMatch_ownerId_status_updatedAt_idx" ON "HuntBattleMatch"("ownerId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "HuntBattleMatch_opponentUserId_status_updatedAt_idx" ON "HuntBattleMatch"("opponentUserId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "HuntBattleMatch_mode_status_updatedAt_idx" ON "HuntBattleMatch"("mode", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "HuntBattleMatch_expiresAt_idx" ON "HuntBattleMatch"("expiresAt");

-- AddForeignKey
ALTER TABLE "HuntBattleMatch" ADD CONSTRAINT "HuntBattleMatch_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuntBattleMatch" ADD CONSTRAINT "HuntBattleMatch_opponentUserId_fkey" FOREIGN KEY ("opponentUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
