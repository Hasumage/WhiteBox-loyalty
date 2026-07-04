ALTER TABLE "UserCompany"
ADD COLUMN "isFavorite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "favoritedAt" TIMESTAMP(3);

CREATE INDEX "UserCompany_userId_isFavorite_favoritedAt_idx"
ON "UserCompany"("userId", "isFavorite", "favoritedAt");
