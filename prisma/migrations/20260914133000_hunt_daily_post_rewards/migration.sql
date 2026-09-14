ALTER TYPE "HuntCurrencyReason" ADD VALUE IF NOT EXISTS 'POST_DAILY_LIKES';

ALTER TABLE "HuntPost"
ADD COLUMN "syntheticLikeCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "HuntPostDailyReward" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "postId" TEXT NOT NULL,
  "rewardDate" TIMESTAMP(3) NOT NULL,
  "organicLikes" INTEGER NOT NULL DEFAULT 0,
  "bonusLikes" INTEGER NOT NULL DEFAULT 0,
  "totalLikes" INTEGER NOT NULL DEFAULT 0,
  "rewardAmount" INTEGER NOT NULL DEFAULT 0,
  "notifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "HuntPostDailyReward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HuntPostDailyReward_postId_rewardDate_key" ON "HuntPostDailyReward"("postId", "rewardDate");
CREATE INDEX "HuntPostDailyReward_userId_rewardDate_notifiedAt_idx" ON "HuntPostDailyReward"("userId", "rewardDate", "notifiedAt");
CREATE INDEX "HuntPostDailyReward_rewardDate_createdAt_idx" ON "HuntPostDailyReward"("rewardDate", "createdAt");

ALTER TABLE "HuntPostDailyReward"
ADD CONSTRAINT "HuntPostDailyReward_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HuntPostDailyReward"
ADD CONSTRAINT "HuntPostDailyReward_postId_fkey"
FOREIGN KEY ("postId") REFERENCES "HuntPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
