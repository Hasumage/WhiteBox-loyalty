ALTER TABLE "Company" ADD COLUMN "recommendationBoostPercent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Company" ADD COLUMN "recommendForEveryone" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Company_recommendForEveryone_recommendationBoostPercent_idx" ON "Company"("recommendForEveryone", "recommendationBoostPercent");
