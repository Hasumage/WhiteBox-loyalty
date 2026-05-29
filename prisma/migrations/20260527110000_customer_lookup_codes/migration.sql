CREATE TABLE "CustomerLookupCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerLookupCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerLookupCode_codeHash_key" ON "CustomerLookupCode"("codeHash");
CREATE INDEX "CustomerLookupCode_userId_expiresAt_idx" ON "CustomerLookupCode"("userId", "expiresAt");
CREATE INDEX "CustomerLookupCode_expiresAt_usedAt_idx" ON "CustomerLookupCode"("expiresAt", "usedAt");

ALTER TABLE "CustomerLookupCode"
ADD CONSTRAINT "CustomerLookupCode_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
