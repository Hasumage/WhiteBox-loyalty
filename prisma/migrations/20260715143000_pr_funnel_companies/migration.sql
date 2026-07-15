CREATE TABLE "PrFunnelCompany" (
  "id" SERIAL NOT NULL,
  "uuid" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "ownerUserId" INTEGER NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "description" TEXT,
  "status" "CompanyReferralPipelineStatus" NOT NULL DEFAULT 'LEAD',
  "source" VARCHAR(120),
  "contact" VARCHAR(160),
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PrFunnelCompany_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrFunnelCompany_uuid_key" ON "PrFunnelCompany"("uuid");
CREATE INDEX "PrFunnelCompany_ownerUserId_status_position_idx" ON "PrFunnelCompany"("ownerUserId", "status", "position");
CREATE INDEX "PrFunnelCompany_ownerUserId_updatedAt_idx" ON "PrFunnelCompany"("ownerUserId", "updatedAt");

ALTER TABLE "PrFunnelCompany"
  ADD CONSTRAINT "PrFunnelCompany_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
