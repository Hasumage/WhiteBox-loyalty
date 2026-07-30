CREATE TYPE "CompanySocialLinkKind" AS ENUM ('WEBSITE', 'VK', 'MAX', 'OTHER');

CREATE TABLE "CompanySocialLink" (
  "id" TEXT NOT NULL,
  "companyId" INTEGER NOT NULL,
  "kind" "CompanySocialLinkKind" NOT NULL DEFAULT 'OTHER',
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CompanySocialLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompanySocialLink_companyId_isActive_sortOrder_idx" ON "CompanySocialLink"("companyId", "isActive", "sortOrder");

ALTER TABLE "CompanySocialLink" ADD CONSTRAINT "CompanySocialLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
