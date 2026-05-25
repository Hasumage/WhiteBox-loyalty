CREATE TYPE "AdminTaskSource" AS ENUM ('AUDIT', 'COMPANY_VERIFICATION', 'FINANCE');
CREATE TYPE "AdminTaskPriority" AS ENUM ('NORMAL', 'HIGH', 'CRITICAL');
CREATE TYPE "AdminTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED');

CREATE TABLE "AdminTask" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "source" "AdminTaskSource" NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "AdminTaskPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "AdminTaskStatus" NOT NULL DEFAULT 'OPEN',
    "targetUrl" TEXT,
    "targetLabel" TEXT,
    "assignedToId" INTEGER,
    "resolvedById" INTEGER,
    "assignedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminTask_uuid_key" ON "AdminTask"("uuid");
CREATE UNIQUE INDEX "AdminTask_sourceKey_key" ON "AdminTask"("sourceKey");
CREATE INDEX "AdminTask_status_priority_createdAt_idx" ON "AdminTask"("status", "priority", "createdAt");
CREATE INDEX "AdminTask_source_status_createdAt_idx" ON "AdminTask"("source", "status", "createdAt");
CREATE INDEX "AdminTask_assignedToId_status_idx" ON "AdminTask"("assignedToId", "status");

ALTER TABLE "AdminTask" ADD CONSTRAINT "AdminTask_assignedToId_fkey"
FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AdminTask" ADD CONSTRAINT "AdminTask_resolvedById_fkey"
FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
