CREATE TYPE "EmailMessageStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
CREATE TYPE "EmailMessageTargetType" AS ENUM ('USER', 'COMPANY', 'DIRECT');
CREATE TYPE "EmailVerificationPurpose" AS ENUM ('REGISTRATION');
CREATE TYPE "EmailVerificationStatus" AS ENUM ('PENDING', 'CONSUMED', 'EXPIRED');

CREATE TABLE "EmailMessage" (
  "id" TEXT NOT NULL,
  "uuid" TEXT NOT NULL,
  "targetType" "EmailMessageTargetType" NOT NULL DEFAULT 'DIRECT',
  "toEmail" TEXT NOT NULL,
  "toName" TEXT,
  "subject" TEXT NOT NULL,
  "bodyText" TEXT NOT NULL,
  "bodyHtml" TEXT,
  "status" "EmailMessageStatus" NOT NULL DEFAULT 'PENDING',
  "provider" TEXT,
  "error" TEXT,
  "sentByUserId" INTEGER,
  "targetUserId" INTEGER,
  "targetCompanyId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailVerificationCode" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "normalizedEmail" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'CLIENT',
  "codeHash" TEXT NOT NULL,
  "purpose" "EmailVerificationPurpose" NOT NULL DEFAULT 'REGISTRATION',
  "status" "EmailVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailVerificationCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailMessage_uuid_key" ON "EmailMessage"("uuid");
CREATE INDEX "EmailMessage_status_createdAt_idx" ON "EmailMessage"("status", "createdAt");
CREATE INDEX "EmailMessage_toEmail_idx" ON "EmailMessage"("toEmail");
CREATE INDEX "EmailMessage_sentByUserId_createdAt_idx" ON "EmailMessage"("sentByUserId", "createdAt");
CREATE INDEX "EmailMessage_targetUserId_createdAt_idx" ON "EmailMessage"("targetUserId", "createdAt");
CREATE INDEX "EmailMessage_targetCompanyId_createdAt_idx" ON "EmailMessage"("targetCompanyId", "createdAt");
CREATE INDEX "EmailVerificationCode_normalizedEmail_status_expiresAt_idx" ON "EmailVerificationCode"("normalizedEmail", "status", "expiresAt");
CREATE INDEX "EmailVerificationCode_expiresAt_idx" ON "EmailVerificationCode"("expiresAt");

ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_targetCompanyId_fkey" FOREIGN KEY ("targetCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
