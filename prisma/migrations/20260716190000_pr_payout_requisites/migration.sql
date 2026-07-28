ALTER TABLE "User"
  ADD COLUMN "prPayoutBankName" TEXT,
  ADD COLUMN "prPayoutBankCode" TEXT,
  ADD COLUMN "prPayoutPhone" TEXT,
  ADD COLUMN "prPayoutCardEncrypted" BYTEA,
  ADD COLUMN "prPayoutCardIv" TEXT,
  ADD COLUMN "prPayoutCardTag" TEXT,
  ADD COLUMN "prPayoutCardLast4" TEXT,
  ADD COLUMN "prPayoutRequisitesUpdatedAt" TIMESTAMP(3);
