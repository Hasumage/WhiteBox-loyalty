CREATE TYPE "ProfileStatusRarity" AS ENUM ('RARE', 'EPIC', 'LEGENDARY');

ALTER TABLE "User"
  ADD COLUMN "selectedProfileStatusId" TEXT;

CREATE TABLE "ProfileStatus" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "rarity" "ProfileStatusRarity" NOT NULL,
  "icon" TEXT NOT NULL DEFAULT 'Sparkles',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfileStatus_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserProfileStatusUnlock" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "statusId" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "unlockedById" INTEGER,
  "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "seenAt" TIMESTAMP(3),
  CONSTRAINT "UserProfileStatusUnlock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformCounter" (
  "key" TEXT NOT NULL,
  "value" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformCounter_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX "ProfileStatus_slug_key" ON "ProfileStatus"("slug");
CREATE INDEX "ProfileStatus_rarity_isActive_idx" ON "ProfileStatus"("rarity", "isActive");
CREATE UNIQUE INDEX "UserProfileStatusUnlock_userId_statusId_key" ON "UserProfileStatusUnlock"("userId", "statusId");
CREATE INDEX "UserProfileStatusUnlock_userId_seenAt_idx" ON "UserProfileStatusUnlock"("userId", "seenAt");
CREATE INDEX "UserProfileStatusUnlock_statusId_idx" ON "UserProfileStatusUnlock"("statusId");
CREATE INDEX "UserProfileStatusUnlock_unlockedById_idx" ON "UserProfileStatusUnlock"("unlockedById");

ALTER TABLE "User" ADD CONSTRAINT "User_selectedProfileStatusId_fkey" FOREIGN KEY ("selectedProfileStatusId") REFERENCES "ProfileStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserProfileStatusUnlock" ADD CONSTRAINT "UserProfileStatusUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserProfileStatusUnlock" ADD CONSTRAINT "UserProfileStatusUnlock_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "ProfileStatus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserProfileStatusUnlock" ADD CONSTRAINT "UserProfileStatusUnlock_unlockedById_fkey" FOREIGN KEY ("unlockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
