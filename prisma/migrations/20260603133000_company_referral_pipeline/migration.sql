CREATE TYPE "CompanyReferralPipelineStatus" AS ENUM ('LEAD', 'NEGOTIATION', 'TRIAL', 'CONNECTED', 'REVENUE_ACTIVE', 'LOST');

ALTER TABLE "CompanyReferral"
ADD COLUMN "pipelineStatus" "CompanyReferralPipelineStatus" NOT NULL DEFAULT 'CONNECTED';

CREATE INDEX "CompanyReferral_pipelineStatus_idx" ON "CompanyReferral"("pipelineStatus");