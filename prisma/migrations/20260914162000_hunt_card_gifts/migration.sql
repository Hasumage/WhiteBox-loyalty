CREATE TYPE "HuntCardGiftStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CANCELED');

CREATE TABLE "HuntCardGift" (
  "id" TEXT NOT NULL,
  "uuid" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "speciesId" TEXT NOT NULL,
  "actorUserId" INTEGER,
  "acceptedCardId" TEXT,
  "rarity" "HuntCardRarity",
  "level" INTEGER NOT NULL DEFAULT 1,
  "note" TEXT,
  "status" "HuntCardGiftStatus" NOT NULL DEFAULT 'PENDING',
  "acceptedAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HuntCardGift_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HuntCardGift_uuid_key" ON "HuntCardGift"("uuid");
CREATE UNIQUE INDEX "HuntCardGift_acceptedCardId_key" ON "HuntCardGift"("acceptedCardId");
CREATE INDEX "HuntCardGift_userId_status_createdAt_idx" ON "HuntCardGift"("userId", "status", "createdAt");
CREATE INDEX "HuntCardGift_speciesId_idx" ON "HuntCardGift"("speciesId");
CREATE INDEX "HuntCardGift_actorUserId_createdAt_idx" ON "HuntCardGift"("actorUserId", "createdAt");

ALTER TABLE "HuntCardGift"
  ADD CONSTRAINT "HuntCardGift_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HuntCardGift"
  ADD CONSTRAINT "HuntCardGift_speciesId_fkey"
  FOREIGN KEY ("speciesId") REFERENCES "HuntCreatureSpecies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HuntCardGift"
  ADD CONSTRAINT "HuntCardGift_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HuntCardGift"
  ADD CONSTRAINT "HuntCardGift_acceptedCardId_fkey"
  FOREIGN KEY ("acceptedCardId") REFERENCES "HuntCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
