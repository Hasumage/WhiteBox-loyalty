ALTER TABLE "Company" ADD COLUMN "supportManagerId" INTEGER;
ALTER TABLE "Company" ADD COLUMN "supportManagerAssignedAt" TIMESTAMP(3);

CREATE INDEX "Company_supportManagerId_idx" ON "Company"("supportManagerId");

ALTER TABLE "Company" ADD CONSTRAINT "Company_supportManagerId_fkey" FOREIGN KEY ("supportManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "Company"
SET
  "supportManagerId" = (
    SELECT "id"
    FROM "User"
    WHERE "accountStatus" = 'ACTIVE'
      AND "role" IN ('MANAGER', 'ADMIN', 'SUPER_ADMIN')
    ORDER BY
      CASE "role"
        WHEN 'MANAGER' THEN 0
        WHEN 'ADMIN' THEN 1
        ELSE 2
      END,
      "id"
    LIMIT 1
  ),
  "supportManagerAssignedAt" = CURRENT_TIMESTAMP
WHERE "supportManagerId" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "User"
    WHERE "accountStatus" = 'ACTIVE'
      AND "role" IN ('MANAGER', 'ADMIN', 'SUPER_ADMIN')
  );
