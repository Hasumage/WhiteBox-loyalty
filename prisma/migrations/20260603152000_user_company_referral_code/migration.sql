ALTER TABLE "User" ADD COLUMN "companyReferralCode" TEXT;

CREATE UNIQUE INDEX "User_companyReferralCode_key" ON "User"("companyReferralCode");
